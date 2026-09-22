import { pageMetadata } from '@/lib/seo'
import SetPassword from '../auth/set-password'
export const metadata = { ...pageMetadata('Accept Your Shop Team Invitation | Nungwi Shop Zanzibar', 'Accept your secure Nungwi Shop invitation and set up your account. Access the shop or hotel workspace assigned to you and manage your authorized activities.', '/accept-invitation', true), referrer: 'no-referrer' as const }
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){return <SetPassword token={(await searchParams).token||''} purpose="invite"/>}
