'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n/context'
import type { Money } from '@/lib/admin/money'

// =============================================
// Banii din panoul de administrare, pe monede (lei și euro nu se adună):
// „1.234,50 lei”, „1.234 lei · 56 €”.
// =============================================

export function useMoney() {
  const { intlLocale } = useT()
  return useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>()
    const fmt = (currency: string) => {
      let f = cache.get(currency)
      if (!f) {
        try { f = new Intl.NumberFormat(intlLocale, { style: 'currency', currency, maximumFractionDigits: 2 }) }
        catch { f = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }) }
        cache.set(currency, f)
      }
      return f
    }
    /** O sumă într-o monedă. */
    const one = (amount: number, currency: string | null | undefined) => fmt((currency || 'RON').toUpperCase()).format(amount)
    /** Sumele pe monede; fără nicio sumă, `empty` (implicit zero în lei). */
    const many = (m: Money | null | undefined, empty?: string) => {
      const parts = Object.entries(m ?? {}).filter(([, v]) => v)
      return parts.length ? parts.map(([c, v]) => one(v, c)).join(' · ') : (empty ?? one(0, 'RON'))
    }
    return { one, many }
  }, [intlLocale])
}
