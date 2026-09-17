'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from './language-provider'

export default function ShopDialog({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useLanguage()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={ref} className={`shop-dialog ${drawer ? 'cart-dialog' : ''}`} aria-labelledby="shop-dialog-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose() } }}><header><h2 id="shop-dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label={t('Close dialog')}><X size={20}/></button></header>{children}</dialog>
}
