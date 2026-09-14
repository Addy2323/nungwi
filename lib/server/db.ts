import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type Row = Record<string, any>
const globalDb = globalThis as unknown as { nungwiDb?: Database.Database }
export const id = () => randomUUID()
export const now = () => new Date().toISOString()
export function db() {
  if (globalDb.nungwiDb) return globalDb.nungwiDb
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'nungwi.sqlite')
  mkdirSync(path.dirname(file), { recursive: true })
  const connection = new Database(file)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.pragma('busy_timeout = 5000')
  connection.exec(`
    CREATE TABLE IF NOT EXISTS hotels (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', code TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1, rule TEXT NOT NULL DEFAULT '{"method":"percentage","value":0,"scope":"referral","tiers":[]}', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL COLLATE NOCASE, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', phone_verified INTEGER NOT NULL DEFAULT 0, password TEXT, role TEXT NOT NULL DEFAULT 'customer', hotel_id TEXT REFERENCES hotels(id), active INTEGER NOT NULL DEFAULT 1, notifications INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '/images/mango-coast.png', volume TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT 'bottle', unit_size INTEGER NOT NULL DEFAULT 1 CHECK(unit_size>0), price INTEGER NOT NULL CHECK(price>=0), hotel_price INTEGER, cost INTEGER NOT NULL DEFAULT 0 CHECK(cost>=0), sku TEXT UNIQUE NOT NULL, reorder_level INTEGER NOT NULL DEFAULT 10, min_qty INTEGER NOT NULL DEFAULT 1, deposit INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), label TEXT NOT NULL, expires_at TEXT NOT NULL, remaining INTEGER NOT NULL CHECK(remaining>=0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=remaining), cost INTEGER NOT NULL CHECK(cost>=0), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), hotel_id TEXT REFERENCES hotels(id), referral_id TEXT REFERENCES hotels(id), recipient TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', delivery_window TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Pending', subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, delivery_fee INTEGER NOT NULL DEFAULT 0, tax INTEGER NOT NULL DEFAULT 0, deposit INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, payment_method TEXT NOT NULL, promotion TEXT, driver TEXT, code_hash TEXT NOT NULL, customer_code TEXT NOT NULL, driver_token TEXT, driver_token_expires TEXT, idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,idempotency_key));
    CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), base_quantity INTEGER NOT NULL, unit TEXT NOT NULL, unit_price INTEGER NOT NULL, cost INTEGER NOT NULL DEFAULT 0, deposit INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS allocations (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES order_items(id), batch_id TEXT NOT NULL REFERENCES batches(id), quantity INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'reserved');
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), batch_id TEXT REFERENCES batches(id), order_id TEXT REFERENCES orders(id), kind TEXT NOT NULL, quantity INTEGER NOT NULL, cost INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_history (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), amount INTEGER NOT NULL CHECK(amount>0), kind TEXT NOT NULL, method TEXT NOT NULL, reference TEXT UNIQUE NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commissions (id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL REFERENCES orders(id), hotel_id TEXT NOT NULL REFERENCES hotels(id), rule TEXT NOT NULL, eligible INTEGER NOT NULL, expected INTEGER NOT NULL, earned INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL REFERENCES hotels(id), amount INTEGER NOT NULL, reference TEXT UNIQUE NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payout_items (payout_id TEXT NOT NULL REFERENCES payouts(id), commission_id TEXT NOT NULL REFERENCES commissions(id), amount INTEGER NOT NULL, PRIMARY KEY(payout_id,commission_id));
    CREATE TABLE IF NOT EXISTS drivers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, vehicle TEXT NOT NULL, registration TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL, offer_text TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#ff5405', template TEXT NOT NULL DEFAULT 'banner', button TEXT NOT NULL DEFAULT 'Shop now', product_ids TEXT NOT NULL DEFAULT '[]', audience TEXT NOT NULL DEFAULT 'all', kind TEXT NOT NULL DEFAULT 'percentage', value INTEGER NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), audience TEXT NOT NULL, order_id TEXT REFERENCES orders(id), channel TEXT NOT NULL, recipient TEXT NOT NULL, message TEXT NOT NULL, dedup_key TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), label TEXT NOT NULL, address TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS favourites (user_id TEXT NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES products(id), PRIMARY KEY(user_id,product_id));
    CREATE TABLE IF NOT EXISTS support (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT REFERENCES orders(id), message TEXT NOT NULL, reply TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Open', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK(amount>0), description TEXT NOT NULL, date TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_hotel ON orders(hotel_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_notification_status ON notifications(status,created_at);
  `)
  globalDb.nungwiDb = connection
  if (!(connection.pragma('table_info(products)') as Row[]).some(column=>column.name==='units')) connection.exec("ALTER TABLE products ADD COLUMN units TEXT NOT NULL DEFAULT '[]'")
  // Seed the established catalogue only. No invented sales, stock, users, or commissions.
  if (!one('SELECT id FROM products LIMIT 1')) {
    const seed = [['1','Mango Coast','Soft drinks',10325,'mango-coast'],['2','Spice Route','Juices',11860,'spice-route'],['3','Stone Town Fizz','Soft drinks',9275,'stone-town-fizz'],['4','Zanzibar Sunrise','Cocktails',12400,'zanzibar-sunrise']]
    connection.transaction(() => seed.forEach(([key,name,category,price,image]) => run('INSERT INTO products (id,name,category,price,sku,image,created_at) VALUES (?,?,?,?,?,?,?)',key,name,category,price,`NUNGWI-${key}`,`/images/${image}.png`,now())))()
  }
  return connection
}
export function all(sql: string, ...args: any[]): Row[] { return db().prepare(sql).all(...args) as Row[] }
export function one(sql: string, ...args: any[]): Row | undefined { return db().prepare(sql).get(...args) as Row | undefined }
export function run(sql: string, ...args: any[]) { return db().prepare(sql).run(...args) }
export function atomic<T>(fn: () => T): T { return db().transaction(fn).immediate() }
export function audit(actor: string | null, action: string, entity: string, entityId: string, detail: unknown) { run('INSERT INTO audit VALUES (?,?,?,?,?,?,?)',id(),actor,action,entity,entityId,JSON.stringify(detail),now()) }
export function setting(key: string, fallback: string) { return one('SELECT value FROM settings WHERE key=?',key)?.value ?? fallback }
