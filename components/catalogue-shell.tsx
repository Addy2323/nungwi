import Link from 'next/link'
import ShopFooter from './shop-footer'
import { LanguageSelect } from './language-provider'

export default function CatalogueShell({ children }: { children: React.ReactNode }) {
  return <div className="storefront"><a className="skip-link" href="#content">Skip to product information</a><header className="header-bar"><Link className="brand-logo" href="/">NUNGWI <b>SHOP</b></Link><nav className="header-actions" aria-label="Shop navigation"><LanguageSelect/><Link href="/shop">Shop all drinks</Link><Link href="/help">Delivery help</Link></nav></header><main id="content" className="catalogue-page">{children}</main><ShopFooter/></div>
}
