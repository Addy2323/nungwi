import path from 'node:path'
import { existsSync } from 'node:fs'
import { Client } from 'pg'
import { pgTool } from './pg-tools'
async function main(){
 const source=path.resolve(process.argv[2]||'')
 if(!existsSync(source)||!source.endsWith('.dump')||!process.env.RESTORE_DATABASE_URL)throw new Error('Usage: set RESTORE_DATABASE_URL to a separate empty database, then npm run db:restore -- backup.dump')
 const target=new URL(process.env.RESTORE_DATABASE_URL);target.searchParams.delete('schema')
 const live=new URL(process.env.DATABASE_URL!)
 if(target.host===live.host&&target.pathname===live.pathname)throw new Error('Restore into a separate empty database; live database replacement is not supported.')
 const client=new Client({connectionString:target.toString()});await client.connect()
 try{const result=await client.query("SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') LIMIT 1");if(result.rowCount)throw new Error('Restore target must contain no user tables.')}finally{await client.end()}
 await pgTool('pg_restore',['--no-password','--single-transaction','--exit-on-error','--dbname',decodeURIComponent(target.pathname.slice(1)),source],target.toString())
 console.log('Backup restored into the separate database. Verify it before changing DATABASE_URL.')
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
