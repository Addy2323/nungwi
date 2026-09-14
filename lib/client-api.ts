'use client'
export async function api<T=any>(resource:string,params:Record<string,string>={}) : Promise<T> {
  const response=await fetch(`/api/platform?${new URLSearchParams({resource,...params})}`,{cache:'no-store'})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Unable to load data.')
  return result.data
}
export async function mutate<T=any>(action:string,values:Record<string,unknown>={}) : Promise<T> {
  const response=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})})
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to save changes.');return result.data
}
