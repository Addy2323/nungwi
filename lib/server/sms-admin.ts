import { z } from 'zod'
import { all, atomic, audit, id, now, one, run, setting } from './db'
import { AppError, permit, type Actor } from './auth'
import { normalizePhone } from '../phone-number'
import { smsTemplates, templateVariables, validateTemplate } from './sms-templates'
import { queue } from './notifications'

const config=z.object({sms_provider:z.enum(['macksms','twilio']),sms_sender_id:z.string().trim().min(1).max(30),sms_admin_phone:z.string().default(''),sms_shop_location:z.string().trim().min(1).max(500),sms_enabled:z.boolean(),sms_otp_enabled:z.boolean(),sms_order_enabled:z.boolean(),sms_driver_enabled:z.boolean(),sms_customer_enabled:z.boolean(),sms_admin_enabled:z.boolean()})
export async function smsSettings(actor:Actor) {
 permit(actor,['admin'])
 const stored=Object.fromEntries((await all("SELECT * FROM settings WHERE key LIKE 'sms_%'")).map(r=>[r.key,r.value]))
 return {values:{sms_provider:process.env.SMS_PROVIDER||'twilio',sms_sender_id:process.env.SMS_SENDER_ID||'',sms_admin_phone:'',sms_shop_location:process.env.SHOP_LOCATION||'Nungwi Main Shop, Zanzibar',sms_enabled:'true',sms_otp_enabled:'true',sms_order_enabled:'true',sms_driver_enabled:'true',sms_customer_enabled:'true',sms_admin_enabled:'true',...stored},templates:Object.fromEntries(Object.entries(smsTemplates).map(([key,value])=>[key,stored[`sms_template_${key}`]||value])),variables:templateVariables,recipients:await all('SELECT id,name,phone FROM users WHERE active=1 AND notifications=1 ORDER BY name LIMIT 5000')}
}
export async function saveSmsSettings(actor:Actor,raw:unknown) {
 permit(actor,['admin']);const value=config.parse(raw)
 if(value.sms_admin_phone) value.sms_admin_phone=normalizePhone(value.sms_admin_phone)
 await atomic(async()=>{
  for(const [key,data] of Object.entries(value)) await run('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(data))
  await audit(actor.id,'sms.settings','settings','sms',value)
 })
}
export async function saveTemplate(actor:Actor,raw:unknown) {
 permit(actor,['admin'])
 const value=z.object({type:z.enum(Object.keys(smsTemplates) as [string,...string[]]),message:z.string().min(1).max(1600)}).parse(raw)
 try {validateTemplate(value.message)} catch(e) {throw new AppError((e as Error).message)}
 if(value.type==='OTP' && !value.message.includes('{{code}}')) throw new AppError('OTP template must include {{code}}.')
 if(!value.message.includes('NUNGWI SHOP') && !value.message.includes('{{shopName}}')) throw new AppError('Include NUNGWI SHOP or {{shopName}} in the template.')
 await run('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',`sms_template_${value.type}`,value.message)
 await audit(actor.id,'sms.template','settings',value.type,{})
}
const campaignInput=z.object({group:z.enum(['ALL_CUSTOMERS','VERIFIED_CUSTOMERS','ACTIVE_CUSTOMERS','DRIVERS','ADMINS','SELECTED_USERS']),selected:z.array(z.string().uuid()).max(10000).default([]),message:z.string().trim().min(1).max(1000),campaignId:z.string().uuid()})
export async function campaign(actor:Actor,raw:unknown,send=false) {
 permit(actor,['admin']);const input=campaignInput.parse(raw)
 const clauses:Record<string,string>={ALL_CUSTOMERS:"role='customer'",VERIFIED_CUSTOMERS:"role='customer' AND phone_verified=1",ACTIVE_CUSTOMERS:"role='customer' AND EXISTS (SELECT 1 FROM orders WHERE orders.user_id=users.id AND orders.created_at>?)",ADMINS:"role='admin'",SELECTED_USERS:'id=ANY(?)'}
 const records=input.group==='DRIVERS'?await all('SELECT id,name,phone FROM drivers WHERE active=1'):await all(`SELECT id,name,phone FROM users WHERE active=1 AND notifications=1 AND ${clauses[input.group]}`, ...(input.group==='ACTIVE_CUSTOMERS'?[new Date(Date.now()-90*86400000).toISOString()]:input.group==='SELECTED_USERS'?[input.selected]:[]))
 const phones=new Set<string>(),recipients:{id:string;name:string;phone:string}[]=[]
 for(const row of records) {try {const phone=normalizePhone(row.phone);if(!phones.has(phone)){phones.add(phone);recipients.push({id:row.id,name:row.name,phone})}} catch { /* Exclude invalid historical contacts from campaigns. */ }}
 if(send) {
  if(await setting('sms_enabled','true')!=='true') throw new AppError('SMS is disabled.')
  await atomic(async()=>{
   await run('INSERT OR IGNORE INTO sms_campaigns (id,actor_id,recipient_group,message,recipients,created_at) VALUES (?,?,?,?,?::jsonb,?)',input.campaignId,actor.id,input.group,input.message,JSON.stringify(recipients),now())
   await audit(actor.id,'sms.campaign.queued','campaign',input.campaignId,{count:recipients.length,group:input.group})
  })
 }
 return {count:recipients.length,preview:input.message,campaignId:input.campaignId}
}
export async function expandCampaigns() {
 await atomic(async()=>{
  if(await setting('sms_enabled','true')!=='true') return
  const campaign=await one('SELECT * FROM sms_campaigns WHERE completed_at IS NULL ORDER BY created_at LIMIT 1')
  if(!campaign) return
  const recipients=campaign.recipients as {id:string;name:string;phone:string}[]
  const end=Math.min(campaign.cursor+100,recipients.length)
  for(const recipient of recipients.slice(campaign.cursor,end)) {
   const driver=campaign.recipient_group==='DRIVERS'
   const active=await one(driver?'SELECT id,phone FROM drivers WHERE id=? AND active=1':'SELECT id,phone FROM users WHERE id=? AND active=1 AND notifications=1',recipient.id)
   if(active && normalizePhone(active.phone)===recipient.phone) await queue({userId:driver?undefined:recipient.id,audience:driver?'driver':campaign.recipient_group==='ADMINS'?'staff':'customer',channel:'sms',recipient:recipient.phone,message:campaign.message,key:`campaign:${campaign.id}:${recipient.phone}`,type:'BULK'})
  }
  await run('UPDATE sms_campaigns SET cursor=?,completed_at=? WHERE id=?',end,end===recipients.length?now():null,campaign.id)
 })
}
export async function smsDashboard(actor:Actor,params:URLSearchParams) {
 permit(actor,['admin'])
 const args:unknown[]=[],filters=["n.channel='sms'"]
 for(const [key,column] of [['status','n.status::text'],['type','n.notification_type'],['recipient','n.recipient'],['order','o.number']] as const) if(params.get(key)){filters.push(`${column}=?`);args.push(params.get(key))}
 for(const [key,op] of [['from','>='],['to','<']] as const) if(params.get(key)){const date=z.string().date().parse(params.get(key));filters.push(`n.created_at${op}?`);args.push(`${date}T00:00:00.000Z`)}
 const logs=await all(`SELECT n.id,n.audience,n.recipient,n.notification_type,n.status,n.attempts,n.error,n.created_at,n.provider,n.provider_id,n.sent_at,n.failed_at,o.number AS order_number,CASE WHEN n.notification_type='OTP' THEN 'Verification SMS (code hidden)' ELSE n.message END AS message FROM notifications n LEFT JOIN orders o ON o.id=n.order_id WHERE ${filters.join(' AND ')} ORDER BY n.created_at DESC LIMIT 500`,...args)
 for(const log of logs) log.message=log.message.replace(/https?:\/\/\S*\/delivery\/\S+/g,'[secure delivery link]').replace(/(?:verification|confirmation) code:?\s*\d{6}/gi,'verification code: [hidden]')
 const metrics=await one("SELECT COUNT(*) AS total,COUNT(*) FILTER (WHERE status IN ('submitted','sent','delivered')) AS successful,COUNT(*) FILTER (WHERE status='failed') AS failed,COUNT(*) FILTER (WHERE status IN ('queued','sending')) AS pending,COUNT(*) FILTER (WHERE status='unknown') AS unknown,COUNT(*) FILTER (WHERE created_at>=?) AS today,COUNT(*) FILTER (WHERE notification_type='OTP') AS otp,COUNT(*) FILTER (WHERE order_id IS NOT NULL) AS orders,COUNT(*) FILTER (WHERE audience='driver') AS drivers,COUNT(*) FILTER (WHERE audience='customer') AS customers FROM notifications WHERE channel='sms'",new Date().toISOString().slice(0,10))
 return {logs,metrics,campaigns:await all('SELECT id,recipient_group,cursor,jsonb_array_length(recipients) AS total,created_at,completed_at FROM sms_campaigns ORDER BY created_at DESC LIMIT 50')}
}
