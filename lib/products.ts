export interface CheckoutProduct {
  id: string
  name: string
  description: string
  priceInCents: number
  image: string
}

export const PRODUCTS: CheckoutProduct[] = [
  { id: 'mango-coast', name: 'Mango Coast', description: 'Mango, lime, sea salt', priceInCents: 390, image: '/images/mango-coast.png' },
  { id: 'spice-route', name: 'Spice Route', description: 'Pineapple, cardamom, ginger', priceInCents: 440, image: '/images/spice-route.png' },
  { id: 'stone-town-fizz', name: 'Stone Town Fizz', description: 'Citrus, mint, sparkling water', priceInCents: 350, image: '/images/stone-town-fizz.png' },
  { id: 'coconut-dhow', name: 'Coconut Dhow', description: 'Coconut, vanilla, toasted rice', priceInCents: 420, image: '/images/coconut-dhow.png' },
  { id: 'kilimani-cooler', name: 'Kilimani Cooler', description: 'Hibiscus, passionfruit, lemongrass', priceInCents: 480, image: '/images/kilimani-cooler.png' },
  { id: 'sultans-table', name: "Sultan's Table", description: 'Baobab, tamarind, black tea', priceInCents: 1850, image: '/images/sultans-table.png' },
]

export function getProduct(id: string) {
  return PRODUCTS.find((product) => product.id === id)
}
