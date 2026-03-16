'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
export type UILocale = 'ro' | 'en'

type Messages = Record<string, string | Record<string, string | Record<string, string>>>

type LanguageContextType = {
  locale: UILocale
  setLocale: (locale: UILocale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

// ─── Lazy-loaded message files ───────────────────────────────────────────────
const messageCache: Record<UILocale, Messages | null> = { ro: null, en: null }

async function loadMessages(locale: UILocale): Promise<Messages> {
  if (messageCache[locale]) return messageCache[locale]!
  try {
    const mod = locale === 'en'
      ? await import('./messages/en.json')
      : await import('./messages/ro.json')
    messageCache[locale] = mod.default || mod
    return messageCache[locale]!
  } catch {
    return {}
  }
}

// ─── Auto-detect locale from browser ─────────────────────────────────────────
function detectLocale(): UILocale {
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage || ''
    const langCode = browserLang.toLowerCase().split('-')[0]
    if (langCode === 'ro') return 'ro'
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz === 'Europe/Bucharest') return 'ro'
    return 'en'
  } catch {
    return 'en'
  }
}

// ─── Deep get from nested object with dot notation ───────────────────────────
function deepGet(obj: any, path: string): string | undefined {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

// ─── Context ─────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextType>({
  locale: 'ro',
  setLocale: () => {},
  t: (key) => key,
})

export function useLocale() {
  return useContext(LanguageContext)
}

export function useT() {
  const { t, locale } = useContext(LanguageContext)
  return { t, locale }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UILocale>('ro')
  const [messages, setMessages] = useState<Messages>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('hontrio_locale') as UILocale | null
    const initial = saved && ['ro', 'en'].includes(saved) ? saved : detectLocale()
    setLocaleState(initial)
    if (!saved) localStorage.setItem('hontrio_locale', initial)
    loadMessages(initial).then(msgs => {
      setMessages(msgs)
      setReady(true)
    })
  }, [])

  const setLocale = useCallback((newLocale: UILocale) => {
    setLocaleState(newLocale)
    localStorage.setItem('hontrio_locale', newLocale)
    loadMessages(newLocale).then(setMessages)
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = deepGet(messages, key)
    if (!value) return key.split('.').pop() || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
      }
    }
    return value
  }, [messages])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}