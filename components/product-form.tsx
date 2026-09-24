'use client'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api, mutate } from '@/lib/client-api'
import { PRODUCT_UNITS, type CatalogProduct } from '@/lib/product-workflow'
import { UniversalScanner } from './scanner/universal-scanner'
import { useLanguage } from './language-provider'
import w from './product-workflow.module.css'
import s from './platform.module.css'

export default function ProductForm({initial={},onSaved,onCancel,onUseExisting}:{initial?:Record<string,any>;onSaved:(p:CatalogProduct)=>void;onCancel:()=>void;onUseExisting?:(p:CatalogProduct)=>void}) {
  const {t}=useLanguage();const key=useId();const submitting=useRef(false)
  const [values,setValues]=useState<Record<string,any>>({name:'',category:'',brand:'',barcode:'',sku:'',unit:'bottle',unit_size:1,cost:0,price:0,reorder_level:1,min_qty:1,deposit:0,hotel_price:null,image:'/logo.png',...initial,active:initial.active===undefined?true:!!initial.active,track_expiry:initial.track_expiry===undefined?true:!!initial.track_expiry})
  const [options,setOptions]=useState<any>({categories:[],brands:[]});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [errors,setErrors]=useState<Record<string,string>>({})
  const [similar,setSimilar]=useState<CatalogProduct[]>([]);const [allowSimilar,setAllowSimilar]=useState(false);const [deposit,setDeposit]=useState(!!initial.deposit);const [scan,setScan]=useState(false)
  useEffect(()=>{api('catalogue-options').then(setOptions).catch(e=>setError(e.message))},[])
  useEffect(()=>{
    if(initial.id||(!values.name&&!values.barcode))return
    let cancelled=false;setAllowSimilar(false)
    const timer=setTimeout(()=>api<any>('product-search',{q:values.barcode||values.name,status:'all',limit:'5'}).then(r=>{if(!cancelled)setSimilar(r.items)}).catch(()=>{if(!cancelled)setSimilar([])}),300)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[values.name,values.barcode,initial.id])
  function change(name:string,value:any){setValues(v=>({...v,[name]:value}));setErrors(e=>({...e,[name]:''}))}
  function field(name:string,label:string,type='text',required=false){return <label key={name} htmlFor={`${key}-${name}`}>{t(label)}{required?' *':''}<input id={`${key}-${name}`} name={name} type={type} required={required} value={values[name]??''} min={type==='number'?0:undefined} step={type==='number'?1:undefined} inputMode={type==='number'?'numeric':undefined} aria-invalid={!!errors[name]} aria-describedby={errors[name]?`${key}-${name}-error`:undefined} onChange={e=>change(name,type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)}/>{errors[name]&&<span className={w.error} id={`${key}-${name}-error`}>{t(errors[name])}</span>}</label>}
  async function save(event:FormEvent){
    event.preventDefault();if(submitting.current)return
    submitting.current=true;setBusy(true);setError('')
    try {
      const payload={...values,deposit:deposit?values.deposit:0}
      const id=await mutate<string>('product.save',payload)
      onSaved({...values,...payload,id} as unknown as CatalogProduct)
    }catch(e){const message=(e as Error).message;setError(message);const next:Record<string,string>={};for(const part of message.split('; ')){const at=part.indexOf(':');if(at>0)next[part.slice(0,at)]=part.slice(at+1).trim()}setErrors(next)}
    finally{submitting.current=false;setBusy(false)}
  }
  return <form className={w.stack} onSubmit={save}>
    <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}} className={w.stack}>
    {!initial.id&&<label>{t('Form template')}<select defaultValue="beverage" onChange={e=>{if(e.target.value==='general')change('unit','piece');else if(e.target.value==='beverage')change('unit','bottle')}}><option value="beverage">{t('Beverage')}</option><option value="grocery">{t('Grocery')}</option><option value="general">{t('General retail')}</option></select></label>}
    {field('name','Product name','text',true)}
    {similar.length>0&&!initial.id&&!allowSimilar&&<div className={w.note}><strong>{t('Possible existing products')}</strong>{similar.map(p=><div key={p.id}><p>{p.name} · {p.barcode||p.sku}{!p.active?` · ${t('Archived')}`:''}</p>{onUseExisting&&!!p.active&&<button type="button" className={s.secondary} onClick={()=>onUseExisting(p)}>{t('Use existing product')}</button>}</div>)}<button type="button" className={s.secondary} onClick={()=>setAllowSimilar(true)}>{t('Create anyway')}</button><small>{t('A barcode already in use cannot be assigned again.')}</small></div>}
    <div className={w.grid}><label>{t('Category')} *<input required list={`${key}-categories`} value={values.category} onChange={e=>change('category',e.target.value)} placeholder={t('Choose or enter a new category')}/><datalist id={`${key}-categories`}>{options.categories.filter((c:any)=>c.active).map((c:any)=><option key={c.id} value={c.name}/>)}</datalist></label>
    <label>{t('Brand')}<input list={`${key}-brands`} value={values.brand} onChange={e=>change('brand',e.target.value)}/><datalist id={`${key}-brands`}>{options.brands.map((b:any)=><option key={b.brand} value={b.brand}/>)}</datalist></label></div>
    {field('barcode','Barcode (optional)')}
    <button type="button" className={s.secondary} onClick={()=>setScan(v=>!v)}>{t(scan?'Close scanner':'Scan barcode')}</button>
    {scan&&<UniversalScanner onScan={(code:string)=>{change('barcode',code);setScan(false)}}/>}
    <label>{t('Unit')} *<select value={values.unit} onChange={e=>change('unit',e.target.value)} required>{PRODUCT_UNITS.map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label>
    <div className={w.grid}>{field('cost','Purchase cost per base unit (TZS)','number')}{field('price','Selling price (TZS)','number')}{field('reorder_level','Reorder level','number')}</div>
    <details><summary>{t('Advanced options')}</summary><div className={w.stack}>
      {field('sku','SKU (generated when blank)')}
      <div className={w.grid}>{field('hotel_price','Hotel / wholesale price (TZS)','number')}{field('unit_size','Base units per selling unit','number')}{field('min_qty','Minimum selling quantity','number')}</div>
      <p className={s.hint}>{t('For a carton of 24 bottles, enter 24 base units. Receive stock and purchase cost use base units.')}</p>
      <label className={w.check}><input type="checkbox" checked={values.track_expiry} onChange={e=>change('track_expiry',e.target.checked)}/>{t('Track expiry on new stock receipts')}</label>
      <label className={w.check}><input type="checkbox" checked={deposit} onChange={e=>setDeposit(e.target.checked)}/>{t('Returnable container / deposit')}</label>
      {deposit&&field('deposit','Deposit per selling unit (TZS)','number')}
      <div className={w.grid}>{field('volume','Size / volume')}{field('variant','Variant (optional)')}{field('flavor','Flavor (optional)')}{field('packaging','Packaging')}{field('manufacturer','Manufacturer')}{field('country_of_origin','Country of origin')}</div>
      <label>{t('Description')}<textarea value={values.description||''} onChange={e=>change('description',e.target.value)}/></label>
      {field('image','Product image URL')}
      <label>{t('Additional selling units (optional JSON)')}<textarea value={typeof values.units==='string'?values.units:JSON.stringify(values.units||[])} onChange={e=>change('units',e.target.value)}/></label>
      <label className={w.check}><input type="checkbox" checked={values.active} onChange={e=>change('active',e.target.checked)}/>{t('Active')}</label>
    </div></details>
    </fieldset>
    {error&&<p role="alert" className={s.error}>{t(error)}</p>}
    <div className={w.actions}><button type="button" className={s.secondary} disabled={busy} onClick={onCancel}>{t('Cancel')}</button><button className={s.primary} disabled={busy||(!initial.id&&similar.length>0&&!allowSimilar)}>{t(busy?'Saving…':'Save product')}</button></div>
  </form>
}
