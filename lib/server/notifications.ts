import { all, atomic, id, now, one, run } from './db'
import { AppError } from './auth'

export function queue(input:{userId?:string;audience?:string;orderId?:string;channel:'sms'|'email'|'dashboard';recipient:string;message:string;key:string}) {
  run('INSERT OR IGNORE INTO notifications (id,user_id,audience,order_id,channel,recipient,message,dedup_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',id(),input.userId||null,input.audience||'customer',input.orderId||null,input.channel,input.recipient,input.message,input.key,now(),now())
}
export function orderNotification(orderId:string, message:string, key:string, includeAdmin=false) {
  const order=one('SELECT o.*,u.notifications FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?',orderId)!
  queue({userId:order.user_id,orderId,channel:'dashboard',recipient:order.user_id,message,key:`${key}:dashboard`})
  if(order.notifications) queue({userId:order.user_id,orderId,channel:'sms',recipient:order.phone,message,key:`${key}:customer`})
  if(includeAdmin) for(const admin of all("SELECT * FROM users WHERE role='admin' AND active=1")) {
    queue({userId:admin.id,audience:'staff',orderId,channel:'dashboard',recipient:admin.id,message:`${order.number}: ${message}`,key:`${key}:admin:${admin.id}:dashboard`})
    if(admin.phone) queue({userId:admin.id,audience:'staff',orderId,channel:'sms',recipient:admin.phone,message:`${order.number}: ${message}`,key:`${key}:admin:${admin.id}:sms`})
  }
}
export function deliveryConfigured(channel:string) { return channel==='sms' ? !!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM) : !!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM) }
export async function processNotifications(limit=20) {
  const results: {id:string;status:string}[]=[]
  for(let index=0;index<limit;index++) {
    const message=atomic(()=> {
      const candidate=all("SELECT * FROM notifications WHERE channel IN ('sms','email') AND status='queued' ORDER BY created_at LIMIT 100").find(row=>deliveryConfigured(row.channel))
      if(!candidate) return null
      run("UPDATE notifications SET status='sending',attempts=attempts+1,updated_at=? WHERE id=?",now(),candidate.id)
      return candidate
    })
    if(!message) break
    try {
      let response:Response
      if(message.channel==='sms') {
        response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:message.recipient,From:process.env.TWILIO_FROM!,Body:message.message}),signal:AbortSignal.timeout(15000)})
      } else {
        response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':message.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[message.recipient],subject:'Nungwi Shop account update',text:message.message}),signal:AbortSignal.timeout(15000)})
      }
      const result=await response.json()
      if(!response.ok) { run("UPDATE notifications SET status='failed',error=?,updated_at=? WHERE id=?",`Provider rejected request (${response.status}).`,now(),message.id);results.push({id:message.id,status:'failed'});continue }
      // Provider acceptance is not proof of handset delivery. SMS status is polled separately.
      run("UPDATE notifications SET status='submitted',provider_id=?,error=NULL,updated_at=? WHERE id=?",result.sid||result.id,now(),message.id)
      results.push({id:message.id,status:'submitted'})
    } catch {
      // A timeout may follow provider acceptance; do not blindly resend and duplicate the message.
      run("UPDATE notifications SET status='unknown',error='Provider response unavailable. Reconcile before retrying.',updated_at=? WHERE id=?",now(),message.id)
      results.push({id:message.id,status:'unknown'})
    }
  }
  return results
}
export async function refreshSms() {
  if(!deliveryConfigured('sms')) throw new AppError('Configure the SMS provider first.',503)
  for(const item of all("SELECT * FROM notifications WHERE channel='sms' AND status IN ('submitted','sent') AND provider_id IS NOT NULL LIMIT 50")) {
    const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages/${item.provider_id}.json`,{headers:{Authorization:`Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`},signal:AbortSignal.timeout(10000)})
    if(response.ok) { const value=await response.json(); const status=['sent','delivered'].includes(value.status)?value.status:['failed','undelivered','canceled'].includes(value.status)?'failed':'submitted';run('UPDATE notifications SET status=?,error=?,updated_at=? WHERE id=?',status,value.error_code?`Provider error ${value.error_code}`:null,now(),item.id) }
  }
}
