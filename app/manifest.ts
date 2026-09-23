import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nungwi Shop',
    short_name: 'Nungwi Shop',
    description: 'Cold drinks and beach essentials delivered across Nungwi and Kendwa.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#faf7f2',
    orientation: 'portrait',
    icons: [
      { src: '/logo.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' },
    ],
  }
}
