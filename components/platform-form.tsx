'use client'
import SiteImage from '@/components/site-image'

import { useAlerts } from '@/components/use-alerts'
import { useState, type FormEvent } from 'react'
import { mutate } from '@/lib/client-api'
import { useLanguage } from './language-provider'
import styles from './platform.module.css'
import { TANZANIA_DRINK_PRESETS, type DrinkPreset } from '@/lib/drink-presets'

export type Field = {
  name: string
  label: string
  type?: 'text' | 'email' | 'number' | 'datetime-local' | 'checkbox' | 'textarea' | 'json' | 'select' | 'password'
  options?: { value: string; label: string }[]
  required?: boolean
  help?: string
  min?: number
  max?: number
}

export default function PlatformForm({
  action,
  fields,
  initial = {},
  onSaved,
  submit = 'Save'
}: {
  action: string
  fields: Field[]
  initial?: Record<string, any>
  onSaved: (value: any) => void
  submit?: string
}) {
  const { t } = useLanguage()
  const alerts = useAlerts()

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, any>>({ ...initial })
  const [image, setImage] = useState(initial.image || '')

  // Update a single form field state dynamically
  const handleChange = (name: string, val: any) => {
    setFormValues(prev => ({ ...prev, [name]: val }))
  }

  // Handle Preset Selection (Auto-Fill)
  const handlePresetSelect = (presetId: string) => {
    const preset = TANZANIA_DRINK_PRESETS.find(p => p.id === presetId)
    if (!preset) return

    setFormValues(prev => ({
      ...prev,
      name: preset.name,
      brand: preset.brand,
      category: preset.category,
      description: preset.description,
      volume: preset.volume,
      unit: preset.unit,
      unit_size: preset.unit_size,
      price: preset.price,
      sku: preset.barcode || preset.id,
      drink_type: preset.drink_type,
      alcohol_percentage: preset.alcohol_percentage,
      image: preset.image
    }))
    setImage(preset.image)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const form = new FormData(event.currentTarget)
      const values: Record<string, any> = { ...initial, ...formValues }

      fields.forEach(field => {
        const raw = form.get(field.name)
        values[field.name] = field.type === 'checkbox'
          ? raw === 'on'
          : field.type === 'number'
            ? (raw === '' || raw === null ? null : Number(raw))
            : field.type === 'json'
              ? (typeof raw === 'string' && raw.trim() !== ''
                  ? (() => {
                      try {
                        return JSON.parse(raw)
                      } catch {
                        return []
                      }
                    })()
                  : (raw || []))
              : field.type === 'datetime-local'
                ? new Date(String(raw)).toISOString()
                : (field.name === 'hotel_id' && raw === '' ? null : String(raw ?? ''))
      })

      if (fields.some(f => f.name === 'image')) {
        values.image = image
      }

      const confirmation = action === 'payment.record' && values.kind === 'refund'
        ? t('Record this refund? Confirm that the money has already been returned.', 'Rekodi marejesho haya? Thibitisha kuwa pesa zimerudishwa tayari.')
        : action === 'order.status' && ['Cancelled', 'Returned'].includes(values.status)
          ? t('Apply this order status change?', 'Tekeleza mabadiliko haya ya hali ya agizo?')
          : ''

      if (confirmation && !(await alerts.confirm(confirmation))) return
      onSaved(await mutate(action, values))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save.'
      setError(message)
      // The inline error remains available even if the popup cannot load or close.
      void alerts.error(message).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const isProductForm = action === 'product.save'

  return (
    <form className={styles.form} onSubmit={save}>
      {/* Quick Fill Preset Dropdown for Products */}
      {isProductForm && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #ffedd5' }}>
          <label style={{ fontWeight: 600, color: '#c2410c', display: 'block', marginBottom: 6 }}>
            {t("🍹 Quick Selection: Select Tanzania Drink Preset")}
          </label>
          <select
            onChange={e => handlePresetSelect(e.target.value)}
            defaultValue=""
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #f97316', background: '#fff', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            <option value="">{t("-- Select popular drink to auto-fill details --")}</option>
            {TANZANIA_DRINK_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.name} ({preset.category} - TZS {preset.price.toLocaleString()})
              </option>
            ))}
          </select>
          <small style={{ color: '#ea580c', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
            {t("Selecting a preset auto-populates product name, category, brand, volume, price & unit details.")}
          </small>
        </div>
      )}

      {fields.map(field => {
        let value = formValues[field.name] ?? initial[field.name] ?? ''

        if (field.type === 'json') {
          value = typeof value === 'string' ? value : JSON.stringify(value || [], null, 2)
        }
        if (field.type === 'datetime-local' && value) {
          const d = new Date(value)
          value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        }

        return (
          <label key={field.name} className={field.type === 'checkbox' ? styles.checkbox : ''}>
            {field.type !== 'checkbox' && t(field.label)}

            {field.type === 'select' ? (
              <select
                name={field.name}
                value={value}
                onChange={e => handleChange(field.name, e.target.value)}
                required={field.required !== false}
              >
                {field.required === false && <option value="">{t("None")}</option>}
                {field.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' || field.type === 'json' ? (
              <textarea
                name={field.name}
                value={value}
                onChange={e => handleChange(field.name, e.target.value)}
                required={field.required !== false}
                rows={field.type === 'json' ? 5 : 3}
              />
            ) : field.name === 'image' ? (
              <>
                <input
                  name="image"
                  value={image}
                  onChange={e => {
                    setImage(e.target.value)
                    handleChange('image', e.target.value)
                  }}
                  placeholder={t("HTTPS image URL or pick local file below")}
                />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={t("Upload local product image")}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    setBusy(true)
                    try {
                      // Try API upload first
                      const form = new FormData()
                      form.set('file', file)
                      const response = await fetch('/api/platform', { method: 'POST', body: form })
                      const result = await response.json()
                      if (response.ok && result.data?.url) {
                        setImage(result.data.url)
                        handleChange('image', result.data.url)
                      } else {
                        throw new Error('API storage fallback')
                      }
                    } catch {
                      // Offline/Local base64 fallback so local file uploads always work!
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const dataUrl = ev.target?.result as string
                        if (dataUrl) {
                          setImage(dataUrl)
                          handleChange('image', dataUrl)
                        }
                      }
                      reader.readAsDataURL(file)
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
                {image && (
                  <SiteImage
                    className={styles.imagePreview}
                    src={image}
                    alt={t("Selected product image preview")}
                    style={{ maxHeight: 100, borderRadius: 8, marginTop: 8, objectFit: 'cover' }}
                  />
                )}
              </>
            ) : (
              <input
                name={field.name}
                type={field.type || 'text'}
                value={field.type === 'checkbox' ? undefined : value}
                checked={field.type === 'checkbox' ? Boolean(value) : undefined}
                onChange={e =>
                  handleChange(field.name, field.type === 'checkbox' ? e.target.checked : e.target.value)
                }
                required={field.type === 'checkbox' ? false : field.required !== false}
                min={field.min ?? (field.type === 'number' ? 0 : undefined)}
                max={field.max}
                step={field.type === 'number' ? '1' : undefined}
              />
            )}

            {field.type === 'checkbox' && t(field.label)}
            {field.help && <small>{t(field.help)}</small>}
          </label>
        )
      })}

      {error && <p role="alert" className={styles.error}>{t(error)}</p>}
      <button className={styles.primary} disabled={busy}>
        {busy ? t("Saving…") : submit}
      </button>
    </form>
  )
}

