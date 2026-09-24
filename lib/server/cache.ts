type CacheEntry<T> = { value: T; expires: number }
const memoryCache = new Map<string, CacheEntry<any>>()

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

export function setCached<T>(key: string, value: T, ttlMs: number): T {
  memoryCache.set(key, { value, expires: Date.now() + ttlMs })
  return value
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
}
