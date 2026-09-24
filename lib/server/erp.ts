import { z } from 'zod'
import { AppError, permit, type Actor } from './auth'
import { all, atomic, audit, id, now, one, run, type Row } from './db'
import { receiveStock } from './orders'
import { date, money, quantity, text } from './validation'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Use a valid calendar date')
const optionalText = z.string().trim().max(500).default('')
const days = z.number().int().min(0).max(365)
const reference = z.string().trim().min(1).max(100)
const method = z.enum(['cash', 'bank_transfer', 'mobile_money', 'card'])
const supplierInput = z.object({ id: text.optional(), name: text, contact: optionalText, phone: optionalText, email: z.union([z.email(), z.literal('')]).default(''), address: optionalText, payment_days: days.default(30), active: z.boolean().default(true) })
const purchaseInput = z.object({ supplier_id: text, notes: optionalText, items: z.array(z.object({ product_id: text, quantity, unit_cost: money })).min(1).max(100) })
const number = (prefix: string, key: string) => `${prefix}-${key.toUpperCase()}`
const dueIn = (count: number) => new Date(Date.now() + count * 86400000).toISOString().slice(0, 10)

export function outstanding(amount: number, paid: number) { return Math.max(0, amount - paid) }
export function agingBucket(due: string, balance: number, today = now().slice(0, 10)) {
  if (balance <= 0) return 'Paid'
  const late = Math.floor((Date.parse(today) - Date.parse(due.slice(0, 10))) / 86400000)
  return late <= 0 ? 'Current' : late <= 30 ? '1–30 days' : late <= 60 ? '31–60 days' : late <= 90 ? '61–90 days' : '90+ days'
}

export async function erpData(actor: Actor) {
  permit(actor, ['admin'])
  const suppliers = await all('SELECT * FROM suppliers ORDER BY name')
  const purchases = await all(`SELECT p.*,s.name AS supplier, s.payment_days,
    COALESCE((SELECT SUM(i.quantity*i.unit_cost) FROM purchase_items i WHERE i.purchase_id=p.id),0) AS total
    FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.created_at DESC`)
  const items = await all('SELECT i.*,p.name,p.sku FROM purchase_items i JOIN products p ON p.id=i.product_id ORDER BY p.name')
  const bills = (await all(`SELECT b.*,b.due_date::text AS due_date,p.number AS purchase_number,s.name AS supplier,
    COALESCE((SELECT SUM(amount) FROM supplier_payments x WHERE x.bill_id=b.id),0) AS paid
    FROM supplier_bills b JOIN purchase_orders p ON p.id=b.purchase_id JOIN suppliers s ON s.id=p.supplier_id ORDER BY b.due_date`))
    .map((b): Row => ({ ...b, balance: outstanding(b.amount, b.paid), aging: agingBucket(b.due_date, outstanding(b.amount, b.paid)) }))
  const invoices = (await all(`SELECT i.*,i.due_date::text AS due_date,o.number AS order_number,o.status AS order_status,o.total,u.name AS customer,
    COALESCE((SELECT SUM(CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.order_id=o.id),0) AS paid
    FROM customer_invoices i JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=o.user_id ORDER BY i.due_date`))
    .map((i): Row => ({ ...i, balance: ['Cancelled', 'Returned'].includes(i.order_status) ? 0 : outstanding(i.total, i.paid), aging: ['Cancelled', 'Returned'].includes(i.order_status) ? 'Closed order' : agingBucket(i.due_date, outstanding(i.total, i.paid)) }))
  return {
    suppliers, purchases: purchases.map(p => ({ ...p, items: items.filter(i => i.purchase_id === p.id) })), bills, invoices,

    customers: await all("SELECT u.id,u.name,u.email,COALESCE(t.payment_days,0) AS payment_days FROM users u LEFT JOIN customer_terms t ON t.user_id=u.id WHERE u.role IN ('customer','hotel_manager','hotel_staff') ORDER BY u.name"),
    orders: await all("SELECT o.id,o.number,o.total,u.name AS customer FROM orders o JOIN users u ON u.id=o.user_id WHERE o.status NOT IN ('Cancelled','Returned') AND NOT EXISTS (SELECT 1 FROM customer_invoices i WHERE i.order_id=o.id) ORDER BY o.created_at DESC"),
    receipts: await all('SELECT r.*,p.number AS purchase_number,x.name AS product FROM purchase_receipts r JOIN purchase_items i ON i.id=r.item_id JOIN purchase_orders p ON p.id=i.purchase_id JOIN products x ON x.id=i.product_id ORDER BY r.created_at DESC'),
    transactions: await financeTransactions(actor),
  }
}

export async function financeTransactions(actor: Actor) {
  permit(actor, ['admin'])
  return all(`SELECT t.*,r.statement_reference,r.created_at AS reconciled_at FROM (
    SELECT 'customer_payment' AS source,p.id,p.created_at,p.method::text AS method,p.reference,
      CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END AS amount,o.number AS description
      FROM payments p JOIN orders o ON o.id=p.order_id
    UNION ALL SELECT 'supplier_payment',p.id,p.created_at,p.method,p.reference,-p.amount,b.reference FROM supplier_payments p JOIN supplier_bills b ON b.id=p.bill_id
    UNION ALL SELECT 'expense',e.id,e.date,'unspecified','',-e.amount,e.description FROM expenses e
    UNION ALL SELECT 'commission_payout',p.id,p.created_at,'unspecified',p.reference,-p.amount,h.name FROM payouts p JOIN hotels h ON h.id=p.hotel_id
    ) t LEFT JOIN finance_reconciliations r ON r.source=t.source AND r.source_id=t.id ORDER BY t.created_at DESC`)
}

export async function erpAction(actor: Actor, action: string, body: unknown) {
  permit(actor, ['admin'])
  return atomic(async () => {
    let entityId: string
    let detail: unknown
    if (action === 'supplier.save') {
      const input = supplierInput.parse(body)
      entityId = input.id || id()
      if (input.id && !await one('SELECT id FROM suppliers WHERE id=?', input.id)) throw new AppError('Supplier not found.', 404)
      await run(`INSERT INTO suppliers(id,name,contact,phone,email,address,payment_days,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,contact=excluded.contact,phone=excluded.phone,email=excluded.email,address=excluded.address,payment_days=excluded.payment_days,active=excluded.active`, entityId, input.name, input.contact, input.phone, input.email, input.address, input.payment_days, input.active, now())
      detail = input
    } else if (action === 'purchase.create') {
      const input = purchaseInput.parse(body)
      if (new Set(input.items.map(i => i.product_id)).size !== input.items.length) throw new AppError('Use one line per product.')
      if (!await one('SELECT id FROM suppliers WHERE id=? AND active=true', input.supplier_id)) throw new AppError('Choose an active supplier.')
      if (!Number.isSafeInteger(input.items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0))) throw new AppError('Purchase total exceeds supported capacity.')
      entityId = id()
      await run('INSERT INTO purchase_orders(id,number,supplier_id,notes,created_by,created_at) VALUES (?,?,?,?,?,?)', entityId, number('PO', entityId), input.supplier_id, input.notes, actor.id, now())
      for (const item of input.items) {
        if (!await one('SELECT id FROM products WHERE id=? AND active=1', item.product_id)) throw new AppError('Choose active products.')
        await run('INSERT INTO purchase_items(id,purchase_id,product_id,quantity,unit_cost) VALUES (?,?,?,?,?)', id(), entityId, item.product_id, item.quantity, item.unit_cost)
      }
      detail = input
    } else if (action === 'purchase.approve' || action === 'purchase.cancel') {
      const input = z.object({ id: text }).parse(body)
      const purchase = await one('SELECT * FROM purchase_orders WHERE id=?', input.id)
      if (!purchase) throw new AppError('Purchase order not found.', 404)
      if (action === 'purchase.approve') {
        if (purchase.status !== 'Draft') throw new AppError('Only draft purchases can be approved.')
        await run("UPDATE purchase_orders SET status='Approved',approved_by=?,approved_at=? WHERE id=?", actor.id, now(), input.id)
      } else {
        if (!['Draft', 'Approved'].includes(purchase.status)) throw new AppError('Only unreceived purchases can be cancelled.')
        await run("UPDATE purchase_orders SET status='Cancelled' WHERE id=?", input.id)
      }
      entityId = input.id; detail = input
    } else if (action === 'purchase.receive') {
      const input = z.object({ item_id: text, quantity, reference, expires_at: date }).parse(body)
      const item = await one('SELECT i.*,p.status FROM purchase_items i JOIN purchase_orders p ON p.id=i.purchase_id WHERE i.id=?', input.item_id)
      if (!item || !['Approved', 'Partially received'].includes(item.status)) throw new AppError('Approve the purchase before receiving stock.')
      if (input.quantity > item.quantity - item.received) throw new AppError('Receipt exceeds the remaining ordered quantity.')
      if (input.expires_at <= now()) throw new AppError('Received stock must have a future expiry date.')
      const batch = await receiveStock(actor, { product_id: item.product_id, quantity: input.quantity, cost: item.unit_cost, label: input.reference, expires_at: input.expires_at, reason: 'Purchase receipt ' + item.purchase_id })
      entityId = id()
      await run('INSERT INTO purchase_receipts VALUES (?,?,?,?,?,?,?)', entityId, item.id, batch, input.quantity, input.reference, actor.id, now())
      await run('UPDATE purchase_items SET received=received+? WHERE id=?', input.quantity, item.id)
      const pending = await one('SELECT id FROM purchase_items WHERE purchase_id=? AND received<quantity LIMIT 1', item.purchase_id)
      await run('UPDATE purchase_orders SET status=? WHERE id=?', pending ? 'Partially received' : 'Received', item.purchase_id)
      detail = input
    } else if (action === 'bill.create') {
      const input = z.object({ purchase_id: text, reference, due_date: day.optional() }).parse(body)
      const purchase = await one('SELECT p.*,s.payment_days FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?', input.purchase_id)
      if (!purchase || purchase.status !== 'Received') throw new AppError('Receive all ordered stock before recording the supplier bill.')
      if (await one('SELECT b.id FROM supplier_bills b JOIN purchase_orders p ON p.id=b.purchase_id WHERE p.supplier_id=? AND b.reference=?', purchase.supplier_id, input.reference)) throw new AppError('This supplier invoice reference is already recorded.')
      const amount = (await one('SELECT SUM(quantity*unit_cost) AS value FROM purchase_items WHERE purchase_id=?', input.purchase_id))!.value
      if (amount <= 0) throw new AppError('A bill must have a positive total.')
      entityId = id()
      await run('INSERT INTO supplier_bills VALUES (?,?,?,?,?,?,?)', entityId, input.purchase_id, input.reference, amount, input.due_date || dueIn(purchase.payment_days), actor.id, now())
      detail = { ...input, amount }
    } else if (action === 'bill.pay') {
      const input = z.object({ bill_id: text, amount: money.positive(), method, reference }).parse(body)
      const bill = await one('SELECT b.*,COALESCE((SELECT SUM(amount) FROM supplier_payments p WHERE p.bill_id=b.id),0) AS paid FROM supplier_bills b WHERE b.id=?', input.bill_id)
      if (!bill || input.amount > bill.amount - bill.paid) throw new AppError('Payment exceeds the unpaid supplier balance.')
      entityId = id()
      await run('INSERT INTO supplier_payments VALUES (?,?,?,?,?,?,?)', entityId, input.bill_id, input.amount, input.method, input.reference, actor.id, now())
      detail = input
    } else if (action === 'terms.save') {
      const input = z.object({ user_id: text, payment_days: days }).parse(body)
      if (!await one("SELECT id FROM users WHERE id=? AND role IN ('customer','hotel_manager','hotel_staff')", input.user_id)) throw new AppError('Choose a customer or hotel account.')
      await run('INSERT INTO customer_terms VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET payment_days=excluded.payment_days', input.user_id, input.payment_days)
      entityId = input.user_id; detail = input
    } else if (action === 'invoice.create') {
      const input = z.object({ order_id: text, due_date: day.optional() }).parse(body)
      const order = await one('SELECT o.*,COALESCE(t.payment_days,0) AS payment_days FROM orders o LEFT JOIN customer_terms t ON t.user_id=o.user_id WHERE o.id=?', input.order_id)
      if (!order || ['Cancelled', 'Returned'].includes(order.status)) throw new AppError('Choose an open order.')
      entityId = id()
      await run('INSERT INTO customer_invoices VALUES (?,?,?,?,?,?)', entityId, number('INV', entityId), input.order_id, input.due_date || dueIn(order.payment_days), actor.id, now())
      detail = input
    } else if (action === 'finance.reconcile') {
      const input = z.object({ source: z.enum(['customer_payment','supplier_payment','expense','commission_payout']), source_id: text, statement_reference: reference }).parse(body)
      const tables = { customer_payment: 'payments', supplier_payment: 'supplier_payments', expense: 'expenses', commission_payout: 'payouts' }
      if (!await one(`SELECT id FROM ${tables[input.source]} WHERE id=?`, input.source_id)) throw new AppError('Transaction not found.', 404)
      entityId = id()
      await run('INSERT INTO finance_reconciliations VALUES (?,?,?,?,?,?)', entityId, input.source, input.source_id, input.statement_reference, actor.id, now())
      detail = input
    } else throw new AppError('Unknown ERP action.', 404)
    await audit(actor.id, action, 'erp', entityId, detail)
    return { id: entityId }
  })
}
