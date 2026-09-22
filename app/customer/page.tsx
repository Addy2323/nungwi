import { pageMetadata } from '@/lib/seo'
﻿import Platform from '@/components/platform'
import { pageUser } from '@/lib/server/access'
export const metadata = { ...pageMetadata('Your Orders & Customer Account | Nungwi Shop Zanzibar', 'Sign in to your Nungwi Shop account to track drinks deliveries, manage saved addresses, review past orders and contact the Zanzibar shop for order support.', '/customer', true), referrer: 'no-referrer' as const }
export default async function Page() { return <Platform user={await pageUser('customer')} /> }
