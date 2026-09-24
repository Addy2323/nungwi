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

export const deliverySteps = ['Confirmed', 'Preparing', 'Out for delivery', 'Delivered']
export function orderProgress(status: string) {
  let index = deliverySteps.indexOf(status)
  if (index === -1) {
    if (['Pending', 'Confirmed'].includes(status)) index = 0
    else if (['Preparing', 'Driver assigned', 'Ready for pickup'].includes(status)) index = 1
    else if (['Picked up', 'Out for delivery', 'Driver arriving'].includes(status)) index = 2
    else if (status === 'Delivered') index = 3
  }
  return { index, exception: ['Cancelled', 'Returned', 'Failed delivery'].includes(status) }
}
