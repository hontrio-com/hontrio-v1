import { monthlyFee, type PricingCurrency } from '@/lib/pricing'
import { localToUtcIso } from '@/lib/commerce/time'

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
}

/** O comandă numărată, cum apare în lista lunii (valoarea în moneda situației). */
export type CountedOrder = {
  id: string
  number: string
  placed_at: string
  value: number
  /** Valoarea și moneda comenzii, când ea s-a transformat în moneda situației. */
  original?: { value: number; currency: string }
}

/** Cursurile BCE: câte unități din monedă face 1 euro (EUR = 1). */
export type EurRates = Record<string, number>

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Venită dintr-o campanie Hontrio, după ultimul clic: sursa începe cu „hontrio-” (art. 9.2 a). */
export function fromHontrio(o: Pick<BillingOrder, 'utm_campaign'>): boolean {
  return (o.utm_campaign ?? '').trim().toLowerCase().startsWith('hontrio-')
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
  const sales = round2(counted.reduce((s, o) => s + o.value, 0))
  const fee = monthlyFee(sales, currency)
  const credit = round2(Math.max(0, input.credit))
  const used = Math.min(fee, credit)
  return {
    currency,
    sales,
    orders: counted,
    fee,
    adjustment: round2(-used),
    amount: round2(fee - used),
    credit_carry: round2(credit - used),
    missingRates: [...missing],
  }
}
