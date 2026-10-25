'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { INTL_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, type Locale } from './config'
import { createT, type Messages, type TFunction } from './translate'

// =============================================
// Traducerea în browser. Limba și dicționarul vin de pe server (layout-ul
// rădăcină), deci textele sunt traduse din prima randare: nicio cheie sau
// bucată de cheie nu apare cât se încarcă pagina.
// =============================================

/** @deprecated folosește `Locale` din `@/lib/i18n/config` */
export type UILocale = Locale

type LanguageContextType = {
  locale: Locale
  /** Formatul numerelor și datelor pentru limba curentă (ro-RO / en-GB) */
  intlLocale: string
  t: TFunction
  /** Schimbă limba: o ține minte (cookie și cont) și reîncarcă pagina în limba nouă. */
  setLocale: (locale: Locale) => void
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'ro',
  intlLocale: INTL_LOCALE.ro,
  t: createT('ro', {}),
  setLocale: () => {},
})

function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
}

function hasLocaleCookie(): boolean {
  return document.cookie.split(';').some(c => c.trim().startsWith(`${LOCALE_COOKIE}=`))
}

export function LanguageProvider({ locale, messages, fallback, children }: {
  locale: Locale
  messages: Messages
  fallback?: Messages | null
  children: ReactNode
}) {
  const t = useMemo(() => createT(locale, messages, fallback ?? undefined), [locale, messages, fallback])
  const { data: session, status } = useSession()

  const setLocale = useCallback((next: Locale) => {
    if (next === locale) return
    rememberLocale(next)
    // În cont, ca limba să-l urmeze pe om și pe alte dispozitive (fără cont, cererea e refuzată, nu contează)
    fetch('/api/user/locale', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: next }), keepalive: true,
    }).catch(() => {})
    window.location.reload()
  }, [locale])

  // Pe un dispozitiv nou (fără alegere salvată), limba aleasă în cont câștigă
  const accountLocale = (session?.user as { locale?: unknown } | undefined)?.locale
  useEffect(() => {
    if (status !== 'authenticated' || !isLocale(accountLocale) || hasLocaleCookie()) return
    rememberLocale(accountLocale)
    if (accountLocale !== locale) window.location.reload()
  }, [status, accountLocale, locale])

  const value = useMemo(() => ({ locale, intlLocale: INTL_LOCALE[locale], t, setLocale }), [locale, t, setLocale])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/** Limba, traducerea și comutatorul. */
export function useLocale() {
  return useContext(LanguageContext)
}

/** Traducerea și limba curentă. */
export function useT() {
  const { t, locale, intlLocale } = useContext(LanguageContext)
  return { t, locale, intlLocale }
}
