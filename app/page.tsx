import Storefront from '@/components/storefront'
import { pageMetadata } from '@/lib/seo'
import { seoProducts } from '@/lib/server/seo'

export const revalidate = 60
export const metadata = pageMetadata('Liquor Delivery Zanzibar & Nungwi | Vunjabei Liquor', 'Shop wine, spirits, beer and cold drinks at Vunjabei Liquor Zanzibar, also known as Nungwi Shop. Order delivery to hotels and villas in Nungwi and Kendwa.', '/')
export default async function HomePage() {
  return <Storefront initialCatalogue={await seoProducts()} />
}
