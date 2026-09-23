import { all, atomic, id, now, one, run, setting } from './db'
import { AppError } from './auth'
import { normalizePhone } from '../phone-number'
import { smsProvider } from './sms-provider'
import { sealSms, openSms } from './sms-secrets'
import { smsText, type SmsType } from './sms-templates'

export async function queue(input: {userId?:string; audience?:string; orderId?:string; channel:'sms'|'email'|'dashboard';recipient:string;message:string;key:string;type?:string;sensitive?:boolean;expiresAt?:string}) {
 const audience=input.audience || 'customer', type=input.type || 'ACCOUNT'
 if (input.channel==='sms') {
  if (await setting('sms_enabled','true')!=='true') return
  if (type!=='OTP' && (await setting(`sms_${audience==='driver'?'driver':audience==='staff'?'admin':'customer'}_enabled`,'true')!=='true' || input.orderId && await setting('sms_order_enabled','true')!=='true')) return
 }
 let recipient=input.recipient, error:string|null=null
 if (input.channel==='sms') { try { recipient=normalizePhone(recipient) } catch { error='Invalid recipient phone number.' } }
 await run('INSERT OR IGNORE INTO notifications (id,user_id,audience,order_id,channel,recipient,message,dedup_key,created_at,updated_at,notification_type,sensitive_payload,expires_at,status,error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id(),input.userId||null,audience,input.orderId||null,input.channel,recipient,input.sensitive?'Verification SMS (code hidden)':input.message,input.key,now(),now(),type,input.sensitive?sealSms(input.message):null,input.expiresAt||null,error?'failed':'queued',error)
}
export async function orderNotification(orderId:string,message:string,key:string,includeAdmin=false,type='ACCOUNT') {
 const order=(await one('SELECT o.*,u.notifications FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?',orderId))!
 await queue({userId:order.user_id,orderId,channel:'dashboard',recipient:order.user_id,message,key:`${key}:dashboard`,type})
 if(order.notifications) await queue({userId:order.user_id,orderId,channel:'sms',recipient:order.phone,message,key:`${key}:customer`,type})
 if(includeAdmin) for(const admin of await all("SELECT * FROM users WHERE role='admin' AND active=1")) await queue({userId:admin.id,audience:'staff',orderId,channel:'sms',recipient:admin.phone,message,key:`${key}:admin:${admin.id}`,type})
}
export const statusEvent:Record<string,SmsType>={'Pending':'ORDER_CREATED','Confirmed':'ORDER_CONFIRMED','Preparing':'ORDER_PROCESSING','Driver assigned':'DRIVER_ASSIGNED','Ready for pickup':'READY_FOR_PICKUP','Picked up':'ORDER_PICKED_UP','Out for delivery':'OUT_FOR_DELIVERY','Driver arriving':'DRIVER_ARRIVING','Delivered':'ORDER_DELIVERED','Cancelled':'ORDER_CANCELLED','Failed delivery':'ORDER_FAILED','Returned':'ORDER_RETURNED'}
export async function notifyOrder(orderId:string,event:SmsType,eventKey=event as string,extra:Record<string,string>={}) {
 const order=(await one('SELECT * FROM orders WHERE id=?',orderId))!
 const driver=order.driver?JSON.parse(order.driver):{}
 const values:Record<string,string>={title:'',customerName:order.recipient,orderNumber:order.number,customerPhone:order.phone,customerLocation:order.address,orderTotal:`TZS ${order.total.toLocaleString('en-US')}`,orderStatus:order.status,shopName:'NUNGWI SHOP',shopLocation:await setting('sms_shop_location',process.env.SHOP_LOCATION||''),driverName:driver.name||'',driverPhone:driver.phone||'',adminPortal:process.env.APP_URL?`${process.env.APP_URL}/dashboard`:'NUNGWI SHOP Admin Portal',orderItems:(await all('SELECT name,quantity FROM order_items WHERE order_id=?',orderId)).map(i=>`${i.quantity} x ${i.name}`).join(', '),...extra}
 await orderNotification(orderId,await smsText(event,values),`${orderId}:${eventKey}`,false,event)
 if(event==='ORDER_CREATED') {
  const admins=await all("SELECT id,phone FROM users WHERE role='admin' AND active=1")
  const configured=await setting('sms_admin_phone','')
  const phones=new Set<string>()
  for(const admin of [...admins,...(configured?[{id:undefined,phone:configured}]:[])]) {
   let phone=admin.phone; try { phone=normalizePhone(phone) } catch { continue }
   if(phones.has(phone)) continue; phones.add(phone)
   await queue({userId:admin.id,audience:'staff',orderId,channel:'sms',recipient:phone,message:await smsText('ADMIN_NEW_ORDER',values),key:`${orderId}:ADMIN_NEW_ORDER:${phone}`,type:'ADMIN_NEW_ORDER'})
  }
 }
 if(event==='DRIVER_ASSIGNED') await queue({audience:'driver',orderId,channel:'sms',recipient:driver.phone,message:await smsText('DRIVER_DELIVERY',values),key:`${orderId}:${eventKey}:driver`,type:'DRIVER_DELIVERY'})
}
export function deliveryConfigured(channel:string) {
 if(channel!=='sms') return !!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM)
 try { return smsProvider().configured() } catch { return false }
}
export async function smsConfigured() {
 try {return smsProvider(await setting('sms_provider',process.env.SMS_PROVIDER||'twilio')).configured()}catch{return false}
}
export async function processNotifications(limit=20) {
 const results:{id:string;status:string}[]=[]
 await run("UPDATE notifications SET status='unknown',error='Worker interrupted. Reconcile before retrying.',updated_at=? WHERE status='sending' AND updated_at<?",now(),new Date(Date.now()-300000).toISOString())
 await run("UPDATE notifications SET status='failed',sensitive_payload=NULL,error='Verification code expired',failed_at=? WHERE notification_type='OTP' AND expires_at<=? AND status='queued'",now(),now())
 await run('UPDATE notifications SET sensitive_payload=NULL WHERE expires_at<=?',now())
 await run('DELETE FROM otp_challenges WHERE expires_at<?',new Date(Date.now()-86400000).toISOString())
 for(let index=0;index<Math.min(limit,100);index++) {
  const message=await atomic(async()=>{
   const smsReady=await smsConfigured() && await setting('sms_enabled','true')==='true'
   const candidate=(await all("SELECT * FROM notifications WHERE channel IN ('sms','email') AND status='queued' AND (expires_at IS NULL OR expires_at>?) AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY CASE WHEN notification_type='OTP' THEN 0 ELSE 1 END,created_at LIMIT 100",now(),now())).find(row=>row.channel==='sms'?smsReady:deliveryConfigured(row.channel))
   if(!candidate) return null
   if(candidate.channel==='sms') {
    const category=candidate.notification_type==='OTP'?'otp':candidate.audience==='driver'?'driver':candidate.audience==='staff'?'admin':'customer'
    if(await setting(`sms_${category}_enabled`,'true')!=='true' || candidate.order_id && await setting('sms_order_enabled','true')!=='true') {
     await run("UPDATE notifications SET status='failed',error='Notification category disabled',sensitive_payload=NULL,failed_at=? WHERE id=?",now(),candidate.id)
     return null
    }
   }
   await run("UPDATE notifications SET status='sending',attempts=attempts+1,updated_at=? WHERE id=?",now(),candidate.id)
   return candidate
  })
  if(!message) break
  try {
   let status:string='submitted', providerId:string|undefined,error:string|undefined, provider='resend'
   if(message.channel==='sms') {
    const adapter=smsProvider(await setting('sms_provider',process.env.SMS_PROVIDER||'twilio'));provider=adapter.name
    await run('UPDATE notifications SET provider=? WHERE id=?',provider,message.id)
    const result=await adapter.send(message.recipient,message.sensitive_payload?openSms(message.sensitive_payload):message.message,message.id,await setting('sms_sender_id',process.env.SMS_SENDER_ID||''))
    status=result.status;providerId=result.providerId;error=result.error
   } else {
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':message.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[message.recipient],subject:'NUNGWI SHOP account update',text:message.message}),signal:AbortSignal.timeout(15000)})
    if(response.status>=500) throw new Error('Unknown provider outcome')
    if(!response.ok) {status=response.status===429?'queued':'failed';error=`Provider rejected request (${response.status}).`} else {providerId=(await response.json()).id;if(!providerId)throw new Error('Missing provider receipt')}
   }
   if(status==='queued' && message.attempts>=4) status='failed'
   const retry=status==='queued'?new Date(Date.now()+Math.min(3600000,30000*2**message.attempts)).toISOString():null
   await run('UPDATE notifications SET status=?,provider=?,provider_id=?,error=?,next_attempt_at=?,sent_at=?,failed_at=?,sensitive_payload=CASE WHEN ? THEN sensitive_payload ELSE NULL END,updated_at=? WHERE id=?',status,provider,providerId||null,error||null,retry,status==='submitted'?now():null,status==='failed'?now():null,status==='queued',now(),message.id)
   results.push({id:message.id,status})
  } catch {
   await run("UPDATE notifications SET status='unknown',sensitive_payload=NULL,error='Provider response unavailable. Reconcile before retrying.',updated_at=? WHERE id=?",now(),message.id)
   results.push({id:message.id,status:'unknown'})
  }
 }
 return results
}
export async function refreshSms() {
 if(!await smsConfigured()) throw new AppError('Configure the SMS provider first.',503)
 for(const item of await all("SELECT * FROM notifications WHERE channel='sms' AND status IN ('submitted','sent') AND provider_id IS NOT NULL ORDER BY updated_at LIMIT 50")) {
  try {
   const status=await smsProvider(item.provider||'twilio').status(item.provider_id)
   await run('UPDATE notifications SET status=?,updated_at=?,failed_at=? WHERE id=?',status,now(),status==='failed'?now():null,item.id)
  } catch { /* Keep the last known state and reconcile in the next worker cycle. */ }
 }
}
