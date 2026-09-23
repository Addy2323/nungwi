import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CatalogueShell from '@/components/catalogue-shell'
import SiteImage from '@/components/site-image'
import JsonLd from '@/components/json-ld'
import { absoluteUrl, breadcrumbs, categoryPath, pageMetadata, productPath } from '@/lib/seo'
import { productDescription, productSchema, seoProduct } from '@/lib/server/seo'

export const revalidate = 60
export function generateStaticParams() { return [] }
type Props = { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await seoProduct((await params).id)
  if (!product) notFound()
  const title = `${product.name} | Nungwi Shop Zanzibar`
  const metadata = pageMetadata(title, productDescription(product), productPath(product.id))
  const image = `/og?product=${encodeURIComponent(product.id)}`
  return { ...metadata, openGraph: { ...metadata.openGraph, images: [{ url: image, width: 1200, height: 630, alt: `${product.name} at Nungwi Shop` }] }, twitter: { ...metadata.twitter, images: [image] } }
}
export default async function ProductPage({ params }: Props) {
  const product = await seoProduct((await params).id)
  if (!product) notFound()
  const available = product.available >= product.unit_size * product.min_qty
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: product.category, path: categoryPath(product.category) }, { name: product.name, path: productPath(product.id) }]
  return <CatalogueShell><JsonLd data={productSchema(product)}/><JsonLd data={breadcrumbs(crumbs)}/><nav className="shop-breadcrumb" aria-label="Breadcrumb">{crumbs.map((c, i) => <span key={c.path}>{i > 0 && <span aria-hidden="true"> / </span>}{i === crumbs.length-1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path}>{c.name}</Link>}</span>)}</nav><article className="product-page-grid"><div className="product-page-image"><SiteImage src={product.image} alt={`${product.name}${product.volume ? `, ${product.volume}` : ''}`} width={800} height={800} sizes="(max-width: 760px) 90vw, 45vw" preload/></div><div><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p>{product.description || `${product.name} is available from Nungwi Shop, Vunjabei Liquor Zanzibar. Order drinks for delivery to Nungwi and Kendwa.`}</p><p className="product-page-price">TZS {product.price.toLocaleString('en-US')} <small>/ {product.unit}</small></p><p className={`stock-label ${available ? '' : 'unavailable'}`}>{available ? 'In stock' : 'Currently unavailable'}</p><dl className="product-facts">{[['Brand', product.brand], ['Size', product.volume], ['Selling unit', `${product.unit} (${product.unit_size} base units)`], ['Minimum quantity', String(product.min_qty)], ['SKU', product.sku], ...(product.deposit ? [['Returnable deposit per unit', `TZS ${product.deposit.toLocaleString('en-US')}`]] : [])].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Link className="btn-primary-orange" href={`/shop?product=${encodeURIComponent(product.id)}#shop`}>{available ? 'Choose quantity & add to basket' : 'View product options in the shop'}</Link><p className="checkout-hint">Standard retail price shown. Delivery charges, any tax and deposits are confirmed at checkout. Hotel account prices may differ.</p></div></article><section className="product-page-info"><h2>Delivery in Nungwi and Kendwa</h2><p>Order to your hotel, villa or local address. Check your delivery area and available payment methods before confirming your order.</p><Link className="text-link" href="/help#delivery">Read delivery and payment information</Link><Link className="text-link" href={categoryPath(product.category)}>Browse more {product.category.toLowerCase()}</Link></section></CatalogueShell>
}
