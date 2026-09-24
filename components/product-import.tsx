'use client'
import { useState } from 'react'
import { PRODUCT_CSV_HEADER, parseProductCsv } from '@/lib/product-csv'
import { mutate } from '@/lib/client-api'
import { useLanguage } from './language-provider'
import s from './platform.module.css'
import w from './product-workflow.module.css'
export default function ProductImport({onDone}:{onDone:()=>void}) {
  const {t}=useLanguage();const [rows,setRows]=useState<any[]>([]);const [errors,setErrors]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [preview,setPreview]=useState(false)
  async function check(confirm=false){setBusy(true);setErrors([]);try{const result=await mutate<any>('product.import',{rows,confirm});if(result.errors.length){setErrors(result.errors);setPreview(false)}else if(confirm)onDone();else setPreview(true)}catch(e){setErrors([(e as Error).message])}finally{setBusy(false)}}
  return <section className={w.note}><h3>{t('Import products')}</h3><p>{t('Upload up to 100 products, review validation, then confirm. No stock is created.')}</p><a download="products-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(PRODUCT_CSV_HEADER+'\n')}`}>{t('Download CSV template')}</a><input type="file" accept=".csv,text/csv" aria-label={t('Product CSV')} disabled={busy} onChange={async e=>{setPreview(false);setRows([]);setErrors([]);try{const file=e.target.files?.[0];if(file){if(file.size>75000)throw new Error('Import up to 75 KB at a time.');setRows(parseProductCsv(await file.text()))}}catch(error){setErrors([(error as Error).message])}}}/>
    {rows.length>0&&<><p>{rows.length} {t('products')}</p><ul>{rows.map((r,i)=><li key={i}>{r.name} · {r.category} · TZS {r.price}</li>)}</ul><button type="button" className={s.primary} disabled={busy} onClick={()=>check(preview)}>{t(busy?'Processing…':preview?'Confirm import':'Validate import')}</button></>}
    {errors.map((error,i)=><p role="alert" className={w.error} key={i}>{t(error)}</p>)}
  </section>
}
