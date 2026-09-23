import { AppError, originGuard, requireUser, throttle } from '@/lib/server/auth'
import { smsSettings,saveSmsSettings,saveTemplate,campaign,smsDashboard } from '@/lib/server/sms-admin'
import { z } from 'zod'
export const runtime='nodejs'
export const dynamic='force-dynamic'
function failure(error:unknown) {return Response.json({error:error instanceof AppError?error.message:error instanceof z.ZodError?'Check the form fields.':'Unable to complete this SMS request.'},{status:error instanceof AppError?error.status:error instanceof z.ZodError?400:500})}
export async function GET(request:Request) {
 try {const actor=await requireUser(),params=new URL(request.url).searchParams;return Response.json({data:params.get('resource')==='settings'?await smsSettings(actor):await smsDashboard(actor,params)},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}
}
export async function POST(request:Request) {
 try {
  originGuard(request);const actor=await requireUser();await throttle(`sms-admin:${actor.id}`,100,60)
  const raw=await request.text();if(raw.length>500000)throw new AppError('Request too large.',413)
  const body=JSON.parse(raw);let data:unknown={success:true}
  if(body.action==='settings')await saveSmsSettings(actor,body)
  else if(body.action==='template')await saveTemplate(actor,body)
  else if(body.action==='preview'||body.action==='campaign')data=await campaign(actor,body,body.action==='campaign')
  else throw new AppError('Unknown action.',404)
  return Response.json({data})
 }catch(e){return failure(e)}
}
