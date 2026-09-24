'use client'
export async function api<T=any>(resource:string,params:Record<string,string>={}) : Promise<T> {
  const response=await fetch(`/api/platform?${new URLSearchParams({resource,...params})}`,{cache:'no-store'})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Unable to load data.')
  return result.data
}
export async function mutate<T=any>(action:string,values:Record<string,unknown>={}) : Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch('/api/platform', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values}),signal:controller.signal})
    const result = await response.json().catch(() => {
      throw new Error(`The server returned an unreadable response (HTTP ${response.status}). Check whether your changes were saved before trying again.`)
    })
    if (!response.ok) throw new Error(result.error || 'Unable to save changes.')
    return result.data
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The save request timed out. Check your connection and refresh the list to see whether your changes were saved before trying again.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
