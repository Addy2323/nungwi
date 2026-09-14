import Platform from '@/components/platform'
import { pageUser } from '@/lib/server/access'
export const metadata = { title: 'Hotel Account | Nungwi Shop' }
export default async function Page() { return <Platform user={await pageUser('hotel')} /> }
