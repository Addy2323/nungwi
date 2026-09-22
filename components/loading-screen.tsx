'use client'

import { Palmtree } from 'lucide-react'
import { useLanguage } from './language-provider'
import styles from './loading-screen.module.css'

export default function LoadingScreen() {
  const { t } = useLanguage()
  return <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
    <div className={styles.halo} aria-hidden="true" />
    <div className={styles.content}>
      <div className={styles.mark} aria-hidden="true"><Palmtree size={46} strokeWidth={1.6} /></div>
      <p className={styles.location}>NUNGWI, ZANZIBAR</p>
      <p className={styles.brand}>NUNGWI <span>SHOP</span></p>
      <p className={styles.tagline}>{t('A little more island time.', 'Muda zaidi wa kufurahia kisiwa.')}</p>
      <div className={styles.track} aria-hidden="true"><span /></div>
      <p className={styles.label}>{t('Getting things ready', 'Tunaandaa kila kitu')}<span aria-hidden="true">…</span></p>
    </div>
    <p className={styles.footer}>{t('BEACH LIFE, DELIVERED.', 'MAISHA YA UFUKWENI, MPAKA ULIPO.')}</p>
  </div>
}
