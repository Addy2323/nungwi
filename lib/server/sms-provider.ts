import { normalizePhone } from '../phone-number'
export type SmsResult = { status: 'submitted' | 'queued' | 'failed'; providerId?: string; error?: string }
export interface SmsProvider {
 name: string
 configured(): boolean
 send(to: string, message: string, reference: string, sender?: string): Promise<SmsResult>
 status(id: string): Promise<'submitted'|'sent'|'delivered'|'failed'>
}
const authorization = () => `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
const twilio: SmsProvider = {
 name: 'twilio',
 configured: () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.SMS_SENDER_ID || process.env.TWILIO_FROM)),
 async send(to, message, _reference, sender) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {method:'POST',headers:{Authorization:authorization(),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:normalizePhone(to),From:sender || process.env.SMS_SENDER_ID || process.env.TWILIO_FROM!,Body:message}),signal:AbortSignal.timeout(15000)})
  if (response.status === 429) return {status:'queued',error:'Provider rate limit. Retry scheduled.'}
  if (response.status >= 500) throw new Error('Provider outcome uncertain')
  if (!response.ok) return {status:'failed',error:`Provider rejected request (${response.status}).`}
  const value = await response.json()
  if (typeof value.sid !== 'string') throw new Error('Provider outcome uncertain')
  return {status:'submitted',providerId:value.sid}
 },
 async status(id) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages/${encodeURIComponent(id)}.json`, {headers:{Authorization:authorization()},signal:AbortSignal.timeout(10000)})
  if (!response.ok) throw new Error('SMS reconciliation unavailable')
  const value = await response.json()
  return ['sent','delivered'].includes(value.status) ? value.status : ['failed','undelivered','canceled'].includes(value.status) ? 'failed' : 'submitted'
 }
}
function mackHeaders() {
 const raw=process.env.SMS_API_KEY?.trim()
 const auth=raw ? (raw.startsWith('Basic ')?raw:`Basic ${raw}`) : `Basic ${Buffer.from(`${process.env.SMS_API_SECRET}:${process.env.SMS_SECRET_CODE}`).toString('base64')}`
 return {Authorization:auth,Accept:'application/json','Content-Type':'application/json'}
}
function mackUrl(path:string) {
 const base=new URL(process.env.SMS_BASE_URL || 'https://macksms.co.tz/portal/api/')
 if(base.protocol!=='https:' || !['macksms.co.tz','www.macksms.co.tz'].includes(base.hostname) || base.pathname!=='/portal/api/') throw new Error('Use the production MackSMS HTTPS API endpoint.')
 return new URL(path,base).toString()
}
// MackSMS IDs can exceed Number.MAX_SAFE_INTEGER; preserve them before JSON parsing.
export function parseMackJson(raw:string) { return JSON.parse(raw.replace(/("messageID"\s*:\s*)(\d+)/g,'$1"$2"')) }
export function mackStatus(value: {status?:string;delivery_status?:{id?:string|number}}): 'submitted'|'sent'|'delivered'|'failed' {
 const code=Number(value.delivery_status?.id)
 if(code===73) return 'delivered'
 if([75,79,80].includes(code) || code>=53&&code<=69 || [110,111].includes(code) || value.status==='FAILED') return 'failed'
 if(value.status==='SENT' || [51,109].includes(code)) return 'sent'
 return 'submitted'
}
const macksms:SmsProvider={
 name:'macksms',
 configured:()=>!!((process.env.SMS_API_KEY || process.env.SMS_API_SECRET&&process.env.SMS_SECRET_CODE)&&process.env.SMS_SENDER_ID),
 async send(to,message,_reference,sender) {
  const response=await fetch(mackUrl('text'),{method:'POST',headers:mackHeaders(),body:JSON.stringify({request_type:'single_sms',sender_id:sender||process.env.SMS_SENDER_ID,phone:normalizePhone(to).slice(1),message}),signal:AbortSignal.timeout(15000),redirect:'error'})
  if(response.status===429) return {status:'queued',error:'Provider rate limit. Retry scheduled.'}
  if(response.status>=500) throw new Error('Provider outcome uncertain')
  if(!response.ok) return {status:'failed',error:`Provider rejected request (${response.status}).`}
  const value=parseMackJson(await response.text()), item=value.sms_data?.[0]
  if(value.success===false || item?.action_status===false || item?.status==='FAILED') return {status:'failed',error:'MackSMS rejected the message. Check sender registration, balance and recipient.'}
  if(value.success!==true || !item?.messageID) throw new Error('Provider outcome uncertain')
  return {status:'submitted',providerId:String(item.messageID)}
 },
 async status(id) {
  const response=await fetch(mackUrl(`sms_details?messageId=${encodeURIComponent(id)}`),{headers:mackHeaders(),signal:AbortSignal.timeout(10000),redirect:'error'})
  if(!response.ok) throw new Error('SMS reconciliation unavailable')
  const value=parseMackJson(await response.text())
  if(value.success!==true || String(value.details?.messageID)!==id) throw new Error('SMS report unavailable')
  return mackStatus(value.details)
 }
}
const providers: Record<string,SmsProvider> = {twilio,macksms}
export function smsProvider(name = process.env.SMS_PROVIDER || 'twilio'): SmsProvider {
 const provider = providers[name]
 if (!provider) throw new Error('Unsupported SMS provider. Configure a supported adapter.')
 return provider
}
