import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nungwi Shop · Island Drinks Delivered',
    short_name: 'Nungwi Shop',
    description: 'Cold drinks, wine, spirits and beach essentials delivered to your hotel or villa in Nungwi & Kendwa, Zanzibar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff5d0c',
    orientation: 'portrait',
    scope: '/',
    id: 'nungwi-shop-pwa',
    categories: ['shopping', 'food', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/app-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Explore Shop',
        short_name: 'Shop',
        description: 'Browse drinks and island essentials',
        url: '/shop',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My Orders & Account',
        short_name: 'Orders',
        description: 'Track your deliveries and order history',
        url: '/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
