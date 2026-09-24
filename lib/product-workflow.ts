// Keep the existing FEFO representation: non-expiring batches sort last.
export const NO_EXPIRY = '9999-12-31T23:59:59.999Z'
export const PRODUCT_UNITS = ['bottle', 'piece', 'can', 'pack', 'carton', 'crate', 'kg', 'litre'] as const
export type CatalogProduct = Record<string, any> & { id: string; name: string; cost: number; unit: string; unit_size: number }
export function searchWords(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 8)
}
