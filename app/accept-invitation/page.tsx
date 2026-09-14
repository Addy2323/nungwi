import SetPassword from '../auth/set-password'
export const metadata={title:'Accept invitation | Nungwi Shop',referrer:'no-referrer'}
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){return <SetPassword token={(await searchParams).token||''} purpose="invite"/>}
