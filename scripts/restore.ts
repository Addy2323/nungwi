import Database from 'better-sqlite3'
import { existsSync,copyFileSync,mkdirSync,renameSync } from 'node:fs'
import path from 'node:path'
try {process.loadEnvFile('.env.local')}catch{}
if(process.argv[3]!=='--confirm-stopped')throw new Error('Stop Next.js and all workers first. Then run: npm run db:restore -- <backup.sqlite> --confirm-stopped')
const source=path.resolve(process.argv[2]||'');const target=path.resolve(process.env.DATABASE_PATH||'data/nungwi.sqlite')
if(!source.endsWith('.sqlite')||!existsSync(source)||source===target)throw new Error('Choose a separate existing .sqlite backup.')
const check=new Database(source,{readonly:true,fileMustExist:true});const integrity=check.pragma('integrity_check',{simple:true});check.close();if(integrity!=='ok')throw new Error('Backup integrity check failed.')
mkdirSync(path.dirname(target),{recursive:true})
const stamp=Date.now()
for(const file of [target,`${target}-wal`,`${target}-shm`])if(existsSync(file))renameSync(file,`${file}.before-restore-${stamp}`)
copyFileSync(source,target)
console.log('Backup restored. Previous database files were preserved beside the restored database. Restart the app.')
