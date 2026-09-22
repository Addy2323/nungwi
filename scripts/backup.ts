import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pgTool } from './pg-tools'
async function main(){
 const folder=path.resolve(process.env.BACKUP_DIR||'backups');await mkdir(folder,{recursive:true})
 const target=path.join(folder,`nungwi-${new Date().toISOString().replaceAll(':','-')}.dump`)
 await pgTool('pg_dump',['--no-password','--format=custom','--file',target])
 await pgTool('pg_restore',['--list',target])
 console.log(`PostgreSQL backup created and archive listing verified: ${target}`)
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
