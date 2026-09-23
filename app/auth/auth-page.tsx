'use client'
import SiteImage from '@/components/site-image'

import { useAlerts } from '@/components/use-alerts'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { LanguageSelect, useLanguage } from '@/components/language-provider'
import { mutate } from '@/lib/client-api'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Heart, KeyRound, LockKeyhole, Mail, MapPin, Palmtree, ShoppingBag, Sun, Truck, UserRound } from 'lucide-react'
import styles from './auth.module.css'

type Mode = 'login' | 'signup' | 'reset'
const copy = {
  login: { eyebrow: 'YOUR LITTLE CORNER OF THE ISLAND', title: 'Welcome back.', subtitle: 'Your favourites, your orders, your next beach day.', button: 'Sign in', icon: Sun },
  signup: { eyebrow: 'GOOD TIMES START HERE', title: 'Join the island life.', subtitle: 'Make room for more beach days and fewer errands.', button: 'Create account', icon: UserRound },
  reset: { eyebrow: 'LET’S GET YOU BACK IN', title: 'Forgot your password?', subtitle: 'Enter your email to request a password reset.', button: 'Send reset link', icon: KeyRound },
}

export default function AuthPage({ mode }: { mode: Mode }) {
 const { t } = useLanguage()
  const alerts = useAlerts()

  const [nextPath,setNextPath]=useState('')
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('next');if(value&&['/checkout','/customer?tab=Support'].includes(value))setNextPath('?next='+encodeURIComponent(value))},[])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const confirmInput = useRef<HTMLInputElement>(null)
  const content = Object.fromEntries(Object.entries(copy[mode]).map(([key,value])=>[key,typeof value==='string'?t(value):value])) as typeof copy[typeof mode]
  const Icon = content.icon
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (mode === 'signup' && password !== confirm) { setError('Your passwords don’t match. Please try again.'); confirmInput.current?.focus(); return }
    setError('')
    setBusy(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await mutate(mode === 'reset' ? 'auth.reset-request' : mode === 'signup' ? 'auth.signup' : 'auth.login', values)
      if (result.redirect) { await alerts.success(mode === 'signup' ? t('Your account is ready.', 'Akaunti yako iko tayari.') : t('You are signed in.', 'Umeingia kwenye akaunti.'), false); const next=new URLSearchParams(window.location.search).get('next'); window.location.href=next&&['/checkout','/customer?tab=Support'].includes(next)?next:result.redirect }
      else { setMessage(result.message); await alerts.success(result.message, false) }
    } catch (error) { setError((error as Error).message); await alerts.error((error as Error).message) }
    finally { setBusy(false); setPassword(''); setConfirm('') }
  }

  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/shop"><span><Palmtree size={30}/></span>NUNGWI <b>SHOP</b></Link><Link className={styles.backLink} href="/shop"><ArrowLeft size={16}/><span>{t("Back to shop")}</span></Link><LanguageSelect/></header>
    <main className={styles.main}>
      <section className={styles.story} aria-label={t("Nungwi beach delivery")}><SiteImage fill sizes="(max-width: 760px) 90vw, 45vw" preload className={styles.heroImage} src="/images/island-vibes-hero-v2.png" alt={t("Chilled island drinks on a Zanzibar beach at sunset")}/><div className={styles.storyShade}/><div className={styles.storyTop}><span><MapPin size={15}/> NUNGWI, ZANZIBAR</span><Palmtree size={35}/></div><div className={styles.storyCopy}><span>{t("MORE SUNSHINE. LESS HASSLE.")}</span><p className={styles.storyTitle}>{t("Your beach day,")}<br/>{t("a little ")}<em>{t("better.")}</em></p><p>{t("Cold drinks, island favourites, and everything")}<br className={styles.desktopBreak}/>{t(" you need. Delivered to your happy place.")}</p><div className={styles.storyBenefits}><span><Truck size={19}/>{t(" Fast island delivery")}</span><span><Heart size={18}/>{t(" Your favourites, on repeat")}</span></div></div><div className={styles.storyBottom}><div className={styles.deliveryBadge}><span><ShoppingBag size={21}/></span><div><strong>{t("Stay right where you are.")}</strong><small>{t("We’ll bring the good times to you.")}</small></div></div><span className={styles.script}>{t("Same Beach")}<br/><i>{t("More Good Times")}</i></span></div></section>
      <section className={styles.formSide} aria-labelledby="auth-title">
        <div className={styles.formInner}>
          <div className={styles.preview}><span/>{t(" NUNGWI SHOP ACCOUNT ")}<i>{t("Your island essentials, connected")}</i></div>
          {mode !== 'reset' && <nav className={styles.tabs} aria-label={t("Account access")}><Link href={"/login"+nextPath} aria-current={mode === 'login' ? 'page' : undefined} className={mode === 'login' ? styles.activeTab : ''}>{t("Sign in")}</Link><Link href={"/signup"+nextPath} aria-current={mode === 'signup' ? 'page' : undefined} className={mode === 'signup' ? styles.activeTab : ''}>{t("Create account")}</Link></nav>}
          <span className={styles.welcomeIcon}><Icon size={31}/></span><p className={styles.eyebrow}>{content.eyebrow}</p><h1 id="auth-title">{content.title}</h1><p className={styles.subtitle}>{content.subtitle}</p>
          <form onSubmit={submit} className={styles.form}>
            {mode === 'signup' && <label htmlFor="full-name">{t("Full name")}<div className={styles.field}><UserRound size={19}/><input id="full-name" name="name" autoComplete="name" placeholder={t("Your full name")} required maxLength={80} pattern=".*\S.*"/></div></label>}
            {mode === 'signup' && <label htmlFor="phone">{t("Phone number")}<div className={styles.field}><UserRound size={19}/><input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+255…" required pattern="\+[1-9][0-9]{7,14}"/></div></label>}
            <label htmlFor="email">{t("Email address")}<div className={styles.field}><Mail size={19}/><input id="email" name="email" type="email" autoComplete="email" placeholder={t("you@example.com")} required maxLength={254}/></div></label>
            {mode !== 'reset' && <label htmlFor="password">{t("Password")}<div className={styles.field}><LockKeyhole size={18}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? t("Create a password") : t("Enter your password")} required minLength={mode === 'signup' ? 10 : 1} maxLength={128} value={password} onChange={e => { setPassword(e.target.value); setError(''); setMessage('') }} aria-describedby={mode === 'signup' ? 'password-help' : undefined}/><button type="button" aria-label={showPassword ? t("Hide password") : t("Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{mode === 'signup' && <small id="password-help" className={styles.hint}>{t("Use at least 10 characters.")}</small>}</label>}
            {mode === 'signup' && <label htmlFor="confirm-password">{t("Confirm password")}<div className={`${styles.field} ${error ? styles.invalid : ''}`}><LockKeyhole size={18}/><input ref={confirmInput} id="confirm-password" name="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder={t("Re-enter your password")} value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }} required minLength={10} maxLength={128} aria-invalid={!!error} aria-describedby={error ? 'password-error' : undefined}/><button type="button" aria-label={showConfirm ? t("Hide confirmation password") : t("Show confirmation password")} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>}
            {mode === 'login' && <div className={styles.formOptions}><span><Check size={14}/>{t(" A little more beach, a little less hassle.")}</span><Link href="/forgot-password">{t("Forgot password?")}</Link></div>}
            {error && <p id="password-error" className={styles.error} role="alert">{t(error)}</p>}
            {message && <p className={styles.message} role="status">{t(message)}</p>}
            <button type="submit" className={styles.submit} disabled={busy}>{busy ? t("Please wait…") : content.button}<ArrowRight size={19}/></button>
          </form>
          <p className={styles.switchMode}>{mode === 'reset' ? <Link href={"/login"+nextPath}><ArrowLeft size={15}/>{t(" Back to sign in")}</Link> : mode === 'login' ? <>{t("New to Nungwi Shop? ")}<Link href={"/signup"+nextPath}>{t("Create an account")}</Link></> : <>{t("Already part of the island? ")}<Link href={"/login"+nextPath}>{t("Sign in")}</Link></>}</p>
          <div className={styles.previewEntry}><span>{t("Just taking a look?")}</span><Link href="/shop">{t("Browse the shop ")}<ArrowRight size={16}/></Link></div>
          <p className={styles.note}><LockKeyhole size={13}/>{t(" Keep your password private. We’ll never ask for it by SMS.")}</p>
        </div>
      </section>
    </main>
    <footer className={styles.footer}><span>NUNGWI SHOP <i>·</i> NUNGWI, ZANZIBAR</span><span>{t("BEACH LIFE, DELIVERED.")}</span></footer>
  </div>
}
