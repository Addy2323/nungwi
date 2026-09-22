import { pageMetadata } from '@/lib/seo'
import AuthPage from './auth-page'

export const metadata = { ...pageMetadata('Welcome to Your Online Account | Nungwi Shop Zanzibar', 'Access your Nungwi Shop account for drinks delivery in Zanzibar. Sign in to manage your basket, saved addresses, order history and customer support requests.', '/auth', true), referrer: 'no-referrer' as const }
export default function Page() { return <AuthPage mode="login" /> }
