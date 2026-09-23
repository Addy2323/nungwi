'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react'
import styles from './install-prompt.module.css'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    if (isStandalone) {
      setInstalled(true)
      return
    }

    // Check if dismissed in this session
    if (sessionStorage.getItem('nungwi-install-dismissed')) {
      return
    }

    // Detect iOS
    const ua = window.navigator.userAgent
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIos(iosDevice)

    if (iosDevice) {
      // Show iOS banner after a short delay
      const timer = setTimeout(() => setShowBanner(true), 1500)
      return () => clearTimeout(timer)
    }

    // Listen for beforeinstallprompt on Android/Chrome/Edge/Desktop
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true)
      return
    }

    if (!deferredPrompt) {
      // Fallback: trigger manifest download or show guide
      window.location.href = '/manifest.webmanifest'
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setShowBanner(false)
    sessionStorage.setItem('nungwi-install-dismissed', '1')
  }

  if (installed || !showBanner) return null

  return (
    <>
      <div className={styles.installerContainer} role="dialog" aria-label="Install App">
        <div className={styles.banner}>
          <button className={styles.closeButton} onClick={dismiss} aria-label="Dismiss app install banner">
            <X size={16} />
          </button>
          <div className={styles.headerRow}>
            <Image
              src="/icons/icon-192.png"
              alt="Nungwi Shop Mobile App Icon"
              width={56}
              height={56}
              className={styles.appIcon}
              priority
              unoptimized
            />
            <div className={styles.details}>
              <strong>Nungwi Shop App</strong>
              <p>Install on your mobile phone for fast 1-tap ordering & offline access.</p>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.installBtn} onClick={handleInstallClick}>
              <Smartphone size={17} />
              Install App
            </button>
            <a
              href="/manifest.webmanifest"
              download="NungwiShopLauncher.webmanifest"
              className={styles.downloadBtn}
              title="Download Web App Launcher File"
            >
              <Download size={15} />
              Download Launcher
            </a>
          </div>
        </div>
      </div>

      {showIosModal && (
        <div className={styles.iosModalBackdrop} onClick={() => setShowIosModal(false)}>
          <div className={styles.iosModal} onClick={e => e.stopPropagation()}>
            <Image
              src="/icons/icon-192.png"
              alt="Nungwi Shop Mobile App Icon"
              width={72}
              height={72}
              className={styles.appIcon}
              unoptimized
            />
            <h3>Install on iPhone / iPad</h3>
            <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
              Follow these 2 steps to add Nungwi Shop to your home screen:
            </p>
            <div className={styles.iosSteps}>
              <div className={styles.iosStep}>
                <span className={styles.iosStepBadge}>1</span>
                <span>
                  Tap the <strong>Share</strong> button <Share2 size={15} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> in Safari.
                </span>
              </div>
              <div className={styles.iosStep}>
                <span className={styles.iosStepBadge}>2</span>
                <span>
                  Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> <PlusSquare size={15} style={{ verticalAlign: 'middle', margin: '0 2px' }} />.
                </span>
              </div>
            </div>
            <button className={styles.iosGotIt} onClick={() => setShowIosModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  )
}
