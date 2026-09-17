export function compareTableValues(a: unknown, b: unknown): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1
  if (b == null || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function pageBounds(length: number, requestedPage: number, size: number) {
  const pages = Math.max(1, Math.ceil(length / size))
  const page = Math.min(Math.max(1, requestedPage), pages)
  return { page, pages, start: (page - 1) * size, end: Math.min(page * size, length) }
}
