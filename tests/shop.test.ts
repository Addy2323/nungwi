import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkDeliveryArea, filterProducts, orderProgress, selectOffering, type ShopProduct } from '../lib/shop-utils'
import { compareTableValues, pageBounds } from '../lib/table-utils'

const product: ShopProduct = { id: 'drink', name: 'Island drink', category: 'Juices', description: '', volume: '330ml', brand: 'Coast', priceTzs: 2000, priceUsd: 2000 / 2650, image: '/test.png', available: 25, stock: 25, minQty: 1, unit: 'bottle', unitSize: 1, deposit: 0, units: [{ unit: 'crate', unit_size: 24, price: 40000, deposit: 1000 }] }
const filters = { query: '', category: 'All', sort: 'featured', maxPrice: '', availableOnly: false }

describe('storefront selection and discovery', () => {
  it('uses exact base stock when switching from a multi-item default unit', () => {
    const crate = { ...product, unit: 'crate', unitSize: 24, stock: 1, units: [{ unit: 'bottle', unit_size: 1, price: 2000, deposit: 0 }] }
    assert.equal(selectOffering(crate, 'bottle').stock, 25)
    assert.equal(selectOffering(product, 'crate').stock, 1)
    assert.equal(selectOffering(product, 'crate').priceTzs, 40000)
    assert.equal(product.stock, 25)
  })
  it('filters and sorts the selected selling prices, preserving original order and data', () => {
    const crate = selectOffering(product, 'crate')
    const cheaper = { ...product, id: 'cheap', priceTzs: 1000 }
    assert.deepEqual(filterProducts([crate, cheaper], { ...filters, maxPrice: '2000' }).map(p => p.id), ['cheap'])
    assert.deepEqual(filterProducts([crate, cheaper], { ...filters, sort: 'price-asc' }).map(p => p.id), ['cheap', 'drink'])
    assert.deepEqual(filterProducts([crate, cheaper], filters).map(p => p.id), ['drink', 'cheap'])
  })
  it('combines trimmed brand search, category, price and minimum purchasable quantity', () => {
    assert.equal(filterProducts([product], { ...filters, query: ' coast ', category: 'Juices', maxPrice: '2000', availableOnly: true }).length, 1)
    assert.equal(filterProducts([{ ...product, stock: 1, minQty: 2 }], { ...filters, availableOnly: true }).length, 0)
    assert.equal(filterProducts([product], { ...filters, maxPrice: '0' }).length, 0)
    assert.equal(filterProducts([product], { ...filters, category: 'Beer' }).length, 0)
  })
  it('does not confirm unknown hotels or substring matches as covered areas', () => {
    assert.equal(checkDeliveryArea(' kendwa '), true)
    assert.equal(checkDeliveryArea('NUNGWI'), true)
    assert.equal(checkDeliveryArea('Outside Nungwi'), false)
    assert.equal(checkDeliveryArea('Unknown hotel'), false)
  })
})

describe('dashboard presentation rules', () => {
  it('sorts numerical quantities and order identifiers naturally', () => {
    assert.deepEqual([10000, 2000, 900].sort(compareTableValues), [900, 2000, 10000])
    assert.deepEqual(['Order 10', 'Order 2'].sort(compareTableValues), ['Order 2', 'Order 10'])
    assert.ok(compareTableValues(null, 0) > 0)
  })
  it('clamps pagination after filtering removes the last page', () => {
    assert.deepEqual(pageBounds(11, 4, 10), { page: 2, pages: 2, start: 10, end: 11 })
    assert.deepEqual(pageBounds(0, 3, 10), { page: 1, pages: 1, start: 0, end: 0 })
  })
  it('keeps cancelled, returned and failed orders out of the normal active sequence', () => {
    for (const status of ['Cancelled', 'Returned', 'Failed delivery']) assert.deepEqual(orderProgress(status), { index: -1, exception: true })
    assert.deepEqual(orderProgress('Out for delivery'), { index: 3, exception: false })
    assert.deepEqual(orderProgress('Delivered'), { index: 4, exception: false })
  })
})
