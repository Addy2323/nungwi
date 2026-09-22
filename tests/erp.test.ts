import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { all, closeDb, id, now, one, run } from '../lib/server/db'
import { publicUser, type Actor } from '../lib/server/auth'
import { agingBucket, erpAction, erpData, financeTransactions } from '../lib/server/erp'
import { placeOrder, recordPayment } from '../lib/server/orders'

try { process.loadEnvFile('.env.local') } catch {}
if (!process.env.DATABASE_ADMIN_URL) throw new Error('ERP integration tests require DATABASE_ADMIN_URL')
const schema = 'nungwi_erp_test_' + id().replaceAll('-', '')
const url = new URL(process.env.DATABASE_ADMIN_URL)
url.searchParams.delete('schema')
const client = new Client({ connectionString: url.toString() })
url.searchParams.set('schema', schema)
process.env.DATABASE_URL = url.toString()
let admin: Actor, customer: Actor, product: string, supplier: string
let created = false
const expiry = new Date(Date.now() + 365 * 86400000).toISOString()
async function actor(role: string) {
  const key = id()
  await run('INSERT INTO users(id,email,name,role,created_at) VALUES (?,?,?,?,?)', key, `${key}@example.test`, role, role, now())
  return publicUser((await one('SELECT * FROM users WHERE id=?', key))!)
}
async function purchase(quantity = 10) {
  return (await erpAction(admin, 'purchase.create', { supplier_id: supplier, items: [{ product_id: product, quantity, unit_cost: 100 }] })).id
}
async function receive(purchaseId: string, quantity: number, reference = id()) {
  const item = (await one('SELECT id FROM purchase_items WHERE purchase_id=?', purchaseId))!
  return erpAction(admin, 'purchase.receive', { item_id: item.id, quantity, reference, expires_at: expiry })
}
before(async () => {
  await client.connect()
  await client.query(`CREATE SCHEMA ${schema}`); created = true
  await client.query(`SET search_path TO ${schema},pg_catalog`)
  for (const migration of ['001_postgres','002_money_capacity','005_erp_foundation']) await client.query(readFileSync(`migrations/${migration}.sql`, 'utf8'))
  admin = await actor('admin'); customer = await actor('customer')
  product = id()
  await run('INSERT INTO products(id,name,category,price,sku,created_at) VALUES (?,?,?,?,?,?)', product, 'ERP drink', 'Beer', 200, id(), now())
  supplier = (await erpAction(admin, 'supplier.save', { name:'Test supplier', payment_days:30 })).id
})
after(async () => {
  await closeDb()
  if (created) await client.query(`DROP SCHEMA ${schema} CASCADE`)
  await client.end()
})

describe('ERP purchasing controls', () => {
  it('rejects access outside the admin role', async () => {
    await assert.rejects(erpData(customer), /permission/)
    await assert.rejects(erpAction(customer, 'supplier.save', { name:'Denied' }), /permission/)
  })
  it('requires approval and preserves stock on invalid and repeated receipts', async () => {
    const key = await purchase()
    await assert.rejects(receive(key, 3), /Approve/)
    await erpAction(admin, 'purchase.approve', { id:key })
    const reference = id()
    await receive(key, 3, reference)
    assert.equal((await one('SELECT status FROM purchase_orders WHERE id=?', key))!.status, 'Partially received')
    const before = (await one('SELECT SUM(remaining) AS n FROM batches'))!.n
    await assert.rejects(receive(key, 3, reference), /duplicate key/)
    assert.equal((await one('SELECT SUM(remaining) AS n FROM batches'))!.n, before)
    assert.equal((await one('SELECT received FROM purchase_items WHERE purchase_id=?', key))!.received, 3)
    await assert.rejects(receive(key, 8), /remaining/)
    await assert.rejects(erpAction(admin, 'purchase.cancel', { id:key }), /unreceived/)
    await assert.rejects(erpAction(admin, 'bill.create', { purchase_id:key,reference:id() }), /all ordered stock/)
    await receive(key, 7)
    assert.equal((await one('SELECT status FROM purchase_orders WHERE id=?', key))!.status, 'Received')
  })
  it('serializes concurrent receipts to prevent over-receiving', async () => {
    const key = await purchase(5)
    await erpAction(admin, 'purchase.approve', { id:key })
    const results = await Promise.allSettled([receive(key,4),receive(key,4)])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal((await one('SELECT received FROM purchase_items WHERE purchase_id=?', key))!.received, 4)
  })
  it('rolls back purchases containing inactive products and rejects duplicate lines', async () => {
    const before = (await one('SELECT COUNT(*) AS n FROM purchase_orders'))!.n
    await assert.rejects(erpAction(admin,'purchase.create',{ supplier_id:supplier, items:[{product_id:product,quantity:1,unit_cost:100},{product_id:id(),quantity:1,unit_cost:100}] }), /active products/)
    assert.equal((await one('SELECT COUNT(*) AS n FROM purchase_orders'))!.n,before)
    await assert.rejects(erpAction(admin,'purchase.create',{ supplier_id:supplier, items:[{product_id:product,quantity:1,unit_cost:100},{product_id:product,quantity:2,unit_cost:100}] }), /one line/)
  })
  it('freezes cancelled orders and rejects expired receipts', async () => {
    const key = await purchase()
    await erpAction(admin,'purchase.cancel',{id:key})
    await assert.rejects(erpAction(admin,'purchase.approve',{id:key}), /draft/)
    await assert.rejects(receive(key,1), /Approve/)
    const next = await purchase()
    await erpAction(admin,'purchase.approve',{id:next})
    const item = (await one('SELECT id FROM purchase_items WHERE purchase_id=?',next))!
    await assert.rejects(erpAction(admin,'purchase.receive',{item_id:item.id,quantity:1,reference:id(),expires_at:'2020-01-01T00:00:00Z'}), /future expiry/)
  })
})

describe('ERP balances and reconciliation', () => {
  it('creates bills from purchase costs, prevents duplicate billing and concurrent overpayment', async () => {
    const key = await purchase(10)
    await erpAction(admin,'purchase.approve',{id:key}); await receive(key,10)
    const reference = id()
    const bill = await erpAction(admin,'bill.create',{purchase_id:key,reference,due_date:'2026-01-01'})
    assert.equal((await one('SELECT amount FROM supplier_bills WHERE id=?',bill.id))!.amount,1000)
    await assert.rejects(erpAction(admin,'bill.create',{purchase_id:key,reference}), /already recorded/)
    const results = await Promise.allSettled([600,600].map(amount => erpAction(admin,'bill.pay',{bill_id:bill.id,amount,method:'bank_transfer',reference:id()})))
    assert.equal(results.filter(r => r.status === 'fulfilled').length,1)
    assert.equal((await erpData(admin)).bills.find(b => b.id === bill.id)!.balance,400)
    await erpAction(admin,'bill.pay',{bill_id:bill.id,amount:400,method:'cash',reference:id()})
    assert.equal((await erpData(admin)).bills.find(b => b.id === bill.id)!.aging,'Paid')
    const transaction = (await financeTransactions(admin)).find(t => t.source === 'supplier_payment')!
    assert.ok(transaction.amount < 0)
    await erpAction(admin,'finance.reconcile',{source:transaction.source,source_id:transaction.id,statement_reference:'Bank line 1'})
    assert.equal((await financeTransactions(admin)).find(t => t.id === transaction.id)!.statement_reference,'Bank line 1')
    await assert.rejects(erpAction(admin,'finance.reconcile',{source:transaction.source,source_id:transaction.id,statement_reference:'Bank line 2'}),/duplicate key/)
    await assert.rejects(erpAction(admin,'finance.reconcile',{source:'customer_payment',source_id:id(),statement_reference:'Invalid'}),/not found/)
  })
  it('uses customer terms and follows existing payments without double-recording revenue', async () => {
    await erpAction(admin,'terms.save',{user_id:customer.id,payment_days:30})
    const order = await placeOrder(customer,{items:[{product_id:product,quantity:1}],recipient:'ERP customer',phone:'+255700000000',address:'Nungwi',payment_method:'cash',idempotency_key:id()})
    const invoice = await erpAction(admin,'invoice.create',{order_id:order.id})
    const getInvoice = async () => (await erpData(admin)).invoices.find(i => i.id === invoice.id)!
    assert.equal((await getInvoice()).due_date,new Date(Date.now()+30*86400000).toISOString().slice(0,10))
    await assert.rejects(erpAction(admin,'invoice.create',{order_id:order.id}),/duplicate key/)
    await recordPayment(admin,order.id,{amount:100,kind:'payment',method:'cash',reference:id()})
    assert.equal((await getInvoice()).balance,order.total-100)
    await recordPayment(admin,order.id,{amount:50,kind:'refund',method:'cash',reference:id()})
    assert.equal((await getInvoice()).balance,order.total-50)
    assert.equal((await all('SELECT * FROM payments WHERE order_id=?',order.id)).length,2)
    await run("UPDATE orders SET status='Cancelled' WHERE id=?",order.id)
    assert.equal((await getInvoice()).balance,0)
  })
  it('validates real calendar dates and aging boundaries', async () => {
    await assert.rejects(erpAction(admin,'invoice.create',{order_id:id(),due_date:'2026-02-30'}),/calendar date/)
    assert.equal(agingBucket('2026-01-01',100,'2026-01-01'),'Current')
    assert.equal(agingBucket('2026-01-01',100,'2026-01-31'),'1–30 days')
    assert.equal(agingBucket('2026-01-01',100,'2026-02-01'),'31–60 days')
    assert.equal(agingBucket('2026-01-01',0,'2026-05-01'),'Paid')
    assert.equal(agingBucket('2026-01-01',100,'2026-05-01'),'90+ days')
  })
})
