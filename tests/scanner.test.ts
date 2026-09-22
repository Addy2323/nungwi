import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inferCodeType, generateInternalQR } from '../lib/server/scanner'
import { scannerLookupInput, productInput } from '../lib/server/validation'
import { TANZANIA_DRINK_PRESETS } from '../lib/drink-presets'

describe('Universal Drinks Scanner Unit Tests', () => {
  describe('inferCodeType()', () => {
    it('detects internal drink QR prefixes', () => {
      assert.equal(inferCodeType('DRINK-ABC12345'), 'INTERNAL_QR')
      assert.equal(inferCodeType('LUMO-DRINK-9988'), 'INTERNAL_QR')
    })

    it('detects standard EAN-13 barcodes', () => {
      assert.equal(inferCodeType('6001007000100'), 'EAN_13')
      assert.equal(inferCodeType('5449000000996'), 'EAN_13')
    })

    it('detects EAN-8 barcodes', () => {
      assert.equal(inferCodeType('12345678'), 'EAN_8')
    })

    it('detects UPC-A barcodes', () => {
      assert.equal(inferCodeType('012345678905'), 'UPC_A')
    })

    it('detects generic QR codes', () => {
      assert.equal(inferCodeType('https://nungwi.co.tz/p/safari-lager'), 'QR')
    })

    it('detects Code 128 as fallback for alphanumeric strings', () => {
      assert.equal(inferCodeType('SKU-SAFARI-500ML'), 'CODE_128')
    })
  })

  describe('generateInternalQR()', () => {
    it('generates internal code starting with specified prefix', () => {
      const qr = generateInternalQR('DRINK')
      assert.ok(qr.internalCode.startsWith('DRINK-'))
      assert.equal(qr.payload.type, 'product')
    })
  })

  describe('Zod Validation Schemas', () => {
    it('validates scanner lookup payload', () => {
      const parsed = scannerLookupInput.parse({ code: '6001007000100', source: 'scanner' })
      assert.equal(parsed.code, '6001007000100')
      assert.equal(parsed.source, 'scanner')
    })

    it('rejects empty scan code', () => {
      assert.throws(() => scannerLookupInput.parse({ code: '' }), /too_small|at least 1 character|Too small/i)
    })

    it('validates drink product registration', () => {
      const product = productInput.parse({
        name: 'Kilimanjaro Premium Lager 500ml',
        brand: 'Kilimanjaro',
        category: 'Beer & Lager',
        sku: 'KILI-500ML',
        barcode: '6001007000200',
        barcode_type: 'EAN_13',
        price: 3500,
        volume_ml: 500,
        drink_type: 'ALCOHOLIC',
        alcohol_percentage: 4.5
      })
      assert.equal(product.name, 'Kilimanjaro Premium Lager 500ml')
      assert.equal(product.drink_type, 'ALCOHOLIC')
      assert.equal(product.alcohol_percentage, 4.5)
    })
  })

  describe('Tanzania Drink Presets', () => {
    it('contains valid Tanzanian drink presets', () => {
      assert.ok(TANZANIA_DRINK_PRESETS.length >= 8)
      const safari = TANZANIA_DRINK_PRESETS.find(p => p.brand === 'Safari')
      assert.ok(safari)
      assert.equal(safari.category, 'Beer & Lager')
      assert.equal(safari.drink_type, 'ALCOHOLIC')
    })
  })
})
