'use client'

import React from 'react'
import styles from './label-printer.module.css'
import { Printer } from 'lucide-react'

export interface LabelPrinterProps {
  product: {
    name: string
    brand?: string
    volume?: string
    price?: number
    internal_code?: string
    barcode?: string
  }
}

export function LabelPrinter({ product }: LabelPrinterProps) {
  const displayCode = product.internal_code || product.barcode || 'DRINK-000000'

  // Generate SVG QR matrix
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(displayCode)}`

  return (
    <div style={{ textAlign: 'center', margin: '10px 0' }}>
      <div className={styles.labelCard}>
        <div className={styles.brandName}>{product.brand || 'NUNGWI DRINKS'}</div>
        <div className={styles.productTitle}>{product.name}</div>
        <div className={styles.volume}>{product.volume || '500ml'}</div>

        <div className={styles.qrContainer}>
          <img src={qrSvgUrl} alt="Product QR Code" width={130} height={130} />
        </div>

        <div className={styles.codeText}>{displayCode}</div>
        {product.price && (
          <div className={styles.priceTag}>
            TZS {Number(product.price).toLocaleString()}
          </div>
        )}
      </div>

      <button
        onClick={() => window.print()}
        style={{
          marginTop: 12,
          background: '#ff5405',
          color: '#ffffff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <Printer size={16} /> Print Drink Label
      </button>
    </div>
  )
}
