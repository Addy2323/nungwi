'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import styles from './universal-scanner.module.css'
import { Zap, ZapOff, Camera, Image as ImageIcon, Keyboard, X, Layers, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

export interface UniversalScannerProps {
  onScan: (code: string, codeType?: string) => void
  onClose?: () => void
  onContinuousBatch?: (items: { code: string; type: string; timestamp: string }[]) => void
  title?: string
  subtitle?: string
}

export function UniversalScanner({
  onScan,
  onClose,
  onContinuousBatch,
  title = 'Scan Product',
  subtitle = 'Point camera at any Barcode or QR code'
}: UniversalScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [flashOn, setFlashOn] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [continuousMode, setContinuousMode] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<{ code: string; type: string; time: number } | null>(null)
  const [continuousItems, setContinuousItems] = useState<{ code: string; type: string; timestamp: string }[]>([])
  const [cooldown, setCooldown] = useState(false)

  // Play audio beep feedback
  const playBeep = useCallback(() => {
    if (!soundEnabled) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) {
      // Audio autoplay might be blocked
    }
  }, [soundEnabled])

  // Trigger haptic vibration feedback
  const triggerHaptic = useCallback(() => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate([80, 40, 80])
      } catch (e) {
        // Ignore vibration errors
      }
    }
  }, [])

  // Process detected raw code
  const handleCodeDetected = useCallback((rawCode: string, codeType = 'DETECTED') => {
    const code = rawCode.trim()
    if (!code) return

    const now = Date.now()
    // Cooldown check (prevent repeated triggers of same code within 1.5s)
    if (lastScanned && lastScanned.code === code && now - lastScanned.time < 1500) {
      return
    }

    setLastScanned({ code, type: codeType, time: now })
    setCooldown(true)
    setTimeout(() => setCooldown(false), 1200)

    playBeep()
    triggerHaptic()

    if (continuousMode) {
      const item = { code, type: codeType, timestamp: new Date().toLocaleTimeString() }
      setContinuousItems(prev => [item, ...prev])
    } else {
      onScan(code, codeType)
    }
  }, [continuousMode, lastScanned, onScan, playBeep, triggerHaptic])

  // Toggle Camera Flash/Torch
  const toggleFlash = async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    try {
      const constraints = { advanced: [{ torch: !flashOn }] } as any
      await track.applyConstraints(constraints)
      setFlashOn(!flashOn)
    } catch (err) {
      console.warn('Flashlight toggle not supported on this device:', err)
    }
  }

  // Camera initialization
  useEffect(() => {
    let active = true

    async function startCamera() {
      try {
        setError(null)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })

        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Check torch support
        const track = stream.getVideoTracks()[0]
        if (track) {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any
          if (capabilities.torch) {
            setHasTorch(true)
          }
        }
      } catch (err: any) {
        if (!active) return
        console.error('Camera permission or device error:', err)
        setError(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission denied. Please allow camera access or use manual code entry.'
            : 'Camera unavailable or in use by another app. You can still use manual entry.'
        )
      }
    }

    startCamera()

    return () => {
      active = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Universal Scanner frame detection loop
  useEffect(() => {
    let detector: any = null

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        })
      } catch (e) {
        console.warn('Native BarcodeDetector format setup fallback:', e)
      }
    }

    const scanFrame = async () => {
      const video = videoRef.current
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !cooldown) {
        try {
          if (detector) {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length > 0) {
              const item = barcodes[0]
              handleCodeDetected(item.rawValue, item.format?.toUpperCase() || 'BARCODE')
            }
          }
        } catch (e) {
          // Frame detect skip
        }
      }
      animFrameRef.current = requestAnimationFrame(scanFrame)
    }

    animFrameRef.current = requestAnimationFrame(scanFrame)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [cooldown, handleCodeDetected])

  // Handle image upload scanning
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const img = document.createElement('img')
    img.src = URL.createObjectURL(file)
    await img.decode()

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector()
        const barcodes = await detector.detect(img)
        if (barcodes && barcodes.length > 0) {
          handleCodeDetected(barcodes[0].rawValue, barcodes[0].format?.toUpperCase() || 'IMAGE_CODE')
          return
        }
      } catch (err) {
        console.warn('Image detection failed:', err)
      }
    }
    setError('Could not decode a valid barcode or QR code from the selected image.')
  }

  // Handle manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleCodeDetected(manualCode.trim(), 'MANUAL_ENTRY')
    setManualCode('')
    setManualOpen(false)
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Camera size={20} color="#ff5405" />
          <div>
            <h3>{title}</h3>
            <p className={styles.subTitle}>{subtitle}</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {hasTorch && (
            <button
              className={`${styles.iconBtn} ${flashOn ? styles.activeFlash : ''}`}
              onClick={toggleFlash}
              title="Toggle Flashlight"
            >
              {flashOn ? <ZapOff size={16} /> : <Zap size={16} />}
            </button>
          )}

          {onClose && (
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close Scanner">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className={styles.viewfinderWrapper}>
        {error ? (
          <div className={styles.errorBox}>
            <AlertTriangle size={32} style={{ marginBottom: 8 }} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className={styles.videoFeed} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Viewfinder Target Box Overlay */}
            <div className={styles.overlayFrame}>
              <div className={styles.cornerTL} />
              <div className={styles.cornerTR} />
              <div className={styles.cornerBL} />
              <div className={styles.cornerBR} />
              <div className={styles.laserLine} />
            </div>

            <div className={styles.hintText}>
              {cooldown ? '✓ Code Detected!' : 'Auto-detecting Barcode & QR code…'}
            </div>
          </>
        )}
      </div>

      {/* Mode Control Bar */}
      <div className={styles.modeBar}>
        <div className={styles.toggleGroup}>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={e => setContinuousMode(e.target.checked)}
            />
            <span className={styles.slider} />
          </label>
          <span>
            Continuous Mode
            {continuousMode && <span className={styles.continuousBadge}>Batch ({continuousItems.length})</span>}
          </span>
        </div>

        <button
          className={styles.iconBtn}
          onClick={() => setSoundEnabled(!soundEnabled)}
          title="Toggle Beep Feedback"
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
        </button>
      </div>

      {/* Continuous Items Preview */}
      {continuousMode && continuousItems.length > 0 && (
        <div className={styles.continuousList}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Scanned Batch ({continuousItems.length})</span>
            {onContinuousBatch && (
              <button
                onClick={() => onContinuousBatch(continuousItems)}
                style={{ background: '#ff5405', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Done Batch
              </button>
            )}
          </div>
          {continuousItems.slice(0, 5).map((item, idx) => (
            <div key={idx} className={styles.continuousItem}>
              <span><strong>{item.code}</strong> <small>({item.type})</small></span>
              <small style={{ color: '#94a3b8' }}>{item.timestamp}</small>
            </div>
          ))}
        </div>
      )}

      {/* Manual Input Drawer */}
      {manualOpen && (
        <form className={styles.manualInputBox} onSubmit={handleManualSubmit}>
          <input
            type="text"
            placeholder="Type or paste barcode / QR code…"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            autoFocus
          />
          <button type="submit" className={`${styles.actionBtn} ${styles.primaryBtn}`}>
            Submit
          </button>
        </form>
      )}

      {/* Footer Controls */}
      <div className={styles.footerControls}>
        <button
          className={styles.actionBtn}
          onClick={() => setManualOpen(!manualOpen)}
        >
          <Keyboard size={16} />
          {manualOpen ? 'Hide Input' : 'Manual Entry'}
        </button>

        <button
          className={styles.actionBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={16} />
          Scan Image
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={handleImageUpload}
        />
      </div>
    </div>
  )
}
