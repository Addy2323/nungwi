import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { all, closeDb, id, now, one, run } from '../lib/server/db'
import { publicUser, type Actor } from '../lib/server/auth'
import { saveProduct, deleteProduct, importProducts } from '../lib/server/platform'
import { searchProducts, saveCategory } from '../lib/server/product-catalogue'
import { receiveStock, catalogue } from '../lib/server/orders'
import { NO_EXPIRY } from '../lib/product-workflow'
import { parseProductCsv, PRODUCT_CSV_HEADER } from '../lib/product-csv'

try { process.loadEnvFile('.env.local') } catch {}
const schema='catalogue_test_'+id().replaceAll('-','')
const url=new URL(process.env.DATABASE_ADMIN_URL!)
url.searchParams.delete('schema')
const admin=new Client({connectionString:url.toString(),connectionTimeoutMillis:5000})
url.searchParams.set('schema',schema);process.env.DATABASE_URL=url.toString()
let created=false;let actor:Actor;let customer:Actor
before(async()=>{
  await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);created=true
  await admin.query(`SET search_path TO ${schema},pg_catalog`)
  for(const version of ['001_postgres','002_money_capacity','007_product_workflow'])await admin.query(readFileSync(`migrations/${version}.sql`,'utf8'))
  for(const role of ['admin','customer']){const key=id();await run('INSERT INTO users(id,email,name,role,created_at) VALUES (?,?,?,?,?)',key,`${key}@test.invalid`,role,role,now());const user=publicUser((await one('SELECT * FROM users WHERE id=?',key))!);if(role==='admin')actor=user;else customer=user}
})
after(async()=>{await closeDb();if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()})

test('database search supports names, brand, SKU and barcode with bounded pages',async()=>{
  const key=await saveProduct(actor,{name:'Coca-Cola 500ml',brand:'Coke',category:'Soft drinks',barcode:'TEST-123',price:1500})
  const product=(await one('SELECT * FROM products WHERE id=?',key))!
  assert.ok(product.sku.startsWith('PRD-'))
  for(const q of ['coca cola','COCA-COLA','500ml','Coke','TEST-123',product.sku])assert.equal((await searchProducts(actor,{q})).items[0].id,key)
  await saveProduct(actor,{name:'Second product',category:'Other'})
  const page=await searchProducts(actor,{limit:'1'});assert.equal(page.items.length,1);assert.equal(page.hasMore,true)
  await assert.rejects(searchProducts(customer,{}))
  await assert.rejects(saveProduct(actor,{name:'Duplicate',category:'Other',barcode:'TEST-123'}),/barcode belongs/)
})

test('receipt reuses product ID, preserves default cost, and permits no expiry only when configured',async()=>{
  const key=await saveProduct(actor,{name:'Non-expiring item',category:'General',unit:'piece',cost:100,track_expiry:false})
  await receiveStock(actor,{product_id:key,label:'Supplier 01',quantity:24,cost:110,reason:'Delivery'})
  assert.equal((await one('SELECT cost FROM products WHERE id=?',key))!.cost,100)
  assert.equal((await one('SELECT expires_at FROM batches WHERE product_id=?',key))!.expires_at,NO_EXPIRY)
  assert.equal((await catalogue()).find(p=>p.id===key)!.available,24)
  const expiring=await saveProduct(actor,{name:'Fresh',category:'Food'})
  await assert.rejects(receiveStock(actor,{product_id:expiring,label:'Fresh',quantity:1,cost:100,reason:'Delivery'}),/expiry date/)
  await deleteProduct(actor,key)
  assert.equal((await one('SELECT remaining FROM batches WHERE product_id=?',key))!.remaining,24)
})

test('categories can be renamed and archived without removing products',async()=>{
  const category=await saveCategory(actor,{name:'Household'})
  const key=await saveProduct(actor,{name:'Soap',category:'Household'})
  await saveCategory(actor,{id:category.id,name:'Household goods',active:false})
  assert.equal((await one('SELECT category FROM products WHERE id=?',key))!.category,'Household goods')
  await assert.rejects(saveProduct(actor,{name:'New soap',category:'Household goods'}),/active category/)
})

test('CSV preview does not write and import rejects duplicate rows atomically',async()=>{
  const rows=parseProductCsv(PRODUCT_CSV_HEADER+'\n"Soap, large",General,Brand,,piece,100,200\n')
  assert.equal(rows[0].name,'Soap, large')
  assert.equal((await importProducts(actor,{rows})).errors.length,0)
  assert.equal((await all("SELECT id FROM products WHERE name='Soap, large'")).length,0)
  assert.equal((await importProducts(actor,{rows,confirm:true})).count,1)
  assert.ok((await importProducts(actor,{rows,confirm:true})).errors.length)
  assert.throws(()=>parseProductCsv(PRODUCT_CSV_HEADER+'\n"unclosed'),/quotation/)
})
