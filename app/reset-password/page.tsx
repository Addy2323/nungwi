import { pageMetadata } from '@/lib/seo'
import SetPassword from '../auth/set-password'
export const metadata = { ...pageMetadata('Set Your New Account Password | Nungwi Shop Zanzibar', 'Choose a new password for your Nungwi Shop account using your secure reset link. Restore access to your orders, delivery information and saved addresses.', '/reset-password', true), referrer: 'no-referrer' as const }
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){return <SetPassword token={(await searchParams).token||''} purpose="reset"/>}
