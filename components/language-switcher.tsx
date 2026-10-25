'use client'

import { useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config'

// =============================================
// Comutatorul de limbă (română / engleză). Alegerea se ține minte în cookie
// și în cont, iar pagina se reîncarcă în limba nouă.
// `compact` = RO | EN, pentru antete; `select` = listă, pentru Setări.
// =============================================

export default function LanguageSwitcher({ variant = 'compact', className = '' }: { variant?: 'compact' | 'select'; className?: string }) {
  const { locale, setLocale, t } = useLocale()

  if (variant === 'select') {
    return (
      <select value={locale} onChange={e => setLocale(e.target.value as Locale)} aria-label={t('common.language_change')}
        className={`h-10 px-3 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-700 focus:outline-none focus:border-neutral-400 ${className}`}>
        {LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    )
  }

  return (
    <div role="group" aria-label={t('common.language_change')}
      className={`inline-flex items-center h-9 rounded-xl border border-neutral-100 bg-white p-0.5 text-[11px] font-semibold ${className}`}>
      {LOCALES.map(l => (
        <button key={l} type="button" onClick={() => setLocale(l)} aria-pressed={l === locale} title={LOCALE_NAMES[l]}
          className={`h-full px-2 rounded-[10px] uppercase tracking-wide transition-colors ${l === locale ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:text-neutral-700'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}
