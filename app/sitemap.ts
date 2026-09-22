import type { MetadataRoute } from 'next'
import { absoluteUrl, categoryPath, productPath } from '@/lib/seo'
import { seoProducts } from '@/lib/server/seo'

export const dynamic = 'force-dynamic'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await seoProducts()
  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/help'), changeFrequency: 'monthly', priority: 0.5 },
    ...products.map(p => ({ url: absoluteUrl(productPath(p.id)), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...Array.from(new Set(products.map(p => p.category))).map(c => ({ url: absoluteUrl(categoryPath(c)), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}
