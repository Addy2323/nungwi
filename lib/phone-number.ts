/** Normalize local Tanzanian numbers and accept explicit international E.164 numbers. */
export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '')
  const normalized = /^0[67]\d{8}$/.test(compact) ? `+255${compact.slice(1)}` : /^255[67]\d{8}$/.test(compact) ? `+${compact}` : compact
  if (!/^\+[1-9]\d{7,14}$/.test(normalized) || normalized.startsWith('+255') && !/^\+255[67]\d{8}$/.test(normalized)) throw new Error('Enter a valid phone number, for example 0712345678 or +255712345678.')
  return normalized
}
