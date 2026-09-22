import { pageMetadata, breadcrumbs } from '@/lib/seo'
import { seoProducts, listingSchema } from '@/lib/server/seo'
import JsonLd from '@/components/json-ld'
import Storefront from '@/components/storefront'
import './shop.css'

export const dynamic = 'force-dynamic'
export const metadata = pageMetadata('Shop Wine, Beer & Spirits in Zanzibar | Nungwi Shop', 'Browse wine, beer, spirits and cold drinks at Nungwi Shop by Vunjabei Liquor Zanzibar. Compare prices and order delivery to your hotel in Nungwi or Kendwa.', '/shop')

export default async function ShopPage() {
  const products = await seoProducts()
  return <><JsonLd data={listingSchema(products, '/shop', 'Drinks in Zanzibar')}/><JsonLd data={breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }])}/><Storefront shopPage initialCatalogue={products}/></>
}
