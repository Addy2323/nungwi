import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { db } from '../lib/server/db'
try {process.loadEnvFile('.env.local')}catch{}
async function main(){const folder=path.resolve(process.env.BACKUP_DIR||'backups');await mkdir(folder,{recursive:true});const target=path.join(folder,`nungwi-${new Date().toISOString().replaceAll(':','-')}.sqlite`);await db().backup(target);console.log(`Verified SQLite backup created: ${target}`)}
main().catch(error=>{console.error(error.message);process.exitCode=1})
