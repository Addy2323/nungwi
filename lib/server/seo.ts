import { cache } from 'react'
import { all, now } from './db'
import { absoluteUrl, BUSINESS_NAME, categoryPath, productPath, SHOP_NAME } from '../seo'
import { storeInfo } from '../store-info'

export type SeoProduct = {
  id: string; name: string; category: string; description: string; brand: string; image: string;
  price: number; unit: string; unit_size: number; min_qty: number; available: number; volume: string;
  deposit: number; sku: string; units: { unit: string; unit_size: number; price: number; deposit: number }[]
}

// Public prices only. Do not serialize purchase costs, hotel pricing or internal stock records.
export const seoProducts = cache(async (): Promise<SeoProduct[]> => {
  const rows = await all(`SELECT p.id,p.name,p.category,p.description,p.brand,p.image,p.price,p.unit,p.unit_size,p.min_qty,p.volume,p.deposit,p.sku,p.units,
    COALESCE((SELECT SUM(b.remaining-b.reserved) FROM batches b WHERE b.product_id=p.id AND b.expires_at>?),0) AS available
    FROM products p WHERE p.active=1 ORDER BY p.name`, now())
  return rows.map(row => ({ ...row, units: JSON.parse(row.units || '[]').map((unit: Record<string, unknown>) => ({ unit: unit.unit, unit_size: unit.unit_size, price: unit.price, deposit: unit.deposit })) })) as SeoProduct[]
})
export const seoProduct = cache(async (id: string) => (await seoProducts()).find(p => p.id === id))
export function productDescription(product: SeoProduct) {
  const name = product.name.length > 65 ? product.name.slice(0, 62).trimEnd() + '…' : product.name
  return `Buy ${name} from Nungwi Shop in Zanzibar. View prices, pack sizes and availability for delivery to your hotel or villa in Nungwi and Kendwa.`.slice(0, 160)
}
export function productSchema(product: SeoProduct) {
  const image = product.image && !product.image.startsWith('data:') ? absoluteUrl(product.image) : absoluteUrl('/images/mango-coast.png')
  return {
    '@context': 'https://schema.org', '@type': 'Product', '@id': absoluteUrl(productPath(product.id)) + '#product',
    name: product.name, description: product.description || productDescription(product), image: [image], sku: product.sku,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}), category: product.category,
    offers: { '@type': 'Offer', url: absoluteUrl(productPath(product.id)), priceCurrency: 'TZS', price: product.price,
      availability: product.available >= product.unit_size * product.min_qty ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition', seller: { '@id': absoluteUrl('/#business') } },
  }
}
export function listingSchema(products: SeoProduct[], path: string, name: string) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', name, url: absoluteUrl(path), numberOfItems: products.length,
    itemListElement: products.map((p, index) => ({ '@type': 'ListItem', position: index + 1, url: absoluteUrl(productPath(p.id)), item: productSchema(p) })) }
}
export function businessSchema() {
  const info = storeInfo()
  const street = process.env.SHOP_STREET_ADDRESS?.trim()
  const lat = Number(process.env.SHOP_LATITUDE), lng = Number(process.env.SHOP_LONGITUDE)
  const hours = process.env.SHOP_OPENING_HOURS?.split(';').map(s => s.trim()).filter(s => /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))? \d{2}:\d{2}-\d{2}:\d{2}$/.test(s))
  return {
    '@context': 'https://schema.org', '@type': street ? 'LiquorStore' : 'Organization', '@id': absoluteUrl('/#business'),
    name: BUSINESS_NAME, alternateName: SHOP_NAME, url: SITE_URL_VALUE,
    logo: absoluteUrl('/icon.svg'), areaServed: ['Nungwi', 'Kendwa'].map(name => ({ '@type': 'Place', name: `${name}, Zanzibar, Tanzania` })),
    ...(info.phone ? { telephone: info.phone } : {}), ...(info.email ? { email: info.email } : {}),
    ...(street ? { address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: process.env.SHOP_LOCALITY || 'Nungwi', addressRegion: 'Zanzibar', addressCountry: 'TZ' } } : {}),
    ...(street && process.env.SHOP_LATITUDE && process.env.SHOP_LONGITUDE && Number.isFinite(lat) && Math.abs(lat)<=90 && Number.isFinite(lng) && Math.abs(lng)<=180 ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}),
    ...(street && hours?.length ? { openingHours: hours } : {}),
  }
}
const SITE_URL_VALUE = absoluteUrl('/')
