import HelpPage from '@/components/help-page'
import { pageMetadata, breadcrumbs } from '@/lib/seo'
import JsonLd from '@/components/json-ld'

export const metadata = pageMetadata('Delivery, Returns & Shopping Help | Nungwi Zanzibar', 'Find answers about drinks delivery in Nungwi and Kendwa, payment options, order tracking and returns. Get shopping support from Vunjabei Liquor Zanzibar.', '/help')
export default function Page() { return <><JsonLd data={breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Help', path: '/help' }])}/><HelpPage/></> }
