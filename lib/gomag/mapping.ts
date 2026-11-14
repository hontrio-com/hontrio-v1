import { countryCode } from '@/lib/commerce/country'
import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import { localToUtcIso } from '@/lib/commerce/time'
import { listOf } from './api'
import type { GomagCurrency, GomagOrder, GomagOrderItem, GomagProduct, GomagStatus, NumLike } from './types'

// =============================================
// Gomag → rândurile modelului comun (commerce_*). Funcții pure.
//
// Oferta = produsul listat: la Gomag fiecare variantă e un produs al ei, cu
// `parent` = produsul grupului (un produs simplu e propriul părinte). Prețurile
// se păstrează cu TVA, cum le vede cumpărătorul (Google le cere așa).
//
// ⚠ API-ul de comenzi Gomag nu spune sursa comenzii (UTM, gclid): comenzile
// Gomag n-au atribuire din magazin (vezi docs/integrari/GOMAG.md).
// =============================================

export const num = (v: NumLike): number => {
  const n = Number(typeof v === 'string' ? v.trim().replace(',', '.') : v)
  return Number.isFinite(n) ? n : 0
}

/** "1" / 1 / true → da. */
export const flag = (v: unknown): boolean => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.trim().toLowerCase() === 'true')

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Activ în magazin. Fără câmp (răspuns vechi), produsul listat se socotește activ. */
export function isEnabled(p: Pick<GomagProduct, 'enabled'>): boolean {
  return p.enabled === undefined || p.enabled === null ? true : flag(p.enabled)
}

/** Prețul cu TVA: Gomag spune dacă prețul produsului include TVA-ul (`vat_included`) și cota (`vat`). */
export function grossPrice(price: NumLike, p: Pick<GomagProduct, 'vat_included' | 'vat'>): number {
  const value = num(price)
  const included = p.vat_included === undefined || p.vat_included === null ? true : flag(p.vat_included)
  return round2(included ? value : value * (1 + num(p.vat) / 100))
}

/** Categoria produsului: ultima din prima ramură (calea de la rădăcină la categorie). */
export function categoryOf(p: Pick<GomagProduct, 'categories'>): string | null {
  const branches = Array.isArray(p.categories) ? p.categories : p.categories ? Object.values(p.categories) : []
  for (const branch of branches) {
    const list = Array.isArray(branch) ? branch : listOf<{ name?: string }>(branch)
    const leaf = str(list[list.length - 1]?.name)
    if (leaf) return leaf
  }
  return null
}

/** Se poate cumpăra: în stoc, la precomandă, sau „se aduce la comandă". */
export function availableOf(p: Pick<GomagProduct, 'stock_status' | 'stockStatus' | 'stock' | 'stockManagement' | 'allowOrdersWhenOutOfStock'>): boolean {
  const status = (str(p.stock_status) ?? str(p.stockStatus))?.toLowerCase()
  if (flag(p.allowOrdersWhenOutOfStock)) return true
  if (status) return status !== 'notinstock' && status !== 'outofstock'
  return !flag(p.stockManagement) || num(p.stock) > 0
}

const GTIN_RE = /^\d{8,14}$/

/** Oferta produsului (cel mult una). Fără preț sau dezactivat: nicio ofertă. */
export function offerRows(ctx: Ctx, p: GomagProduct, syncedAt: string, timeZone: string): OfferRow[] {
  if (!isEnabled(p)) return []
  const price = grossPrice(p.price, p)
  if (!(price > 0)) return []
  const id = String(p.id)
  const parent = p.parent !== null && p.parent !== undefined && String(p.parent).trim() !== '' && String(p.parent) !== '0' ? String(p.parent) : null
  const grouped = parent !== null && parent !== id
  const base = grossPrice(p.base_price, p)
  const name = str(p.name) ?? id
  const ean = str(p.ean)
  return [{
    store_id: ctx.storeId,
    user_id: ctx.userId,
    offer_id: id,
    external_product_id: grouped ? parent! : id,
    item_group_id: grouped ? parent : null,
    title: name,
    product_name: name,
    variant_title: null,
    category: categoryOf(p),
    url: str(p.url) ?? str(p.canonical_url),
    image_url: str(p.images?.[0]) ?? null,
    price,
    compare_at_price: base > price ? base : null,
    currency: str(p.currency)?.toUpperCase() ?? ctx.currency,
    available: availableOf(p),
    stock: flag(p.stockManagement) ? num(p.stock) : null,
    sku: str(p.sku),
    gtin: ean && GTIN_RE.test(ean) ? ean : null,
    mpn: null,
    brand: str(p.brand),
    custom_labels: {},
    // Gomag nu spune ce face Google cu produsul; aflăm din Merchant Center
    google_status: null,
    source_updated_at: localToUtcIso(p.updated, timeZone),
    synced_at: syncedAt,
  }]
}

// ── Comenzile ──────────────────────────────────────────────────────────────

/**
 * Starea comenzii. Stările Gomag se pot redenumi și adăuga în fiecare magazin;
 * lista lor (order/status/read) poate spune tipul: sale / return / cancel.
 * Altfel se judecă după nume, ca la stările implicite (Comandă nouă, Preluată,
 * Plătită, Livrată, Finalizată, Returnată, Anulată).
 */
export function orderState(statusId: unknown, statusName: string | null | undefined, statuses: Map<string, GomagStatus>): OrderState {
  const s = statusId !== null && statusId !== undefined ? statuses.get(String(statusId)) : undefined
  const type = str(s?.type)?.toLowerCase()
  if (type === 'cancel') return 'cancelled'
  if (type === 'return') return 'refunded'
  const name = normalize(str(statusName) ?? str(s?.name) ?? '')
  if (/anulat|anulare|respins|refuzat|cancel/.test(name)) return 'cancelled'
  if (/retur|rambursa|refund/.test(name)) return 'refunded'
  if (/livrat|finalizat|facturat|incasat|complet|predat/.test(name)) return 'fulfilled'
  if (/\bnoua\b|\bnou\b|neplatit|asteptare|telefonic|neconfirmat|in curs de confirmare/.test(name)) return 'pending'
  // Stările adăugate de magazin (în pregătire, expediată...) sunt comenzi vii
  return 'confirmed'
}

/** Canalele care nu sunt vitrina magazinului (marketplace-uri aduse prin Gomag). */
export function channelOf(salesChannel: string | null | undefined): string {
  const v = normalize(salesChannel ?? '')
  if (!v || /^(website|web|site|magazin|online|shop|store|default|admin|backend|telefon)/.test(v)) return 'store'
  return v.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'store'
}

function itemsOf(o: GomagOrder): GomagOrderItem[] {
  return listOf<GomagOrderItem>(o.items)
}

const isProduct = (i: GomagOrderItem) => (str(i.type) ?? 'product').toLowerCase() === 'product'

/**
 * Sumele comenzii, cu TVA, cum le dă Gomag: prețul pe bucată plătit, reducerile
 * (vouchere), transportul și totalul. TVA-ul nu vine ca sumă: se socotește din
 * cota fiecărui produs, cu reducerile împărțite proporțional (transportul fără TVA).
 */
export function orderRow(ctx: Ctx, o: GomagOrder, syncedAt: string, statuses: Map<string, GomagStatus>, timeZone: string): OrderRow | null {
  const placedAt = localToUtcIso(o.date, timeZone)
  if (!placedAt) return null
  const items = itemsOf(o)
  const products = items.filter(isProduct)
  const extras = items.filter(i => !isProduct(i))
  const subtotal = products.reduce((s, i) => s + num(i.price) * num(i.quantity), 0)
  const fees = extras.reduce((s, i) => s + num(i.price) * num(i.quantity), 0)
  const discount = (o.discounts ?? []).reduce((s, d) => s + Math.abs(num(d.value)), 0)
  const shipping = num(o.delivery?.total)
  const share = subtotal > 0 ? Math.max(0, subtotal - discount) / subtotal : 1
  const tax = products.reduce((s, i) => {
    const rate = num(i.vat)
    return s + (rate > 0 ? (num(i.price) * num(i.quantity) * rate) / (100 + rate) : 0)
  }, 0) * share
  const state = orderState(o.statusId, o.status, statuses)
  const codes = (o.discounts ?? []).map(d => str(d.voucher)).filter((c): c is string => !!c)
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: String(o.id),
    order_number: str(o.number) ?? String(o.id),
    placed_at: placedAt,
    source_updated_at: localToUtcIso(o.updated, timeZone) ?? placedAt,
    status: str(o.status) ?? (o.statusId !== null && o.statusId !== undefined ? String(o.statusId) : 'unknown'),
    state,
    payment_status: state === 'refunded' ? 'refunded' : flag(o.payment?.completed) ? 'paid' : 'unpaid',
    payment_method: str(o.payment?.name),
    channel: channelOf(o.sales_channel),
    currency: str(o.currency)?.toUpperCase() ?? ctx.currency,
    subtotal: round2(subtotal),
    shipping: round2(shipping),
    discount: round2(discount),
    fees: round2(fees),
    tax: round2(Math.max(0, tax)),
    total: round2(num(o.total)),
    discount_code: codes.length ? [...new Set(codes)].join(', ') : null,
    // Singura dată a cumpărătorului care se păstrează (Gomag scrie numele țării)
    country: countryCode(o.billing?.country) ?? countryCode(o.shipping?.country),
    // Gomag nu dă sursa comenzii
    gclid: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    attribution: {},
    synced_at: syncedAt,
  }
}

/** Liniile comenzii: produsele, apoi serviciile (ca linii „extra", în afara vânzărilor de produse). */
export function lineRows(orderId: string, storeId: string, o: GomagOrder, syncedAt: string): LineRow[] {
  const items = itemsOf(o)
  const ordered = [...items.filter(isProduct), ...items.filter(i => !isProduct(i))]
  return ordered.map((i, position) => {
    const id = i.id !== null && i.id !== undefined && String(i.id).trim() !== '' && String(i.id) !== '0' ? String(i.id) : null
    return {
      order_id: orderId,
      store_id: storeId,
      position,
      external_product_id: id,
      offer_id: id,
      name: str(i.name) ?? str(i.sku) ?? '',
      variant_title: null,
      quantity: num(i.quantity),
      unit_price: round2(num(i.price)),
      is_extra: !isProduct(i),
      synced_at: syncedAt,
    }
  })
}

/** Produsele vândute în comandă (id-urile Gomag). */
export function soldProductIds(o: GomagOrder): string[] {
  return itemsOf(o).filter(isProduct).map(i => String(i.id ?? '')).filter(id => id && id !== '0')
}

// ── Magazinul ──────────────────────────────────────────────────────────────

/** Moneda de bază: cea cu multiplicatorul 1 (celelalte sunt convertite din ea). */
export function baseCurrency(currencies: GomagCurrency[]): string | null {
  const base = currencies.find(c => num(c.multiplier) === 1) ?? (currencies.length === 1 ? currencies[0] : undefined)
  return str(base?.currency)?.toUpperCase() ?? str(base?.name)?.toUpperCase() ?? null
}

export function statusMap(list: GomagStatus[] | null | undefined): Map<string, GomagStatus> {
  return new Map((list ?? []).filter(s => s && s.id !== undefined && s.id !== null).map(s => [String(s.id), s]))
}
