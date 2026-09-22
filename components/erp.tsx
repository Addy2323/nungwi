'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Table from './data-table'
import s from './platform.module.css'
import e from './erp.module.css'
import { useLanguage } from './language-provider'

type Row = Record<string, any>
type Field = { name: string; label: string; type?: string; value?: string | number; options?: Row[]; optional?: boolean; min?: number; max?: number }
const money = (value: number) => `TZS ${Number(value || 0).toLocaleString('en-US')}`
const today = () => new Date().toISOString().slice(0, 10)

function EntryForm({ title, fields, save, cancel, busy }: { title: string; fields: Field[]; save: (values: Row) => Promise<void>; cancel: () => void; busy: boolean }) {
  const { t } = useLanguage()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values: Row = {}
    for (const field of fields) {
      const value = String(form.get(field.name) || '')
      if (field.optional && !value) continue
      values[field.name] = field.type === 'number' ? Number(value) : field.type === 'datetime-local' ? new Date(value).toISOString() : value
    }
    await save(values)
  }
  return <section className={s.panel}><h2>{t(title)}</h2><form className={e.form} onSubmit={submit}><div className={e.fields}>{fields.map(field => <label key={field.name}>{t(field.label)}{field.options ? <select name={field.name} required={!field.optional} defaultValue={field.value || ''}><option value="">{t('Choose…')}</option>{field.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : <input name={field.name} type={field.type || 'text'} defaultValue={field.value} required={!field.optional} min={field.min ?? (field.type === 'number' ? 0 : undefined)} max={field.max} step={field.type === 'number' ? 1 : undefined}/>}</label>)}</div><div className={e.actions}><button className={s.primary} disabled={busy}>{t(busy ? 'Saving…' : 'Save')}</button><button className={s.secondary} type="button" onClick={cancel} disabled={busy}>{t('Cancel')}</button></div></form></section>
}

export default function ERP() {
  const { t } = useLanguage()
  const [data, setData] = useState<Row | null>(null)
  const [tab, setTab] = useState('Purchasing')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{ title: string; action: string; fields: Field[]; initial?: Row } | null>(null)
  const [creating, setCreating] = useState(false)
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, unit_cost: 0 }])
  async function refresh() {
    const response = await fetch('/api/erp', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result.data)
  }
  useEffect(() => { let active = true; fetch('/api/erp', { cache: 'no-store' }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) setData(result.data) }).catch(err => { if (active) setError(err.message) }); return () => { active = false } }, [])
  async function save(action: string, values: Row) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/erp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, action }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setForm(null); setCreating(false); setNotice('Saved successfully.')
      try { await refresh() } catch { setError('Saved, but the latest data could not be loaded. Refresh before making another change.'); setData(null) }
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const field = (name: string, label: string, type = 'text', extra: Partial<Field> = {}): Field => ({ name, label, type, ...extra })
  const supplierForm = (row?: Row) => { setCreating(false); setForm({ title: row ? 'Edit supplier' : 'Add supplier', action: 'supplier.save', initial: row ? { id: row.id, active: row.active } : {}, fields: [field('name','Supplier name','text',{ value: row?.name }),field('contact','Contact person','text',{ optional: true, value: row?.contact }),field('phone','Phone','text',{ optional: true, value: row?.phone }),field('email','Email','email',{ optional: true, value: row?.email }),field('address','Address','text',{ optional: true, value: row?.address }),field('payment_days','Payment terms (days)','number',{ value: row?.payment_days ?? 30, max: 365 })] }) }
  if (!data) return <article className={s.panel}>{error ? <><p className={e.error} role="alert">{t(error)}</p><button className={s.secondary} onClick={() => refresh().then(() => setError('')).catch(err => setError(err.message))}>{t('Retry')}</button></> : <p role="status">{t('Loading ERP…')}</p>}</article>
  const bills: Row[] = data.bills
  const invoices: Row[] = data.invoices
  const suppliers: Row[] = data.suppliers
  const purchases: Row[] = data.purchases
  const sum = (rows: Row[]) => rows.reduce((value, row) => value + row.balance, 0)
  return <>
    <div className={e.summary}><div>{t('Customer balances')}<strong>{money(sum(invoices))}</strong></div><div>{t('Supplier balances')}<strong>{money(sum(bills))}</strong></div><div>{t('Overdue customer invoices')}<strong>{money(sum(invoices.filter(i => i.due_date < today())))}</strong></div><div>{t('Overdue supplier bills')}<strong>{money(sum(bills.filter(i => i.due_date < today())))}</strong></div></div>
    <div className={e.tabs}>{['Purchasing','Suppliers','Supplier bills','Customer invoices','Finance'].map(name => <button key={name} aria-pressed={tab === name} onClick={() => { setTab(name); setForm(null); setCreating(false); setError(''); setNotice('') }}>{t(name)}</button>)}</div>
    {error && <p className={e.error} role="alert">{t(error)}</p>}{notice && <p className={e.notice} role="status">{t(notice)}</p>}
    {form && <EntryForm key={JSON.stringify(form)} {...form} busy={busy} cancel={() => setForm(null)} save={values => save(form.action, { ...form.initial, ...values })}/>}
    {tab === 'Suppliers' && <article className={s.panel}><div className={s.toolbar}><h2>{t('Suppliers')}</h2><button className={s.primary} onClick={() => supplierForm()}>{t('Add supplier')}</button></div><Table rows={suppliers} columns={[{ label:'Supplier', render:r => <>{r.name}<small>{r.contact} · {r.phone}</small></> },{ label:'Terms', render:r => `${r.payment_days} days` },{ label:'Status', render:r => r.active ? t('Active') : t('Inactive') },{ label:'Actions', render:r => <div className={e.actions}><button onClick={() => supplierForm(r)}>{t('Edit')}</button><button disabled={busy} onClick={() => save('supplier.save', { ...r, active: !r.active })}>{t(r.active ? 'Deactivate' : 'Activate')}</button></div> }]}/></article>}
    {tab === 'Purchasing' && <article className={s.panel}><div className={s.toolbar}><h2>{t('Purchase orders')}</h2><button className={s.primary} onClick={() => { setCreating(true); setForm(null); setLines([{ product_id:'',quantity:1,unit_cost:0 }]) }}>{t('New purchase order')}</button></div><p className={s.hint}>{t('Order quantities and costs are per base unit. Approve a draft before receiving stock. Each receipt creates a stock batch.')}</p>
      {creating && <form className={e.form} onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void save('purchase.create', { supplier_id: values.get('supplier'), notes: values.get('notes'), items: lines }) }}><div className={e.fields}><label>{t('Supplier')}<select required name="supplier"><option value="">{t('Choose supplier')}</option>{suppliers.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>{t('Notes')}<input name="notes" maxLength={500}/></label></div>{lines.map((line,index) => <div className={e.line} key={index}><label>{t('Product')}<select required value={line.product_id} onChange={event => { const product = data.products.find((p:Row) => p.id === event.target.value); setLines(lines.map((l,i) => i === index ? { ...l, product_id:event.target.value, unit_cost:product?.cost || 0 } : l)) }}><option value="">{t('Choose product')}</option>{data.products.map((p:Row) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label><label>{t('Base units')}<input type="number" min={1} max={1000000} required value={line.quantity} onChange={event => setLines(lines.map((l,i) => i === index ? { ...l, quantity:Number(event.target.value) } : l))}/></label><label>{t('Cost per base unit TZS')}<input type="number" min={0} max={1000000000} required value={line.unit_cost} onChange={event => setLines(lines.map((l,i) => i === index ? { ...l, unit_cost:Number(event.target.value) } : l))}/></label><button type="button" className={s.secondary} disabled={lines.length === 1} onClick={() => setLines(lines.filter((_,i) => i !== index))}>{t('Remove')}</button></div>)}<strong>{t('Total')}: {money(lines.reduce((v,l) => v + l.quantity*l.unit_cost,0))}</strong><div className={e.actions}><button type="button" className={s.secondary} disabled={lines.length >= 100} onClick={() => setLines([...lines,{ product_id:'',quantity:1,unit_cost:0 }])}>{t('Add product')}</button><button className={s.primary} disabled={busy}>{t('Save draft')}</button><button type="button" className={s.secondary} onClick={() => setCreating(false)}>{t('Cancel')}</button></div></form>}
      {!purchases.length && <p className={s.empty}>{t('No purchase orders yet. Add a supplier, then create your first purchase order.')}</p>}
      {purchases.map(p => <section key={p.id} className={e.document}><h3>{p.number}</h3><p>{p.supplier} · {t(p.status)} · {money(p.total)}</p><div className={e.actions}>{p.status === 'Draft' && <button disabled={busy} className={s.primary} onClick={() => save('purchase.approve',{ id:p.id })}>{t('Approve purchase')}</button>}{['Draft','Approved'].includes(p.status) && <button disabled={busy} className={s.secondary} onClick={() => save('purchase.cancel',{ id:p.id })}>{t('Cancel purchase')}</button>}{p.status === 'Received' && !bills.some(b => b.purchase_id === p.id) && <button className={s.primary} onClick={() => setForm({ title:'Record supplier bill',action:'bill.create',initial:{ purchase_id:p.id },fields:[field('reference','Supplier invoice reference'),field('due_date','Due date (leave blank to use supplier terms)','date',{ optional:true })] })}>{t('Record supplier bill')}</button>}</div>{p.notes && <p>{p.notes}</p>}<Table rows={p.items} columns={[{ label:'Product',render:r => r.name },{ label:'Ordered / received',render:r => `${r.quantity} / ${r.received}` },{ label:'Unit cost',render:r => money(r.unit_cost) },{ label:'Receive',render:r => ['Approved','Partially received'].includes(p.status) && r.received < r.quantity ? <button onClick={() => setForm({ title:`Receive ${r.name}`,action:'purchase.receive',initial:{ item_id:r.id },fields:[field('quantity','Base units received','number',{ value:r.quantity-r.received,min:1,max:r.quantity-r.received }),field('reference','Unique receipt / batch reference'),field('expires_at','Expiry','datetime-local')] })}>{t('Receive stock')}</button> : null }]}/></section>)}
      <h3>{t('Receipt history')}</h3><Table rows={data.receipts} columns={[{ label:'Date',render:r => r.created_at.slice(0,10) },{ label:'Purchase',render:r => r.purchase_number },{ label:'Product',render:r => r.product },{ label:'Reference',render:r => r.reference },{ label:'Base units',render:r => r.quantity }]}/>
    </article>}
    {tab === 'Supplier bills' && <article className={s.panel}><h2>{t('Supplier bills and payments')}</h2><p className={s.hint}>{t('Bills use the approved purchase total after all stock is received. Record only payments already made; this does not transfer money.')}</p><Table rows={bills} columns={[{ label:'Supplier / bill',render:r => <>{r.supplier}<small>{r.reference}</small></> },{ label:'Due',render:r => r.due_date },{ label:'Total / paid',render:r => <>{money(r.amount)}<small>{money(r.paid)}</small></> },{ label:'Balance',render:r => money(r.balance) },{ label:'Aging',render:r => <span className={`${s.badge} ${r.aging === 'Paid' ? s.good : r.balance > 0 && r.due_date < today() ? s.bad : r.balance > 0 ? s.pending : ''}`}>{t(r.aging)}</span> },{ label:'Action',render:r => r.balance > 0 && <button onClick={() => setForm({ title:'Record supplier payment',action:'bill.pay',initial:{ bill_id:r.id },fields:[field('amount','Amount TZS','number',{ min:1,max:Math.min(r.balance,1000000000),value:Math.min(r.balance,1000000000) }),field('method','Payment method','text',{ options:['cash','bank_transfer','mobile_money','card'].map(id => ({ id,name:id })) }),field('reference','Actual payment reference')] })}>{t('Record payment')}</button> }]}/></article>}
    {tab === 'Customer invoices' && <article className={s.panel}><div className={s.toolbar}><h2>{t('Customer invoices')}</h2><button className={s.primary} onClick={() => setForm({ title:'Issue customer invoice',action:'invoice.create',fields:[field('order_id','Order','text',{ options:data.orders.map((o:Row) => ({ id:o.id,name:`${o.number} · ${o.customer} · ${money(o.total)}` })) }),field('due_date','Due date (leave blank to use customer terms)','date',{ optional:true })] })}>{t('Issue invoice')}</button><button className={s.secondary} onClick={() => setForm({ title:'Customer payment terms',action:'terms.save',fields:[field('user_id','Customer','text',{ options:data.customers.map((c:Row) => ({ id:c.id,name:`${c.name} · ${c.email} · ${c.payment_days} days` })) }),field('payment_days','Payment terms (days)','number',{ value:0,max:365 })] })}>{t('Set payment terms')}</button></div><p className={s.hint}>{t('Invoice balances follow order payments and refunds. Record customer payments in Orders. Payment terms apply to new invoices; they do not impose a credit limit.')}</p><Table rows={invoices} columns={[{ label:'Invoice / customer',render:r => <>{r.number}<small>{r.customer} · {r.order_number}</small></> },{ label:'Due',render:r => r.due_date },{ label:'Total / paid',render:r => <>{money(r.total)}<small>{money(r.paid)}</small></> },{ label:'Balance',render:r => money(r.balance) },{ label:'Aging',render:r => <span className={`${s.badge} ${r.aging === 'Paid' ? s.good : r.balance > 0 && r.due_date < today() ? s.bad : r.balance > 0 ? s.pending : ''}`}>{t(r.aging)}</span> },{ label:'Document',render:r => <a className={s.secondary} href={`/api/erp?invoice=${encodeURIComponent(r.id)}`}>{t('Download PDF')}</a> }]}/></article>}
    {tab === 'Finance' && <article className={s.panel}><div className={s.toolbar}><h2>{t('Transaction reconciliation')}</h2><a className={s.primary} href="/api/erp?export=finance">{t('Export transactions CSV')}</a></div><p className={s.hint}>{t('Match recorded transactions against a bank statement, mobile-money statement or cash count. Positive amounts are receipts; negative amounts are outflows. Expenses and commissions have no recorded payment method. This export is a transaction register, not a general ledger.')}</p><Table rows={data.transactions} columns={[{ label:'Date / document',render:r => <>{r.created_at.slice(0,10)}<small>{r.description}</small></> },{ label:'Source / method',render:r => <>{r.source}<small>{r.method}</small></> },{ label:'Reference',render:r => r.reference },{ label:'Amount',render:r => money(r.amount) },{ label:'Reconciliation',render:r => r.statement_reference || <button onClick={() => setForm({ title:'Match recorded transaction',action:'finance.reconcile',initial:{ source:r.source,source_id:r.id },fields:[field('statement_reference','Statement line / cash count reference')] })}>{t('Match transaction')}</button> }]}/></article>}
  </>
}
