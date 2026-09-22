import { ImageResponse } from 'next/og'
import { seoProduct } from '@/lib/server/seo'
import { BUSINESS_NAME, SHOP_NAME } from '@/lib/seo'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('product')
  const product = id ? await seoProduct(id) : undefined
  if (id && !product) return new Response('Product not found', { status: 404 })
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#faf7f2', color: '#263a35', padding: '65px 75px', flexDirection: 'column', justifyContent: 'space-between', borderBottom: '22px solid #b64e24' }}>
      <div style={{ display: 'flex', fontSize: 28, color: '#b64e24' }}>{BUSINESS_NAME} · {SHOP_NAME}</div>
      <div style={{ display: 'flex', fontSize: product ? 58 : 72, fontWeight: 700, lineHeight: 1.12 }}>{product?.name.slice(0, 100) || 'Drinks delivered. More island time.'}</div>
      <div style={{ display: 'flex', fontSize: 30 }}>{product ? `TZS ${product.price.toLocaleString('en-US')} / ${product.unit}` : 'Wine, spirits, beer & island favourites'}</div>
      <div style={{ display: 'flex', fontSize: 24 }}>Nungwi & Kendwa · Zanzibar</div>
    </div>, { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
