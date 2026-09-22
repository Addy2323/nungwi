import { pageMetadata } from '@/lib/seo'
import Delivery from './delivery'
export const metadata = { ...pageMetadata('Confirm Your Drinks Delivery | Nungwi Shop Zanzibar', 'Use your secure Nungwi Shop delivery link to review the assigned order and complete delivery confirmation. This private page is for the intended recipient.', '/delivery', true), referrer: 'no-referrer' as const }
export default async function Page({params}:{params:Promise<{token:string}>}){return <Delivery token={(await params).token}/>}
