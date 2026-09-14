'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const confirmInput = useRef<HTMLInputElement>(null)
  const content = copy[mode]
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
      if (result.redirect) window.location.href = result.redirect
      else setMessage(result.message)
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false); setPassword(''); setConfirm('') }
  }

  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/shop"><span><Palmtree size={30}/></span>NUNGWI <b>SHOP</b></Link><Link className={styles.backLink} href="/shop"><ArrowLeft size={16}/><span>Back to shop</span></Link></header>
    <main className={styles.main}>
      <section className={styles.story} aria-label="Nungwi beach delivery"><img className={styles.heroImage} src="/images/island-vibes-hero-v2.png" alt="Chilled island drinks on a Zanzibar beach at sunset"/><div className={styles.storyShade}/><div className={styles.storyTop}><span><MapPin size={15}/> NUNGWI, ZANZIBAR</span><Palmtree size={35}/></div><div className={styles.storyCopy}><span>MORE SUNSHINE. LESS HASSLE.</span><h1>Your beach day,<br/>a little <em>better.</em></h1><p>Cold drinks, island favourites, and everything<br className={styles.desktopBreak}/> you need. Delivered to your happy place.</p><div className={styles.storyBenefits}><span><Truck size={19}/> Fast island delivery</span><span><Heart size={18}/> Your favourites, on repeat</span></div></div><div className={styles.storyBottom}><div className={styles.deliveryBadge}><span><ShoppingBag size={21}/></span><div><strong>Stay right where you are.</strong><small>We’ll bring the good times to you.</small></div></div><span className={styles.script}>Same Beach<br/><i>More Good Times</i></span></div></section>
      <section className={styles.formSide} aria-labelledby="auth-title">
        <div className={styles.formInner}>
          <div className={styles.preview}><span/> NUNGWI SHOP ACCOUNT <i>Your island essentials, connected</i></div>
          {mode !== 'reset' && <nav className={styles.tabs} aria-label="Account access"><Link href="/login" aria-current={mode === 'login' ? 'page' : undefined} className={mode === 'login' ? styles.activeTab : ''}>Sign in</Link><Link href="/signup" aria-current={mode === 'signup' ? 'page' : undefined} className={mode === 'signup' ? styles.activeTab : ''}>Create account</Link></nav>}
          <span className={styles.welcomeIcon}><Icon size={31}/></span><p className={styles.eyebrow}>{content.eyebrow}</p><h2 id="auth-title">{content.title}</h2><p className={styles.subtitle}>{content.subtitle}</p>
          <form onSubmit={submit} className={styles.form}>
            {mode === 'signup' && <label htmlFor="full-name">Full name<div className={styles.field}><UserRound size={19}/><input id="full-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={80} pattern=".*\S.*"/></div></label>}
            {mode === 'signup' && <label htmlFor="phone">Phone number<div className={styles.field}><UserRound size={19}/><input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+255…" required pattern="\+[1-9][0-9]{7,14}"/></div></label>}
            <label htmlFor="email">Email address<div className={styles.field}><Mail size={19}/><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></div></label>
            {mode !== 'reset' && <label htmlFor="password">Password<div className={styles.field}><LockKeyhole size={18}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'} required minLength={mode === 'signup' ? 10 : 1} maxLength={128} value={password} onChange={e => { setPassword(e.target.value); setError(''); setMessage('') }} aria-describedby={mode === 'signup' ? 'password-help' : undefined}/><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{mode === 'signup' && <small id="password-help" className={styles.hint}>Use at least 10 characters.</small>}</label>}
            {mode === 'signup' && <label htmlFor="confirm-password">Confirm password<div className={`${styles.field} ${error ? styles.invalid : ''}`}><LockKeyhole size={18}/><input ref={confirmInput} id="confirm-password" name="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }} required minLength={10} maxLength={128} aria-invalid={!!error} aria-describedby={error ? 'password-error' : undefined}/><button type="button" aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>}
            {mode === 'login' && <div className={styles.formOptions}><span><Check size={14}/> A little more beach, a little less hassle.</span><Link href="/forgot-password">Forgot password?</Link></div>}
            {error && <p id="password-error" className={styles.error} role="alert">{error}</p>}
            {message && <p className={styles.message} role="status">{message}</p>}
            <button type="submit" className={styles.submit} disabled={busy}>{busy ? 'Please wait…' : content.button}<ArrowRight size={19}/></button>
          </form>
          <p className={styles.switchMode}>{mode === 'reset' ? <Link href="/login"><ArrowLeft size={15}/> Back to sign in</Link> : mode === 'login' ? <>New to Nungwi Shop? <Link href="/signup">Create an account</Link></> : <>Already part of the island? <Link href="/login">Sign in</Link></>}</p>
          <div className={styles.previewEntry}><span>Just taking a look?</span><Link href="/shop">Browse the shop <ArrowRight size={16}/></Link></div>
          <p className={styles.note}><LockKeyhole size={13}/> Keep your password private. We’ll never ask for it by SMS.</p>
        </div>
      </section>
    </main>
    <footer className={styles.footer}><span>NUNGWI SHOP <i>·</i> NUNGWI, ZANZIBAR</span><span>BEACH LIFE, DELIVERED.</span></footer>
  </div>
}
