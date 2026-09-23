import { closeDb } from '../lib/server/db'
import { processNotifications,refreshSms,smsConfigured,deliveryConfigured } from '../lib/server/notifications'
import { expandCampaigns } from '../lib/server/sms-admin'
try {process.loadEnvFile('.env.local')}catch{}
let stopping=false
process.on('SIGINT',()=>{stopping=true})
process.on('SIGTERM',()=>{stopping=true})
async function cycle(){await expandCampaigns();const processed=await processNotifications(100);if(await smsConfigured())await refreshSms();console.log(JSON.stringify({processed:processed.length,smsConfigured:await smsConfigured(),emailConfigured:deliveryConfigured('email')}))}
async function main(){do{try{await cycle()}catch{console.error('Notification worker cycle failed. Check database and provider configuration.');if(!process.argv.includes('--watch'))throw new Error('Worker failed')}if(process.argv.includes('--watch')&&!stopping)await new Promise(resolve=>setTimeout(resolve,5000))}while(process.argv.includes('--watch')&&!stopping)}
main().catch(()=>{process.exitCode=1}).finally(closeDb)
