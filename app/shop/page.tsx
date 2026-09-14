'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Check, ChevronDown, Clock, Globe,
  MapPin, Minus, Palmtree, PartyPopper, Plus, Search,
  ShoppingBag, ShoppingCart, House, GlassWater, ShoppingBasket, Snowflake, Truck, UserRound, Users, Utensils, Wine, X
} from 'lucide-react'

import Link from 'next/link'
import { useCatalogue, useShopCart, type Product } from '@/lib/catalogue-client'
import { api, mutate } from '@/lib/client-api'

type Currency = 'TZS' | 'USD'

const CurrencyContext = createContext<{ currency: Currency; setCurrency: (c: Currency) => void }>({
  currency: 'TZS',
  setCurrency: () => {},
})

const money = (p: Product, currency: Currency) => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.priceUsd)
  }
  return `TZS ${p.priceTzs.toLocaleString('en-US')}`
}

export default function Page() {
  const [currency, setCurrency] = useState<Currency>('TZS')
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      <PageContent />
    </CurrencyContext.Provider>
  )
}

function PageContent() {
  const { currency, setCurrency } = useContext(CurrencyContext)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const { cart, setCart, ready, error: cartError } = useShopCart()
  const { products, error: catalogueError } = useCatalogue()
  const [promotions, setPromotions] = useState<any[]>([])
  const [notice, setNotice] = useState('')
  const [unitChoice, setUnitChoice] = useState<Record<string,string>>({})
  useEffect(() => { api<any[]>('promotions-public').then(setPromotions).catch(() => {}); const promo = new URLSearchParams(window.location.search).get('promo'); if (promo) sessionStorage.setItem('nungwi-promo', promo) }, [])
  const [cartOpen, setCartOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'shop' | 'drinks' | 'snacks' | 'party'>('shop')


  const categories = ['All', 'Soft drinks', 'Juices', 'Beer', 'Cocktails', 'Beach', 'Party packs']

  const visible = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = category === 'All' || p.category.toLowerCase() === category.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [query, category, products])

  const count = cart.reduce((s, i) => s + i.qty, 0)
  const subtotalTzs = cart.reduce((s, i) => s + i.qty * i.priceTzs, 0)

  const add = (p: Product) => {
    setCart(c => (c.some(i => i.id === p.id && i.unit === p.unit) ? c.map(i => (i.id === p.id && i.unit === p.unit ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i)) : [...c, { ...p, qty: p.minQty }]))
  }

  const update = (id: string, n: number, unit: string) => {
    setCart(c => c.map(i => (i.id === id && i.unit === unit ? { ...i, qty: Math.min(i.qty + n, i.stock) } : i)).filter(i => i.qty > 0))
  }

  return (
    <div>
      {/* Header Bar */}
      <header className="header-bar">
        <div className="brand-logo">
          <span className="brand-icon"><Palmtree size={29} /></span>
          <span>NUNGWI <b>SHOP</b></span>
        </div>

        <nav className="nav-links">
          <a href="#shop" className={category === 'All' ? 'active' : ''} onClick={() => setCategory('All')}>Shop</a>
          <a href="#shop" className={category === 'Beer' ? 'active' : ''} onClick={() => setCategory('Beer')}>Beer</a>
          <a href="#shop" className={category === 'Party packs' ? 'active' : ''} onClick={() => setCategory('Party packs')}>Party packs</a>
        </nav>

        <div className="header-right">
          <div className="search-pill">
            <Search />
            <input
              placeholder="Search drinks, juices, snacks..."
              aria-label="Search products"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <button className="currency-select" onClick={() => setCurrency(currency === 'TZS' ? 'USD' : 'TZS')}>
            <Globe size={16} />
            <span>{currency}</span>
            <ChevronDown size={14} />
          </button>

          <Link href="/login" className="nav-links" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <UserRound size={16} /> My Account
            </span>
          </Link>

          <button className="cart-btn-orange" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={22} />
            <span>Cart ({count})</span>
          </button>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="page-container">
        {(catalogueError || cartError || notice) && <p role="status">{catalogueError || cartError || notice}</p>}
        {/* Hero Section */}
        <section className="hero-wrapper">
          {/* Left Hero Card */}
          <div className="hero-card-left">
            <div>
              <span className="hero-tag">FAST ISLAND DELIVERY</span>
              <h1>
                Beach essentials,<br />
                <span>at your door.</span>
              </h1>
              <p>Chilled drinks, fresh coconuts, and island party packs delivered directly to your hotel, villa, or sunbed on the beach.</p>

              <div className="hero-cta-group">
                <button className="btn-primary-orange" onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}>
                  Shop now <ArrowRight size={16} />
                </button>
                <button className="btn-secondary-white" onClick={() => {
                  const el = document.getElementById('shop')
                  el?.scrollIntoView({ behavior: 'smooth' })
                }}>
                  Browse drinks
                </button>
              </div>
            </div>

            <div className="hero-meta-row">
              <span><Clock size={16} /> Delivered in 15–40 minutes</span>
              <span><Snowflake size={16} /> Chilled & fresh</span>
              <span><MapPin size={16} /> Nungwi & Kendwa delivery</span>
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div className="hero-card-right">
            <img src="/images/island-vibes-hero-v2.png" alt="Six chilled drinks on a Zanzibar beach at sunset" />
            <span className="script-overlay-1">Island<br />Vibes<br />Delivered</span>
            <div className="hero-image-overlay-badge">
              <MapPin color="#FF5B19" size={16} />
              <span>Relax. We deliver <b>Anything to Nungwi Beach</b></span>
            </div>
          </div>
        </section>

        {/* Promotional Banners Row */}
        {promotions.length > 0 && <section className="promo-grid">{promotions.map(promotion => <article className="promo-card-box" key={promotion.id} style={{ backgroundColor: promotion.color, color: 'white' }}><div className="promo-text"><h3>{promotion.title}</h3><p style={{color:'inherit'}}>{promotion.offer_text} · Code {promotion.code}</p></div><button className="btn-secondary-white" onClick={() => { sessionStorage.setItem('nungwi-promo', promotion.code); setNotice(`Offer ${promotion.code} selected for checkout.`); document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}) }}>{promotion.button}</button></article>)}</section>}

        {/* Section Heading & Category Filters */}
        <section id="shop">
          <div className="section-header">
            <div>
              <h2>Everything you need, <span>delivered cold.</span></h2>
            </div>
            <p>Local tropical flavours, trusted drinks, and fast island delivery in 15–40 mins.</p>
          </div>

          <div className="category-row">
            {categories.map(cat => (
              <button
                key={cat}
                className={`cat-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 4-Column Product Grid */}
          <div className="product-grid-4">
            {visible.length === 0 && <p className="empty-products">No products available here yet. Try another category or search.</p>}
            {visible.map(original => { const option = original.units.find(u => u.unit === unitChoice[original.id]); const p = option ? { ...original, unit: option.unit, unitSize: option.unit_size, priceTzs: option.price, priceUsd: option.price / 2650, deposit: option.deposit, stock: Math.floor(original.stock * original.unitSize / option.unit_size) } : original; return (
              <article key={p.id} className="card-product">
                <div className="card-img-wrap">
                  <img src={p.image} alt={p.name} />
                  <button aria-label={`Save ${p.name} to favourites`} style={{ position: 'absolute', top: 8, right: 8, borderRadius: '50%', background: 'white', border: 0, width: 28, height: 28 }} onClick={async () => { try { await mutate('favourite.toggle', { id: p.id }); setNotice('Favourites updated.') } catch { window.location.href = '/login' } }}>♡</button>
                  {p.badge && <span className="badge-pill">{p.badge}</span>}
                </div>

                <div className="card-details">
                  <span className="card-category">{p.category}</span>
                  <h3 className="card-title">{p.name}</h3>
                  {original.units.length > 0 && <select aria-label={`Selling unit for ${p.name}`} value={unitChoice[p.id] || original.unit} onChange={e => setUnitChoice({ ...unitChoice, [p.id]: e.target.value })} style={{fontSize:11,border:'1px solid #eee',borderRadius:5,marginTop:4}}><option value={original.unit}>{original.unit} · TZS {original.priceTzs.toLocaleString()}</option>{original.units.map(u => <option key={u.unit} value={u.unit}>{u.unit} ({u.unit_size} base units) · TZS {u.price.toLocaleString()}</option>)}</select>}

                  <div className="card-footer-row">
                    <span className="card-stock">
                      <i /> {p.stock > 0 ? 'In stock' : 'Out of stock'}
                    </span>
                    <span className="card-price">{money(p, currency)}</span>
                    <button className="add-btn-orange" disabled={!ready || p.stock < p.minQty} onClick={() => add(p)} aria-label={`Add ${p.name}`}>
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </article>
            )})}
          </div>
        </section>
      </main>

      {/* Floating Bottom Navigation Bar with Clean SVG Icons */}
      <div className="bottom-floating-nav">
        <button className={activeTab === 'shop' ? 'active' : ''} onClick={() => setActiveTab('shop')}>
          <House size={20} /> Shop
        </button>
        <button className={activeTab === 'drinks' ? 'active' : ''} onClick={() => setActiveTab('drinks')}>
          <GlassWater size={20} /> Drinks
        </button>
        <button className={activeTab === 'snacks' ? 'active' : ''} onClick={() => setActiveTab('snacks')}>
          <ShoppingBasket size={20} /> Snacks
        </button>
        <button className={activeTab === 'party' ? 'active' : ''} onClick={() => setActiveTab('party')}>
          <Users size={15} /> Party Packs
        </button>
      </div>

      {/* Script Accent Footer Text */}
      <div className="script-footer-accent">
        Same Beach<br /><span>More Good Times</span>
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, backdropFilter: 'blur(4px)'
            }}
            onClick={() => setCartOpen(false)}
          />
          <aside
            style={{
              position: 'fixed', top: 0, right: 0, width: 'min(420px, 100%)', height: '100dvh',
              background: '#FFFFFF', zIndex: 120, padding: '24px', display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900 }}>Your Cart ({count})</h2>
              <button onClick={() => setCartOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cart.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Your cart is currently empty.</div>
              ) : (
                cart.map(item => (
                  <div key={`${item.id}:${item.unit}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#FAF6F0', padding: '12px', borderRadius: '14px' }}>
                    <img src={item.image} alt={item.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: '14px' }}>{item.name}</b>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>{money(item, currency)}</small>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <button onClick={() => update(item.id, -1, item.unit)} style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid var(--border-light)', background: '#fff', cursor: 'pointer' }}><Minus size={12} /></button>
                        <b style={{ fontSize: '13px' }}>{item.qty}</b>
                        <button onClick={() => update(item.id, 1, item.unit)} style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid var(--border-light)', background: '#fff', cursor: 'pointer' }}><Plus size={12} /></button>
                      </div>
                    </div>
                    <strong>TZS {(item.priceTzs * item.qty).toLocaleString()}</strong>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '18px' }}>
                <span>Subtotal</span>
                <span>TZS {subtotalTzs.toLocaleString()}</span>
              </div>
              <Link href="/checkout" className="btn-primary-orange" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>Continue to checkout</Link>
            </div>
          </aside>
        </>
      )}

      {/* Footer Strip */}
      <footer className="footer-strip">
        <span>NUNGWI SHOP · NUNGWI, ZANZIBAR</span>
        <span>BEACH LIFE, DELIVERED</span>
      </footer>
    </div>
  )
}
