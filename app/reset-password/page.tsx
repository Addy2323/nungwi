import SetPassword from '../auth/set-password'
export const metadata={title:'Reset password | Nungwi Shop',referrer:'no-referrer'}
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){return <SetPassword token={(await searchParams).token||''} purpose="reset"/>}
