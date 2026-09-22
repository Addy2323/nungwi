import { z } from 'zod'
import { atomic,audit,closeDb,id,now,one,run } from '../lib/server/db'
import { tokenFor } from '../lib/server/auth'
try {process.loadEnvFile('.env.local')}catch{}
async function main(){
 const email=z.string().email().transform(v=>v.toLowerCase()).parse(process.argv[2])
 const token=await atomic(async()=>{
  const existing=await one('SELECT * FROM users WHERE lower(email)=?',email)
  if(existing && existing.role!=='admin')throw new Error('This address belongs to a non-admin account. Use the authenticated dashboard to change its role.')
  if(existing && !existing.active)throw new Error('This admin account is inactive.')
  const userId=existing?.id||id()
  if(!existing)await run("INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,'admin',?)",userId,email,process.argv[3]||'Shop administrator',now())
  await audit(null,'admin.invitation','user',userId,{email})
  return tokenFor(userId,'invite',60)
 })
 console.log(`One-time admin invitation for ${email} (expires in one hour):\n${process.env.APP_URL||'http://localhost:3000'}/accept-invitation?token=${token}\nShare only with the intended administrator. No password was created.`)
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(closeDb)
