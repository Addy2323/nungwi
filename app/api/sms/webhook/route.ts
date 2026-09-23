import { one, run, now } from '@/lib/server/db'
import { throttle } from '@/lib/server/auth'
import { smsProvider, parseMackJson } from '@/lib/server/sms-provider'
export const runtime='nodejs'
// MackSMS does not document signed callbacks. Treat callbacks only as hints;
// obtain the authoritative status from the authenticated provider API.
export async function POST(request:Request) {
 try {
  await throttle('macksms:webhook',300,60)
  const text=await request.text()
  if(text.length>10000)return new Response(null,{status:413})
  const body=parseMackJson(text)
  if(typeof body.messageID!=='string'||!/^\d{1,30}$/.test(body.messageID))return new Response(null,{status:400})
  const row=await one("SELECT id FROM notifications WHERE provider='macksms' AND provider_id=? AND status IN ('submitted','sent')",body.messageID)
  if(row){const status=await smsProvider('macksms').status(body.messageID);await run("UPDATE notifications SET status=?,updated_at=?,failed_at=? WHERE id=? AND status IN ('submitted','sent')",status,now(),status==='failed'?now():null,row.id)}
  return Response.json({received:true})
 }catch{return Response.json({error:'Report reconciliation unavailable.'},{status:503})}
}
