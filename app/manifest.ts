import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nungwi Drop',
    short_name: 'Nungwi Drop',
    description: 'Cold drinks and beach essentials delivered across Nungwi and Kendwa.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08282a',
    theme_color: '#08282a',
    orientation: 'portrait',
    icons: [
      { src: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
