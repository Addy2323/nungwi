import { before,after,test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { normalizePhone } from '../lib/phone-number'
import { smsProvider,parseMackJson,mackStatus } from '../lib/server/sms-provider'
import { sealSms,openSms } from '../lib/server/sms-secrets'
import { renderTemplate } from '../lib/server/sms-templates'
import { requestOtp,verifyOtp } from '../lib/server/otp'
import { processNotifications,queue } from '../lib/server/notifications'
import { one,all,run,now,closeDb } from '../lib/server/db'
import { smsDashboard,campaign,expandCampaigns } from '../lib/server/sms-admin'
import { publicUser } from '../lib/server/auth'
try{process.loadEnvFile('.env.local')}catch{}
const schema='sms_test_'+randomUUID().replaceAll('-',''),url=new URL(process.env.DATABASE_ADMIN_URL!)
url.searchParams.delete('schema');const admin=new Client({connectionString:url.toString()});url.searchParams.set('schema',schema);process.env.DATABASE_URL=url.toString()
process.env.SMS_PROVIDER='macksms';process.env.SMS_API_KEY='Basic test-only';process.env.SMS_SENDER_ID='TEST';process.env.SMS_ENCRYPTION_KEY=randomBytes(32).toString('hex')
const originalFetch=globalThis.fetch
let mode='success',calls=0
before(async()=>{
 await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);await admin.query(`SET search_path TO ${schema},pg_catalog`)
 for(const migration of ['001_postgres','002_money_capacity','006_sms_notifications'])await admin.query(readFileSync(`migrations/${migration}.sql`,'utf8'))
 globalThis.fetch=async(input,init)=>{
  calls++
  assert.ok(String(input).startsWith('https://macksms.co.tz/portal/api/'))
  if(mode==='timeout')throw new Error('timeout')
  if(mode==='rate')return new Response('{}',{status:429})
  if(mode==='rejected')return Response.json({success:false})
  if(String(input).includes('sms_details'))return Response.json({success:true,details:{messageID:'708285840899124926',delivery_status:{id:'73'}}})
  const body=JSON.parse(init!.body as string);assert.equal(body.request_type,'single_sms');assert.match(body.phone,/^255/)
  return new Response('{"success":true,"sms_data":[{"action_status":true,"messageID":708285840899124926,"status":"SENT"}]}')
 }
})
after(async()=>{globalThis.fetch=originalFetch;await closeDb();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()})
test('normalizes local numbers and rejects malformed Tanzanian numbers',()=>{
 for(const input of ['0712345678','255712345678','+255 712 345 678'])assert.equal(normalizePhone(input),'+255712345678')
 for(const input of ['07123','+255123456789','+2557123456789','call0712345678'])assert.throws(()=>normalizePhone(input))
})
test('templates render data without recursive substitution and reject unknown fields',()=>{
 assert.equal(renderTemplate('Hello {{customerName}}, {{orderNumber}}',{customerName:'Asha',orderNumber:'#42'}),'Hello Asha, #42')
 assert.throws(()=>renderTemplate('{{secret}}',{}))
})
test('OTP queue payloads are authenticated and encrypted',()=>{
 const payload=sealSms('private verification message');assert.equal(openSms(payload),'private verification message');assert.ok(!payload.includes('private'))
 const parts=payload.split('.');parts[2]=Buffer.from('tampered').toString('base64');assert.throws(()=>openSms(parts.join('.')))
})
test('MackSMS IDs retain precision and acceptance is not delivery',async()=>{
 assert.equal(parseMackJson('{"messageID":708285840899124926}').messageID,'708285840899124926')
 assert.equal(mackStatus({status:'SENT',delivery_status:{id:'0'}}),'sent');assert.equal(mackStatus({delivery_status:{id:'73'}}),'delivered')
 const result=await smsProvider().send('+255712345678','Test message','reference');assert.equal(result.providerId,'708285840899124926');assert.equal(result.status,'submitted')
})
const signup=(suffix:string)=>({name:'SMS test',email:`${suffix}@example.test`,phone:`+2557123456${suffix}`,password:'Test-password-only-2026'})
async function codeFor(challenge:string){const row=(await one('SELECT sensitive_payload FROM notifications WHERE dedup_key=?',`otp:${challenge}`))!;return openSms(row.sensitive_payload).match(/\b\d{6}\b/)![0]}
test('registration completes only after valid OTP, welcomes once, and hides OTP in history',async()=>{
 const input=signup('01'),result=await requestOtp(input)
 assert.equal(await one('SELECT id FROM users WHERE email=?',input.email),undefined)
 assert.ok(!('code' in result));const code=await codeFor(result.challenge)
 const log=(await one('SELECT message FROM notifications WHERE dedup_key=?',`otp:${result.challenge}`))!;assert.ok(!log.message.includes(code))
 const user=await verifyOtp(result.challenge,code);assert.equal((await one('SELECT phone_verified FROM users WHERE id=?',user))!.phone_verified,1)
 await assert.rejects(()=>verifyOtp(result.challenge,code))
 assert.equal((await one("SELECT count(*) AS n FROM notifications WHERE notification_type='WELCOME'"))!.n,1)
 await run("UPDATE users SET role='admin' WHERE id=?",user)
 const actor=publicUser((await one('SELECT * FROM users WHERE id=?',user))!)
 const dashboard=await smsDashboard(actor,new URLSearchParams());assert.ok(!JSON.stringify(dashboard).includes(code));assert.ok(!JSON.stringify(dashboard).includes('sensitive_payload'))
})
test('attempt limits persist and correct codes cannot bypass them',async()=>{
 const result=await requestOtp(signup('02')),code=await codeFor(result.challenge)
 for(let i=0;i<5;i++)await assert.rejects(()=>verifyOtp(result.challenge,'000000'))
 assert.equal((await one('SELECT attempts FROM otp_challenges WHERE id=?',result.challenge))!.attempts,5)
 await assert.rejects(()=>verifyOtp(result.challenge,code))
})
test('expired OTP and resend cooldown are enforced; resend invalidates prior challenge',async()=>{
 const input=signup('03'),first=await requestOtp(input),oldCode=await codeFor(first.challenge)
 await assert.rejects(()=>requestOtp(input),/Too many/)
 await run('DELETE FROM rate_limits WHERE key=?',`otp:cooldown:${input.phone}`)
 const second=await requestOtp(input)
 await assert.rejects(()=>verifyOtp(first.challenge,oldCode))
 const code=await codeFor(second.challenge);await run('UPDATE otp_challenges SET expires_at=? WHERE id=?','2000-01-01T00:00:00.000Z',second.challenge)
 await assert.rejects(()=>verifyOtp(second.challenge,code))
})
test('concurrent workers claim once and queue deduplication is persistent',async()=>{
 await run("UPDATE notifications SET status='failed' WHERE status='queued'");mode='success';calls=0
 const input={channel:'sms' as const,recipient:'+255712345678',message:'Order ready',key:'unique-event'}
 await Promise.all([queue(input),queue(input)])
 await Promise.all([processNotifications(1),processNotifications(1)])
 assert.equal(calls,1);assert.equal((await one('SELECT status FROM notifications WHERE dedup_key=?',input.key))!.status,'submitted')
})
test('safe rejection retries use backoff; uncertain outcomes are not automatically retried',async()=>{
 mode='rate';await queue({channel:'sms',recipient:'+255712345678',message:'Rate limit',key:'rate'})
 await processNotifications(1);let row=(await one("SELECT * FROM notifications WHERE dedup_key='rate'"))!;assert.equal(row.status,'queued');assert.ok(row.next_attempt_at>now())
 await run("UPDATE notifications SET status='failed' WHERE dedup_key='rate'")
 mode='timeout';await queue({channel:'sms',recipient:'+255712345678',message:'Timeout',key:'timeout'})
 await processNotifications(1);row=(await one("SELECT * FROM notifications WHERE dedup_key='timeout'"))!;assert.equal(row.status,'unknown')
 const count=calls;await processNotifications(1);assert.equal(calls,count);mode='success'
})
test('bulk submission persists a campaign and expands outside the HTTP path',async()=>{
 const actor=publicUser((await one("SELECT * FROM users WHERE role='admin' LIMIT 1"))!)
 const body={group:'ADMINS',message:'NUNGWI SHOP team update',campaignId:randomUUID()}
 const result=await campaign(actor,body,true);assert.equal(result.count,1)
 assert.equal((await all("SELECT id FROM notifications WHERE notification_type='BULK'")).length,0)
 await expandCampaigns();await expandCampaigns();assert.equal((await all("SELECT id FROM notifications WHERE notification_type='BULK'")).length,1)
})
