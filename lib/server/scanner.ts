import { all, one, run, id, now, audit } from './db'

export type CodeType = 'EAN_13' | 'EAN_8' | 'UPC_A' | 'UPC_E' | 'CODE_128' | 'CODE_39' | 'QR' | 'INTERNAL_QR' | 'UNKNOWN'

export interface ScannedProductResult {
  success: boolean
  found: boolean
  code: string
  codeType: string
  source: 'local' | 'external' | 'none'
  product?: any
  externalCandidate?: any
  message?: string
}

export function inferCodeType(code: string): CodeType {
  const clean = code.trim()
  if (clean.startsWith('DRINK-') || clean.startsWith('LUMO-DRINK-') || clean.startsWith('{')) return 'INTERNAL_QR'
  if (/^\d{13}$/.test(clean)) return 'EAN_13'
  if (/^\d{8}$/.test(clean)) return 'EAN_8'
  if (/^\d{12}$/.test(clean)) return 'UPC_A'
  if (/^\d{6}$/.test(clean)) return 'UPC_E'
  if (clean.length > 20 || clean.includes('/') || clean.includes(':')) return 'QR'
  return 'CODE_128'
}

export async function logScanAnalytics(userId: string | null, code: string, codeType: string, productId: string | null, result: string, source = 'scanner') {
  try {
    await run(
      'INSERT INTO scanner_analytics (id, user_id, code, code_type, product_id, result, source, created_at) VALUES (?,?,?,?,?,?,?,?)',
      id(), userId, code, codeType, productId, result, source, now()
    )
  } catch (err) {
    console.error('[scanner] Failed to log analytics:', err)
  }
}

export async function scanProductCode(code: string, userId?: string | null, source = 'scanner'): Promise<ScannedProductResult> {
  const cleanCode = code.trim()
  if (!cleanCode) {
    return { success: false, found: false, code: '', codeType: 'UNKNOWN', source: 'none', message: 'Invalid or empty code' }
  }

  const detectedType = inferCodeType(cleanCode)

  // Priority 1: Check product_codes table
  const codeRow = (await one(
    'SELECT p.*, pc.code_type AS matched_code_type FROM product_codes pc JOIN products p ON pc.product_id = p.id WHERE pc.code = ?',
    cleanCode
  )) as Record<string, any> | undefined

  if (codeRow) {
    // Fetch available stock across batches
    const stockRow = await one('SELECT COALESCE(SUM(remaining - reserved), 0) AS available FROM batches WHERE product_id = ?', codeRow.id)
    const product: Record<string, any> = { ...codeRow, available: stockRow?.available ?? 0 }
    await logScanAnalytics(userId || null, cleanCode, detectedType, product.id, 'FOUND_LOCAL', source)
    return {
      success: true,
      found: true,
      code: cleanCode,
      codeType: codeRow.matched_code_type || detectedType,
      source: 'local',
      product
    }
  }

  // Priority 2: Direct lookup on products table (sku, barcode, qr_code, internal_code)
  const productRow = (await one(
    'SELECT * FROM products WHERE sku = ? OR barcode = ? OR qr_code = ? OR internal_code = ?',
    cleanCode, cleanCode, cleanCode, cleanCode
  )) as Record<string, any> | undefined

  if (productRow) {
    const stockRow = await one('SELECT COALESCE(SUM(remaining - reserved), 0) AS available FROM batches WHERE product_id = ?', productRow.id)
    const product: Record<string, any> = { ...productRow, available: stockRow?.available ?? 0 }
    
    // Auto-link code to product_codes if missing
    await run(
      'INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (code) DO NOTHING',
      id(), product.id, cleanCode, detectedType, 1, 'auto_linked', now()
    )

    await logScanAnalytics(userId || null, cleanCode, detectedType, product.id, 'FOUND_LOCAL', source)
    return {
      success: true,
      found: true,
      code: cleanCode,
      codeType: detectedType,
      source: 'local',
      product
    }
  }

  // Priority 3: External lookup fallback simulation (or mock for well-known barcode patterns)
  const externalCandidate = getExternalLookupCandidate(cleanCode)
  if (externalCandidate) {
    await logScanAnalytics(userId || null, cleanCode, detectedType, null, 'FOUND_EXTERNAL', source)
    return {
      success: true,
      found: false,
      code: cleanCode,
      codeType: detectedType,
      source: 'external',
      externalCandidate,
      message: 'Product not in local inventory, but identified online.'
    }
  }

  // Priority 4: Not found
  await logScanAnalytics(userId || null, cleanCode, detectedType, null, 'NOT_FOUND', source)
  return {
    success: true,
    found: false,
    code: cleanCode,
    codeType: detectedType,
    source: 'none',
    message: "We couldn't identify this product in local inventory."
  }
}

export function generateInternalQR(prefix = 'DRINK'): { internalCode: string; payload: { type: string; productId: string } } {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let randomStr = ''
  for (let i = 0; i < 8; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const internalCode = `${prefix}-${randomStr}`
  return {
    internalCode,
    payload: {
      type: 'product',
      productId: internalCode
    }
  }
}

export async function linkCodeToProduct(productId: string, code: string, codeType: string, isPrimary = true, source = 'manual') {
  const cleanCode = code.trim()
  const codeId = id()
  await run(
    'INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET product_id=EXCLUDED.product_id, code_type=EXCLUDED.code_type',
    codeId, productId, cleanCode, codeType, isPrimary ? 1 : 0, source, now()
  )
  if (isPrimary) {
    if (codeType === 'QR' || codeType === 'INTERNAL_QR') {
      await run('UPDATE products SET qr_code=?, qr_code_type=? WHERE id=?', cleanCode, codeType, productId)
    } else {
      await run('UPDATE products SET barcode=?, barcode_type=? WHERE id=?', cleanCode, codeType, productId)
    }
  }
  return { id: codeId, code: cleanCode, codeType }
}

export async function getCategories() {
  const categories = await all('SELECT * FROM drink_categories ORDER BY type, name')
  const subcategories = await all('SELECT * FROM drink_subcategories ORDER BY name')
  return categories.map(cat => ({
    ...cat,
    subcategories: subcategories.filter(sub => sub.category_id === cat.id)
  }))
}

export async function getScannerAnalyticsSummary() {
  const total = await one('SELECT COUNT(*) AS count FROM scanner_analytics')
  const byResult = await all('SELECT result, COUNT(*) AS count FROM scanner_analytics GROUP BY result')
  const byType = await all('SELECT code_type, COUNT(*) AS count FROM scanner_analytics GROUP BY code_type')
  const recent = await all('SELECT sa.*, p.name AS product_name FROM scanner_analytics sa LEFT JOIN products p ON sa.product_id=p.id ORDER BY sa.created_at DESC LIMIT 20')
  return {
    totalScans: total?.count ?? 0,
    byResult: Object.fromEntries(byResult.map(r => [r.result, r.count])),
    byType: Object.fromEntries(byType.map(t => [t.code_type, t.count])),
    recent
  }
}

function getExternalLookupCandidate(code: string) {
  // Known reference product lookup for demonstration/external API mock
  const knownDatabase: Record<string, any> = {
    '5449000000996': { brand: 'Coca-Cola', name: 'Stoney Tangawizi Ginger Beer', volumeMl: 500, drinkType: 'NON_ALCOHOLIC', category: 'Soft Drinks' },
    '9002490100070': { brand: 'Red Bull', name: 'Red Bull Energy Drink', volumeMl: 250, drinkType: 'NON_ALCOHOLIC', category: 'Energy Drinks' },
    '5000267024310': { brand: 'Johnnie Walker', name: 'Johnnie Walker Black Label 12 Year', volumeMl: 750, drinkType: 'ALCOHOLIC', category: 'Whisky' },
    '6001007000100': { brand: 'Safari', name: 'Safari Lager', volumeMl: 500, drinkType: 'ALCOHOLIC', category: 'Beer & Lager' }
  }
  return knownDatabase[code] || null
}
