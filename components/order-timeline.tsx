'use client'
import { Check, Clock, AlertCircle } from 'lucide-react'
import { useLanguage } from './language-provider'
import { deliverySteps, orderProgress } from '@/lib/shop-utils'

const milestoneStatuses: Record<string, string[]> = {
  'Confirmed': ['Pending', 'Confirmed'],
  'Preparing': ['Preparing', 'Driver assigned', 'Ready for pickup'],
  'Out for delivery': ['Picked up', 'Out for delivery', 'Driver arriving'],
  'Delivered': ['Delivered']
}

export default function OrderTimeline({ status, history = [] }: { status: string; history?: { id: string; status: string; created_at: string; note?: string; actor?: string }[] }) {
  const { t, language } = useLanguage()
  const progress = orderProgress(status)
  const date = (value: string) => new Date(value).toLocaleString(language === 'sw' ? 'sw-TZ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam' })
  return <section className="order-timeline" aria-label={t('Order progress', 'Maendeleo ya agizo')}><h3>{t('Order progress', 'Maendeleo ya agizo')}</h3>{progress.exception && <p className="timeline-exception" role="status"><AlertCircle size={18}/>{t(status)} · {t('Contact support for the next steps.', 'Wasiliana nasi kwa hatua zinazofuata.')}</p>}<ol className="delivery-steps">{deliverySteps.map((step, index) => { const statuses = milestoneStatuses[step] || [step]; const event = [...history].reverse().find(value => statuses.includes(value.status)); const done = progress.exception ? !!event : index < progress.index || (index === progress.index && status === 'Delivered'); const current = !progress.exception && index === progress.index && status !== 'Delivered'; return <li key={step} data-state={current ? 'current' : done ? 'done' : 'waiting'} aria-current={current ? 'step' : undefined}><span>{done ? <Check size={15}/> : current ? <Clock size={15}/> : index + 1}</span><div><strong>{t(step)}</strong>{event && <time dateTime={event.created_at}>{date(event.created_at)}</time>}</div></li> })}</ol>{history.length > 0 && <details><summary>{t('View order history', 'Tazama historia ya agizo')}</summary><ol className="order-events">{[...history].sort((a,b) => a.created_at.localeCompare(b.created_at)).map(event => <li key={event.id}><strong>{t(event.status)}</strong><time dateTime={event.created_at}>{date(event.created_at)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol></details>}</section>
}
