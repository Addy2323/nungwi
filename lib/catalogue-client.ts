'use client'
import { useEffect, useState } from 'react'
import { api } from './client-api'
import type { ShopProduct } from './shop-utils'
export type Product = ShopProduct
export type Line=Product&{qty:number}
export function toProduct(p:Record<string,any>,unit?:string):Product {const offering=unit?(p.units||[]).find((u:any)=>u.unit===unit)||p:p;return {id:String(p.id),name:p.name,category:p.category,description:p.description||'',volume:p.volume||'',brand:p.brand||'',available:p.available,priceTzs:offering.price,priceUsd:offering.price/2650,image:p.image,stock:Math.floor(p.available/offering.unit_size),minQty:p.min_qty,unit:offering.unit,unitSize:offering.unit_size,deposit:offering.deposit,units:p.units||[]}}
export function useCatalogue() {
  const [products,setProducts]=useState<Product[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
  useEffect(()=>{api<Record<string,any>[]>('catalogue').then(rows=>setProducts(rows.map(p=>toProduct(p)))).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  return {products,error,loading}
}
export function useShopCart() {
  const [cart,setCart]=useState<Line[]>([]);const [ready,setReady]=useState(false);const [error,setError]=useState('')
  useEffect(()=>{let cancelled=false
    api<Record<string,any>[]>('catalogue').then(rows=>{
      let saved:unknown=[]
      try {saved=JSON.parse(localStorage.getItem('nungwi-reorder')||localStorage.getItem('nungwi-cart')||'[]');localStorage.removeItem('nungwi-reorder')}catch{}
      const lines:Line[]=[]
      if(Array.isArray(saved))saved.forEach(item=>{const row=rows.find(p=>String(p.id)===String(item?.id));const product=row?toProduct(row,item.unit):null;if(product&&Number.isInteger(item.qty)&&item.qty>0&&!lines.some(l=>l.id===product.id&&l.unit===product.unit))lines.push({...product,qty:Math.min(item.qty,1000)})})
      if(!cancelled){setCart(lines);setReady(true)}
    }).catch(e=>{if(!cancelled)setError(e.message)})
    return()=>{cancelled=true}
  },[])
  useEffect(()=>{if(ready)try{localStorage.setItem('nungwi-cart',JSON.stringify(cart.map(({id,qty,unit})=>({id,qty,unit}))))}catch{}},[cart,ready])
  return {cart,setCart,ready,error}
}
