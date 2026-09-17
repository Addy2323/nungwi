export type StoreInfo = { phone: string; email: string; hours: string; hoursSw: string }
export function storeInfo(): StoreInfo {
  return { phone: process.env.SHOP_PHONE || '', email: process.env.SHOP_EMAIL || '', hours: process.env.SHOP_HOURS || '', hoursSw: process.env.SHOP_HOURS_SW || '' }
}
