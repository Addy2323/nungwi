import { spawn } from 'node:child_process'
import path from 'node:path'
try { process.loadEnvFile('.env.local') } catch {}
export function pgTool(name: 'pg_dump' | 'pg_restore', args: string[], databaseUrl = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL) {
 if (!databaseUrl) throw new Error('Configure DATABASE_ADMIN_URL for backup and restore.')
 const url = new URL(databaseUrl)
 const command = process.env.PG_BIN ? path.join(process.env.PG_BIN, name + (process.platform === 'win32' ? '.exe' : '')) : name
 return new Promise<void>((resolve,reject)=>{
  const child=spawn(command,args,{shell:false,windowsHide:true,stdio:'inherit',env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)}})
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${name} exited with status ${code}`)))
 })
}
