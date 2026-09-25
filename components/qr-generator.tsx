'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  CheckCircle, Download, ExternalLink, Globe, Printer,
  QrCode, RefreshCw, Settings, XCircle, FileText
} from 'lucide-react'
import s from './platform.module.css'

/* ─── Types ─── */
interface QRConfig {
  url: string
  label: string
  businessName: string
  location: string
  tagline: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

const DEFAULT_URL = 'https://vunjabeiliquorzanzibar.co.tz/'

const DEFAULT_CONFIG: QRConfig = {
  url: DEFAULT_URL,
  label: 'SCAN TO SHOP',
  businessName: 'VUNJA BEI LIQUOR ZANZIBAR',
  location: 'NUNGWI SHOP',
  tagline: 'Shop Online — Easy & Fast!',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

/* ─── URL validator ─── */
function validateUrl(raw: string): { valid: boolean; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { valid: false, error: 'URL is required.' }
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol))
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol.' }
    if (/[<>"'`]/.test(trimmed))
      return { valid: false, error: 'URL contains invalid characters.' }
    return { valid: true, error: '' }
  } catch {
    return { valid: false, error: 'Please enter a valid URL.' }
  }
}

/* ─── QR options ─── */
const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: 'H',
  margin: 4,
  width: 600,
  color: { dark: '#000000', light: '#ffffff' },
}

export default function QrGenerator() {
  const [config, setConfig] = useState<QRConfig>(DEFAULT_CONFIG)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrSvg, setQrSvg] = useState<string>('')
  const [urlError, setUrlError] = useState<string>('')
  const [verified, setVerified] = useState<boolean>(false)
  const [generating, setGenerating] = useState<boolean>(false)
  const [editing, setEditing] = useState<boolean>(false)
  const printRef = useRef<HTMLDivElement>(null)

  /* ─── Generate QR ─── */
  const generateQR = useCallback(async (url: string) => {
    const check = validateUrl(url)
    if (!check.valid) { setUrlError(check.error); setQrDataUrl(''); setQrSvg(''); setVerified(false); return }
    setUrlError('')
    setGenerating(true)
    try {
      const [dataUrl, svg] = await Promise.all([
        QRCode.toDataURL(url, QR_OPTIONS),
        QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, width: 600 }),
      ])
      setQrDataUrl(dataUrl)
      setQrSvg(svg)
      /* client-side decode verification (image back to text) */
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const img = new Image()
        img.onload = () => {
          canvas.width = img.width; canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          /* Use BarcodeDetector if available, otherwise trust the library */
          if ('BarcodeDetector' in window) {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
            detector.detect(canvas).then((results: any[]) => {
              setVerified(results.length > 0 && results[0].rawValue === url)
            }).catch(() => setVerified(true))
          } else {
            setVerified(true)
          }
        }
        img.src = dataUrl
      } else {
        setVerified(true)
      }
      setConfig(prev => ({ ...prev, updatedAt: new Date().toISOString() }))
    } catch {
      setUrlError('Failed to generate QR code. Please check the URL.')
      setVerified(false)
    } finally {
      setGenerating(false)
    }
  }, [])

  /* ─── Auto-generate on mount ─── */
  useEffect(() => { generateQR(config.url) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Field change ─── */
  const updateField = (field: keyof QRConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    if (field === 'url') generateQR(value)
  }

  /* ─── Download PNG ─── */
  const downloadPNG = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = 'vunja-bei-qr-code.png'
    link.href = qrDataUrl
    link.click()
  }

  /* ─── Download SVG ─── */
  const downloadSVG = () => {
    if (!qrSvg) return
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'vunja-bei-qr-code.svg'
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  /* ─── Download PDF poster ─── */
  const downloadPDF = async () => {
    if (!qrDataUrl) return
    setGenerating(true)
    try {
      const pdfDoc = await PDFDocument.create()
      const page = pdfDoc.addPage([595.28, 841.89]) // A4
      const { width, height } = page.getSize()
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

      /* ── Background ── */
      const navy = rgb(12 / 255, 27 / 255, 58 / 255)
      const gold = rgb(212 / 255, 160 / 255, 74 / 255)
      const white = rgb(1, 1, 1)
      page.drawRectangle({ x: 0, y: 0, width, height, color: navy })

      /* ── Gold accent strip at top ── */
      page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: gold })

      /* ── Business name ── */
      let bY = height - 80
      const bSize = 36
      for (const line of ['VUNJA BEI', 'LIQUOR ZANZIBAR']) {
        const bW = font.widthOfTextAtSize(line, bSize)
        page.drawText(line, { x: (width - bW) / 2, y: bY, size: bSize, font, color: gold })
        bY -= 48
      }

      /* ── Location ── */
      const locSize = 18
      const locW = font.widthOfTextAtSize(config.location, locSize)
      page.drawText(config.location, { x: (width - locW) / 2, y: bY - 10, size: locSize, font, color: white })

      /* ── Decorative line ── */
      const lineY = bY - 35
      page.drawRectangle({ x: width / 2 - 50, y: lineY, width: 100, height: 2, color: gold })

      /* ── QR Code ── */
      const qrImg = await pdfDoc.embedPng(qrDataUrl)
      const qrSize = 260
      const qrX = (width - qrSize) / 2
      const qrY = lineY - qrSize - 30
      /* White background behind QR */
      page.drawRectangle({ x: qrX - 15, y: qrY - 15, width: qrSize + 30, height: qrSize + 30, color: white, borderColor: gold, borderWidth: 2 })
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })

      /* ── Label ── */
      const labelSize = 24
      const labelW = font.widthOfTextAtSize(config.label, labelSize)
      page.drawText(config.label, { x: (width - labelW) / 2, y: qrY - 40, size: labelSize, font, color: gold })

      /* ── Instructions ── */
      const instText = 'Scan the QR code with your phone camera'
      const instSize = 13
      const instW = fontRegular.widthOfTextAtSize(instText, instSize)
      page.drawText(instText, { x: (width - instW) / 2, y: qrY - 65, size: instSize, font: fontRegular, color: white })

      const instText2 = 'and shop directly on our website.'
      const instW2 = fontRegular.widthOfTextAtSize(instText2, instSize)
      page.drawText(instText2, { x: (width - instW2) / 2, y: qrY - 82, size: instSize, font: fontRegular, color: white })

      /* ── URL ── */
      const urlSize = 12
      const urlW = fontRegular.widthOfTextAtSize(config.url, urlSize)
      page.drawText(config.url, { x: (width - urlW) / 2, y: qrY - 115, size: urlSize, font: fontRegular, color: gold })

      /* ── Tagline ── */
      const tagSize = 16
      const tagW = font.widthOfTextAtSize(config.tagline, tagSize)
      page.drawText(config.tagline, { x: (width - tagW) / 2, y: qrY - 145, size: tagSize, font, color: white })

      /* ── Gold accent strip at bottom ── */
      page.drawRectangle({ x: 0, y: 0, width, height: 8, color: gold })

      /* ── Save ── */
      const bytes = await pdfDoc.save()
      const buf = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(buf).set(bytes)
      const blob = new Blob([buf], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = 'vunja-bei-qr-poster.pdf'
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setUrlError('Failed to generate PDF poster.')
    } finally {
      setGenerating(false)
    }
  }

  /* ─── Print poster ─── */
  const printPoster = () => {
    if (!printRef.current) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Vunja Bei QR Poster</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 210mm; min-height: 297mm; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.poster { width: 210mm; min-height: 297mm; background: #0c1b3a; color: #fff;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px; position: relative; }
.gold-bar { position: absolute; left: 0; right: 0; height: 6mm; background: #d4a04a; }
.gold-bar.top { top: 0; }
.gold-bar.bottom { bottom: 0; }
h1 { color: #d4a04a; font-size: 34pt; text-align: center; font-weight: 800;
  letter-spacing: 2px; line-height: 1.25; margin-top: 24px; }
.location { font-size: 16pt; letter-spacing: 4px; margin-top: 12px;
  color: #fff; font-weight: 600; }
.divider { width: 80px; height: 2px; background: #d4a04a; margin: 22px auto; }
.qr-frame { background: #fff; padding: 20px; border: 3px solid #d4a04a;
  border-radius: 6px; margin: 16px 0; display: inline-block; }
.qr-frame img { display: block; width: 220px; height: 220px; }
.label { color: #d4a04a; font-size: 22pt; font-weight: 800;
  letter-spacing: 3px; margin-top: 20px; }
.instructions { color: #ffffffcc; font-size: 11pt; margin-top: 14px;
  text-align: center; line-height: 1.6; }
.url { color: #d4a04a; font-size: 10pt; margin-top: 16px;
  letter-spacing: 1px; }
.tagline { color: #fff; font-size: 14pt; font-weight: 600;
  margin-top: 14px; }
</style></head><body>
<div class="poster">
  <div class="gold-bar top"></div>
  <h1>VUNJA BEI<br>LIQUOR ZANZIBAR</h1>
  <div class="location">${config.location}</div>
  <div class="divider"></div>
  <div class="qr-frame"><img src="${qrDataUrl}" alt="QR Code"></div>
  <div class="label">${config.label}</div>
  <div class="instructions">
    Scan the QR code with your phone camera<br>
    and shop directly on our website.
  </div>
  <div class="url">${config.url}</div>
  <div class="tagline">${config.tagline}</div>
  <div class="gold-bar bottom"></div>
</div>
</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const stamp = (v: string) => v ? new Date(v).toLocaleString() : ''
  const urlValid = validateUrl(config.url).valid
  const ready = !!qrDataUrl && urlValid && !generating

  return (<>
    {/* ── Page header ── */}
    <div className={s.panel} style={{ marginBottom: 24 }}>
      <div className={s.toolbar}>
        <div>
          <h2><QrCode size={22} style={{ verticalAlign: -4, marginRight: 8 }} />QR Code Generator</h2>
          <p className={s.hint} style={{ marginTop: 4 }}>
            Generate and print a QR code that takes customers directly to your online shop.
          </p>
        </div>
      </div>
    </div>

    {/* ── Main layout ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── Left: Config ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* URL input */}
        <article className={s.panel}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>
            <Globe size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Destination URL
          </h2>
          <input
            type="url"
            value={config.url}
            onChange={e => updateField('url', e.target.value)}
            placeholder="https://vunjabeiliquorzanzibar.co.tz/"
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid var(--border-light)',
              borderRadius: 8, fontSize: 14, fontFamily: 'monospace',
              background: urlError ? '#fff5f5' : '#fffdfa',
              borderColor: urlError ? '#e74c3c' : undefined
            }}
          />
          {urlError && <p style={{ color: '#e74c3c', fontSize: 12, marginTop: 6 }}>{urlError}</p>}
          <p className={s.hint} style={{ marginTop: 8 }}>
            The URL encoded in the QR code. Customers will be redirected here when they scan it.
          </p>
        </article>

        {/* Customization fields */}
        <article className={s.panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>
              <Settings size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Customization
            </h2>
            <button className={s.secondary} onClick={() => setEditing(!editing)} style={{ minHeight: 36, padding: '6px 12px' }}>
              {editing ? 'Done' : 'Edit Fields'}
            </button>
          </div>
          {editing ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {([
                { key: 'label', label: 'QR Label', placeholder: 'SCAN TO SHOP' },
                { key: 'businessName', label: 'Business Name', placeholder: 'VUNJA BEI LIQUOR ZANZIBAR' },
                { key: 'location', label: 'Location', placeholder: 'NUNGWI SHOP' },
                { key: 'tagline', label: 'Tagline', placeholder: 'Shop Online — Easy & Fast!' },
              ] as const).map(f => (
                <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                  {f.label}
                  <input
                    value={config[f.key]}
                    onChange={e => updateField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={{
                      padding: '10px 12px', border: '1px solid var(--border-light)',
                      borderRadius: 8, fontSize: 14, background: '#fffdfa'
                    }}
                  />
                </label>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              {([
                ['Label', config.label],
                ['Business', config.businessName],
                ['Location', config.location],
                ['Tagline', config.tagline],
              ]).map(([label, value]) => (
                <div key={label}>
                  <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</small>
                  <div style={{ fontWeight: 500, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* QR Info / Management */}
        <article className={s.panel}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>QR Code Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Status</small>
              <div style={{ marginTop: 4 }}>
                <span className={`${s.badge} ${config.status === 'active' ? s.good : s.bad}`}>
                  {config.status === 'active' ? '● Active' : '● Inactive'}
                </span>
              </div>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Validation</small>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                {verified ? (
                  <><CheckCircle size={14} color="#2e8b42" /> <span style={{ color: '#2e8b42', fontWeight: 500 }}>Verified</span></>
                ) : ready ? (
                  <><CheckCircle size={14} color="#d4a04a" /> <span style={{ color: '#d4a04a', fontWeight: 500 }}>Ready</span></>
                ) : (
                  <><XCircle size={14} color="#bb442b" /> <span style={{ color: '#bb442b', fontWeight: 500 }}>Not ready</span></>
                )}
              </div>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Destination</small>
              <div style={{ marginTop: 2, wordBreak: 'break-all' }}>
                <a href={config.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 12 }}>
                  {config.url} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
                </a>
              </div>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>Last Updated</small>
              <div style={{ marginTop: 2, fontSize: 12 }}>{stamp(config.updatedAt)}</div>
            </div>
          </div>
        </article>
      </div>

      {/* ── Right: Preview + Actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* QR Preview */}
        <article className={s.panel} style={{ textAlign: 'center', padding: 30 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20, textAlign: 'left' }}>QR Code Preview</h2>
          <div ref={printRef} style={{
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            background: '#0c1b3a', padding: '32px 36px 28px', borderRadius: 16,
          }}>
            {qrDataUrl ? (
              <div style={{
                background: '#fff', padding: 16, borderRadius: 8,
                border: '3px solid #d4a04a',
              }}>
                <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220, display: 'block' }} />
              </div>
            ) : (
              <div style={{
                width: 252, height: 252, background: '#ffffff22', borderRadius: 8,
                display: 'grid', placeItems: 'center', color: '#ffffff66', fontSize: 13
              }}>
                {generating ? 'Generating…' : 'Enter a valid URL'}
              </div>
            )}
            <div style={{ color: '#d4a04a', fontSize: 18, fontWeight: 800, letterSpacing: 2, marginTop: 18 }}>
              {config.label}
            </div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: 1, marginTop: 8 }}>
              {config.businessName}
            </div>
            <div style={{ color: '#ffffffcc', fontSize: 11, letterSpacing: 2, marginTop: 4 }}>
              {config.location}
            </div>
          </div>
        </article>

        {/* Action buttons */}
        <article className={s.panel}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className={s.primary} onClick={() => generateQR(config.url)} disabled={!urlValid || generating}
              style={{ gap: 8 }}>
              <RefreshCw size={15} /> Generate QR
            </button>
            <button className={s.secondary} onClick={downloadPNG} disabled={!ready}
              style={{ gap: 8 }}>
              <Download size={15} /> Download PNG
            </button>
            <button className={s.secondary} onClick={downloadSVG} disabled={!ready}
              style={{ gap: 8 }}>
              <Download size={15} /> Download SVG
            </button>
            <button className={s.secondary} onClick={downloadPDF} disabled={!ready || generating}
              style={{ gap: 8 }}>
              <FileText size={15} /> PDF Poster
            </button>
            <button className={s.primary} onClick={printPoster} disabled={!ready}
              style={{ gridColumn: '1 / -1', gap: 8 }}>
              <Printer size={15} /> Print Poster
            </button>
          </div>
          <p className={s.hint} style={{ marginTop: 12 }}>
            PNG is ideal for digital sharing. SVG is best for professional printing and large formats.
            PDF generates a branded A4 poster ready for print. Print opens the poster directly in your
            browser&apos;s print dialog.
          </p>
        </article>

        {/* Toggle active/inactive */}
        <article className={s.panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600 }}>QR Management</h2>
              <p className={s.hint} style={{ marginTop: 4 }}>
                {config.status === 'active'
                  ? 'This QR code is currently active and ready for use.'
                  : 'This QR code is deactivated.'}
              </p>
            </div>
            <button
              className={config.status === 'active' ? s.secondary : s.primary}
              onClick={() => setConfig(prev => ({
                ...prev,
                status: prev.status === 'active' ? 'inactive' : 'active',
                updatedAt: new Date().toISOString()
              }))}
              style={{ minHeight: 38, padding: '8px 16px', gap: 6 }}
            >
              {config.status === 'active' ? <><XCircle size={14} /> Deactivate</> : <><CheckCircle size={14} /> Activate</>}
            </button>
          </div>
        </article>
      </div>
    </div>

    {/* ── Responsive override for mobile ── */}
    <style>{`
      @media (max-width: 900px) {
        [style*="grid-template-columns: 1fr 1fr"][style*="gap: 20px"] {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  </>)
}
