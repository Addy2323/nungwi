import Checkout from './checkout'
import { pageUser } from '@/lib/server/access'
export const metadata={title:'Checkout | Nungwi Shop'}
export default async function Page(){const user=await pageUser('customer');return <Checkout user={user}/>}
