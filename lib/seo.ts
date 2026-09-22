import type { Metadata } from 'next'

export const SITE_URL = 'https://vunjabeiliquorzanzibar.co.tz'
export const BUSINESS_NAME = 'Vunjabei Liquor Zanzibar'
export const SHOP_NAME = 'Nungwi Shop'
export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString()
export const productPath = (id: string) => `/products/${encodeURIComponent(id)}`
export const categoryPath = (category: string) => `/categories/${encodeURIComponent(category)}`

export function pageMetadata(title: string, description: string, path: string, privatePage = false): Metadata {
  return {
    title, description, alternates: { canonical: absoluteUrl(path) },
    robots: privatePage ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'website', title, description, url: absoluteUrl(path), siteName: `${BUSINESS_NAME} · ${SHOP_NAME}`, locale: 'en_TZ', images: [{ url: '/og', width: 1200, height: 630, alt: `${BUSINESS_NAME} — ${SHOP_NAME}, Nungwi and Kendwa delivery` }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og'] },
  }
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) }
}

// Escape HTML-significant characters so catalogue names cannot terminate the script.
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
