'use client'
import { useEffect, useState } from 'react'
import { api, mutate } from '@/lib/client-api'
import type { CatalogProduct } from '@/lib/product-workflow'
import Table from './data-table'
import { useLanguage } from './language-provider'
import { useAlerts } from './use-alerts'
import ProductImport from './product-import'
import s from './platform.module.css'
import w from './product-workflow.module.css'

export default function ProductCatalogue({canEdit,onEdit,revision}:{canEdit:boolean;onEdit:(p?:CatalogProduct)=>void;revision:number}) {
  const {t}=useLanguage();const alerts=useAlerts()
  const [query,setQuery]=useState('');const [category,setCategory]=useState('');const [status,setStatus]=useState('all');const [stock,setStock]=useState('all');const [page,setPage]=useState(1)
  const [items,setItems]=useState<CatalogProduct[]>([]);const [hasMore,setHasMore]=useState(false);const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [tick,setTick]=useState(0)
  const [categories,setCategories]=useState<any[]>([]);const [manage,setManage]=useState(false);const [name,setName]=useState('');const [editing,setEditing]=useState<any>(null);const [saving,setSaving]=useState(false);const [importing,setImporting]=useState(false)
  useEffect(()=>{api<any>('catalogue-options').then(r=>setCategories(r.categories)).catch(e=>setError(e.message))},[tick,revision])
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('')
    const timer=setTimeout(async()=>{try{const response=await fetch(`/api/platform?${new URLSearchParams({resource:'product-search',q:query,category,status,stock,page:String(page),limit:'25'})}`,{signal:controller.signal,cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);if(!controller.signal.aborted){setItems(result.data.items);setHasMore(result.data.hasMore)}}catch(e){if(!controller.signal.aborted)setError((e as Error).message)}finally{if(!controller.signal.aborted)setBusy(false)}},250)
    return()=>{clearTimeout(timer);controller.abort()}
  },[query,category,status,stock,page,tick,revision])
  async function categorySave(active=true){if(saving)return;setSaving(true);setError('');try{await mutate('category.save',{id:editing?.id,name,active});setName('');setEditing(null);setTick(v=>v+1)}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  return <article className={`${s.panel} ${w.stack}`}>
    <div className={s.toolbar}><h2>{t('Product catalogue')}</h2>{canEdit&&<><button className={s.primary} onClick={()=>onEdit()}>{t('Add product')}</button><button className={s.secondary} onClick={()=>setManage(v=>!v)}>{t('Categories')}</button><button className={s.secondary} onClick={()=>setImporting(v=>!v)}>{t('Import products')}</button></>}</div>
    {importing&&<ProductImport onDone={()=>{setImporting(false);setTick(v=>v+1)}}/>}
    {manage&&<section className={w.note}><h3>{t('Shop categories')}</h3><div className={w.toolbar}><input aria-label={t('Category name')} value={name} onChange={e=>setName(e.target.value)} placeholder={t('Category name')}/><button className={s.primary} disabled={saving||!name.trim()} onClick={()=>categorySave(true)}>{t(editing?'Save category':'Add category')}</button>{editing&&<><button className={s.secondary} disabled={saving} onClick={()=>categorySave(!editing.active)}>{t(editing.active?'Archive category':'Reactivate category')}</button><button className={s.secondary} onClick={()=>{setEditing(null);setName('')}}>{t('Cancel')}</button></>}</div><div className={w.toolbar}>{categories.map(c=><button className={s.secondary} key={c.id} onClick={()=>{setEditing(c);setName(c.name)}}>{c.name}{!c.active?` (${t('Archived')})`:''}</button>)}</div></section>}
    <div className={w.toolbar}><input aria-label={t('Search products')} placeholder={t('Search name, brand, barcode or SKU…')} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/>
      <select aria-label={t('Category')} value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">{t('All categories')}</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
      <select aria-label={t('Status')} value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="all">{t('All statuses')}</option><option value="active">{t('Active')}</option><option value="archived">{t('Archived')}</option></select>
      <select aria-label={t('Stock')} value={stock} onChange={e=>{setStock(e.target.value);setPage(1)}}><option value="all">{t('All stock')}</option><option value="low">{t('Low stock')}</option><option value="out">{t('Out of stock')}</option></select>
    </div>
    {error&&<p role="alert" className={s.error}>{t(error)} <button onClick={()=>setTick(v=>v+1)}>{t('Retry')}</button></p>}
    {busy?<p role="status">{t('Loading products…')}</p>:<Table rows={items} columns={[{label:'Product',render:p=><>{p.name}<small>{p.sku} · {p.category} · {p.unit} × {p.unit_size}</small></>},{label:'Stock',render:p=><>{p.available}<small>{p.reserved} {t('reserved')}</small></>},{label:'Price',render:p=>`TZS ${Number(p.price).toLocaleString()}`},{label:'Status',render:p=>t(p.active?'Active':'Archived')},{label:'Actions',render:p=>canEdit&&<div className={w.toolbar}><button onClick={()=>onEdit(p as CatalogProduct)}>{t('Edit')}</button>{!!p.active&&<button onClick={async()=>{if(!await alerts.confirm(t(`Archive ${p.name}? Existing stock and sales history will be preserved.`)))return;try{await mutate('product.delete',{id:p.id});setTick(v=>v+1)}catch(e){setError((e as Error).message)}}}>{t('Archive')}</button>}</div>}]}/>}
    <div className={w.toolbar}><button className={s.secondary} disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>{t('Previous')}</button><span>{t('Page')} {page}</span><button className={s.secondary} disabled={busy||!hasMore} onClick={()=>setPage(p=>p+1)}>{t('Next')}</button></div>
  </article>
}
