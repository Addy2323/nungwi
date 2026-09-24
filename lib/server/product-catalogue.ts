import { z } from 'zod'
import { all, one, run, atomic, audit, id, now } from './db'
import { AppError, permit, type Actor } from './auth'
import { searchWords } from '../product-workflow'

export async function searchProducts(actor: Actor, params: Record<string, string>) {
  permit(actor, ['admin', 'stock', 'sales'])
  const input = z.object({ q: z.string().max(150).default(''), page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20), status: z.enum(['active','archived','all']).default('active'),
    category: z.string().max(500).default(''), stock: z.enum(['all','low','out']).default('all'), id: z.string().optional() }).parse(params)
  const args: unknown[] = [now()]
  const clauses = ['1=1']
  if (input.id) { clauses.push('p.id=?'); args.push(input.id) }
  if (input.status !== 'all') { clauses.push('p.active=?'); args.push(input.status === 'active' ? 1 : 0) }
  if (input.category) { clauses.push('p.category=?'); args.push(input.category) }
  for (const word of searchWords(input.q)) {
    clauses.push(`(lower(p.name || ' ' || p.brand || ' ' || p.sku || ' ' || coalesce(p.barcode,'')) LIKE ? OR EXISTS (SELECT 1 FROM product_codes c WHERE c.product_id=p.id AND lower(c.code) LIKE ?))`)
    args.push(`%${word}%`, `%${word}%`)
  }
  if (input.stock === 'low') clauses.push('coalesce(s.available,0)<=p.reorder_level')
  if (input.stock === 'out') clauses.push('coalesce(s.available,0)=0')
  const rows = await all(`SELECT p.*,coalesce(s.available,0) AS available,coalesce(s.reserved,0) AS reserved
    FROM products p LEFT JOIN (SELECT product_id,SUM(CASE WHEN expires_at>? THEN remaining-reserved ELSE 0 END) AS available,SUM(reserved) AS reserved FROM batches GROUP BY product_id) s ON s.product_id=p.id
    WHERE ${clauses.join(' AND ')}
    ORDER BY ${input.q || input.id ? '' : "(SELECT MAX(created_at) FROM stock_movements m WHERE m.product_id=p.id AND m.kind='received') DESC NULLS LAST,"} lower(p.name),p.id LIMIT ? OFFSET ?`, ...args, input.limit + 1, (input.page - 1) * input.limit)
  return { items: rows.slice(0,input.limit).map(p => ({ ...p, units: JSON.parse(p.units) })), hasMore: rows.length > input.limit, page: input.page }
}

export async function catalogueOptions(actor: Actor) {
  permit(actor, ['admin','stock','sales'])
  return { categories: await all('SELECT id,name,active FROM drink_categories ORDER BY lower(name)'), brands: await all("SELECT DISTINCT brand FROM products WHERE brand<>'' ORDER BY brand LIMIT 500") }
}

export async function saveCategory(actor: Actor, raw: unknown) {
  permit(actor, ['admin','stock'])
  const input = z.object({ id:z.string().optional(), name:z.string().trim().min(1).max(100), active:z.boolean().default(true) }).parse(raw)
  return atomic(async () => {
    const key = input.id || id()
    const old = await one('SELECT * FROM drink_categories WHERE id=?',key)
    if (input.id && !old) throw new AppError('Category not found.',404)
    if (await one('SELECT id FROM drink_categories WHERE lower(name)=lower(?) AND id<>?',input.name,key)) throw new AppError('A category with this name already exists.')
    await run("INSERT INTO drink_categories(id,name,type,icon,created_at,active) VALUES (?,?,'NON_ALCOHOLIC','',?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active",key,input.name,now(),Number(input.active))
    if (old && old.name !== input.name) await run('UPDATE products SET category=? WHERE category=?',input.name,old.name)
    await audit(actor.id,'category.saved','category',key,input)
    return { id:key,...input }
  })
}
