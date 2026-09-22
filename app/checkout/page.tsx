import { pageMetadata } from '@/lib/seo'
import Checkout from './checkout'
import { pageUser } from '@/lib/server/access'
export const metadata = { ...pageMetadata('Secure Drinks Order Checkout | Nungwi Shop Zanzibar', 'Review your Nungwi Shop basket, delivery address and payment options. Confirm prices and availability before ordering drinks for delivery in Zanzibar.', '/checkout', true), referrer: 'no-referrer' as const }
export default async function Page(){const user=await pageUser('customer','/checkout');return <Checkout user={user}/>}
