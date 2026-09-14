import Delivery from './delivery'
export const metadata={title:'Confirm delivery | Nungwi Shop',referrer:'no-referrer',robots:{index:false,follow:false}}
export default async function Page({params}:{params:Promise<{token:string}>}){return <Delivery token={(await params).token}/>}
