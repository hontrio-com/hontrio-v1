import { monthlyFee, type PricingCurrency } from '@/lib/pricing'
import { localToUtcIso } from '@/lib/commerce/time'
import { isHontrioUtm } from '@/lib/commerce/attribution'

// =============================================
// Situația lunară a unui magazin, după Termeni, art. 9: ce comenzi se
// numără, cu ce valoare, taxa din grila lib/pricing.ts și creditul din
// rambursările de după o factură (art. 9.3). Funcții pure, verificate în
// tests/billing.test.ts; citirea și scrierea sunt în lib/billing/run.ts.
//
// Valoarea unei comenzi (art. 9.2 b): produsele după reduceri, fără
// transport și fără TVA. În modelul comun, `subtotal` și `discount` sunt pe
// aceeași bază (produsele înainte de reduceri și reducerea, cu TVA când
// prețurile magazinului o includ, ca la Edinio), iar `total` și `tax` sunt
// comanda întreagă cu TVA și TVA-ul ei. TVA-ul se scoate cu raportul
// (total − TVA) / total, deci o cotă la fel pe toată comanda.
//
// Gomag nu dă sursa comenzii (lib/commerce/attribution.ts): acolo se numără
// conversiile Google Ads ale campaniilor Hontrio, pe zile, înmulțite cu partea
// netă din comenzile site-ului din aceeași lună (`netShare`) și cel mult cât
// vânzările plătite sau livrate de pe site (`buildConversionStatement`).
// =============================================

export type BillingOrder = {
  id: string
  order_number: string | null
  external_id: string
  placed_at: string
  state: string
  payment_status: string | null
  currency: string
  subtotal: number
  discount: number
  tax: number
  total: number
  utm_campaign: string | null
  /** De unde vine comanda: `store` = site-ul (eMAG, Trendyol și celelalte au canalul lor). */
  channel?: string | null
}

/**
 * Un rând numărat, cum apare în lista lunii (valoarea în moneda situației): o comandă din magazin sau, la Gomag,
 * ziua cu conversiile Google Ads ale campaniilor Hontrio (`source: 'google_ads'`, id-ul „gads:AAAA-LL-ZZ”).
 */
export type CountedOrder = {
  id: string
  number: string
  placed_at: string
  value: number
  /** Valoarea și moneda comenzii, când ea s-a transformat în moneda situației. */
  original?: { value: number; currency: string }
  source?: 'google_ads'
  /** Ziua Gomag: câte conversii și ce valoare a raportat Google, înainte de partea netă. */
  conversions?: number
  reported?: number
}

/** Conversiile Google Ads ale campaniilor Hontrio într-o zi (ziua contului Google Ads). */
export type ConversionDay = { date: string; conversions: number; value: number }

/**
 * Versiunea Termenilor care cuprinde regula Gomag (art. 9.2): datele Google se folosesc la calculul taxei doar
 * pentru cine a acceptat-o (art. 18.2, Politica de confidențialitate). Până atunci, la Gomag nu se numără nimic.
 */
export const CONVERSIONS_TERMS_VERSION = '2026-11-22'

/** Taxa unui magazin Gomag se poate calcula din conversiile Google Ads pentru contul cu această versiune acceptată? */
export function countsConversions(termsVersion: string | null | undefined): boolean {
  return !!termsVersion && termsVersion >= CONVERSIONS_TERMS_VERSION
}

export const conversionDayId = (date: string) => `gads:${date}`
export const isConversionDay = (id: string) => id.startsWith('gads:')
export const conversionDayOf = (id: string) => id.slice('gads:'.length)

/** Cursurile BCE: câte unități din monedă face 1 euro (EUR = 1). */
export type EurRates = Record<string, number>

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Venită dintr-o campanie Hontrio, după ultimul clic: sursa începe cu „hontrio-” (art. 9.2 a). */
export function fromHontrio(o: Pick<BillingOrder, 'utm_campaign'>): boolean {
  return isHontrioUtm(o.utm_campaign)
}

/**
 * Plătită sau livrată, nu anulată, refuzată ori rambursată (art. 9.2 c). O rambursare
 * parțială nu are suma în modelul comun, deci comanda nu se numără deloc (în favoarea omului).
 */
export function billable(o: Pick<BillingOrder, 'state' | 'payment_status'>): boolean {
  if (o.state === 'cancelled' || o.state === 'refunded') return false
  const pay = (o.payment_status ?? '').trim().toLowerCase()
  if (pay.includes('refund') || pay === 'voided') return false
  return o.state === 'fulfilled' || pay === 'paid'
}

/** Produsele după reduceri, fără transport și fără TVA, în moneda comenzii (art. 9.2 b). */
export function orderValue(o: Pick<BillingOrder, 'subtotal' | 'discount' | 'tax' | 'total'>): number {
  const products = Math.max(0, num(o.subtotal) - Math.abs(num(o.discount)))
  const total = num(o.total)
  const tax = num(o.tax)
  const net = total > 0 && tax > 0 && tax < total ? (total - tax) / total : 1
  return round2(products * net)
}

/** Moneda situației: leii și euro rămân; orice altă monedă trece pe grila în euro (art. 9.2 e). */
export function statementCurrency(storeCurrency: string | null | undefined): PricingCurrency {
  return (storeCurrency ?? '').toUpperCase() === 'RON' ? 'RON' : 'EUR'
}

/** Suma într-o monedă, transformată în alta prin euro (cursurile BCE). null = lipsește un curs. */
export function convert(amount: number, from: string, to: string, rates: EurRates): number | null {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  if (f === t) return amount
  const rf = f === 'EUR' ? 1 : rates[f]
  const rt = t === 'EUR' ? 1 : rates[t]
  if (!rf || !rt) return null
  return round2((amount / rf) * rt)
}

/** Monedele de care e nevoie pentru o lună (în afara celei a situației), ca să se ceară cursurile. */
export function neededRates(orders: Pick<BillingOrder, 'currency'>[], currency: PricingCurrency): string[] {
  const need = new Set<string>()
  for (const o of orders) {
    const c = (o.currency || currency).toUpperCase()
    if (c !== currency) { need.add(c); if (currency !== 'EUR') need.add(currency) }
  }
  need.delete('EUR')
  return [...need]
}

// ─── Luna ────────────────────────────────────────────────────────────────────

/** „2026-11” → prima zi, „2026-11-01”. */
export const periodDate = (period: string) => `${period}-01`

/** Luna dinaintea unei zile „AAAA-LL-ZZ”, ca „AAAA-LL”. */
export function previousPeriod(day: string): string {
  const [y, m] = day.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** Luna care urmează, ca „AAAA-LL”. */
export function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Ultima zi a lunii, „AAAA-LL-ZZ” (cursul BCE se ia din ea). */
export function lastDay(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Începutul și sfârșitul lunii, în fusul orar al magazinului, ca momente UTC. */
export function periodBounds(period: string, timeZone: string): { from: string; to: string } {
  return {
    from: localToUtcIso(`${period}-01 00:00:00`, timeZone)!,
    to: localToUtcIso(`${nextPeriod(period)}-01 00:00:00`, timeZone)!,
  }
}

// ─── Creditul din rambursări (art. 9.3) ──────────────────────────────────────

/** O lună facturată a magazinului, cu comenzile ei rambursate de curând (încă netrecute în credit). */
export type BilledMonth = {
  id: string
  currency: PricingCurrency
  sales: number
  /** Valoarea comenzilor rambursate deja trecute în credit. */
  refunded_value: number
  /** Valoarea comenzilor rambursate de la ultima socoteală. */
  new_refunds: number
}

/**
 * Cât s-a plătit în plus pentru o lună facturată, după rambursările noi: taxa lunii
 * recalculată fără ele, față de cea socotită până acum.
 */
export function refundCredit(m: BilledMonth): number {
  if (m.new_refunds <= 0) return 0
  const before = monthlyFee(Math.max(0, m.sales - m.refunded_value), m.currency)
  const after = monthlyFee(Math.max(0, m.sales - m.refunded_value - m.new_refunds), m.currency)
  return round2(Math.max(0, before - after))
}

// ─── Situația ────────────────────────────────────────────────────────────────

export type StatementInput = {
  period: string
  storeCurrency: string | null
  timeZone: string
  /** Comenzile lunii (după data plasării, în fusul magazinului). */
  orders: BillingOrder[]
  /** Comenzile scoase din calcul după o contestație. */
  excluded: Set<string>
  /** Facturarea pornește de la această zi („AAAA-LL-ZZ”): comenzile de dinainte nu se numără (art. 9.5). */
  startDate: string
  rates: EurRates
  /** Creditul din rambursări: cel nou (din lunile facturate) și cel rămas din luna trecută. */
  credit: number
}

export type Statement = {
  currency: PricingCurrency
  sales: number
  orders: CountedOrder[]
  /** Câte comenzi s-au numărat (la Gomag: câte conversii, rotunjit). */
  count: number
  fee: number
  adjustment: number
  amount: number
  credit_carry: number
  /** Comenzile care nu s-au putut transforma (lipsește cursul). */
  missingRates: string[]
}

export function buildStatement(input: StatementInput): Statement {
  const currency = statementCurrency(input.storeCurrency)
  const startMs = Date.parse(localToUtcIso(`${input.startDate} 00:00:00`, input.timeZone) ?? `${input.startDate}T00:00:00Z`)
  const counted: CountedOrder[] = []
  const missing = new Set<string>()
  for (const o of input.orders) {
    if (!fromHontrio(o) || !billable(o) || input.excluded.has(o.id)) continue
    if (!(Date.parse(o.placed_at) >= startMs)) continue
    const value = orderValue(o)
    if (value <= 0) continue
    const from = (o.currency || currency).toUpperCase()
    const converted = convert(value, from, currency, input.rates)
    if (converted === null) { missing.add(from); continue }
    counted.push({
      id: o.id,
      number: o.order_number || o.external_id,
      placed_at: o.placed_at,
      value: converted,
      ...(from !== currency ? { original: { value, currency: from } } : {}),
    })
  }
  counted.sort((a, b) => a.placed_at.localeCompare(b.placed_at))
  return finish(currency, counted, counted.length, input.credit, missing)
}

/** Taxa din grilă, creditul folosit și cel rămas, pentru rândurile numărate ale lunii. */
function finish(currency: PricingCurrency, counted: CountedOrder[], count: number, creditIn: number, missing: Set<string>): Statement {
  const sales = round2(counted.reduce((s, o) => s + o.value, 0))
  const fee = monthlyFee(sales, currency)
  const credit = round2(Math.max(0, creditIn))
  const used = Math.min(fee, credit)
  return {
    currency,
    sales,
    orders: counted,
    count,
    fee,
    adjustment: round2(-used),
    amount: round2(fee - used),
    credit_carry: round2(credit - used),
    missingRates: [...missing],
  }
}

// ─── Gomag: din conversiile Google Ads (art. 9.2) ────────────────────────────

/**
 * Partea netă a comenzilor de pe site dintr-o lună: produsele comenzilor plătite sau livrate, după reduceri, fără
 * transport și fără TVA (art. 9.2 b–c), din totalul tuturor comenzilor (cu TVA, transport și cele anulate). Google
 * raportează conversia la plasarea comenzii, cu totalul ei, deci partea scoate ce n-ar trebui numărat. Fără comenzi
 * pe site, 0: o conversie fără nicio comandă în magazin nu se numără.
 */
export function netShare(orders: Pick<BillingOrder, 'state' | 'payment_status' | 'subtotal' | 'discount' | 'tax' | 'total'>[]): { share: number; net: number } {
  let gross = 0
  let net = 0
  for (const o of orders) {
    gross += Math.max(0, num(o.total))
    if (billable(o)) net += orderValue(o)
  }
  return { share: gross > 0 ? Math.min(1, net / gross) : 0, net: round2(net) }
}

export type ConversionStatementInput = {
  period: string
  storeCurrency: string | null
  timeZone: string
  /** Conversiile campaniilor Hontrio pe zile, în moneda contului Google Ads (aceeași cu a magazinului). */
  days: ConversionDay[]
  /** Comenzile de pe site ale lunii (canalul `store`), toate, pentru partea netă și plafon. */
  websiteOrders: BillingOrder[]
  /** Zilele scoase din calcul după o contestație. */
  excludedDays: Set<string>
  startDate: string
  rates: EurRates
  credit: number
}

/**
 * Situația unui magazin Gomag: fiecare zi cu conversii numără valoarea raportată × partea netă a lunii, iar luna
 * întreagă nu trece de vânzările plătite sau livrate de pe site (dacă ar trece, toate zilele scad la fel).
 */
export function buildConversionStatement(input: ConversionStatementInput): Statement {
  const currency = statementCurrency(input.storeCurrency)
  const from = (input.storeCurrency || currency).toUpperCase()
  const startMs = Date.parse(localToUtcIso(`${input.startDate} 00:00:00`, input.timeZone) ?? `${input.startDate}T00:00:00Z`)
  const { share, net } = netShare(input.websiteOrders.filter(o => Date.parse(o.placed_at) >= startMs))
  const days = input.days
    .filter(d => d.date.startsWith(input.period) && d.date >= input.startDate && !input.excludedDays.has(d.date) && num(d.value) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  let values = days.map(d => round2(num(d.value) * share))
  const total = values.reduce((s, v) => s + v, 0)
  if (total > net && total > 0) values = values.map(v => round2((v * net) / total))

  const counted: CountedOrder[] = []
  const missing = new Set<string>()
  let conversions = 0
  days.forEach((d, i) => {
    const value = values[i]
    if (value <= 0) return
    const converted = convert(value, from, currency, input.rates)
    if (converted === null) { missing.add(from); return }
    conversions += num(d.conversions)
    counted.push({
      id: conversionDayId(d.date),
      number: d.date,
      placed_at: `${d.date}T12:00:00.000Z`,
      value: converted,
      source: 'google_ads',
      conversions: round2(num(d.conversions)),
      reported: round2(num(d.value)),
      ...(from !== currency ? { original: { value, currency: from } } : {}),
    })
  })
  return finish(currency, counted, Math.round(conversions), input.credit, missing)
}
