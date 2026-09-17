'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Heart, MapPin, Minus, Palmtree, Plus, Search, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react'
import { useCatalogue, useShopCart, type Product } from '@/lib/catalogue-client'
import { filterProducts, selectOffering } from '@/lib/shop-utils'
import { api, mutate } from '@/lib/client-api'
import { LanguageSelect, useLanguage } from './language-provider'
import DeliveryChecker from './delivery-checker'
import ShopFooter from './shop-footer'
import ShopDialog from './shop-dialog'

export default function Storefront() {
  const { t, language } = useLanguage()
  const { products, error: catalogueError, loading } = useCatalogue()
  const { cart, setCart, ready, error: cartError } = useShopCart()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('featured')
  const [maxPrice, setMaxPrice] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [units, setUnits] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [promotions, setPromotions] = useState<any[]>([])
  const [currency, setCurrency] = useState<'TZS' | 'USD'>('TZS')
  useEffect(() => {
    api<any[]>('promotions-public').then(setPromotions).catch(() => {})
    const promo = new URLSearchParams(window.location.search).get('promo')
    if (promo) sessionStorage.setItem('nungwi-promo', promo)
  }, [])
  const money = (value: number) => currency === 'USD' ? `≈ US$ ${(value / 2650).toFixed(2)}` : `TZS ${value.toLocaleString(language === 'sw' ? 'sw-TZ' : 'en-US')}`
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))]
  const offerings = useMemo(() => products.map(p => selectOffering(p, units[p.id])), [products, units])
  const visible = useMemo(() => filterProducts(offerings, { query, category, sort, maxPrice, availableOnly }), [offerings, query, category, sort, maxPrice, availableOnly])
  const selected = offerings.find(p => p.id === selectedId)
  const count = cart.reduce((sum, line) => sum + line.qty, 0)
  const subtotal = cart.reduce((sum, line) => sum + line.qty * line.priceTzs, 0)
  const remaining = (p: Product) => Math.floor((p.available - cart.filter(line => line.id === p.id).reduce((sum, line) => sum + line.qty * line.unitSize, 0)) / p.unitSize)
  const canAdd = (p: Product) => ready && remaining(p) >= (cart.some(line => line.id === p.id && line.unit === p.unit) ? 1 : p.minQty)
  const add = (p: Product) => {
    if (!canAdd(p)) return
    setCart(lines => lines.some(line => line.id === p.id && line.unit === p.unit) ? lines.map(line => line.id === p.id && line.unit === p.unit ? { ...line, qty: line.qty + 1 } : line) : [...lines, { ...p, qty: p.minQty }])
    setNotice(t('Added to your basket.', 'Imeongezwa kwenye kikapu chako.'))
  }
  const changeQuantity = (p: Product, delta: number) => {
    if (delta > 0 && remaining(p) < 1) return
    setCart(lines => lines.flatMap(line => line.id === p.id && line.unit === p.unit ? line.qty + delta < line.minQty ? [] : [{ ...line, qty: line.qty + delta }] : [line]))
  }
  const reset = () => { setQuery(''); setCategory('All'); setSort('featured'); setMaxPrice(''); setAvailableOnly(false) }
  const unitPicker = (p: Product) => {
    const original = products.find(value => value.id === p.id)!
    return <label className="unit-picker">{t('Selling unit', 'Kipimo cha mauzo')}<select value={p.unit} onChange={event => setUnits({ ...units, [p.id]: event.target.value })}><option value={original.unit}>{t(original.unit)} · {original.unitSize} {t('item(s)', 'kipande/vipande')}</option>{original.units.map(unit => <option key={unit.unit} value={unit.unit}>{t(unit.unit)} · {unit.unit_size} {t('item(s)', 'kipande/vipande')}</option>)}</select></label>
  }
  const availability = (p: Product) => <span className={`stock-label ${p.stock < p.minQty ? 'unavailable' : ''}`}><i/>{p.stock >= p.minQty ? t('In stock', 'Inapatikana') : t('Unavailable', 'Haipatikani')}</span>
  return <div className="storefront">
    <a className="skip-link" href="#shop">{t('Skip to products', 'Nenda kwenye bidhaa')}</a>
    <div className="announcement">Nungwi & Kendwa <span>·</span> {t('Island essentials, delivered to your door.', 'Mahitaji ya kisiwani, mlangoni pako.')}</div>
    <header className="header-bar">
      <Link href="/" className="brand-logo"><span className="brand-icon"><Palmtree size={26}/></span><span>NUNGWI <b>SHOP</b></span></Link>
      <nav className="desktop-navigation" aria-label={t('Shop navigation', 'Menyu ya duka')}><a href="#shop">{t('Shop')}</a><a href="#delivery-checker">{t('Delivery')}</a><Link href="/help#faq">{t('Help', 'Msaada')}</Link></nav>
      <div className="header-actions"><LanguageSelect/><Link href="/dashboard" className="account-link" aria-label={t('My account')}><UserRound size={21}/><span>{t('My account')}</span></Link><button className="cart-btn-orange" onClick={() => setCartOpen(true)} aria-label={`${t('Basket', 'Kikapu')} (${count})`}><ShoppingCart size={20}/><span>{count}</span></button></div>
    </header>
    <main className="page-container">
      <section className="hero-wrapper">
        <div className="hero-card-left"><span className="hero-tag">{t('A LITTLE MORE ISLAND TIME', 'MUDA ZAIDI WA KUFURAHIA KISIWA')}</span><h1>{t('Good days.', 'Siku njema.')}<br/><em>{t('Delivered.', 'Tunakuletea.')}</em></h1><p>{t('Cold drinks, local favourites and beach essentials. Choose what you love. We’ll bring it to your hotel, villa or place by the sea.', 'Vinywaji baridi, vipendwa vya hapa na mahitaji ya ufukweni. Chagua unachopenda. Tutakuletea hotelini, kwenye vila au kando ya bahari.')}</p><div className="hero-cta-group"><a className="btn-primary-orange" href="#shop">{t('Explore the shop', 'Tembelea duka')}<ArrowRight size={18}/></a><a className="text-link" href="#delivery-checker">{t('Check your delivery area', 'Angalia eneo lako la ufikishaji')}</a></div><div className="hero-meta-row"><span><MapPin size={17}/> Nungwi & Kendwa</span><span>{t('Your place. Your pace.', 'Mahali pako. Kwa wakati wako.')}</span></div></div>
        <div className="hero-card-right"><img src="/images/island-vibes-hero-v2.png" alt={t('Chilled island drinks beside the sea in Zanzibar', 'Vinywaji baridi kando ya bahari Zanzibar')} fetchPriority="high"/><div className="hero-caption">{t('A taste of the island.', 'Ladha ya kisiwani.')} <span>ZANZIBAR</span></div></div>
      </section>
      <DeliveryChecker/>
      {promotions.length > 0 && <section className="shop-promotions" aria-label={t('Offers')}>{promotions.map(p => <article key={p.id}><span className="eyebrow">{t('An island treat', 'Zawadi ya kisiwani')}</span><h2>{p.title}</h2><p>{p.offer_text}</p><button className="text-link" onClick={() => { sessionStorage.setItem('nungwi-promo', p.code); setNotice(t('Offer selected for checkout.', 'Ofa imechaguliwa kwa malipo.')) }}>{t('Use offer', 'Tumia ofa')} · {p.code}<ArrowRight size={16}/></button></article>)}</section>}
      <section id="shop" className="catalogue-section" aria-labelledby="catalogue-title"><div className="section-header"><div><span className="eyebrow">{t('THE ISLAND EDIT', 'CHAGUO LA KISIWANI')}</span><h2 id="catalogue-title">{t('Find your favourites.', 'Pata vipendwa vyako.')}</h2></div><p>{t('Something refreshing. Something to share. A little of everything you need.', 'Kitu cha kuburudisha. Kitu cha kushiriki. Kila unachohitaji.')}</p></div>
        <div className="catalogue-tools"><label className="catalogue-search"><Search size={19}/><span className="sr-only">{t('Search products', 'Tafuta bidhaa')}</span><input type="search" placeholder={t('Search drinks, snacks and essentials…', 'Tafuta vinywaji, vitafunio na mahitaji…')} value={query} onChange={event => setQuery(event.target.value)}/></label><label>{t('Sort by', 'Panga kwa')}<select value={sort} onChange={event => setSort(event.target.value)}><option value="featured">{t('Featured', 'Zilizoangaziwa')}</option><option value="price-asc">{t('Price: low to high', 'Bei: ndogo hadi kubwa')}</option><option value="price-desc">{t('Price: high to low', 'Bei: kubwa hadi ndogo')}</option><option value="name">{t('Name: A–Z', 'Jina: A–Z')}</option></select></label><label>{t('Maximum price (TZS)', 'Bei ya juu (TZS)')}<input type="number" min="0" step="100" placeholder={t('Any price', 'Bei yoyote')} value={maxPrice} onChange={event => setMaxPrice(event.target.value)}/></label><label>{t('Display currency', 'Sarafu ya kuonyesha')}<select value={currency} onChange={event => setCurrency(event.target.value as 'TZS' | 'USD')}><option>TZS</option><option>USD</option></select></label></div>
        <div className="category-row" aria-label={t('Categories', 'Makundi')}>{categories.map(value => <button key={value} className={`cat-pill ${category === value ? 'active' : ''}`} aria-pressed={category === value} onClick={() => setCategory(value)}>{t(value)}</button>)}</div>
        <div className="results-bar"><span aria-live="polite">{visible.length} {t('products', 'bidhaa')}</span><label><input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)}/>{t('In stock only', 'Zinazopatikana tu')}</label><button className="text-link" onClick={reset}>{t('Clear filters', 'Ondoa vichujio')}</button></div>
        {currency === 'USD' && <p className="shop-hint">{t('USD prices are approximate, using TZS 2,650 per US$1. Checkout totals are in TZS.', 'Bei za USD ni makadirio kwa TZS 2,650 kwa US$1. Jumla ya malipo ni kwa TZS.')}</p>}
        {(catalogueError || cartError) && <p role="alert" className="shop-error">{t(catalogueError || cartError)}</p>}
        <div className="product-grid-4">{loading ? <p className="empty-products" role="status">{t('Loading products…', 'Inapakia bidhaa…')}</p> : !visible.length ? <div className="empty-products"><h3>{t('No matches just yet.', 'Hakuna matokeo bado.')}</h3><p>{t('Try a different search or clear your filters.', 'Jaribu utafutaji mwingine au ondoa vichujio.')}</p><button className="text-link" onClick={reset}>{t('Clear filters', 'Ondoa vichujio')}</button></div> : visible.map(p => <article key={p.id} className="card-product"><div className="card-img-wrap"><button className="product-image-button" onClick={() => setSelectedId(p.id)} aria-label={`${t('View details', 'Tazama maelezo')}: ${p.name}`}><img src={p.image} alt={p.name} loading="lazy"/></button><button className="favourite-button" aria-label={`${t('Save to favourites', 'Hifadhi kwenye vipendwa')}: ${p.name}`} onClick={async () => { try { await mutate('favourite.toggle', { id: p.id }); setNotice(t('Favourites updated.', 'Vipendwa vimesasishwa.')) } catch { window.location.href = '/login' } }}><Heart size={18}/></button></div><div className="card-details"><span className="card-category">{t(p.category)}</span><h3><button className="product-name" onClick={() => setSelectedId(p.id)}>{p.name}</button></h3><p className="product-size">{p.volume || t('Size not specified', 'Ukubwa haujaainishwa')}{p.brand && ` · ${p.brand}`}</p>{unitPicker(p)}<div className="card-footer-row">{availability(p)}<strong className="card-price">{money(p.priceTzs)}<small>/ {t(p.unit)}</small></strong></div><button className="product-add" disabled={!canAdd(p)} onClick={() => add(p)}><Plus size={17}/>{t('Add to basket', 'Ongeza kikapuni')}</button></div></article>)}</div>
      </section>
    </main>
    {notice && <div className="shop-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label={t('Dismiss', 'Funga')}>×</button></div>}
    <ShopFooter/>
    <nav className="bottom-floating-nav" aria-label={t('Mobile navigation', 'Menyu ya simu')}><a href="#shop"><ShoppingBag size={20}/>{t('Shop')}</a><a href="#delivery-checker"><MapPin size={20}/>{t('Delivery')}</a><Link href="/dashboard"><UserRound size={20}/>{t('Account')}</Link><button onClick={() => setCartOpen(true)}><ShoppingCart size={20}/>{t('Basket', 'Kikapu')} ({count})</button></nav>
    {selected && <ShopDialog title={selected.name} onClose={() => setSelectedId(null)}><div className="product-detail"><img src={selected.image} alt={selected.name}/><div><span className="eyebrow">{t(selected.category)}</span><p>{selected.description || t('Choose your selling unit below and check availability before adding to your basket.', 'Chagua kipimo cha mauzo hapa chini na angalia upatikanaji kabla ya kuongeza kikapuni.')}</p><dl><div><dt>{t('Size', 'Ukubwa')}</dt><dd>{selected.volume || t('Not specified', 'Haujaainishwa')}</dd></div><div><dt>{t('Minimum quantity', 'Idadi ya chini')}</dt><dd>{selected.minQty} {t(selected.unit)}</dd></div><div><dt>{t('Returnable deposit', 'Amana inayorejeshwa')}</dt><dd>{money(selected.deposit)} / {t(selected.unit)}</dd></div></dl>{unitPicker(selected)}<p>{availability(selected)}</p><strong className="detail-price">{money(selected.priceTzs)} / {t(selected.unit)}</strong><button className="btn-primary-orange" disabled={!canAdd(selected)} onClick={() => add(selected)}>{t('Add to basket', 'Ongeza kikapuni')}<Plus size={18}/></button></div></div></ShopDialog>}
    {cartOpen && <ShopDialog title={`${t('Your basket', 'Kikapu chako')} (${count})`} drawer onClose={() => setCartOpen(false)}><div className="cart-lines">{!cart.length ? <p>{t('Your basket is empty. Find something you love in the shop.', 'Kikapu chako ni tupu. Tafuta unachopenda dukani.')}</p> : cart.map(line => <article key={`${line.id}:${line.unit}`} className="cart-line"><img src={line.image} alt=""/><div><h3>{line.name}</h3><p>{money(line.priceTzs)} / {t(line.unit)}</p><div className="quantity-controls"><button aria-label={`${t('Decrease quantity', 'Punguza idadi')}: ${line.name}`} onClick={() => changeQuantity(line, -1)}><Minus size={15}/></button><span>{line.qty}</span><button disabled={remaining(line) < 1} aria-label={`${t('Increase quantity', 'Ongeza idadi')}: ${line.name}`} onClick={() => changeQuantity(line, 1)}><Plus size={15}/></button><button className="text-link" onClick={() => setCart(lines => lines.filter(item => item.id !== line.id || item.unit !== line.unit))}>{t('Remove')}</button></div></div></article>)}</div><div className="cart-summary"><p><span>{t('Subtotal', 'Jumla ndogo')}</span><strong>{money(subtotal)}</strong></p><small>{t('Delivery, discounts and deposits are calculated at checkout.', 'Ufikishaji, punguzo na amana huhesabiwa wakati wa kulipia.')}</small>{cart.length > 0 && <Link href="/checkout" className="btn-primary-orange">{t('Continue to checkout', 'Endelea kulipia')}<ArrowRight size={18}/></Link>}</div></ShopDialog>}
  </div>
}
