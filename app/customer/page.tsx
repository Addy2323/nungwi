import Platform from '@/components/platform'
import { pageUser } from '@/lib/server/access'
export const metadata = { title: 'My Account | Nungwi Shop' }
export default async function Page() { return <Platform user={await pageUser('customer')} /> }
