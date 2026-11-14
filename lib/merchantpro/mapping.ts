import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import { localToUtcIso } from '@/lib/commerce/time'
import type { MproLineItem, MproOrder, MproProduct, MproVariant } from './types'

// =============================================
// MerchantPro → rândurile modelului comun (commerce_*). Funcții pure.
//
// Oferta = produsul simplu (basic, bundle) sau fiecare variantă vizibilă a unui
// produs cu variante (ca în Merchant Center); id-ul ei e id-ul MerchantPro.
// Produsele digitale și cardurile cadou nu sunt oferte pentru Google Shopping.
// Prețurile sunt cele cu TVA (`*_gross`).
// =============================================

const num = (v: unknown): number => {
  const n = Number(typeof v === 'string' ? v.trim().replace(',', '.') : v)
  return Number.isFinite(n) ? n : 0
}

/** Valoarea există (0 e o valoare; null, lipsa și „" nu sunt). */
const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''

const GTIN_RE = /^\d{8,14}$/
const SHOPPING_TYPES = new Set(['basic', 'multi_variant', 'bundle'])

export function variantsOf(p: Pick<MproProduct, 'variants'>): MproVariant[] {
  const v = p.variants
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return Object.values(v)
  return []
}

/** Produsul e de vânzare pe site: activ, vizibil, cu preț afișat. */
export function isListed(p: Pick<MproProduct, 'status' | 'visibility' | 'price_on_request' | 'type'>): boolean {
  const status = (str(p.status) ?? 'active').toLowerCase()
  const visibility = (str(p.visibility) ?? 'visible').toLowerCase()
  const type = (str(p.type) ?? 'basic').toLowerCase()
  return status === 'active' && visibility === 'visible' && p.price_on_request !== true && SHOPPING_TYPES.has(type)
}

function imageOf(p: Pick<MproProduct, 'image_url'>): string | null {
  const img = p.image_url
  if (typeof img === 'string') return str(img)
  return str(img?.large) ?? str(img?.medium) ?? str(img?.thumb)
}

const gtin = (v: unknown) => {
  const s = str(typeof v === 'number' ? String(v) : v)
  return s && GTIN_RE.test(s) ? s : null
}

const stockOf = (x: { inventory_enabled?: string | null; stock?: unknown }) =>
  (str(x.inventory_enabled) ?? 'off').toLowerCase() === 'on' ? num(x.stock) : null

export function offerRows(ctx: Ctx, p: MproProduct, syncedAt: string, timeZone: string): OfferRow[] {
  if (!isListed(p)) return []
  const productId = String(p.id)
  const name = str(p.name) ?? productId
  const base = {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_product_id: productId,
    product_name: name,
    category: str(p.category_name),
    url: str(p.url),
    currency: ctx.currency,
    brand: str(p.manufacturer_name),
    mpn: null,
    custom_labels: {},
    // MerchantPro nu spune ce face Google cu produsul; aflăm din Merchant Center
    google_status: null,
    source_updated_at: localToUtcIso(p.date_modified, timeZone),
    synced_at: syncedAt,
  }

  if ((str(p.type) ?? 'basic').toLowerCase() !== 'multi_variant') {
    const price = round2(num(p.price_gross))
    if (!(price > 0)) return []
    const old = round2(num(p.old_price_gross))
    return [{
      ...base,
      offer_id: productId,
      item_group_id: null,
      title: name,
      variant_title: null,
      image_url: imageOf(p),
      price,
      compare_at_price: old > price ? old : null,
      // `in_stock` = se poate cumpăra acum (cu stoc, sau la comandă când e permis)
      available: typeof p.in_stock === 'boolean' ? p.in_stock : (stockOf(p) ?? 1) > 0 || p.allow_backorders === true,
      stock: stockOf(p),
      sku: str(p.sku),
      gtin: gtin(p.ean),
    }]
  }

  return variantsOf(p).flatMap(v => {
    const price = round2(num(v.price_gross))
    const visibility = (str(v.visibility) ?? 'visible').toLowerCase()
    if (visibility !== 'visible' || !(price > 0)) return []
    const old = round2(num(v.old_price_gross))
    const variant = (v.variant_options ?? []).map(o => str(o.value)).filter(Boolean).join(' / ') || null
    return [{
      ...base,
      offer_id: String(v.id),
      item_group_id: productId,
      title: variant ? `${name} - ${variant}` : name,
      variant_title: variant,
      image_url: str(v.variant_image) ?? imageOf(p),
      price,
      compare_at_price: old > price ? old : null,
      available: typeof v.in_stock === 'boolean' ? v.in_stock : (stockOf(v) ?? 1) > 0 || p.allow_backorders === true,
      stock: stockOf(v),
      sku: str(v.sku) ?? str(p.sku),
      // Codul de bare e al variantei: al produsului ar fi același pentru toate
      gtin: gtin(v.ean),
    }]
  })
}

// ── Comenzile ──────────────────────────────────────────────────────────────

const lower = (v: unknown) => (str(v) ?? '').toLowerCase()

/** O comandă „temporară" (plata online neterminată) nu e încă o comandă. */
export function isOrder(o: Pick<MproOrder, 'payment_status' | 'shipping_status'>): boolean {
  return lower(o.shipping_status) !== 'temporary' && lower(o.payment_status) !== 'temporary'
}

/** Starea comenzii, din livrare și plată. */
export function orderState(o: Pick<MproOrder, 'payment_status' | 'shipping_status'>): OrderState {
  const ship = lower(o.shipping_status)
  const pay = lower(o.payment_status)
  if (ship === 'cancelled') return 'cancelled'
  if (ship === 'returned' || pay === 'refunded') return 'refunded'
  if (['failed', 'rejected', 'cancelled'].includes(pay) && ship !== 'shipped' && ship !== 'delivered') return 'cancelled'
  if (ship === 'delivered') return 'fulfilled'
  if (['confirmed', 'in_process', 'shipped'].includes(ship) || pay === 'paid' || pay === 'partially_paid') return 'confirmed'
  return 'pending'
}

// Canalele care nu sunt vitrina (comenzi aduse din marketplace-uri)
const MARKETPLACES = /emag|altex|trendyol|amazon|allegro|fashiondays|fashion days|pcgarage|okazii|marketplace|easysales|vivre|elefant|cel\.ro/i

export function channelOf(channelName: string | null | undefined): string {
  const v = str(channelName)
  if (!v || !MARKETPLACES.test(v)) return 'store'
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const isProductLine = (l: MproLineItem) => (str(l.item_type) ?? 'product').toLowerCase() === 'product'

/** Originea unei adrese (https://domeniu), fără cale și parametri. */
function originOf(value: unknown): string | null {
  const s = str(value)
  if (!s) return null
  try { return new URL(s).origin } catch { return null }
}

/**
 * Sursa vizitei. MerchantPro o dă în `traffic_source`, a cărui structură nu e
 * documentată (doar filtrul `utm_campaign` arată că ține UTM-urile): se caută
 * cheile obișnuite (utm_*, gclid...), apoi parametrii paginii de intrare.
 */
export function attributionOf(o: Pick<MproOrder, 'traffic_source' | 'source_type' | 'source_referrer' | 'customer_device'>) {
  const ts = o.traffic_source && typeof o.traffic_source === 'object' && !Array.isArray(o.traffic_source) ? o.traffic_source : {}
  const lowered = Object.fromEntries(Object.entries(ts).map(([k, v]) => [k.toLowerCase(), v]))
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = lowered[k]
      const s = str(typeof v === 'number' ? String(v) : v)
      if (s) return s.slice(0, 200)
    }
    return null
  }
  let landing: URL | null = null
  for (const k of ['landing_page', 'landing_url', 'landing', 'entry_page', 'url', 'page']) {
    const s = get(k)
    if (s) {
      try { landing = new URL(s); break } catch { /* nu e o adresă */ }
    }
  }
  const param = (k: string) => str(landing?.searchParams.get(k))?.slice(0, 200) ?? null
  const values: Record<string, string | null> = {
    source_type: lower(o.source_type) || null,
    referrer: originOf(o.source_referrer) ?? originOf(get('referrer', 'referer')),
    landing_path: landing?.pathname ?? null,
    utm_source: get('utm_source', 'source') ?? param('utm_source'),
    utm_medium: get('utm_medium', 'medium') ?? param('utm_medium'),
    utm_campaign: get('utm_campaign', 'campaign') ?? param('utm_campaign'),
    utm_content: get('utm_content', 'content') ?? param('utm_content'),
    utm_term: get('utm_term', 'term') ?? param('utm_term'),
    gclid: get('gclid') ?? param('gclid'),
    gbraid: get('gbraid') ?? param('gbraid'),
    wbraid: get('wbraid') ?? param('wbraid'),
    device_type: lower(o.customer_device) || null,
  }
  const attribution = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as Record<string, string>
  return { values, attribution }
}

/**
 * Sumele comenzii, cu TVA: produsele (liniile de produs, cum au fost plătite),
 * transportul (cu TVA: în API, subtotal + transport = total) și totalul. Ce
 * lipsește până la total e reducere (cupoane, promoții pe coș); ce trece de el,
 * taxe (de exemplu ramburs). Așa sumele se potrivesc mereu cu totalul.
 */
export function orderRow(ctx: Ctx, o: MproOrder, syncedAt: string, timeZone: string): OrderRow | null {
  if (!isOrder(o)) return null
  const placedAt = localToUtcIso(o.date_created, timeZone)
  if (!placedAt) return null
  const lines = (o.line_items ?? []).filter(isProductLine)
  const subtotal = lines.length
    ? lines.reduce((s, l) => s + (present(l.line_subtotal_gross) ? num(l.line_subtotal_gross) : num(l.unit_price_gross) * num(l.quantity)), 0)
    : num(o.subtotal_including_tax)
  const shipping = num(o.shipping_amount)
  const total = num(o.total_amount)
  const rest = round2(total - subtotal - shipping)
  const state = orderState(o)
  const pay = lower(o.payment_status)
  const { values, attribution } = attributionOf(o)
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: String(o.id),
    order_number: String(o.id),
    placed_at: placedAt,
    source_updated_at: localToUtcIso(o.date_modified, timeZone) ?? placedAt,
    status: lower(o.shipping_status) || 'unknown',
    state,
    payment_status: pay === 'refunded' ? 'refunded' : pay === 'paid' ? 'paid' : pay === 'partially_paid' ? 'partially_paid' : 'unpaid',
    payment_method: str(o.payment_method_code),
    channel: channelOf(o.channel_name),
    currency: str(o.currency)?.toUpperCase() ?? ctx.currency,
    subtotal: round2(subtotal),
    shipping: round2(shipping),
    discount: rest < 0 ? -rest : 0,
    fees: rest > 0 ? rest : 0,
    tax: round2(num(o.tax_amount) + num(o.shipping_tax_amount)),
    total: round2(total),
    discount_code: str(o.coupon_code),
    // Singura dată a cumpărătorului care se păstrează
    country: str(o.billing_country_code)?.toUpperCase() ?? str(o.shipping_country_code)?.toUpperCase() ?? null,
    gclid: values.gclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    attribution,
    synced_at: syncedAt,
  }
}

/** Liniile de produs; oferta e varianta (dacă există), altfel produsul. */
export function lineRows(orderId: string, storeId: string, o: MproOrder, syncedAt: string): LineRow[] {
  return (o.line_items ?? []).filter(isProductLine).map((l, position) => {
    const quantity = num(l.quantity)
    const product = present(l.product_id) && String(l.product_id) !== '0' ? String(l.product_id) : null
    const variant = present(l.variant_id) && String(l.variant_id) !== '0' ? String(l.variant_id) : null
    const unit = present(l.unit_price_gross) ? num(l.unit_price_gross) : quantity > 0 ? num(l.line_subtotal_gross) / quantity : 0
    const options = (l.variant_options ?? []).map(op => str(op.value)).filter(Boolean).join(' / ')
    return {
      order_id: orderId,
      store_id: storeId,
      position,
      external_product_id: product,
      offer_id: variant ?? product,
      name: str(l.product_name) ?? str(l.product_sku) ?? '',
      variant_title: variant ? (options || str(l.variant_name)) : null,
      quantity,
      unit_price: round2(unit),
      is_extra: false,
      synced_at: syncedAt,
    }
  })
}

/** Produsele vândute (id-ul produsului: variantele lui vin împreună). */
export function soldProductIds(o: MproOrder): string[] {
  return [...new Set((o.line_items ?? []).filter(isProductLine).map(l => String(l.product_id ?? '')).filter(id => id && id !== '0'))]
}
