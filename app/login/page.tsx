import { pageMetadata } from '@/lib/seo'
import AuthPage from '../auth/auth-page'

export const metadata = { ...pageMetadata('Sign In to Your Drinks Account | Nungwi Shop Zanzibar', 'Sign in to Nungwi Shop to order drinks in Zanzibar, track deliveries to Nungwi and Kendwa, manage your addresses and find your previous orders in one place.', '/login', true), referrer: 'no-referrer' as const }
export default function Page() { return <AuthPage mode="login" /> }
