// =============================================
// Limbile interfeței: română (limba-sursă, completă) și engleză.
// Limba nu se alege la intrare: vine din țară (România și Moldova → română,
// altfel engleză; vezi `detectLocale`) și se salvează în cont la înregistrare.
// Omul o poate schimba doar din Setări; alegerea stă în cont și într-un
// cookie, ca să-l urmeze pe alte dispozitive. Un link cu `?lang=ro|en`
// (proxy.ts) alege limba fără selector, pentru verificări.
// =============================================

export const LOCALES = ['ro', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ro'
export const SOURCE_LOCALE: Locale = 'ro'
export const LOCALE_COOKIE = 'hontrio_locale'
/** Un an: alegerea limbii nu expiră de la o vizită la alta. */
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

/** Formatul numerelor și al datelor pentru fiecare limbă. */
export const INTL_LOCALE: Record<Locale, string> = { ro: 'ro-RO', en: 'en-GB' }

/** Numele limbilor, scrise în limba lor (pentru lista din Setări). */
export const LOCALE_NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' }

export function isLocale(value: unknown): value is Locale {
  return value === 'ro' || value === 'en'
}

/** Țările unde interfața pornește în română. */
const ROMANIAN_COUNTRIES = ['RO', 'MD']

/**
 * Limba fără o alegere explicită: întâi țara (antetul Vercel), apoi limba
 * preferată din browser (Accept-Language), altfel limba implicită.
 */
export function detectLocale(country: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (country) return ROMANIAN_COUNTRIES.includes(country.toUpperCase()) ? 'ro' : 'en'
  const preferred = (acceptLanguage ?? '')
    .split(',')
    .map(part => {
      const [tag, ...rest] = part.trim().split(';')
      const q = Number(rest.find(r => r.trim().startsWith('q='))?.split('=')[1] ?? 1)
      return { lang: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 }
    })
    .filter(p => p.lang && p.lang !== '*')
    .sort((a, b) => b.q - a.q)
  if (!preferred.length) return DEFAULT_LOCALE
  // Prima limbă cunoscută din preferințe; o limbă străină oarecare primește engleza
  return preferred.find(p => isLocale(p.lang))?.lang as Locale | undefined
    ?? (preferred[0].lang === 'ro' ? 'ro' : 'en')
}
