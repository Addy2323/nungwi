import { z } from 'zod'
import { atomic,audit,id,now,one,run } from '../lib/server/db'
import { tokenFor } from '../lib/server/auth'
try {process.loadEnvFile('.env.local')}catch{}
const email=z.string().email().transform(v=>v.toLowerCase()).parse(process.argv[2])
const base=process.env.APP_URL||'http://localhost:3000'
const token=atomic(()=>{
  const existing=one('SELECT * FROM users WHERE email=?',email)
  if(existing && existing.role!=='admin')throw new Error('This address belongs to a non-admin account. Use the authenticated dashboard to change its role.')
  const userId=existing?.id||id()
  if(!existing)run("INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,'admin',?)",userId,email,process.argv[3]||'Shop administrator',now())
  audit(null,'admin.invitation','user',userId,{email})
  return tokenFor(userId,'invite',60)
})
console.log(`One-time admin invitation for ${email} (expires in one hour):\n${base}/accept-invitation?token=${token}\nShare only with the intended administrator. No password was created.`)
