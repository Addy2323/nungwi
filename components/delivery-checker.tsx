'use client'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useLanguage } from './language-provider'
import { checkDeliveryArea, deliveryAreas } from '@/lib/shop-utils'

export default function DeliveryChecker() {
  const { t } = useLanguage()
  const [area, setArea] = useState('')
  const [checked, setChecked] = useState(false)
  return <section className="delivery-checker" id="delivery-checker" aria-labelledby="delivery-checker-title">
    <div><span className="eyebrow"><MapPin size={16}/>{t('Before you order', 'Kabla ya kuagiza')}</span><h2 id="delivery-checker-title">{t('Are we delivering to you?', 'Tunakufikia ulipo?')}</h2><p>{t('Choose the area where your hotel, villa or beach is located.', 'Chagua eneo la hoteli, vila au ufukwe ulipo.')}</p></div>
    <form onSubmit={event => { event.preventDefault(); setChecked(true) }}><label htmlFor="delivery-area">{t('Your delivery area', 'Eneo lako la ufikishaji')}</label><div className="inline-controls"><select id="delivery-area" required value={area} onChange={event => { setArea(event.target.value); setChecked(false) }}><option value="">{t('Select an area', 'Chagua eneo')}</option>{deliveryAreas.map(value => <option key={value}>{value}</option>)}<option value="other">{t('Another area / unsure', 'Eneo lingine / sina uhakika')}</option></select><button className="btn-primary-orange">{t('Check area', 'Angalia eneo')}</button></div>{checked && <p role="status" className="coverage-result">{checkDeliveryArea(area) ? t('Your area is covered. Add your hotel name and landmark at checkout; the team will confirm the exact location and timing.', 'Tunafikisha katika eneo lako. Weka jina la hoteli na alama ya eneo wakati wa kuagiza; timu itathibitisha mahali na muda.') : t('Please contact support to confirm your location before ordering. Our listed delivery areas are Nungwi and Kendwa.', 'Tafadhali wasiliana nasi kuthibitisha eneo lako kabla ya kuagiza. Maeneo yetu yaliyoorodheshwa ni Nungwi na Kendwa.')}</p>}</form>
  </section>
}
