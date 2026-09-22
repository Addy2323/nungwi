import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './classic.css'
import './product-cards.css'
import './motion.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import './sweet-alert.css'
import { LanguageProvider } from '@/components/language-provider'
import StartupLoader from '@/components/startup-loader'
import SiteMotion from '@/components/site-motion'

export const metadata: Metadata = {
  title: 'Nungwi Shop — Island Essentials, Delivered',
  description: 'Cold drinks, snacks, and beach essentials delivered across Nungwi and Kendwa in 10–20 minutes.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Nungwi Shop' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#faf7f2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Browser simulators can inject root attributes before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <LanguageProvider><StartupLoader /><SiteMotion />{children}</LanguageProvider>
        <noscript><style>{'#startup-loader { display: none !important; }'}</style></noscript>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
