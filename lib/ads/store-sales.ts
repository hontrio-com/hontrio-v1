import { createAdminClient } from '@/lib/supabase/admin'
import { readAll } from '@/lib/ads/read-all'
import { hontrioCampaignId, HONTRIO_UTM_PREFIX } from '@/lib/commerce/attribution'
import { localToUtcIso, utcToLocal } from '@/lib/commerce/time'
import type { StoreSales } from '@/lib/ads/optimizer'

// =============================================
// Vânzările din magazin aduse de campaniile Hontrio, pentru pilot.
//
// Google nu vede toate vânzările: în UE conversia pleacă doar de la vizitatorii
// care acceptă cookie-urile de marketing (Edinio o trimite doar atunci), iar o
// etichetă se mai și strică. Comenzile magazinului cu sursa „hontrio-<ID>” le
// arată pe toate, în afară de Gomag, care n-are sursa comenzii. Pilotul le pune
// lângă cifrele Google și, la fiecare judecată, ia sursa care vede mai mult
// (optimizer.ts, `withStoreSales`).
//
// Pe produs, o comandă se leagă de ofertele cumpărate (rândurile ei) și de
// oferta pe a cărei pagină a intrat cumpărătorul din reclamă (`landing_path`),
// ca Google, care dă conversia produsului pe care s-a dat clic.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

/** O comandă neanulată din campaniile Hontrio, cum o citește pilotul. */
export type HontrioOrder = { id: string; utm_campaign: string | null; placed_at: string; total: unknown; attribution: Record<string, unknown> | null }
export type OrderLine = { order_id: string; offer_id: string | null; quantity: unknown; unit_price: unknown; is_extra: boolean | null }

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Comenzile neanulate și nerambursate cu sursa Hontrio, plasate de la `fromIso` (inclusiv). */
export async function hontrioOrders(supabase: Supabase, storeId: string, fromIso: string): Promise<HontrioOrder[]> {
  return readAll<HontrioOrder>((a, b) => supabase.from('commerce_orders')
    .select('id, utm_campaign, placed_at, total, attribution')
    .eq('store_id', storeId).ilike('utm_campaign', `${HONTRIO_UTM_PREFIX}%`).not('state', 'in', '(cancelled,refunded)')
    .gte('placed_at', fromIso).order('placed_at').order('id').range(a, b))
}

/**
 * Pe campanie (numărul ei din Google Ads): câte comenzi și cât valorează, cu TVA, plasate de la începutul socotelii
 * ei (`startOf`) până la `toMs` (exclusiv; lipsă = până acum). Campaniile fără început în `startOf` nu se numără.
 */
export function salesByCampaign(orders: HontrioOrder[], startOf: Map<string, string>, toMs?: number): Map<string, StoreSales> {
  const out = new Map<string, StoreSales>()
  for (const o of orders) {
    const id = hontrioCampaignId(o.utm_campaign)
    const start = id ? startOf.get(id) : undefined
    const at = Date.parse(o.placed_at)
    if (!id || !start || !(at >= Date.parse(start)) || (toMs !== undefined && !(at < toMs))) continue
    const s = out.get(id) ?? { orders: 0, value: 0 }
    out.set(id, { orders: s.orders + 1, value: round2(s.value + num(o.total)) })
  }
  return out
}

// ─── Pentru pagini: pe campanie și pe zi ─────────────────────────────────────
//
// Cifrele din Campanii, din fișa campaniei, din Rapoarte și de pe Dashboard
// pun lângă conversiile Google comenzile din magazin aduse de fiecare campanie.
// Pe o fereastră de zile (perioada aleasă, sau cea de dinainte), dacă magazinul
// a văzut mai multe vânzări decât Google, toate zilele ferestrei iau cifra
// magazinului (`withStoreDays`): suma ferestrei rămâne suma zilelor, iar o
// vânzare văzută de amândouă, în zile diferite (clicul seara, comanda după
// miezul nopții), nu se numără de două ori.

/** Vânzările din magazin ale unei campanii, pe zilele magazinului („AAAA-LL-ZZ”). */
export type DaySales = Map<string, StoreSales>

/** Pe campanie (numărul ei din Google Ads) și pe ziua magazinului, comenzile din zilele [fromDay, toDay]. */
export function salesByCampaignDay(orders: HontrioOrder[], tz: string, fromDay: string, toDay: string): Map<string, DaySales> {
  const out = new Map<string, DaySales>()
  for (const o of orders) {
    const id = hontrioCampaignId(o.utm_campaign)
    if (!id) continue
    const day = utcToLocal(new Date(o.placed_at).toISOString(), tz).slice(0, 10)
    if (day < fromDay || day > toDay) continue
    const days = out.get(id) ?? new Map<string, StoreSales>()
    out.set(id, days)
    const s = days.get(day) ?? { orders: 0, value: 0 }
    days.set(day, { orders: s.orders + 1, value: round2(s.value + num(o.total)) })
  }
  return out
}

/** Citirea pentru pagini: comenzile Hontrio neanulate ale magazinului din zilele [fromDay, toDay], pe campanie și zi. */
export async function storeSalesByCampaignDay(supabase: Supabase, storeId: string, tz: string, fromDay: string, toDay: string): Promise<Map<string, DaySales>> {
  const orders = await hontrioOrders(supabase, storeId, localToUtcIso(`${fromDay} 00:00:00`, tz) ?? `${fromDay}T00:00:00Z`)
  return salesByCampaignDay(orders, tz, fromDay, toDay)
}

/**
 * O fereastră de zile a unei campanii (cu toate zilele ei, și cele fără cifre), cu vânzările din magazin: dacă
 * magazinul a văzut mai multe comenzi decât conversiile Google, conversiile tuturor zilelor vin din magazin; la fel,
 * separat, valoarea. `used` spune dacă s-a luat ceva din magazin.
 */
export function withStoreDays<T extends { date: string; conversions: number; value: number }>(days: T[], store: DaySales | undefined): { days: T[]; used: boolean } {
  if (!store?.size) return { days, used: false }
  const google = days.reduce((s, d) => ({ conversions: s.conversions + d.conversions, value: s.value + d.value }), { conversions: 0, value: 0 })
  const inStore = days.reduce((s, d) => {
    const x = store.get(d.date)
    return x ? { orders: s.orders + x.orders, value: s.value + x.value } : s
  }, { orders: 0, value: 0 })
  const conversions = inStore.orders > google.conversions
  const value = inStore.value > round2(google.value)
  if (!conversions && !value) return { days, used: false }
  return {
    used: true,
    days: days.map(d => ({
      ...d,
      ...(conversions ? { conversions: store.get(d.date)?.orders ?? 0 } : {}),
      ...(value ? { value: store.get(d.date)?.value ?? 0 } : {}),
    })),
  }
}

/**
 * Rândurile Google pe campanie și zi, cu vânzările din magazin ale campaniilor Hontrio (`campaigns`), pe fiecare
 * fereastră de zile (`windows`, liste de zile). Rândurile altor campanii și zilele din afara ferestrelor rămân cum
 * sunt; zilele fără nicio cifră nu se întorc. `used` spune dacă s-a luat ceva din magazin.
 */
export function mergeStoreSales<R extends { google_campaign_id: string; date: string; conversions: number; value: number }>(
  rows: R[], campaigns: string[], windows: string[][], store: Map<string, DaySales>, blank: (id: string, date: string) => R,
): { rows: R[]; used: boolean } {
  if (!store.size) return { rows, used: false }
  const ours = new Set(campaigns.filter(id => store.has(id)))
  const inWindow = new Set(windows.flat())
  const out = rows.filter(r => !ours.has(r.google_campaign_id) || !inWindow.has(r.date))
  let used = false
  for (const id of ours) {
    const own = new Map(rows.filter(r => r.google_campaign_id === id).map(r => [r.date, r]))
    for (const window of windows) {
      const merged = withStoreDays(window.map(date => own.get(date) ?? blank(id, date)), store.get(id))
      used ||= merged.used
      out.push(...merged.days.filter(d => Object.values(d).some(v => typeof v === 'number' && v !== 0)))
    }
  }
  return { rows: out, used }
}

/**
 * Vânzările din magazin pe produsul din Merchant Center (ID-ul din cifrele Google pe produs, cu litere mici), din
 * vânzările pe ofertă: o ofertă are ID-ul ei din Merchant Center sau, la Edinio, chiar ID-ul ei.
 */
export async function storeSalesByItem(supabase: Supabase, storeId: string, byOffer: Map<string, StoreSales>): Promise<Map<string, StoreSales>> {
  const out = new Map<string, StoreSales>()
  const ids = [...byOffer.keys()]
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('commerce_offers').select('offer_id, merchant_offer_id').eq('store_id', storeId).in('offer_id', ids.slice(i, i + 200))
    if (error) throw new Error(`commerce_offers: ${error.message}`)
    for (const o of data ?? []) {
      const sales = byOffer.get(String(o.offer_id))
      if (!sales) continue
      const item = String(o.merchant_offer_id || o.offer_id).trim().toLowerCase()
      const s = out.get(item) ?? { orders: 0, value: 0 }
      out.set(item, { orders: s.orders + sales.orders, value: round2(s.value + sales.value) })
    }
  }
  return out
}

/** Calea unei pagini, ca să se compare adresa ofertei cu pagina de intrare: fără domeniu, parametri și „/” final. */
export function pagePath(urlOrPath: string | null | undefined): string | null {
  const raw = (urlOrPath ?? '').trim()
  if (!raw) return null
  let path: string
  try { path = new URL(raw, 'https://magazin.invalid').pathname } catch { return null }
  try { path = decodeURIComponent(path) } catch { /* lăsăm forma codată */ }
  path = path.replace(/\/+$/, '').toLowerCase()
  return path || null
}

/**
 * Pe ofertă: în câte comenzi apare (cumpărată sau doar pagina de intrare din reclamă) și cât au adus ele: ce a vândut
 * oferta în comandă (preț × cantitate) sau, când doar a adus cumpărătorul, comanda întreagă.
 */
export function salesByOffer(orders: HontrioOrder[], lines: OrderLine[], offersByPath: Map<string, string[]>): Map<string, StoreSales> {
  const linesOf = new Map<string, OrderLine[]>()
  for (const l of lines) {
    if (l.is_extra || !l.offer_id) continue
    linesOf.set(l.order_id, [...(linesOf.get(l.order_id) ?? []), l])
  }
  const out = new Map<string, StoreSales>()
  const add = (offer: string, value: number) => {
    const s = out.get(offer) ?? { orders: 0, value: 0 }
    out.set(offer, { orders: s.orders + 1, value: round2(s.value + value) })
  }
  for (const o of orders) {
    const bought = new Map<string, number>()
    for (const l of linesOf.get(o.id) ?? []) bought.set(l.offer_id!, (bought.get(l.offer_id!) ?? 0) + num(l.unit_price) * num(l.quantity))
    for (const [offer, value] of bought) add(offer, value)
    const landing = pagePath(typeof o.attribution?.landing_path === 'string' ? o.attribution.landing_path : null)
    for (const offer of (landing ? offersByPath.get(landing) : undefined) ?? []) {
      if (!bought.has(offer)) add(offer, num(o.total))
    }
  }
  return out
}

/**
 * Pe ofertă, comenzile Hontrio plasate în [fromIso, toIso), ale tuturor campaniilor sau doar ale celor din
 * `campaigns` (numerele lor din Google Ads). Gol când nu există niciuna.
 */
export async function storeSalesByOffer(supabase: Supabase, storeId: string, fromIso: string, toIso: string, campaigns?: string[]): Promise<Map<string, StoreSales>> {
  const toMs = Date.parse(toIso)
  const only = campaigns ? new Set(campaigns) : null
  const orders = (await hontrioOrders(supabase, storeId, fromIso))
    .filter(o => Date.parse(o.placed_at) < toMs && (!only || only.has(hontrioCampaignId(o.utm_campaign) ?? '')))
  if (!orders.length) return new Map()
  const ids = orders.map(o => o.id)
  const lines: OrderLine[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('commerce_order_lines').select('order_id, offer_id, quantity, unit_price, is_extra').in('order_id', ids.slice(i, i + 200))
    if (error) throw new Error(`commerce_order_lines: ${error.message}`)
    lines.push(...((data ?? []) as OrderLine[]))
  }
  // Paginile de intrare se leagă de oferte doar dacă există; adresele tuturor ofertelor se citesc doar atunci
  const offersByPath = new Map<string, string[]>()
  if (orders.some(o => typeof o.attribution?.landing_path === 'string')) {
    const offers = await readAll<{ offer_id: string; url: string | null }>((a, b) => supabase.from('commerce_offers')
      .select('offer_id, url').eq('store_id', storeId).order('offer_id').range(a, b))
    for (const o of offers) {
      const path = pagePath(o.url)
      if (path) offersByPath.set(path, [...(offersByPath.get(path) ?? []), o.offer_id])
    }
  }
  return salesByOffer(orders, lines, offersByPath)
}
