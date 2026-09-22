import { pageMetadata } from '@/lib/seo'
import AuthPage from '../auth/auth-page'

export const metadata = { ...pageMetadata('Create Your Drinks Shop Account | Nungwi Shop Zanzibar', 'Create a Nungwi Shop account to order drinks in Zanzibar, save delivery addresses, track your orders and shop for your favourites in Nungwi and Kendwa.', '/signup', true), referrer: 'no-referrer' as const }
export default function Page() { return <AuthPage mode="signup" /> }
