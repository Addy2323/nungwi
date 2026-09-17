'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { sw } from '@/lib/translations'

type Language = 'en' | 'sw'
const LanguageContext = createContext({ language: 'en' as Language, setLanguage: (_: Language) => {}, t: (english: string, swahili?: string): string => english })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en')
  useEffect(() => {
    try { if (localStorage.getItem('nungwi-language') === 'sw') updateLanguage('sw') } catch {}
  }, [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  const setLanguage = (value: Language) => {
    updateLanguage(value)
    try { localStorage.setItem('nungwi-language', value) } catch {}
  }
  const t = (english: string, swahili?: string) => {
    if (language === 'en') return english
    if (swahili) return swahili
    const translated = sw[english.trim()]
    if (translated) return (english.match(/^\s*/)?.[0] || '') + translated + (english.match(/\s*$/)?.[0] || '')
    if (english.endsWith(' does not have enough unexpired stock.')) return english.replace(' does not have enough unexpired stock.', ': hakuna bidhaa za kutosha zinazofaa kuuzwa.')
    if (english.startsWith('Minimum order is TZS ')) return english.replace('Minimum order is TZS ', 'Kiwango cha chini cha agizo ni TZS ')
    return english
  }
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage()
  return <label className="language-select"><span className="sr-only">Language / Lugha</span><select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="sw">Kiswahili</option></select></label>
}
