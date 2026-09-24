'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, mutate } from '@/lib/client-api'
import type { CatalogProduct } from '@/lib/product-workflow'
import ProductSelector from './product-selector'
import ProductForm from './product-form'
import { useLanguage } from './language-provider'
import s from './platform.module.css'
import w from './product-workflow.module.css'

export default function ReceiveStockForm({initial={},onSaved,onCancel}:{initial?:Record<string,any>;onSaved:(value:any)=>void;onCancel:()=>void}) {
  const {t}=useLanguage();const lock=useRef(false)
  const [product,setProduct]=useState<CatalogProduct|null>(null);const [creating,setCreating]=useState<string|null>(null)
  const [values,setValues]=useState({label:'',quantity:initial.quantity||1,cost:initial.cost||0,expires_at:'',reason:initial.reason||'Supplier delivery'})
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('')
  useEffect(()=>{if(initial.product_id)api<any>('product-search',{id:initial.product_id}).then(r=>{if(r.items[0])choose(r.items[0])}).catch(e=>setError(e.message))},[initial.product_id])
  function choose(p:CatalogProduct|null){setProduct(p);if(p)setValues(v=>({...v,cost:p.cost}));setError('')}
  async function save(event:FormEvent){event.preventDefault();if(lock.current)return;if(!product){setError('Choose a product first.');return}lock.current=true;setBusy(true);setError('')
    try{onSaved(await mutate('stock.receive',{...values,product_id:product.id,expires_at:values.expires_at?new Date(`${values.expires_at}T23:59:59`).toISOString():null}))}
    catch(e){setError((e as Error).message)}finally{lock.current=false;setBusy(false)}
  }
  if(creating!==null)return <div className={w.stack}><h3>{t('Add product, then continue receiving')}</h3><ProductForm initial={{name:creating}} onCancel={()=>setCreating(null)} onSaved={p=>{choose(p);setCreating(null);setNotice('Product created and selected. Continue receiving stock.')}} onUseExisting={p=>{choose(p);setCreating(null)}}/></div>
  return <form className={w.stack} onSubmit={save}>
    {notice&&<p role="status">{t(notice)}</p>}
    <ProductSelector value={product} onSelect={choose} onCreate={setCreating} disabled={busy}/>
    {product&&<p className={s.hint}>{product.unit} × {product.unit_size} · {t('Default cost')}: TZS {Number(product.cost).toLocaleString()}. {t('The delivery cost below does not change the product default.')}</p>}
    <label>{t('Batch / supplier reference')}<input required value={values.label} onChange={e=>setValues({...values,label:e.target.value})}/></label>
    <div className={w.grid}><label>{t('Quantity in base units')}<input type="number" inputMode="numeric" required min="1" max="1000000" step="1" value={values.quantity} onChange={e=>setValues({...values,quantity:Number(e.target.value)})}/></label><label>{t('Purchase cost per base unit (TZS)')}<input type="number" inputMode="numeric" min="0" max="1000000000" step="1" required value={values.cost} onChange={e=>setValues({...values,cost:Number(e.target.value)})}/></label></div>
    <label>{t(product&&!product.track_expiry?'Expiry (optional)':'Expiry')}<input type="date" required={!!product?.track_expiry} value={values.expires_at} onChange={e=>setValues({...values,expires_at:e.target.value})}/></label>
    <label>{t('Reason')}<input required value={values.reason} onChange={e=>setValues({...values,reason:e.target.value})}/></label>
    {error&&<p role="alert" className={s.error}>{t(error)}</p>}
    <div className={w.actions}><button type="button" className={s.secondary} onClick={onCancel} disabled={busy}>{t('Cancel')}</button><button className={s.primary} disabled={busy||!product}>{t(busy?'Saving…':'Receive stock')}</button></div>
  </form>
}
