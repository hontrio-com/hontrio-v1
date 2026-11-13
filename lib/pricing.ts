// =============================================
// Prețurile Hontrio (hotărâte de proprietar pe 12.11.2026): o taxă pe lună,
// pentru fiecare magazin, calculată doar din vânzările aduse de campaniile
// Hontrio în luna calendaristică respectivă (regulile de numărare sunt în
// Termeni, art. 9).
//
//   lei:  până la 5.000 gratuit · până la 10.000, 199 lei · peste, 2% din vânzări
//   euro: până la 1.000 gratuit · până la 2.000, 39 €     · peste, 2% din vânzări
//
// Fără plafon. Prețuri finale: VOID SFT GAMES SRL nu e plătitoare de TVA.
// Alte monede se transformă în euro (cursul BCE din ultima zi a lunii) și
// urmează grila în euro. Secțiunea de prețuri și comparația de pe prima pagină o
// folosesc acum; facturarea o va folosi la fel.
// =============================================

export type PricingCurrency = 'RON' | 'EUR'

export type PricingGrid = {
  /** Până aici, inclusiv, luna e gratuită */
  freeUpTo: number
  /** Peste pragul gratuit și până aici, inclusiv: taxa fixă */
  flatUpTo: number
  flatFee: number
  /** Peste flatUpTo: procentul din toate vânzările lunii */
  percent: number
}

export const PRICING: Record<PricingCurrency, PricingGrid> = {
  RON: { freeUpTo: 5000, flatUpTo: 10000, flatFee: 199, percent: 2 },
  EUR: { freeUpTo: 1000, flatUpTo: 2000, flatFee: 39, percent: 2 },
}

export type PricingTier = 'free' | 'flat' | 'percent'

/** Treapta în care intră vânzările lunii. */
export function pricingTier(sales: number, currency: PricingCurrency): PricingTier {
  const g = PRICING[currency]
  if (!Number.isFinite(sales) || sales <= g.freeUpTo) return 'free'
  return sales <= g.flatUpTo ? 'flat' : 'percent'
}

/**
 * Taxa lunară a unui magazin, rotunjită la bani (doi zecimali; jumătatea de ban în sus).
 * Socoteala e în bani întregi, cu procentul în promile (2% → 20‰), ca virgula mobilă
 * să nu mute rotunjirea.
 */
export function monthlyFee(sales: number, currency: PricingCurrency): number {
  const g = PRICING[currency]
  const tier = pricingTier(sales, currency)
  if (tier === 'free') return 0
  if (tier === 'flat') return g.flatFee
  const salesCents = Math.round(sales * 100)
  const perMille = Math.round(g.percent * 10)
  return Math.round((salesCents * perMille) / 1000) / 100
}

/** Cât reprezintă taxa din vânzări, în procente cu doi zecimali (0 fără vânzări). */
export function feeShare(sales: number, currency: PricingCurrency): number {
  if (!Number.isFinite(sales) || sales <= 0) return 0
  return Math.round((monthlyFee(sales, currency) / sales) * 10000) / 100
}
