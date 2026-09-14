import { NextResponse,after } from 'next/server'
import { z } from 'zod'
import { randomInt, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { all, atomic, audit, id, now, one, run, type Row } from '@/lib/server/db'
import { AppError, createSession, currentUser, hash, logout, originGuard, passwordHash, passwordMatches, permit, publicUser, redeemToken, requireUser, roles, staff, throttle, tokenFor } from '@/lib/server/auth'
import { accountInput, date, driverInput, money, phone, quantity, text } from '@/lib/server/validation'
import { adjustStock, assignDriver, catalogue, changeStatus, commissionAmount, listOrders, orderDetails, payout, placeOrder, receiveStock, recordPayment } from '@/lib/server/orders'
import { accountData, invite, overview, publicCatalogue, saveDriver, saveHotel, saveProduct, savePromotion, staffData } from '@/lib/server/platform'
import { deliveryConfigured, processNotifications, queue, refreshSms } from '@/lib/server/notifications'
import { csvReport, pdfReport, reportRows } from '@/lib/server/reports'

export const runtime='nodejs'
export const dynamic='force-dynamic'
function failure(error:unknown) {
  if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid JSON request.'},{status:400})
  if(error instanceof AppError)return NextResponse.json({error:error.message},{status:error.status})
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400})
  if(error instanceof Error && error.message.includes('UNIQUE constraint'))return NextResponse.json({error:'A record with this email, code, SKU or reference already exists.'},{status:409})
  console.error('[platform]',error instanceof Error?error.message:'Request failed')
  return NextResponse.json({error:'Unable to complete this request. Please try again.'},{status:500})
}
export async function GET(request:Request) {
  try {
    const url=new URL(request.url);const resource=url.searchParams.get('resource')||'me';const actor=await currentUser()
    if(resource==='catalogue')return NextResponse.json({data:publicCatalogue(actor)})
    if(resource==='promotions-public')return NextResponse.json({data:all("SELECT * FROM promotions WHERE active=1 AND starts_at<=? AND ends_at>? AND (audience='all' OR audience=?)",now(),now(),actor?.hotel_id?'hotel':'customer').map(p=>({...p,product_ids:JSON.parse(p.product_ids)}))})
    if(resource==='me')return NextResponse.json({data:actor})
    if(resource==='checkout-config')return NextResponse.json({data:{cardEnabled:!!(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET)}})
    if(!actor)throw new AppError('Please sign in.',401)
    const from=date.parse(url.searchParams.get('from')||'1970-01-01T00:00:00.000Z');const to=date.parse(url.searchParams.get('to')||'2999-01-01T00:00:00.000Z');if(to<=from)throw new AppError('Choose a valid date range.')
    if(resource==='account')return NextResponse.json({data:accountData(actor)})
    if(resource==='overview')return NextResponse.json({data:overview(actor,from,to)})
    if(resource==='orders')return NextResponse.json({data:listOrders(actor,from,to)})
    if(resource==='order')return NextResponse.json({data:orderDetails(actor,text.parse(url.searchParams.get('id')))})
    if(resource==='report') {
      const type=z.enum(['receipt','sales','outstanding','deliveries','statement','commissions','stock','expiry','products']).parse(url.searchParams.get('type'))
      if(staff(actor)&&['sales','outstanding','statement','products'].includes(type))permit(actor,['admin','sales'])
      if(staff(actor)&&type==='deliveries')permit(actor,['admin','sales','delivery'])
      const report=reportRows(actor,type,from,to,url.searchParams.get('id')||undefined)
      const format=url.searchParams.get('format')==='csv'?'csv':'pdf';const content=format==='csv'?csvReport(report):Buffer.from(await pdfReport(report,`${from.slice(0,10)} to ${to.slice(0,10)} (end exclusive)`))
      return new Response(content,{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/pdf','Content-Disposition':`attachment; filename="nungwi-${type}.${format}"`,'Cache-Control':'no-store'}})
    }
    return NextResponse.json({data:staffData(actor,resource)})
  } catch(error) {return failure(error)}
}

export async function POST(request:Request) {
  try {
    originGuard(request)
    after(async()=>{try{await processNotifications(10)}catch{console.error('[outbox] Background processing interrupted; queued messages remain recoverable.')}})
    if(Number(request.headers.get('content-length')||0)>5*1024*1024)throw new AppError('Request is too large.',413)
    const base=process.env.APP_URL||new URL(request.url).origin
    if(request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const actor=await requireUser();permit(actor,['admin','stock','sales'])
      const form=await request.formData();const file=form.get('file')
      if(!(file instanceof File)||file.size>4*1024*1024||file.size<12)throw new AppError('Upload a PNG, JPEG or WebP image up to 4 MB.')
      const buffer=Buffer.from(await file.arrayBuffer());let extension=''
      if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='png'
      else if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)extension='jpg'
      else if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')extension='webp'
      if(!extension)throw new AppError('Unsupported image format. SVG and executable uploads are not accepted.')
      const name=`${randomUUID()}.${extension}`;const folder=path.resolve(process.env.UPLOAD_DIR||'data/uploads');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,name),buffer,{flag:'wx'});audit(actor.id,'image.upload','image',name,{size:buffer.length})
      return NextResponse.json({data:{url:`/uploads/${name}`}})
    }
    const raw=await request.text();if(raw.length>100000)throw new AppError('Request is too large.',413)
    const body=JSON.parse(raw);const action=z.string().parse(body.action)
    if(action==='auth.signup') {
      const input=accountInput.parse(body);throttle('signup:global',100,3600);throttle(`signup:${hash(input.email)}`,4,3600)
      const userId=atomic(()=>{if(one('SELECT id FROM users WHERE email=?',input.email))throw new AppError('Unable to create this account. Try signing in or resetting your password.',409);const userId=id();run('INSERT INTO users (id,email,name,phone,password,created_at) VALUES (?,?,?,?,?,?)',userId,input.email,input.name,input.phone,passwordHash(input.password),now());audit(userId,'account.created','user',userId,{});return userId})
      await createSession(userId);return NextResponse.json({data:{redirect:'/customer'}})
    }
    if(action==='auth.login') {
      const input=z.object({email:z.string().email().transform(v=>v.toLowerCase()),password:z.string().min(1).max(128)}).parse(body)
      throttle('login:global',500,900);throttle(`login:${hash(input.email)}`,10,900)
      const user=one('SELECT * FROM users WHERE email=?',input.email)
      const valid=passwordMatches(input.password,user?.password||`${'0'.repeat(32)}:${'0'.repeat(128)}`)
      if(!user||!valid||!user.active||user.hotel_id&&!one('SELECT id FROM hotels WHERE id=? AND active=1',user.hotel_id))throw new AppError('Email or password is incorrect, or the account is unavailable.',401)
      await createSession(user.id);return NextResponse.json({data:{redirect:staff(publicUser(user))?'/dashboard':user.hotel_id?'/hotel':'/customer'}})
    }
    if(action==='auth.logout') {await logout();return NextResponse.json({data:{redirect:'/login'}})}
    if(action==='auth.reset-request') {
      const email=z.string().email().transform(v=>v.toLowerCase()).parse(body.email);throttle(`reset:${hash(email)}`,3,3600)
      if(!deliveryConfigured('email'))throw new AppError('Password reset email is not configured. Please contact the shop administrator.',503)
      const user=one('SELECT * FROM users WHERE email=? AND active=1',email)
      if(user){const token=tokenFor(user.id,'reset');queue({userId:user.id,channel:'email',recipient:email,message:`Reset your Nungwi Shop password using this single-use link (valid for one hour): ${base}/reset-password?token=${token}`,key:`reset:${user.id}:${hash(token)}`})}
      return NextResponse.json({data:{message:'If an active account matches this email, a reset message has been queued.'}})
    }
    if(action==='auth.set-password') {const input=z.object({token:z.string().length(64),purpose:z.enum(['reset','invite']),password:z.string().min(10).max(128)}).parse(body);throttle(`token:${hash(input.token)}`,10,900);const userId=redeemToken(input.token,input.purpose,input.password);await createSession(userId);const user=one('SELECT * FROM users WHERE id=?',userId)!;return NextResponse.json({data:{redirect:staff(publicUser(user))?'/dashboard':user.hotel_id?'/hotel':'/customer'}})}
    const actor=await requireUser();let result:unknown={success:true}
    if(action==='order.place')result=placeOrder(actor,body)
    else if(action==='order.quote')result=placeOrder(actor,body,true)
    else if(action==='order.status') {const input=z.object({id:text,status:text,code:z.string().max(10).default(''),note:z.string().max(1000).default('')}).parse(body);result=changeStatus(actor,input.id,input.status,input.code,input.note)}
    else if(action==='order.assign') {const input=z.object({id:text,driver_id:text,eta:text,instructions:z.string().max(1000).default('')}).parse(body);result=assignDriver(actor,input.id,input)}
    else if(action==='payment.record') {const input=z.object({id:text,amount:money.refine(v=>v>0),kind:z.enum(['payment','refund']),method:z.enum(['cash','bank_transfer','card','deposit_return']),reference:text}).parse(body);result=recordPayment(actor,input.id,input)}
    else if(action==='product.save')result=saveProduct(actor,body)
    else if(action==='stock.receive') {const input=z.object({product_id:text,label:text,expires_at:date,quantity,cost:money,reason:text}).parse(body);result=receiveStock(actor,input)}
    else if(action==='stock.adjust') {const input=z.object({batch_id:text,quantity,kind:z.enum(['damaged','expired']),reason:text}).parse(body);result=adjustStock(actor,input)}
    else if(action==='driver.save')result=saveDriver(actor,body)
    else if(action==='hotel.save')result=saveHotel(actor,body)
    else if(action==='promotion.save')result=savePromotion(actor,body)
    else if(action==='commission.calculate') {permit(actor,['admin']);result={amount:commissionAmount(money.parse(body.eligible),body.rule)}}
    else if(action==='commission.payout')result=payout(actor,text.parse(body.hotel_id),text.parse(body.reference))
    else if(action==='user.invite')result=invite(actor,body,base)
    else if(action==='user.update') {
      const input=z.object({id:text,active:z.boolean(),role:z.enum(roles)}).parse(body)
      atomic(()=>{const user=one('SELECT * FROM users WHERE id=?',input.id);if(!user)throw new AppError('Account not found.',404)
        if(actor.role==='hotel_manager'){if(user.hotel_id!==actor.hotel_id||user.role!=='hotel_staff'||input.role!=='hotel_staff')throw new AppError('Only your hotel staff may be managed.',403)}else permit(actor,['admin'])
        if(user.id===actor.id)throw new AppError('You cannot deactivate or change your own role.')
        if(user.hotel_id!==null && !input.role.startsWith('hotel_') || user.hotel_id===null && input.role.startsWith('hotel_'))throw new AppError('Hotel membership cannot be changed by editing the role.')
        run('UPDATE users SET active=?,role=? WHERE id=?',Number(input.active),input.role,user.id);run('DELETE FROM sessions WHERE user_id=?',user.id);audit(actor.id,'user.updated','user',user.id,input)
      })
    }
    else if(action==='account.save') {const input=z.object({name:text,phone,notifications:z.boolean()}).parse(body);run('UPDATE users SET name=?,phone=?,phone_verified=CASE WHEN phone=? THEN phone_verified ELSE 0 END,notifications=? WHERE id=?',input.name,input.phone,input.phone,Number(input.notifications),actor.id);audit(actor.id,'profile.updated','user',actor.id,{})}
    else if(action==='phone.send') {if(!actor.phone)throw new AppError('Save a phone number first.');if(!deliveryConfigured('sms'))throw new AppError('Phone verification is unavailable until SMS is configured.',503);throttle(`phone-send:${actor.id}`,3,3600);const code=String(randomInt(100000,1000000));run("DELETE FROM tokens WHERE user_id=? AND purpose LIKE 'phone:%'",actor.id);run('INSERT INTO tokens VALUES (?,?,?,?,NULL)',hash(`${actor.id}:${actor.phone}:${code}`),actor.id,`phone:${actor.phone}`,new Date(Date.now()+600000).toISOString());queue({userId:actor.id,channel:'sms',recipient:actor.phone,message:`Your Nungwi Shop phone verification code: ${code}. Expires in 10 minutes.`,key:`phone:${actor.id}:${id()}`})}
    else if(action==='phone.verify') {throttle(`phone-verify:${actor.id}`,6,900);const code=z.string().regex(/^\d{6}$/).parse(body.code);atomic(()=>{const token=one('SELECT * FROM tokens WHERE token=? AND user_id=? AND purpose=? AND used_at IS NULL AND expires_at>?',hash(`${actor.id}:${actor.phone}:${code}`),actor.id,`phone:${actor.phone}`,now());if(!token)throw new AppError('Verification code is incorrect or expired.');run('UPDATE users SET phone_verified=1 WHERE id=?',actor.id);run('UPDATE tokens SET used_at=? WHERE token=?',now(),token.token)})}
    else if(action==='address.save') {const input=z.object({id:z.string().optional(),label:text,address:text,is_default:z.boolean().default(false)}).parse(body);atomic(()=>{if(input.id&&!one('SELECT id FROM addresses WHERE id=? AND user_id=?',input.id,actor.id))throw new AppError('Address not found.',404);if(input.is_default)run('UPDATE addresses SET is_default=0 WHERE user_id=?',actor.id);run('INSERT INTO addresses VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,address=excluded.address,is_default=excluded.is_default',input.id||id(),actor.id,input.label,input.address,Number(input.is_default))})}
    else if(action==='address.delete')run('DELETE FROM addresses WHERE id=? AND user_id=?',text.parse(body.id),actor.id)
    else if(action==='favourite.toggle') {const productId=text.parse(body.id);if(!one('SELECT id FROM products WHERE id=?',productId))throw new AppError('Product not found.');if(one('SELECT product_id FROM favourites WHERE product_id=? AND user_id=?',productId,actor.id))run('DELETE FROM favourites WHERE product_id=? AND user_id=?',productId,actor.id);else run('INSERT INTO favourites VALUES (?,?)',actor.id,productId)}
    else if(action==='support.create') {const input=z.object({order_id:z.string().nullable().default(null),message:text}).parse(body);if(input.order_id)orderDetails(actor,input.order_id);run('INSERT INTO support (id,user_id,order_id,message,created_at) VALUES (?,?,?,?,?)',id(),actor.id,input.order_id,input.message,now())}
    else if(action==='support.reply') {permit(actor,['admin','sales']);const input=z.object({id:text,reply:text,status:z.enum(['Open','Resolved'])}).parse(body);run('UPDATE support SET reply=?,status=? WHERE id=?',input.reply,input.status,input.id);audit(actor.id,'support.replied','support',input.id,{status:input.status})}
    else if(action==='notifications.process') {permit(actor,['admin']);result={processed:await processNotifications()}}
    else if(action==='notifications.refresh') {permit(actor,['admin']);await refreshSms()}
    else if(action==='notifications.retry') {permit(actor,['admin']);const message=one('SELECT * FROM notifications WHERE id=?',text.parse(body.id));if(!message||message.status!=='failed')throw new AppError('Only provider-confirmed failures can be retried. Unknown outcomes require reconciliation.');run("UPDATE notifications SET status='queued',error=NULL WHERE id=?",message.id);audit(actor.id,'notification.retry','notification',message.id,{})}
    else if(action==='settings.save') {permit(actor,['admin']);const values=z.object({delivery_fee:money,free_delivery_threshold:money,minimum_order:money,tax_percent:z.number().min(0).max(100)}).parse(body);atomic(()=>{Object.entries(values).forEach(([key,value])=>run('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(value)));audit(actor.id,'settings.saved','settings','store',values)})}
    else if(action==='expense.create') {permit(actor,['admin']);const input=z.object({amount:money.refine(v=>v>0),description:text,date}).parse(body);run('INSERT INTO expenses VALUES (?,?,?,?,?)',id(),input.amount,input.description,input.date,actor.id);audit(actor.id,'expense.recorded','expense','store',input)}
    else throw new AppError('Action not found.',404)
    return NextResponse.json({data:result})
  }catch(error){return failure(error)}
}
