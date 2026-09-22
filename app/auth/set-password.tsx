'use client'

import { useAlerts } from '@/components/use-alerts'
import { useState } from 'react'
import Link from 'next/link'
import { LanguageSelect, useLanguage } from '@/components/language-provider'
import { mutate } from '@/lib/client-api'
import styles from './auth.module.css'
export default function SetPassword({token,purpose}:{token:string;purpose:'invite'|'reset'}){
 const { t } = useLanguage()
  const alerts = useAlerts()

 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 return <div className={styles.page}><header className={styles.header}><Link className={styles.brand} href="/shop">NUNGWI <b>SHOP</b></Link><LanguageSelect/></header><main className={styles.formSide} style={{minHeight:'75vh'}}><div className={styles.formInner}><h2>{purpose==='invite'?t("Welcome to Nungwi Shop."):t("Choose a new password.")}</h2><p className={styles.subtitle}>{t("Set your own password. This link can be used once.")}</p><form className={styles.form} onSubmit={async e=>{e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match.');return}setBusy(true);try{const result=await mutate('auth.set-password',{token,purpose,password});await alerts.success(t('Your password has been saved.', 'Nenosiri lako limehifadhiwa.'), false);window.location.href=result.redirect}catch(e){setError((e as Error).message);await alerts.error((e as Error).message)}finally{setBusy(false);setPassword('');setConfirm('')}}}><label>{t("New password")}<div className={styles.field}><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={128} required/></div></label><label>{t("Confirm password")}<div className={styles.field}><input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={10} maxLength={128} required/></div></label>{error&&<p className={styles.error} role="alert">{t(error)}</p>}<button className={styles.submit} disabled={busy||!token}>{busy?t("Saving…"):t("Set password")}</button></form><p className={styles.note}>{t("At least 10 characters. Keep your password private.")}</p><Link href="/login">{t("Back to sign in")}</Link></div></main></div>
}
