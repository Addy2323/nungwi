'use client'
import { useState, type FormEvent } from 'react'
import { mutate } from '@/lib/client-api'
import { useLanguage } from './language-provider'
import styles from './platform.module.css'
export type Field={name:string;label:string;type?:'text'|'email'|'number'|'datetime-local'|'checkbox'|'textarea'|'json'|'select'|'password';options?:{value:string;label:string}[];required?:boolean;help?:string;min?:number;max?:number}
export default function PlatformForm({action,fields,initial={},onSaved,submit='Save'}:{action:string;fields:Field[];initial?:Record<string,any>;onSaved:(value:any)=>void;submit?:string}) {
 const { t } = useLanguage()

  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [image,setImage]=useState(initial.image||'')
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setBusy(true)
    try {const form=new FormData(event.currentTarget);const values:Record<string,any>={...initial}
      fields.forEach(field=>{const raw=form.get(field.name);values[field.name]=field.type==='checkbox'?raw==='on':field.type==='number'?(raw===''?null:Number(raw)):field.type==='json'?JSON.parse(String(raw||'[]')):field.type==='datetime-local'?new Date(String(raw)).toISOString():(field.name==='hotel_id'&&raw===''?null:String(raw??''))})
      onSaved(await mutate(action,values))
    }catch(error){setError(error instanceof Error?error.message:'Unable to save.')}finally{setBusy(false)}
  }
  return <form className={styles.form} onSubmit={save}>{fields.map(field=>{
    let value=initial[field.name]??'';if(field.type==='json')value=JSON.stringify(value||[],null,2);if(field.type==='datetime-local'&&value){const d=new Date(value);value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
    return <label key={field.name} className={field.type==='checkbox'?styles.checkbox:''}>{field.type!=='checkbox'&&t(field.label)}{field.type==='select'?<select name={field.name} defaultValue={value} required={field.required!==false}>{field.required===false&&<option value="">{t("None")}</option>}{field.options?.map(option=><option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>:field.type==='textarea'||field.type==='json'?<textarea name={field.name} defaultValue={value} required={field.required!==false} rows={field.type==='json'?5:3}/>:field.name==='image'?<><input name="image" value={image} onChange={e=>setImage(e.target.value)} placeholder={t("HTTPS image URL or upload below")}/><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={t("Upload image")} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const form=new FormData();form.set('file',file);setBusy(true);try{const response=await fetch('/api/platform',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error);setImage(result.data.url)}catch(error){setError((error as Error).message)}finally{setBusy(false)}}}/>{image&&<img className={styles.imagePreview} src={image} alt={t("Selected image preview")}/>}</>:<input name={field.name} type={field.type||'text'} defaultValue={field.type==='checkbox'?undefined:value} defaultChecked={field.type==='checkbox'?Boolean(value):undefined} required={field.type==='checkbox'?false:field.required!==false} min={field.min??(field.type==='number'?0:undefined)} max={field.max} step={field.type==='number'?'1':undefined}/ >}{field.type==='checkbox'&&t(field.label)}{field.help&&<small>{t(field.help)}</small>}</label>
  })}{error&&<p role="alert" className={styles.error}>{t(error)}</p>}<button className={styles.primary} disabled={busy}>{busy?t("Saving…"):submit}</button></form>
}
