import { processNotifications,refreshSms,deliveryConfigured } from '../lib/server/notifications'
try {process.loadEnvFile('.env.local')}catch{}
async function main(){const processed=await processNotifications(100);if(deliveryConfigured('sms'))await refreshSms();console.log(JSON.stringify({processed:processed.length,smsConfigured:deliveryConfigured('sms'),emailConfigured:deliveryConfigured('email')}))}
main().catch(error=>{console.error(error.message);process.exitCode=1})
