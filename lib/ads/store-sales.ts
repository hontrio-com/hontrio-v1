import { createAdminClient } from '@/lib/supabase/admin'
import { readAll } from '@/lib/ads/read-all'
import { hontrioCampaignId, HONTRIO_UTM_PREFIX } from '@/lib/commerce/attribution'
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

/** Pentru pilot: pe ofertă, comenzile Hontrio plasate în [fromIso, toIso). Gol când nu există niciuna. */
export async function storeSalesByOffer(supabase: Supabase, storeId: string, fromIso: string, toIso: string): Promise<Map<string, StoreSales>> {
  const toMs = Date.parse(toIso)
  const orders = (await hontrioOrders(supabase, storeId, fromIso)).filter(o => Date.parse(o.placed_at) < toMs)
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
