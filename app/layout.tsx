import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Roboto, Libre_Caslon_Text } from 'next/font/google'
import { pageMetadata, SITE_URL } from '@/lib/seo'
import { businessSchema } from '@/lib/server/seo'
import JsonLd from '@/components/json-ld'
import './globals.css'
import './classic.css'
import './product-cards.css'
import './motion.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import './sweet-alert.css'
import { LanguageProvider } from '@/components/language-provider'
import SiteMotion from '@/components/site-motion'

const roboto = Roboto({ subsets: ['latin'], display: 'swap', variable: '--font-roboto' })
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap', variable: '--font-caslon' })

export const metadata: Metadata = {
  ...pageMetadata('Liquor Delivery Zanzibar & Nungwi | Vunjabei Liquor', 'Shop wine, spirits, beer and cold drinks at Vunjabei Liquor Zanzibar, also known as Nungwi Shop. Order delivery to hotels and villas in Nungwi and Kendwa.', '/'),
  metadataBase: new URL(SITE_URL),
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Nungwi Shop' },
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png', sizes: '1254x1254' }],
    apple: [{ url: '/logo.png', sizes: '1254x1254', type: 'image/png' }],
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
    <html lang="en" className={`${roboto.variable} ${caslon.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <JsonLd data={businessSchema()}/>
        <LanguageProvider><SiteMotion />{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
