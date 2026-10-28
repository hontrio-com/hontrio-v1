'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n/context'

// =============================================
// Cum se scriu cifrele în paginile platformei, în limba omului: banii
// (fără bani mărunți, sau cu, la costul pe click), ROAS-ul, numerele
// întregi, procentele și datele.
// =============================================

export type Formats = {
  money: Intl.NumberFormat
  money2: Intl.NumberFormat
  /** Mii fără zecimale, pentru axele graficelor: 1,2 mii. */
  compact: Intl.NumberFormat
  num: Intl.NumberFormat
  int: Intl.NumberFormat
  date: Intl.DateTimeFormat
  shortDate: Intl.DateTimeFormat
  dateTime: Intl.DateTimeFormat
}

export function useFormats(currency: string): Formats {
  const { intlLocale } = useT()
  return useMemo(() => {
    const money = (opts: Intl.NumberFormatOptions) => {
      try { return new Intl.NumberFormat(intlLocale, { style: 'currency', currency, ...opts }) }
      catch { return new Intl.NumberFormat(intlLocale, opts) }
    }
    return {
      money: money({ maximumFractionDigits: 0 }),
      money2: money({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      compact: new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 }),
      num: new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }),
      int: new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }),
      date: new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }),
      shortDate: new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' }),
      dateTime: new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }),
    }
  }, [intlLocale, currency])
}

/** O zi YYYY-MM-DD, la amiază (fără surprize de fus orar la afișare). */
export const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`)
