'use client'

import { useT } from '@/lib/i18n/context'
import { PRICING, type PricingCurrency } from '@/lib/pricing'

// =============================================
// Prețul pe scurt („Plătești doar din ce vinzi”, price-teaser.tsx): moneda după limbă
// (lei în română, euro în engleză, ca pe /pricing) și sumele scrise ca pe /pricing.
// Socoteala (taxa, treapta, procentul) e doar în lib/pricing.ts.
// =============================================

/** Moneda paginii și sumele scrise în limba ei: „25.000 lei” sau „€5,000”. */
export function useTeaserMoney() {
  const { t, locale, intlLocale } = useT()
  const currency: PricingCurrency = locale === 'ro' ? 'RON' : 'EUR'
  const number = (value: number) => new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
  const money = (value: number) =>
    t(currency === 'RON' ? 'site.pricing_money_ron' : 'site.pricing_money_eur', { value: number(value) })
  return { t, currency, grid: PRICING[currency], number, money }
}
