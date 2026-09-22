import { z } from 'zod'
import { AppError, originGuard, requireUser, permit } from '@/lib/server/auth'
import { erpAction, erpData, financeTransactions } from '@/lib/server/erp'
import { csvReport, pdfReport, reportRows } from '@/lib/server/reports'
import { one } from '@/lib/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status })
  if (error instanceof z.ZodError) return Response.json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
  if (error instanceof SyntaxError) return Response.json({ error: 'Invalid request.' }, { status: 400 })
  if (error instanceof Error && 'code' in error && error.code === '23505') return Response.json({ error: 'This document or reference is already recorded. Refresh before trying again.' }, { status: 409 })
  console.error('[erp]', error instanceof Error ? error.message : 'Request failed')
  return Response.json({ error: 'Unable to complete the ERP request.' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const actor = await requireUser()
    permit(actor, ['admin'])
    const params = new URL(request.url).searchParams
    if (params.get('export') === 'finance') {
      const rows = await financeTransactions(actor)
      const csv = csvReport({ title: 'Recorded transactions', headers: ['Date','Source','Document','Method','Reference','Signed amount TZS','Statement reference'], rows: rows.map(r => [r.created_at,r.source,r.description,r.method,r.reference,r.amount,r.statement_reference || '']) })
      return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="nungwi-transactions.csv"', 'Cache-Control': 'no-store' } })
    }
    if (params.get('invoice')) {
      const invoice = await one('SELECT i.*,i.due_date::text AS due_date,u.name AS customer FROM customer_invoices i JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=o.user_id WHERE i.id=?', params.get('invoice'))
      if (!invoice) throw new AppError('Invoice not found.', 404)
      const report = await reportRows(actor, 'receipt', '', '', invoice.order_id)
      report.title = `Invoice ${invoice.number}`
      report.rows.unshift(['Customer', invoice.customer, '', ''], ['Issued', invoice.created_at.slice(0, 10), '', ''], ['Due date', invoice.due_date, '', ''])
      const pdf = await pdfReport(report, invoice.created_at.slice(0, 10))
      return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${invoice.number}.pdf"`, 'Cache-Control': 'no-store' } })
    }
    return Response.json({ data: await erpData(actor) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    originGuard(request)
    const actor = await requireUser()
    permit(actor, ['admin'])
    const raw = await request.text()
    if (raw.length > 100000) throw new AppError('Request is too large.', 413)
    const body = JSON.parse(raw)
    const action = z.string().parse(body.action)
    return Response.json({ data: await erpAction(actor, action, body) })
  } catch (error) { return failure(error) }
}
