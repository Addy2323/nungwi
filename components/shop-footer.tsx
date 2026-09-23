'use client'
import BrandLogo from '@/components/brand-logo'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from './language-provider'
import { api } from '@/lib/client-api'
import type { StoreInfo } from '@/lib/store-info'

export default function ShopFooter() {
  const { t, language } = useLanguage()
  const [info, setInfo] = useState<StoreInfo | null>(null)
  useEffect(() => { api<StoreInfo>('store-info').then(setInfo).catch(() => {}) }, [])
  return <footer className="shop-footer">
    <div><Link className="brand-logo" href="/"><BrandLogo/></Link><p>{t('Island essentials, thoughtfully delivered.', 'Mahitaji ya kisiwani, yakifikishwa kwa uangalifu.')}</p><p>Vunjabei Liquor Zanzibar ? Nungwi Shop</p><p>Nungwi & Kendwa · Zanzibar</p></div>
    <div><h2>{t('Get in touch', 'Wasiliana nasi')}</h2>{info?.phone && <a href={`tel:${info.phone.replace(/[^+\d]/g, '')}`}>{info.phone}</a>}{info?.email && <a href={`mailto:${info.email}`}>{info.email}</a>}<Link href="/customer?tab=Support">{t('Contact support')}</Link><h2>{t('Opening hours', 'Saa za kazi')}</h2><p>{info?.hours ? (language === 'sw' ? info.hoursSw || info.hours : info.hours) : t('Contact us to confirm today’s delivery hours.', 'Wasiliana nasi kuthibitisha saa za ufikishaji za leo.')}</p></div>
    <div><h2>{t('Shopping with us', 'Nunua nasi')}</h2><Link href="/shop">{t('Shop all products', 'Nunua bidhaa zote')}</Link><Link href="/help#delivery">{t('Delivery areas & information', 'Maeneo na taarifa za ufikishaji')}</Link><Link href="/help#faq">{t('Frequently asked questions', 'Maswali yanayoulizwa mara kwa mara')}</Link><Link href="/help#returns">{t('Returns & order help', 'Marejesho na msaada wa maagizo')}</Link><Link href="/help#privacy">{t('Privacy', 'Faragha')}</Link></div>
    <div className="footer-bottom">© {new Date().getFullYear()} Nungwi Shop <span>{t('A little more time by the sea.', 'Muda zaidi kando ya bahari.')}</span></div>
  </footer>
}
