export type Offering = { unit: string; unit_size: number; price: number; deposit: number }
export type ShopProduct = { id: string; name: string; category: string; description: string; volume: string; brand: string; priceTzs: number; priceUsd: number; image: string; available: number; stock: number; minQty: number; unit: string; unitSize: number; deposit: number; units: Offering[]; badge?: string }

export function selectOffering(product: ShopProduct, unit?: string): ShopProduct {
  const offering = product.units.find(value => value.unit === unit)
  if (!offering) return product
  return { ...product, unit: offering.unit, unitSize: offering.unit_size, priceTzs: offering.price, priceUsd: offering.price / 2650, deposit: offering.deposit, stock: Math.floor(product.available / offering.unit_size) }
}

export function filterProducts(products: ShopProduct[], filters: { query: string; category: string; availableOnly: boolean; maxPrice: string; sort: string }) {
  const query = filters.query.trim().toLocaleLowerCase()
  const price = filters.maxPrice === '' ? Infinity : Number(filters.maxPrice)
  return products.filter(p => `${p.name} ${p.category} ${p.brand}`.toLocaleLowerCase().includes(query)
    && (filters.category === 'All' || p.category === filters.category)
    && (!filters.availableOnly || p.stock >= p.minQty)
    && p.priceTzs <= price)
    .sort((a, b) => filters.sort === 'price-asc' ? a.priceTzs - b.priceTzs : filters.sort === 'price-desc' ? b.priceTzs - a.priceTzs : filters.sort === 'name' ? a.name.localeCompare(b.name) : 0)
}

export const deliveryAreas = ['Nungwi', 'Kendwa'] as const
export function checkDeliveryArea(area: string) { return deliveryAreas.some(value => value.toLowerCase() === area.trim().toLowerCase()) }

export const deliverySteps = ['Pending', 'Confirmed', 'Preparing', 'Driver assigned', 'Ready for pickup', 'Picked up', 'Out for delivery', 'Driver arriving', 'Delivered']
export function orderProgress(status: string) {
  return { index: deliverySteps.indexOf(status), exception: ['Cancelled', 'Returned', 'Failed delivery'].includes(status) }
}
