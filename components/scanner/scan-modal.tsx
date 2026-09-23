'use client'
import SiteImage from '@/components/site-image'

import React, { useState } from 'react'
import { UniversalScanner } from './universal-scanner'
import styles from './scan-modal.module.css'
import { CheckCircle2, AlertCircle, ShoppingCart, PlusCircle, RefreshCw, X, Search, Plus } from 'lucide-react'

export interface ScanModalProps {
  isOpen: boolean
  onClose: () => void
  onAddToCart?: (product: any, quantity: number) => void
  onReceiveStock?: (product: any, quantity: number) => void
  onRegisterProduct?: (code: string, codeType: string) => void
  userRole?: string
}

export function ScanModal({
  isOpen,
  onClose,
  onAddToCart,
  onReceiveStock,
  onRegisterProduct,
  userRole = 'customer'
}: ScanModalProps) {
  const [scanResult, setScanResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [qty, setQty] = useState(1)
  const [mode, setMode] = useState<'scan' | 'result'>('scan')

  if (!isOpen) return null

  const handleScan = async (code: string, codeType = 'UNKNOWN') => {
    setLoading(true)
    try {
      const response = await fetch(`/api/scanner?code=${encodeURIComponent(code)}&type=${encodeURIComponent(codeType)}`)
      const json = await response.json()

      if (response.ok && json.data) {
        setScanResult(json.data)
      } else {
        setScanResult({
          found: false,
          code,
          codeType,
          message: json.error || 'Scan lookup failed'
        })
      }
    } catch (err) {
      setScanResult({
        found: false,
        code,
        codeType,
        message: 'Network error during code lookup'
      })
    } finally {
      setLoading(false)
      setMode('result')
    }
  }

  const handleRescan = () => {
    setScanResult(null)
    setMode('scan')
  }

  const isAdminOrStock = ['admin', 'stock', 'sales'].includes(userRole)

  return (
    <div className={styles.backdrop}>
      <div className={styles.modalCard}>
        {mode === 'scan' ? (
          <UniversalScanner
            onScan={handleScan}
            onClose={onClose}
            title="📷 Universal Product Scanner"
            subtitle="Point camera at any Barcode or QR code"
          />
        ) : (
          <>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <h3>
                {scanResult?.found ? (
                  <span className={styles.successTag}>
                    <CheckCircle2 size={20} inline-block /> Product Identified
                  </span>
                ) : (
                  <span className={styles.unknownTag}>
                    <AlertCircle size={20} inline-block /> Product Not Found
                  </span>
                )}
              </h3>
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {scanResult?.found ? (
              <div className={styles.productBody}>
                <SiteImage
                  src={scanResult.product?.image || '/logo.png'}
                  alt={scanResult.product?.name || "Scanned beverage"}
                  className={styles.productThumb}
                />
                <div className={styles.productDetails}>
                  <h4>{scanResult.product?.name}</h4>
                  <div className={styles.brandCategory}>
                    {scanResult.product?.brand} · {scanResult.product?.category} · {scanResult.product?.volume}
                  </div>

                  <div className={styles.metaGrid}>
                    <div>
                      <span>Selling Price</span>
                      <strong>TZS {Number(scanResult.product?.price || 0).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Stock Available</span>
                      <strong>{scanResult.product?.available ?? scanResult.product?.stock ?? 0} units</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.unknownBody}>
                <p>We couldn't find a matching drink in local inventory for:</p>
                <div className={styles.codeBadge}>
                  {scanResult?.code} <small>({scanResult?.codeType})</small>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {scanResult?.message || 'Try scanning again or register this code.'}
                </p>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className={styles.actionsFooter}>
              {scanResult?.found ? (
                <>
                  <div className={styles.quantityRow}>
                    <label style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>Quantity:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={qty}
                      onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <div className={styles.btnRow}>
                    {onAddToCart && (
                      <button
                        className={`${styles.btn} ${styles.primaryBtn}`}
                        onClick={() => {
                          onAddToCart(scanResult.product, qty)
                          onClose()
                        }}
                      >
                        <ShoppingCart size={16} /> Add to Cart
                      </button>
                    )}

                    {onReceiveStock && isAdminOrStock && (
                      <button
                        className={`${styles.btn} ${styles.successBtn}`}
                        onClick={() => {
                          onReceiveStock(scanResult.product, qty)
                          onClose()
                        }}
                      >
                        <PlusCircle size={16} /> Receive Stock
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.btnRow}>
                  {isAdminOrStock && onRegisterProduct && (
                    <button
                      className={`${styles.btn} ${styles.primaryBtn}`}
                      onClick={() => {
                        onRegisterProduct(scanResult.code, scanResult.codeType)
                        onClose()
                      }}
                    >
                      <Plus size={16} /> Register Product
                    </button>
                  )}

                  <button
                    className={`${styles.btn} ${styles.secondaryBtn}`}
                    onClick={handleRescan}
                  >
                    <RefreshCw size={16} /> Scan Again
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
