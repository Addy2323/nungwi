import { pageMetadata } from '@/lib/seo'
import AuthPage from '../auth/auth-page'

export const metadata = { ...pageMetadata('Recover Your Shop Account Access | Nungwi Shop Zanzibar', 'Request a password reset for your Nungwi Shop account. Use your registered email to regain access to drinks orders, delivery updates and saved addresses.', '/forgot-password', true), referrer: 'no-referrer' as const }
export default function Page() { return <AuthPage mode="reset" /> }
