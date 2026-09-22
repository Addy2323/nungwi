import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { pageMetadata, breadcrumbs, serializeJsonLd, absoluteUrl, productPath, categoryPath, SITE_URL } from '../lib/seo'
import { productSchema, listingSchema, type SeoProduct } from '../lib/server/seo'
import { proxy } from '../proxy'
import robots from '../app/robots'

const product: SeoProduct = { id: 'test/encoded', name: '</script><script>alert(1)</script>', category: 'Wine & Spirits', description: 'Test drink', brand: 'Test', image: '/images/mango-coast.png', price: 15000, unit: 'bottle', unit_size: 6, min_qty: 2, available: 11, volume: '750 ml', deposit: 0, sku: 'TEST-1', units: [] }

describe('SEO metadata, public structured data and host handling', () => {
  it('uses one host and strips private pages out of indexable metadata', () => {
    const meta = pageMetadata('Private account', 'Private information', '/customer', true)
    assert.equal(meta.alternates?.canonical, SITE_URL + '/customer')
    assert.deepEqual(meta.robots, { index: false, follow: false })
    assert.ok(!meta.alternates?.languages)
    assert.equal(productPath(product.id), '/products/test%2Fencoded')
    assert.equal(categoryPath(product.category), '/categories/Wine%20%26%20Spirits')
  })
  it('escapes stored markup without changing the JSON-LD values', () => {
    const serialized = serializeJsonLd(productSchema(product))
    assert.ok(!serialized.includes('</script>'))
    assert.equal(JSON.parse(serialized).name, product.name)
  })
  it('keeps offers consistent with selling units and minimum order quantities', () => {
    const schema = productSchema(product)
    assert.equal(schema['@type'], 'Product')
    assert.equal(schema.offers.priceCurrency, 'TZS')
    assert.equal(schema.offers.price, 15000)
    assert.equal(schema.offers.availability, 'https://schema.org/OutOfStock')
    assert.equal(productSchema({ ...product, available: 12 }).offers.availability, 'https://schema.org/InStock')
    assert.equal(schema.offers.url, absoluteUrl(productPath(product.id)))
    assert.ok(!('aggregateRating' in schema))
    assert.ok(!('review' in schema))
  })
  it('emits ordered absolute breadcrumbs and product list entries', () => {
    const schema = breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }])
    assert.deepEqual(schema.itemListElement.map(i => i.position), [1,2])
    assert.equal(schema.itemListElement[1].item, SITE_URL + '/shop')
    const list = listingSchema([product], '/shop', 'Shop')
    assert.equal(list.itemListElement[0].item.offers.priceCurrency, 'TZS')
    assert.equal(list.numberOfItems, 1)
  })
  it('redirects only the alternate production host and preserves path/query', () => {
    const response = proxy(new NextRequest('https://www.vunjabeiliquorzanzibar.co.tz/shop?category=wine', { headers: { host: 'www.vunjabeiliquorzanzibar.co.tz' } }))
    assert.equal(response.status, 301)
    assert.equal(response.headers.get('location'), SITE_URL + '/shop?category=wine')
    assert.equal(proxy(new NextRequest('http://localhost:3002/shop', { headers: { host: 'localhost:3002' } })).status, 200)
    assert.equal(proxy(new NextRequest(SITE_URL+'/shop', { headers: { host: 'vunjabeiliquorzanzibar.co.tz' } })).status, 200)
  })
  it('lists the sitemap and excludes private/auth/delivery URLs from crawling', () => {
    const rules = robots()
    assert.equal(rules.sitemap, SITE_URL + '/sitemap.xml')
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules
    for (const path of ['/dashboard','/customer','/checkout','/hotel','/delivery/','/api/']) assert.ok(rule.disallow?.includes(path))
  })
})
