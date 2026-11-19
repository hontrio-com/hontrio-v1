// =============================================
// Cifrele din fișa unei campanii: sumele din Google Ads pe o perioadă și ce
// se socotește din ele (rata de clic, costul pe clic, rata de conversie,
// costul pe conversie, ROAS-ul, valoarea medie a unei conversii). Funcții
// pure: o împărțire la zero nu are rezultat (null), nu e zero.
// =============================================

export const STATS_PERIODS = [7, 30, 90] as const
export type StatsPeriod = (typeof STATS_PERIODS)[number]

export const isStatsPeriod = (n: number): n is StatsPeriod => (STATS_PERIODS as readonly number[]).includes(n)

export type Totals = { cost: number; clicks: number; impressions: number; conversions: number; value: number }

export const emptyTotals = (): Totals => ({ cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 })

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Adaugă un rând (din Google Ads: cost, clicks, impressions, conversions, conversions_value). */
export function addRow(into: Totals, r: { cost?: unknown; clicks?: unknown; impressions?: unknown; conversions?: unknown; conversions_value?: unknown; value?: unknown }): Totals {
  into.cost = round2(into.cost + num(r.cost))
  into.clicks += num(r.clicks)
  into.impressions += num(r.impressions)
  into.conversions = round2(into.conversions + num(r.conversions))
  into.value = round2(into.value + num(r.conversions_value ?? r.value))
  return into
}

export type Derived = {
  /** Clicuri / afișări. */
  ctr: number | null
  /** Cost / clicuri. */
  cpc: number | null
  /** Conversii / clicuri. */
  conv_rate: number | null
  /** Cost / conversii. */
  cost_per_conv: number | null
  /** Valoare / cost. */
  roas: number | null
  /** Valoare / conversii. */
  avg_value: number | null
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null)

export function derive(t: Totals): Derived {
  return {
    ctr: ratio(t.clicks, t.impressions),
    cpc: ratio(t.cost, t.clicks),
    conv_rate: ratio(t.conversions, t.clicks),
    cost_per_conv: ratio(t.cost, t.conversions),
    roas: ratio(t.value, t.cost),
    avg_value: ratio(t.value, t.conversions),
  }
}

/** Schimbarea față de perioada de dinainte (−0,2 = cu 20% mai puțin); fără bază, fără schimbare. */
export function change(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null
  return (now - before) / Math.abs(before)
}
