'use client'

import { ArrowUpRight, ShoppingBag } from 'lucide-react'
import type { Product } from '@/lib/catalogue-client'
import { useLanguage } from './language-provider'

export default function ShopCategories({ products, selected, onSelect, loading }: {
  products: Product[]
  selected: string
  onSelect: (category: string) => void
  loading: boolean
}) {
  const { t } = useLanguage()
  const categories = Array.from(new Set(products.map(product => product.category)))
  const label = (count: number) => count === 1 ? t('product', 'bidhaa') : t('products', 'bidhaa')

  return <section className="shop-category-browser" aria-labelledby="browse-category-title" aria-busy={loading}>
    <div className="shop-category-heading">
      <h2 id="browse-category-title">{t('Shop by category', 'Nunua kwa kundi')}</h2>
      <span>{t('Find your kind of island essential.', 'Pata mahitaji yako ya kisiwani.')}</span>
    </div>
    <div className="shop-category-grid">
      <button className="shop-category-tile all-categories" aria-pressed={selected === 'All'} onClick={() => onSelect('All')} aria-controls="shop">
        <span className="category-art"><ShoppingBag size={30} aria-hidden="true" /></span>
        <span className="category-copy"><strong>{t('All products', 'Bidhaa zote')}</strong><small>{loading ? t('Loading…', 'Inapakia…') : `${products.length} ${label(products.length)}`}</small></span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </button>
      {categories.map(category => {
        const items = products.filter(product => product.category === category)
        return <button key={category} className="shop-category-tile" aria-pressed={selected === category} onClick={() => onSelect(category)} aria-controls="shop">
          <span className="category-art"><img src={items[0].image || '/placeholder.svg'} alt="" loading="lazy" /></span>
          <span className="category-copy"><strong>{t(category)}</strong><small>{items.length} {label(items.length)}</small></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      })}
    </div>
  </section>
}
