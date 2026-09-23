import { randomInt, createHmac, timingSafeEqual } from 'node:crypto'
import { atomic, audit, id, now, one, run, setting } from './db'
import { AppError, passwordHash, throttle } from './auth'
import { phone, accountInput } from './validation'
import { smsConfigured, queue } from './notifications'
import { smsText } from './sms-templates'

function digest(challenge: string, code: string) {
 const secret = process.env.SMS_ENCRYPTION_KEY
 if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new AppError('Phone verification is not configured.',503)
 return createHmac('sha256',secret).update(`${challenge}:${code}`).digest('hex')
}
export async function requestOtp(raw: unknown, userId?: string) {
 const input = userId ? {phone:phone.parse((raw as {phone:string}).phone),name:(raw as {name:string}).name,email:null,password:null} : accountInput.parse(raw)
 if (!await smsConfigured() || await setting('sms_enabled','true') !== 'true' || await setting('sms_otp_enabled','true') !== 'true') throw new AppError('Phone verification is temporarily unavailable. Please contact the shop.',503)
 await throttle('otp:global',100,3600)
 await throttle(`otp:phone:${input.phone}`,5,3600)
 await throttle(`otp:cooldown:${input.phone}`,1,60)
 const challenge = id(), code = String(randomInt(100000,1000000)), codeHash = digest(challenge,code)
 const expires = new Date(Date.now()+300000).toISOString()
 await atomic(async()=>{
  if (!userId && await one('SELECT id FROM users WHERE email=?',input.email)) throw new AppError('Unable to create this account. Try signing in or resetting your password.',409)
  await run('UPDATE otp_challenges SET used_at=? WHERE phone=? AND used_at IS NULL',now(),input.phone)
  await run("UPDATE notifications SET status='failed',sensitive_payload=NULL,error='Superseded verification code' WHERE recipient=? AND notification_type='OTP' AND status='queued'",input.phone)
  await run('INSERT INTO otp_challenges (id,phone,name,email,password_hash,user_id,code_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',challenge,input.phone,input.name,input.email,input.password ? passwordHash(input.password) : null,userId||null,codeHash,expires,now())
  await queue({userId,channel:'sms',recipient:input.phone,message:await smsText('OTP',{customerName:input.name,code}),key:`otp:${challenge}`,type:'OTP',expiresAt:expires,sensitive:true})
 })
 return {challenge, message:'Your verification code has been queued. It expires in 5 minutes. You can request another code after 60 seconds.'}
}
export async function verifyOtp(challenge: string, code: string, userId?: string) {
 if (!/^[0-9a-f-]{36}$/.test(challenge) || !/^\d{6}$/.test(code)) throw new AppError('Enter the six-digit verification code.')
 await throttle(`otp:verify:${challenge}`,10,900)
 const result = await atomic(async()=>{
  const row = await one('SELECT * FROM otp_challenges WHERE id=?',challenge)
  if (!row || row.used_at || row.expires_at<=now() || row.attempts>=5 || (row.user_id||undefined)!==userId) return null
  await run('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?',challenge)
  if (!timingSafeEqual(Buffer.from(digest(challenge,code),'hex'),Buffer.from(row.code_hash,'hex'))) return null
  let account = row.user_id
  if (account) {
   const updated = await run('UPDATE users SET phone_verified=1 WHERE id=? AND phone=?',account,row.phone)
   if (!updated.changes) return null
  } else {
   account=id()
   await run('INSERT INTO users (id,email,name,phone,password,phone_verified,created_at) VALUES (?,?,?,?,?,1,?)',account,row.email,row.name,row.phone,row.password_hash,now())
   await queue({userId:account,channel:'sms',recipient:row.phone,message:await smsText('WELCOME',{customerName:row.name}),key:`welcome:${account}`,type:'WELCOME'})
  }
  await run('UPDATE otp_challenges SET used_at=?,password_hash=NULL WHERE id=?',now(),challenge)
  await audit(account,'phone.verified','user',account,{})
  return account as string
 })
 if (!result) throw new AppError('Verification code is incorrect, expired, or has reached its attempt limit.')
 return result
}
