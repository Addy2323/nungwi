import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { Pool, types, type PoolClient } from 'pg'

export type Row = Record<string, any>
export const id = () => randomUUID()
export const now = () => new Date().toISOString()
// PostgreSQL returns int8 aggregates as strings. Reject values JS cannot represent exactly.
types.setTypeParser(20, value => { const number = Number(value); if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds the safe range'); return number })
// NUMERIC also includes decimal product properties, such as alcohol_percentage.
// BIGINT money sums still need to stay within JavaScript's safe integer range.
types.setTypeParser(1700, value => {
  const number = Number(value)
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) throw new Error('Database numeric value exceeds the safe range')
  return number
})
const state = globalThis as unknown as { nungwiPool?: Pool; nungwiTransaction?: AsyncLocalStorage<PoolClient> }
const transaction = state.nungwiTransaction ??= new AsyncLocalStorage<PoolClient>()
export function db() {
  if (!state.nungwiPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Configure PostgreSQL in .env.local.')
    const url = new URL(process.env.DATABASE_URL)
    const schema = url.searchParams.get('schema') || 'public'
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema')
    url.searchParams.delete('schema')
    state.nungwiPool = new Pool({ connectionString: url.toString(), max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, options: `-c search_path=${schema},pg_catalog -c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000` })
    state.nungwiPool.on('error', () => console.error('[database] Idle PostgreSQL connection failed'))
  }
  return state.nungwiPool
}
// Keep the application's positional-query interface; never interpolate user values into SQL.
export function postgresSql(sql: string) {
  let index = 0
  const converted = sql.replace(/'(?:''|[^'])*'|\?/g, token => token === '?' ? `$${++index}` : token)
  return /^INSERT OR IGNORE /i.test(converted) ? converted.replace(/^INSERT OR IGNORE /i, 'INSERT ') + ' ON CONFLICT DO NOTHING' : converted
}
export async function all(sql: string, ...args: any[]): Promise<Row[]> { return (await (transaction.getStore() || db()).query(postgresSql(sql), args)).rows }
export async function one(sql: string, ...args: any[]): Promise<Row | undefined> { return (await all(sql, ...args))[0] }
export async function run(sql: string, ...args: any[]) { const result = await (transaction.getStore() || db()).query(postgresSql(sql), args); return { changes: result.rowCount ?? 0 } }
export async function atomic<T>(fn: () => Promise<T>): Promise<T> {
  if (transaction.getStore()) return fn()
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    // Preserve SQLite's serialized write semantics across processes for stock, refunds,
    // invitation redemption and outbox claims. Acquire before any business-data reads.
    await client.query('SELECT pg_advisory_xact_lock(184733, 1)')
    const result = await transaction.run(client, fn)
    await client.query('COMMIT')
    return result
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
export async function audit(actor: string | null, action: string, entity: string, entityId: string, detail: unknown) { await run('INSERT INTO audit VALUES (?,?,?,?,?,?,?)', id(), actor, action, entity, entityId, JSON.stringify(detail), now()) }
export async function setting(key: string, fallback: string) { return (await one('SELECT value FROM settings WHERE key=?', key))?.value ?? fallback }
export async function eachAsync<T>(items: readonly T[], fn: (item: T, index: number) => Promise<unknown>) { for (let i = 0; i < items.length; i++) await fn(items[i], i) }
export async function closeDb() { await state.nungwiPool?.end(); state.nungwiPool = undefined }
