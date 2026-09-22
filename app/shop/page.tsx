import type { Metadata } from 'next'
import Storefront from '@/components/storefront'
import './shop.css'

export const metadata: Metadata = {
  title: 'Shop all products | Nungwi Shop',
  description: 'Browse drinks, snacks and island essentials by category. Shop for delivery across Nungwi and Kendwa.',
}

export default function ShopPage() {
  return <Storefront shopPage />
}
