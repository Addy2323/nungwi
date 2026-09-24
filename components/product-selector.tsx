'use client'
import { useEffect, useId, useState } from 'react'
import type { CatalogProduct } from '@/lib/product-workflow'
import { useLanguage } from './language-provider'
import s from './platform.module.css'
import w from './product-workflow.module.css'

export default function ProductSelector({ value, onSelect, onCreate, disabled=false }: {
  value: CatalogProduct | null; onSelect:(product:CatalogProduct|null)=>void; onCreate?:(query:string)=>void; disabled?:boolean
}) {
  const {t}=useLanguage(); const key=useId()
  const [query,setQuery]=useState(''); const [open,setOpen]=useState(!value)
  const [items,setItems]=useState<CatalogProduct[]>([]); const [loading,setLoading]=useState(false)
  const [error,setError]=useState(''); const [active,setActive]=useState(-1); const [retry,setRetry]=useState(0)
  useEffect(()=>{
    if(!open)return
    const controller=new AbortController();setLoading(true);setError('');setItems([]);setActive(-1)
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/platform?${new URLSearchParams({resource:'product-search',q:query,limit:'12'})}`,{signal:controller.signal,cache:'no-store'})
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to search products.')
        if(!controller.signal.aborted)setItems(result.data.items)
      }catch(e){if(!controller.signal.aborted)setError((e as Error).message)}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },250)
    return()=>{clearTimeout(timer);controller.abort()}
  },[query,open,retry])
  function choose(p:CatalogProduct){onSelect(p);setOpen(false);setQuery('')}
  return <div className={w.stack}>
    {value&&!open?<div className={w.note}><strong>{value.name}</strong><p>{value.sku} · {value.unit} × {value.unit_size}</p><button type="button" className={s.secondary} disabled={disabled} onClick={()=>setOpen(true)}>{t('Change product')}</button></div>:<>
      <label htmlFor={key}>{t('Product')}<input id={key} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${key}-list`} aria-activedescendant={active>=0?`${key}-${active}`:undefined} autoComplete="off" disabled={disabled} value={query} placeholder={t('Search name, brand, barcode or SKU…')} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,items.length-1))}
        if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}
        if(e.key==='Enter'){e.preventDefault();if(items[active])choose(items[active])}
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false)}
      }}/></label>
      {open&&<><small>{t(query?'Matching products':'Recently received products and catalogue')}</small>
        {loading&&<p role="status">{t('Searching…')}</p>}
        {error&&<p role="alert" className={w.error}>{t(error)} <button type="button" onClick={()=>setRetry(r=>r+1)}>{t('Retry')}</button></p>}
        <ul className={w.results} id={`${key}-list`} role="listbox" aria-label={t('Products')}>{items.map((p,i)=><li key={p.id} role="presentation"><button type="button" id={`${key}-${i}`} role="option" aria-selected={active===i} className={w.option} onClick={()=>choose(p)}><strong>{p.name}</strong><small>{p.sku} · {p.barcode||p.brand} · {p.available} {t('available')}</small></button></li>)}</ul>
        {!loading&&!error&&!items.length&&<p role="status">{t('No matching product found.')}</p>}
      </>}
    </>}
    {onCreate&&<button type="button" className={s.secondary} disabled={disabled} onClick={()=>onCreate(query)}>+ {t('Add new product')}{query?`: ${query}`:''}</button>}
  </div>
}
