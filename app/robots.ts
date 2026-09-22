import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/customer', '/hotel', '/checkout', '/api/', '/auth', '/login', '/signup', '/accept-invitation', '/reset-password', '/forgot-password', '/delivery/', '/uploads/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
