import { z } from 'zod'
import { all, atomic, audit, id, now, one, run, setting, type Row } from './db'
import { AppError, hash, passwordHash, permit, publicUser, staff, tokenFor, type Actor } from './auth'
import { catalogue, listOrders, paymentTotals } from './orders'
import { driverInput, hotelInput, invitationInput, productInput, promotionInput,unitsInput } from './validation'
import { deliveryConfigured, queue } from './notifications'

export function publicCatalogue(actor:Actor|null):Row[] {
  return catalogue().map(({cost,hotel_price,...product})=>({...product,price:actor?.hotel_id&&hotel_price!==null?hotel_price:product.price,units:JSON.parse(product.units).map(({hotel_price,...unit}:Row)=>({...unit,price:actor?.hotel_id&&hotel_price!==null?hotel_price:unit.price}))}))
}
export function saveProduct(actor:Actor,raw:unknown) {
  permit(actor,['admin','stock'])
  const input=productInput.parse(raw);const productId=input.id||id()
  const units=unitsInput.parse((raw as Row).units)
  if(new Set([input.unit,...units.map(unit=>unit.unit)]).size!==units.length+1)throw new AppError('Selling unit names must be unique.')
  return atomic(()=> {
    const old=one('SELECT * FROM products WHERE id=?',productId)
    if(old && old.unit_size!==input.unit_size && one('SELECT id FROM batches WHERE product_id=? AND (remaining>0 OR reserved>0)',productId)) throw new AppError('Archive this product and create a new SKU to change its unit conversion while stock exists.')
    if(old && old.active && !input.active && one("SELECT a.id FROM allocations a JOIN order_items i ON i.id=a.item_id WHERE i.product_id=? AND a.state='reserved'",productId)) throw new AppError('Resolve reserved orders before archiving this product.')
    run(`INSERT INTO products (id,name,brand,category,description,image,volume,unit,unit_size,price,hotel_price,cost,sku,reorder_level,min_qty,deposit,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,description=excluded.description,image=excluded.image,volume=excluded.volume,unit=excluded.unit,unit_size=excluded.unit_size,price=excluded.price,hotel_price=excluded.hotel_price,cost=excluded.cost,sku=excluded.sku,reorder_level=excluded.reorder_level,min_qty=excluded.min_qty,deposit=excluded.deposit,active=excluded.active`,productId,input.name,input.brand,input.category,input.description,input.image,input.volume,input.unit,input.unit_size,input.price,input.hotel_price,input.cost,input.sku,input.reorder_level,input.min_qty,input.deposit,Number(input.active),old?.created_at||now())
    run('UPDATE products SET units=? WHERE id=?',JSON.stringify(units),productId)
    audit(actor.id,'product.saved','product',productId,{before:old||null,after:{...input,units}});return productId
  })
}
export function saveHotel(actor:Actor,raw:unknown) {
  permit(actor,['admin']);const input=hotelInput.parse(raw);const hotelId=input.id||id()
  return atomic(()=>{run(`INSERT INTO hotels (id,name,contact,phone,address,instructions,code,active,rule,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact=excluded.contact,phone=excluded.phone,address=excluded.address,instructions=excluded.instructions,code=excluded.code,active=excluded.active,rule=excluded.rule`,hotelId,input.name,input.contact,input.phone,input.address,input.instructions,input.code,Number(input.active),JSON.stringify(input.rule),now());audit(actor.id,'hotel.saved','hotel',hotelId,input);return hotelId})
}
export function saveDriver(actor:Actor,raw:unknown) {
  permit(actor,['admin','sales','delivery']);const input=driverInput.parse(raw);const driverId=input.id||id()
  run('INSERT INTO drivers VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,vehicle=excluded.vehicle,registration=excluded.registration,active=excluded.active',driverId,input.name,input.phone,input.vehicle,input.registration,Number(input.active));audit(actor.id,'driver.saved','driver',driverId,input);return driverId
}
export function savePromotion(actor:Actor,raw:unknown) {
  permit(actor,['admin','sales']);const input=promotionInput.parse(raw);const promotionId=input.id||id()
  input.product_ids.forEach(productId=>{if(!one('SELECT id FROM products WHERE id=?',productId)) throw new AppError('Promotion contains an unknown product.')})
  run('INSERT INTO promotions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,title=excluded.title,offer_text=excluded.offer_text,image=excluded.image,color=excluded.color,template=excluded.template,button=excluded.button,product_ids=excluded.product_ids,audience=excluded.audience,kind=excluded.kind,value=excluded.value,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active',promotionId,input.code,input.title,input.offer_text,input.image,input.color,input.template,input.button,JSON.stringify(input.product_ids),input.audience,input.kind,input.value,input.starts_at,input.ends_at,Number(input.active));audit(actor.id,'promotion.saved','promotion',promotionId,input);return promotionId
}
export function invite(actor:Actor,raw:unknown,base:string) {
  const input=invitationInput.parse(raw)
  if(actor.role==='hotel_manager') {if(input.role!=='hotel_staff'||input.hotel_id!==actor.hotel_id)throw new AppError('Hotel managers may invite staff only to their own hotel.',403)} else permit(actor,['admin'])
  if(input.role.startsWith('hotel_') && (!input.hotel_id||!one('SELECT id FROM hotels WHERE id=? AND active=1',input.hotel_id))) throw new AppError('Select an active hotel.')
  if(!input.role.startsWith('hotel_')&&input.hotel_id) throw new AppError('Only hotel users may belong to a hotel.')
  return atomic(()=> {
    if(one('SELECT id FROM users WHERE email=?',input.email))throw new AppError('This email already has an account. Manage it from Customers or Staff.',409)
    const userId=id();run('INSERT INTO users (id,email,name,phone,role,hotel_id,created_at) VALUES (?,?,?,?,?,?,?)',userId,input.email,input.name,input.phone,input.role,input.hotel_id,now())
    const token=tokenFor(userId,'invite',1440);const url=`${base}/accept-invitation?token=${token}`
    queue({userId,channel:'email',recipient:input.email,message:`You have been invited to Nungwi Shop. Set your own password using this single-use link (valid for 24 hours): ${url}`,key:`invite:${userId}:${hash(token)}`})
    audit(actor.id,'user.invited','user',userId,{email:input.email,role:input.role,hotel:input.hotel_id})
    return {id:userId,url,emailQueued:true,providerConfigured:deliveryConfigured('email')}
  })
}
export function commissionsFor(actor:Actor) {
  if(actor.role==='admin') return all('SELECT c.*,o.number,o.status,h.name AS hotel FROM commissions c JOIN orders o ON o.id=c.order_id JOIN hotels h ON h.id=c.hotel_id ORDER BY c.created_at DESC')
  permit(actor,['hotel_manager'])
  // Referrals expose order number, monetary basis and status, never customer identity/address/phone.
  return all('SELECT c.*,o.number,o.status FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.hotel_id=? ORDER BY c.created_at DESC',actor.hotel_id)
}
export function overview(actor:Actor,from:string,to:string) {
  const orders=listOrders(actor,from,to)
  const eligible=orders.filter(o=>!['Cancelled','Returned'].includes(o.status))
  const paid=orders.reduce((s,o)=>s+o.paid,0)
  const outstanding=eligible.reduce((s,o)=>s+o.outstanding,0)
  const status=Object.fromEntries(['Pending','Confirmed','Preparing','Out for delivery','Delivered','Cancelled','Failed delivery','Returned'].map(status=>[status,orders.filter(o=>o.status===status).length]))
  const byDay:Record<string,number>={};eligible.forEach(order=>{const key=order.created_at.slice(0,10);byDay[key]=(byDay[key]||0)+order.total-order.refunded})
  const productRows:Record<string,Row>={};eligible.forEach(order=>order.items.forEach((item:Row)=>{const line=productRows[item.product_id]||(productRows[item.product_id]={name:item.name,quantity:0,sales:0});line.quantity+=item.quantity;line.sales+=item.quantity*item.unit_price}))
  const base={sales:eligible.reduce((s,o)=>s+o.total-o.refunded,0),paid,outstanding,orders:orders.length,status,byDay,bestProducts:Object.values(productRows).sort((a,b)=>b.sales-a.sales),recent:orders.slice(0,10)}
  if(!staff(actor))return base
  const products=catalogue(true);const lowStock=products.filter(p=>p.active&&p.available<=p.reorder_level)
  const expenses=one('SELECT COALESCE(SUM(amount),0) AS value FROM expenses WHERE date>=? AND date<?',from,to)!.value
  const delivered=eligible.filter(o=>o.status==='Delivered')
  const grossMargin=delivered.reduce((s,o)=>s+(o.subtotal-o.discount)*(1-o.refunded/Math.max(1,o.total))-o.items.reduce((t:number,i:Row)=>t+i.cost,0),0)
  return {...base,customers:one("SELECT COUNT(*) AS count FROM users WHERE role='customer' AND active=1")!.count,hotels:one('SELECT COUNT(*) AS count FROM hotels WHERE active=1')!.count,lowStock:lowStock.length,outOfStock:products.filter(p=>p.active&&p.available===0).length,expiring:all('SELECT b.*,p.name FROM batches b JOIN products p ON p.id=b.product_id WHERE b.remaining>0 AND b.expires_at<=? ORDER BY b.expires_at',new Date(Date.now()+30*86400000).toISOString()),grossMargin:Math.round(grossMargin),expenses,operatingContribution:Math.round(grossMargin-expenses),commissions:actor.role==='admin'?one('SELECT COALESCE(SUM(earned),0) AS earned, COALESCE(SUM(paid),0) AS paid, COALESCE(SUM(earned-paid),0) AS balance FROM commissions'):null}
}
export function accountData(actor:Actor) {
  return {user:actor,addresses:all('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC',actor.id),favourites:all('SELECT product_id FROM favourites WHERE user_id=?',actor.id).map(r=>r.product_id),notifications:all("SELECT id,message,order_id,created_at FROM notifications WHERE user_id=? AND channel='dashboard' ORDER BY created_at DESC LIMIT 50",actor.id),support:all('SELECT * FROM support WHERE user_id=? ORDER BY created_at DESC',actor.id),hotel:actor.hotel_id?one('SELECT id,name,code,address FROM hotels WHERE id=?',actor.hotel_id):null}
}
export function staffData(actor:Actor,resource:string) {
  if(resource==='products') {permit(actor,['admin','stock','sales']);return catalogue(true).map(p=>({...p,units:JSON.parse(p.units)}))}
  if(resource==='inventory') {permit(actor,['admin','stock']);return {batches:all('SELECT b.*,p.name FROM batches b JOIN products p ON p.id=b.product_id ORDER BY expires_at'),movements:all('SELECT m.*,p.name,u.name AS actor FROM stock_movements m JOIN products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.actor_id ORDER BY m.created_at DESC LIMIT 1000')}}
  if(resource==='drivers') {permit(actor,['admin','sales','delivery']);return all('SELECT * FROM drivers ORDER BY name')}
  if(resource==='hotels') {permit(actor,['admin']);return all('SELECT * FROM hotels ORDER BY name').map(h=>({...h,rule:JSON.parse(h.rule),balance:one('SELECT COALESCE(SUM(earned-paid),0) AS value FROM commissions WHERE hotel_id=?',h.id)!.value,purchases:one("SELECT COALESCE(SUM(total),0) AS value FROM orders WHERE hotel_id=? AND status NOT IN ('Cancelled','Returned')",h.id)!.value,phone_verified:!!one('SELECT id FROM users WHERE hotel_id=? AND phone=? AND phone_verified=1',h.id,h.phone)}))}
  if(resource==='users') {if(actor.role==='hotel_manager') return all('SELECT * FROM users WHERE hotel_id=?',actor.hotel_id).map(u=>({...publicUser(u),active:u.active,invited:!u.password}));permit(actor,['admin']);return all('SELECT * FROM users ORDER BY created_at DESC').map(u=>({...publicUser(u),active:u.active,invited:!u.password,purchases:one('SELECT COALESCE(SUM(total),0) AS value FROM orders WHERE user_id=?',u.id)!.value}))}
  if(resource==='promotions') {permit(actor,['admin','sales']);return all('SELECT * FROM promotions ORDER BY starts_at DESC').map(p=>({...p,product_ids:JSON.parse(p.product_ids)}))}
  if(resource==='commissions')return commissionsFor(actor)
  if(resource==='payouts') {if(actor.role==='hotel_manager')return all('SELECT * FROM payouts WHERE hotel_id=? ORDER BY created_at DESC',actor.hotel_id);permit(actor,['admin']);return all('SELECT p.*,h.name AS hotel FROM payouts p JOIN hotels h ON h.id=p.hotel_id ORDER BY p.created_at DESC')}
  if(resource==='notifications') {permit(actor,['admin']);return all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500').map(({message,...row})=>({...row,message:row.channel==='email'?'Account email (secure link hidden)':message.replace(/confirmation code: \d{6}/gi,'confirmation code: [hidden]').replace(/https?:\/\/\S*\/delivery\/\S+/g,'[secure delivery link]')}))}
  if(resource==='audit') {permit(actor,['admin']);return all('SELECT a.*,u.name AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 1000')}
  if(resource==='support') {permit(actor,['admin','sales']);return all('SELECT s.*,u.name FROM support s JOIN users u ON u.id=s.user_id ORDER BY created_at DESC')}
  if(resource==='settings') {permit(actor,['admin']);return {values:Object.fromEntries(all('SELECT * FROM settings').map(r=>[r.key,r.value])),smsConfigured:deliveryConfigured('sms'),emailConfigured:deliveryConfigured('email'),expenses:all('SELECT * FROM expenses ORDER BY date DESC')}}
  throw new AppError('Resource not found.',404)
}
