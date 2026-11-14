import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import type { OcInfo, OcOrder, OcProduct, OcStatus } from './types'

// =============================================
// OpenCart (extensia Hontrio) → rândurile modelului comun. Funcții pure.
//
// Oferta = produsul listat (în OpenCart 4, o variantă e un produs al ei, cu
// `master_id` = produsul principal). Opțiunile OpenCart (culoare, mărime cu
// adaos de preț) nu sunt oferte: feedurile Google pentru OpenCart trimit și ele
// produsul. Prețurile se păstrează cu taxe, cum le vede cumpărătorul.
// =============================================

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const iso = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const GTIN_RE = /^\d{8,14}$/

/** Primul cod de bare valid dintre EAN, UPC, JAN și ISBN. */
export function gtinOf(p: Pick<OcProduct, 'ean' | 'upc' | 'jan' | 'isbn'>): string | null {
  for (const v of [p.ean, p.upc, p.jan, p.isbn]) {
    const s = str(v)?.replace(/[\s-]/g, '')
    if (s && GTIN_RE.test(s)) return s
  }
  return null
}

/** Categoria produsului: ultima din prima cale (de la rădăcină la categorie). */
export function categoryOf(p: Pick<OcProduct, 'categories'>): string | null {
  for (const path of p.categories ?? []) {
    const leaf = Array.isArray(path) ? str(path[path.length - 1]) : null
    if (leaf) return leaf
  }
  return null
}

const variantOf = (options: { value?: string | null }[] | null | undefined) =>
  (options ?? []).map(o => str(o.value)).filter(Boolean).join(' / ') || null

export function offerRows(ctx: Ctx, p: OcProduct, syncedAt: string): OfferRow[] {
  const price = round2(num(p.price))
  if (!(price > 0)) return []
  const id = String(p.product_id)
  const master = num(p.master_id) > 0 ? String(p.master_id) : null
  const name = str(p.name) ?? id
  const variant = variantOf(p.variant)
  const regular = round2(num(p.regular_price))
  return [{
    store_id: ctx.storeId,
    user_id: ctx.userId,
    offer_id: id,
    external_product_id: master ?? id,
    item_group_id: master,
    title: variant ? `${name} - ${variant}` : name,
    product_name: name,
    variant_title: variant,
    category: categoryOf(p),
    url: str(p.url),
    image_url: str(p.image),
    price,
    compare_at_price: regular > price ? regular : null,
    currency: ctx.currency,
    available: p.available === true,
    stock: p.subtract ? num(p.quantity) : null,
    sku: str(p.sku) ?? str(p.model),
    gtin: gtinOf(p),
    mpn: str(p.mpn),
    brand: str(p.manufacturer),
    custom_labels: {},
    // OpenCart nu spune ce face Google cu produsul; aflăm din Merchant Center
    google_status: null,
    source_updated_at: iso(p.date_modified),
    synced_at: syncedAt,
  }]
}

// ── Comenzile ──────────────────────────────────────────────────────────────

/**
 * Starea comenzii. Stările se pot redenumi; OpenCart spune însă care sunt „în
 * procesare" și care „finalizate" (Setări → Opțiuni), iar extensia le trimite.
 * Anulările și rambursările se recunosc după nume (Canceled, Denied, Failed,
 * Expired, Voided, Reversed / Refunded, Chargeback), oricum le-ar marca magazinul.
 */
export function orderState(o: Pick<OcOrder, 'status_id' | 'status'>, statuses: Map<number, OcStatus>): OrderState {
  const s = statuses.get(num(o.status_id))
  const name = normalize(str(o.status) ?? str(s?.name) ?? '')
  // „Canceled Reversal": anularea plății a fost întoarsă, comanda e din nou plătită
  if (/cancel+ed reversal|anulare (stornata|inversata)/.test(name)) return 'confirmed'
  if (/cancel|anulat|denied|refuzat|respins|failed|esuat|expired|expirat|voided|reversed|stornat/.test(name)) return 'cancelled'
  if (/refund|rambursat|chargeback|returnat/.test(name)) return 'refunded'
  if (s?.complete) return 'fulfilled'
  if (s?.processing) return 'confirmed'
  if (/complete|finalizat|livrat|delivered/.test(name)) return 'fulfilled'
  if (/pending|asteptare|in curs/.test(name)) return 'pending'
  return 'confirmed'
}

const sumTotals = (o: OcOrder, code: string) => (o.totals ?? []).filter(t => t.code === code).reduce((s, t) => s + num(t.value), 0)

/** Originea unei adrese (https://domeniu), fără cale și parametri. */
function originOf(value: unknown): string | null {
  const s = str(value)
  if (!s) return null
  try { return new URL(s).origin } catch { return null }
}

/** Sursa salvată de extensie la plasarea comenzii, plus legătura de marketing OpenCart. */
export function attributionOf(o: Pick<OcOrder, 'source' | 'marketing_id' | 'tracking'>) {
  const s = o.source ?? null
  const clean = (v: unknown) => str(v)?.slice(0, 200) ?? null
  const values: Record<string, string | null> = {
    utm_source: clean(s?.utm_source),
    utm_medium: clean(s?.utm_medium),
    utm_campaign: clean(s?.utm_campaign),
    utm_content: clean(s?.utm_content),
    utm_term: clean(s?.utm_term),
    gclid: clean(s?.gclid),
    gbraid: clean(s?.gbraid),
    wbraid: clean(s?.wbraid),
    referrer: originOf(s?.referrer),
    landing_path: clean(s?.landing_path),
  }
  values.source_type = values.utm_source || values.utm_medium || values.utm_campaign ? 'utm'
    : values.gclid || values.gbraid || values.wbraid ? 'click_id'
    : values.referrer ? 'referral' : s ? 'direct' : null
  if (num(o.marketing_id) > 0) values.oc_marketing_id = String(o.marketing_id)
  if (str(o.tracking)) values.oc_tracking = clean(o.tracking)
  const attribution = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as Record<string, string>
  return { values, attribution }
}

/**
 * Sumele comenzii, cu taxe. OpenCart ține prețurile produselor fără taxe, cu
 * taxa pe bucată alături; totalurile (subtotal, transport, cupon, taxe, total)
 * sunt rânduri separate. Produsele: (preț + taxă) × cantitate. Transportul:
 * rândul lui plus taxa care nu e a produselor. Ce lipsește până la total e
 * reducere (cupon, voucher, credit), ce trece de el, taxă suplimentară.
 */
export function orderRow(ctx: Ctx, o: OcOrder, syncedAt: string, statuses: Map<number, OcStatus>): OrderRow | null {
  const placedAt = iso(o.date_added)
  if (!placedAt || !(num(o.status_id) > 0)) return null
  const products = o.products ?? []
  const subtotal = products.reduce((s, p) => s + (num(p.price) + num(p.tax)) * num(p.quantity), 0)
  const productTax = products.reduce((s, p) => s + num(p.tax) * num(p.quantity), 0)
  const tax = sumTotals(o, 'tax')
  const shipping = sumTotals(o, 'shipping') + Math.max(0, tax - productTax)
  const total = num(o.total)
  const rest = round2(total - subtotal - shipping)
  const { values, attribution } = attributionOf(o)
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: String(o.order_id),
    order_number: String(o.order_id),
    placed_at: placedAt,
    source_updated_at: iso(o.date_modified) ?? placedAt,
    status: str(o.status) ?? String(o.status_id),
    state: orderState(o, statuses),
    // OpenCart n-are o stare a plății separată de starea comenzii
    payment_status: null,
    payment_method: str(o.payment_code) ?? str(o.payment_method),
    channel: 'store',
    currency: str(o.currency)?.toUpperCase() ?? ctx.currency,
    subtotal: round2(subtotal),
    shipping: round2(shipping),
    discount: rest < 0 ? -rest : 0,
    fees: rest > 0 ? rest : 0,
    tax: round2(tax),
    total: round2(total),
    discount_code: str(o.coupon),
    // Singura dată a cumpărătorului (extensia nu trimite alta)
    country: str(o.country)?.toUpperCase() ?? null,
    gclid: values.gclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    attribution,
    synced_at: syncedAt,
  }
}

export function lineRows(orderId: string, storeId: string, o: OcOrder, syncedAt: string): LineRow[] {
  return (o.products ?? []).map((p, position) => ({
    order_id: orderId,
    store_id: storeId,
    position,
    external_product_id: num(p.master_id) > 0 ? String(p.master_id) : String(p.product_id),
    offer_id: num(p.product_id) > 0 ? String(p.product_id) : null,
    name: str(p.name) ?? str(p.model) ?? '',
    variant_title: variantOf(p.options),
    quantity: num(p.quantity),
    // Pe bucată, cu taxe (ca prețul ofertei)
    unit_price: round2(num(p.price) + num(p.tax)),
    is_extra: false,
    synced_at: syncedAt,
  }))
}

export function soldProductIds(o: OcOrder): string[] {
  return [...new Set((o.products ?? []).map(p => String(p.product_id)).filter(id => id && id !== '0'))]
}

// ── Magazinul ──────────────────────────────────────────────────────────────

export function statusMap(list: OcStatus[] | null | undefined): Map<number, OcStatus> {
  return new Map((list ?? []).map(s => [num(s.id), s]))
}

/** Ce din datele magazinului intră pe rândul din `stores`. */
export function storeFields(info: OcInfo) {
  const s = info.store
  return {
    fields: {
      store_name: str(s.name),
      currency: str(s.currency)?.toUpperCase() ?? null,
      country: str(s.country)?.toUpperCase() ?? null,
      language: str(s.language)?.toLowerCase().split(/[-_]/)[0] ?? null,
      timezone: str(s.timezone),
    },
    platform_data: {
      opencart_version: str(info.opencart_version),
      extension_version: str(info.extension_version),
      php_version: str(info.php_version),
      prices_include_tax: s.prices_include_tax === true,
      statuses: info.statuses ?? [],
      // Extensiile instalate și pornite: un feed Google sau o etichetă de conversie se văd aici
      feed_extensions: info.extensions?.feed ?? [],
      analytics_extensions: info.extensions?.analytics ?? [],
      module_extensions: info.extensions?.module ?? [],
      tracking: info.tracking ?? null,
    },
  }
}
