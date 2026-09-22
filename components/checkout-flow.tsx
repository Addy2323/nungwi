'use client'

import { useAlerts } from '@/components/use-alerts'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Trash2 } from 'lucide-react'
import { api, mutate } from '@/lib/client-api'
import { useShopCart } from '@/lib/catalogue-client'
import type { Actor } from '@/lib/server/auth'
import { LanguageSelect, useLanguage } from './language-provider'
import ShopFooter from './shop-footer'

export default function CheckoutFlow({ user }: { user: Actor }) {
  const { t, language } = useLanguage()
  const alerts = useAlerts()
  const { cart, setCart, ready, error: cartError } = useShopCart()
  const [account, setAccount] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState('')
  const [card, setCard] = useState(false)
  const [values, setValues] = useState({ recipient: user.name, phone: user.phone, address: '', instructions: '', delivery_window: '', payment_method: 'cash', promotion: '', referral_code: '' })
  const accountUrl = user.hotel_id ? '/hotel' : '/customer'
  const step = order ? 2 : quote ? 1 : 0
  useEffect(() => {
    setKey(crypto.randomUUID())
    api('account').then(value => { setAccount(value); setValues(previous => ({ ...previous, address: value.addresses.find((address: any) => address.is_default)?.address || value.hotel?.address || '', promotion: sessionStorage.getItem('nungwi-promo') || '' })) }).catch(e => setError(e.message))
    api('checkout-config').then(config => setCard(config.cardEnabled)).catch(e => setError(e.message))
  }, [])
  const money = (value: number) => `TZS ${Number(value).toLocaleString(language === 'sw' ? 'sw-TZ' : 'en-US')}`
  const payload = () => ({ ...values, items: cart.map(line => ({ product_id: line.id, quantity: line.qty, unit: line.unit })), idempotency_key: key })
  async function review(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { setQuote(await mutate('order.quote', payload())) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function pay(orderId: string) {
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    window.location.href = result.url
  }
  async function confirm() {
    if (!quote || busy) return
    setBusy(true); setError('')
    try {
      const result = await mutate('order.place', { ...payload(), expected_total: quote.total })
      setOrder(result); setCart([]); sessionStorage.removeItem('nungwi-promo')
      if (values.payment_method === 'card') await pay(result.id)
      else void alerts.success(t('Your order has been received.', 'Agizo lako limepokelewa.'))
    } catch (e) { setError((e as Error).message); setQuote(null); await alerts.error((e as Error).message) } finally { setBusy(false) }
  }
  const field = (name: keyof typeof values, label: string, type = 'text', wide = false) => <label className={wide ? 'wide' : ''}>{label}<input name={name} type={type} required={['recipient', 'phone', 'address'].includes(name)} autoComplete={name === 'recipient' ? 'name' : name === 'phone' ? 'tel' : name === 'address' ? 'street-address' : undefined} value={values[name]} onChange={e => { setValues({ ...values, [name]: e.target.value }); setQuote(null) }}/></label>
  return <div className="storefront"><header className="header-bar"><Link className="brand-logo" href="/">NUNGWI <b>SHOP</b></Link><div className="header-actions"><LanguageSelect/><Link href={accountUrl}>{t('My account')}</Link></div></header><main className="checkout-main"><h1 className="checkout-title">{t('A few details. Then, relax.', 'Maelezo machache. Kisha, pumzika.')}</h1><p className="checkout-intro">{t('Your island essentials are almost on their way.', 'Mahitaji yako ya kisiwani yako karibu kuja.')}</p><ol className="checkout-progress" aria-label={t('Checkout progress', 'Hatua za kuagiza')}>{[t('Delivery'), t('Review', 'Ukaguzi'), t('Confirmation', 'Uthibitisho')].map((label, index) => <li key={index} data-active={step === index} data-complete={step > index} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Check size={14}/> : index + 1}</span>{index === 0 && step === 1 ? <button disabled={busy} onClick={() => setQuote(null)}>{label}</button> : label}</li>)}</ol>
    {(error || cartError) && <p className="shop-error" role="alert">{t(error || cartError)}</p>}
    {order ? <section className="checkout-panel" aria-live="polite"><Check size={36} color="#386249"/><h2>{t('Thank you. Your order is received.', 'Asante. Tumepokea agizo lako.')}</h2><p>{t('Order')} <strong>{order.number}</strong> · {money(order.total)}</p><p>{t('Payment')}: {t(order.payment_status)}</p><p>{t('Follow your order’s progress in My Orders. Your delivery details and updates are saved there.', 'Fuatilia maendeleo kwenye Maagizo yangu. Taarifa za ufikishaji na masasisho yako yamehifadhiwa huko.')}</p><p className="checkout-hint">{t('Share this code with your driver only after receiving your order.', 'Mpe dereva msimbo huu baada tu ya kupokea agizo lako.')}<strong className="confirmation-code">{order.customer_code}</strong></p>{values.payment_method === 'card' && order.payment_status !== 'Paid' && <button className="btn-primary-orange" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await pay(order.id) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>{t('Continue to card payment', 'Endelea kulipa kwa kadi')}</button>}<p><Link className="text-link" href={`${accountUrl}?tab=My%20Orders`}>{t('View my orders', 'Tazama maagizo yangu')}<ArrowRight size={17}/></Link></p></section>
    : !ready ? <p role="status">{t('Loading your basket…', 'Inapakia kikapu chako…')}</p>
    : !cart.length ? <section className="checkout-panel"><h2>{t('Your basket is empty', 'Kikapu chako ni tupu')}</h2><Link className="text-link" href="/shop">{t('Browse the shop')}</Link></section>
    : <div className="checkout-grid"><section className="checkout-panel"><h2>{step === 0 ? t('Delivery details', 'Taarifa za ufikishaji') : t('Review your order', 'Kagua agizo lako')}</h2>{step === 0 ? <><form onSubmit={review}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>{account?.addresses.length > 0 && <label>{t('Saved delivery address', 'Anwani iliyohifadhiwa')}<select className="checkout-saved" value={values.address} onChange={e => setValues({ ...values, address: e.target.value })}><option value="">{t('Choose saved address', 'Chagua anwani iliyohifadhiwa')}</option>{account.addresses.map((address: any) => <option key={address.id} value={address.address}>{address.label} · {address.address}</option>)}</select></label>}<div className="checkout-fields">{field('recipient', t('Recipient name', 'Jina la mpokeaji'))}{field('phone', t('Phone (+255…)', 'Simu (+255…)'), 'tel')}{field('address', t('Hotel, address / landmark', 'Hoteli, anwani / alama ya eneo'), 'text', true)}{field('delivery_window', t('Preferred delivery window (optional)', 'Muda wa ufikishaji unaopendelea (si lazima)'), 'text', true)}{field('instructions', t('Delivery instructions (optional)', 'Maelekezo ya ufikishaji (si lazima)'), 'text', true)}{field('promotion', t('Promotion code (optional)', 'Msimbo wa ofa (si lazima)'))}{!user.hotel_id && field('referral_code', t('Hotel referral code (optional)', 'Msimbo wa rufaa ya hoteli (si lazima)'))}<label className="wide">{t('Payment method', 'Njia ya malipo')}<select value={values.payment_method} onChange={e => setValues({ ...values, payment_method: e.target.value })}><option value="cash">{t('Cash on delivery', 'Taslimu unapopokea')}</option><option value="bank_transfer">{t('Bank transfer', 'Uhamisho wa benki')}</option>{card && <option value="card">{t('Card payment', 'Malipo ya kadi')}</option>}</select></label></div><button className="btn-primary-orange" disabled={busy || !key}>{busy ? t('Please wait…') : t('Review order', 'Kagua agizo')}<ArrowRight size={16}/></button></fieldset></form><p className="checkout-hint">{t('Delivery is available in Nungwi and Kendwa. We’ll confirm your location and requested time. Review the final total before placing your order.', 'Tunafikisha Nungwi na Kendwa. Tutathibitisha eneo na muda ulioomba. Kagua jumla kabla ya kuweka agizo.')} <Link href="/help#delivery">{t('Delivery information', 'Taarifa za ufikishaji')}</Link></p></> : <><dl className="checkout-review-details">{[[t('Recipient'), values.recipient], [t('Phone number'), values.phone], [t('Address'), values.address], [t('Delivery instructions'), values.instructions || t('None')], [t('Requested window'), values.delivery_window || t('As soon as possible')], [t('Payment'), t(values.payment_method)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button className="text-link" disabled={busy} onClick={() => setQuote(null)}><ArrowLeft size={16}/>{t('Edit delivery details', 'Hariri taarifa za ufikishaji')}</button><p className="checkout-hint">{t('Check your details and the total, then confirm your order. Availability and prices are checked again when you confirm.', 'Kagua taarifa zako na jumla, kisha thibitisha agizo. Upatikanaji na bei hukaguliwa tena unapothibitisha.')}</p></>}</section>
    <section className="checkout-panel"><h2>{t('Your basket', 'Kikapu chako')}</h2>{cart.map(item => <div className="checkout-line" key={`${item.id}:${item.unit}`}><img src={item.image} alt=""/><div><strong>{item.name}</strong><p>{money(item.priceTzs)} / {t(item.unit)}</p>{step === 0 ? <input type="number" aria-label={`${t('Quantity')}: ${item.name}`} min={item.minQty} max={Math.max(item.stock, item.qty)} disabled={busy} value={item.qty} onChange={event => { const qty = Number(event.target.value); if (Number.isInteger(qty) && qty >= item.minQty) setCart(lines => lines.map(line => line.id === item.id && line.unit === item.unit ? { ...line, qty } : line)) }}/> : <p>{t('Quantity')}: {item.qty}</p>}</div>{step === 0 && <button className="icon-button" aria-label={`${t('Remove')}: ${item.name}`} disabled={busy} onClick={() => setCart(lines => lines.filter(line => line.id !== item.id || line.unit !== item.unit))}><Trash2 size={16}/></button>}</div>)}{quote ? <><dl className="checkout-totals">{[[t('Products'), quote.subtotal], [t('Discount', 'Punguzo'), -quote.discount], [t('Delivery'), quote.delivery_fee], [t('Tax', 'Kodi'), quote.tax], [t('Returnable deposits', 'Amana zinazorejeshwa'), quote.deposit], [t('Total'), quote.total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl><button className="btn-primary-orange" disabled={busy} onClick={confirm}>{busy ? t('Placing order…', 'Inaweka agizo…') : `${t('Confirm order', 'Thibitisha agizo')} · ${money(quote.total)}`}</button></> : <p className="checkout-hint">{t('Select Review order to see your delivery fee, discounts and final total.', 'Chagua Kagua agizo kuona ada ya ufikishaji, punguzo na jumla.')}</p>}</section></div>}
    <Link className="text-link" href="/shop"><ArrowLeft size={16}/>{t('Back to shop')}</Link></main><ShopFooter/></div>
}
