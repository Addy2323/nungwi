// Read-only browser smoke check. Creates a short-lived session and revokes it on exit.
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { closeDb, one, run } from '../lib/server/db'
import { hash } from '../lib/server/auth'
try { process.loadEnvFile('.env.local') } catch {}
async function main() {
  const admin = await one("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1")
  if (!admin) throw new Error('Browser check requires an existing active admin account.')
  const token = randomBytes(32).toString('hex')
  await run('INSERT INTO sessions VALUES (?,?,?)', hash(token), admin.id, new Date(Date.now()+300000).toISOString())
  try {
    const result = spawnSync('python', ['design/check-erp.py'], { windowsHide:true, stdio:'inherit', env:{ ...process.env, NUNGWI_BROWSER_TOKEN:token }, timeout:240000 })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error('ERP browser check failed.')
  } finally { await run('DELETE FROM sessions WHERE token=?', hash(token)) }
}
main().catch(error => { console.error(error.message); process.exitCode=1 }).finally(closeDb)
