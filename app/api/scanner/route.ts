import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser, requireUser, AppError, permit } from '@/lib/server/auth'
import { scanProductCode, generateInternalQR, linkCodeToProduct, getCategories, getScannerAnalyticsSummary } from '@/lib/server/scanner'
import { scannerLookupInput, productCodeInput, productInput } from '@/lib/server/validation'
import { saveProduct } from '@/lib/server/platform'
import { run, id, now, audit } from '@/lib/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
  }
  console.error('[api/scanner]', error)
  return NextResponse.json({ error: 'Scanner operation failed.' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const action = url.searchParams.get('action') || 'scan'
    const actor = await currentUser()

    if (action === 'categories') {
      const categories = await getCategories()
      return NextResponse.json({ data: categories })
    }

    if (action === 'analytics') {
      if (!actor || !['admin', 'stock', 'sales'].includes(actor.role)) {
        throw new AppError('Permission denied', 403)
      }
      const analytics = await getScannerAnalyticsSummary()
      return NextResponse.json({ data: analytics })
    }

    if (!code) {
      throw new AppError('Code parameter is required for scanning', 400)
    }

    const parsed = scannerLookupInput.parse({
      code,
      codeType: url.searchParams.get('type') || 'UNKNOWN',
      source: (url.searchParams.get('source') as any) || 'scanner'
    })

    const result = await scanProductCode(parsed.code, actor?.id || null, parsed.source)
    return NextResponse.json({ data: result })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser()
    const body = await request.json()
    const action = z.string().parse(body.action)

    if (action === 'scanner.scan') {
      const input = scannerLookupInput.parse(body)
      const result = await scanProductCode(input.code, actor.id, input.source)
      return NextResponse.json({ data: result })
    }

    if (action === 'scanner.generate_qr') {
      permit(actor, ['admin', 'stock'])
      const productId = z.string().parse(body.product_id)
      const { internalCode } = generateInternalQR()
      const link = await linkCodeToProduct(productId, internalCode, 'INTERNAL_QR', true, 'generated')
      await audit(actor.id, 'qr.generated', 'product', productId, { internalCode })
      return NextResponse.json({ data: { internalCode, link } })
    }

    if (action === 'scanner.link_code') {
      permit(actor, ['admin', 'stock'])
      const input = productCodeInput.parse(body)
      const link = await linkCodeToProduct(input.product_id, input.code, input.code_type, input.is_primary, input.source)
      await audit(actor.id, 'code.linked', 'product', input.product_id, { code: input.code, type: input.code_type })
      return NextResponse.json({ data: link })
    }

    if (action === 'scanner.register') {
      permit(actor, ['admin', 'stock'])
      const scannedCode = z.string().trim().min(1).parse(body.scannedCode)
      const scannedCodeType = z.string().parse(body.scannedCodeType || 'EAN_13')
      
      // Save product using platform saveProduct
      const result = await saveProduct(actor, body)
      if (result && (result as any).id) {
        const newProductId = (result as any).id
        await linkCodeToProduct(newProductId, scannedCode, scannedCodeType, true, 'manual')
        // Also generate an internal QR code
        const { internalCode } = generateInternalQR()
        await linkCodeToProduct(newProductId, internalCode, 'INTERNAL_QR', false, 'generated')
      }
      return NextResponse.json({ data: result })
    }

    throw new AppError('Action not supported', 400)
  } catch (error) {
    return failure(error)
  }
}
