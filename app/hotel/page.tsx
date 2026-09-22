import { pageMetadata } from '@/lib/seo'
﻿import Platform from '@/components/platform'
import { pageUser } from '@/lib/server/access'
export const metadata = { ...pageMetadata('Hotel Orders & Team Account | Nungwi Shop Zanzibar', 'Manage your hotel account with Nungwi Shop in Zanzibar. Sign in to review team orders, delivery details and eligible commissions for your hotel account.', '/hotel', true), referrer: 'no-referrer' as const }
export default async function Page() { return <Platform user={await pageUser('hotel')} /> }
