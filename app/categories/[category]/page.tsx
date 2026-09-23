import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CatalogueShell from '@/components/catalogue-shell'
import SiteImage from '@/components/site-image'
import JsonLd from '@/components/json-ld'
import { breadcrumbs, categoryPath, pageMetadata, productPath } from '@/lib/seo'
import { listingSchema, seoProducts } from '@/lib/server/seo'

export const revalidate = 60
export function generateStaticParams() { return [] }
type Props = { params: Promise<{ category: string }> }
async function getCategory(params: Props['params']) {
  const { category } = await params
  const products = (await seoProducts()).filter(p => p.category === category)
  if (!products.length) notFound()
  return { category, products }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await getCategory(params)
  const title = category.length <= 11 ? `Shop ${category} & Drinks Delivery in Zanzibar | Nungwi Shop` : `${category} Delivery in Zanzibar | Nungwi Shop`
  const suffix = category.length <= 11 ? ' at Nungwi Shop by Vunjabei Liquor Zanzibar. Browse current prices and availability for local delivery to hotels and villas in Nungwi and Kendwa.' : ' at Nungwi Shop in Zanzibar. Compare prices and stock, then order drinks delivery to your hotel or villa in Nungwi and Kendwa.'
  const budget = 160 - 'Shop '.length - suffix.length
  const name = category.length > budget ? category.slice(0, budget - 1).trimEnd() + '…' : category
  return pageMetadata(title, `Shop ${name.toLowerCase()}${suffix}`, categoryPath(category))
}
export default async function CategoryPage({ params }: Props) {
  const { category, products } = await getCategory(params)
  return <CatalogueShell><JsonLd data={breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: category, path: categoryPath(category) }])}/><JsonLd data={listingSchema(products, categoryPath(category), `${category} in Zanzibar`)}/><nav className="shop-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/shop">Shop</Link><span>/</span><span aria-current="page">{category}</span></nav><h1>{category} in Zanzibar</h1><p className="catalogue-page-intro">Browse {category.toLowerCase()} from Nungwi Shop, Vunjabei Liquor Zanzibar. Order delivery to Nungwi and Kendwa; prices and stock are confirmed at checkout.</p><div className="product-grid-4">{products.map((product, index) => <article className="card-product" key={product.id}><Link className="card-img-wrap" href={productPath(product.id)}><SiteImage src={product.image} alt={product.name} width={640} height={640} sizes="(max-width: 760px) 45vw, 300px" loading={index < 2 ? 'eager' : 'lazy'}/></Link><div className="card-details"><h2><Link href={productPath(product.id)}>{product.name}</Link></h2><p>{product.volume || product.unit}</p><strong>TZS {product.price.toLocaleString('en-US')} / {product.unit}</strong><p className={`stock-label ${product.available >= product.unit_size*product.min_qty ? '' : 'unavailable'}`}>{product.available >= product.unit_size*product.min_qty ? 'In stock' : 'Currently unavailable'}</p><Link className="text-link" href={productPath(product.id)}>View {product.name}</Link></div></article>)}</div><Link className="text-link" href="/shop">Browse all drinks and shop categories</Link></CatalogueShell>
}
