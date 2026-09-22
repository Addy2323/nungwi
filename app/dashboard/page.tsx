import { pageMetadata } from '@/lib/seo'
﻿import Platform from '@/components/platform'
import { pageUser } from '@/lib/server/access'
export const metadata = { ...pageMetadata('Shop Operations & ERP Dashboard | Nungwi Shop Zanzibar', 'Manage Nungwi Shop orders, inventory, suppliers and deliveries. Authorized staff can sign in to review business operations, payments and customer support.', '/dashboard', true), referrer: 'no-referrer' as const }
export default async function Page() { return <Platform user={await pageUser('staff')} /> }
