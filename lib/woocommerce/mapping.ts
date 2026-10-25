import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import type { GlaConnection, WooCogs, WooMeta, WooOrder, WooProduct, WooSetting, WooSiteInfo, WooSystemStatus, WooVariation } from './types'

// =============================================
// WooCommerce → rândurile modelului comun (commerce_*)
// Funcții pure: nu ating baza, ca să poată fi verificate separat.
//
// Oferta = produsul simplu sau variația (ca în Merchant Center); id-ul ei e
// id-ul WooCommerce, stabil oricare ar fi pluginul de feed.
// =============================================

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Datele „_gmt" vin fără fus orar: le facem ISO în UTC. */
export function gmt(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function metaValue(list: WooMeta[] | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const v = list?.find(m => m.key === key)?.value
    const s = str(typeof v === 'number' ? String(v) : v)
    if (s) return s
  }
  return null
}

// Unde țin pluginurile codurile produsului, când WooCommerce (9.2+) nu are GTIN-ul lui
const GTIN_KEYS = ['_global_unique_id', 'hwp_product_gtin', 'hwp_var_gtin', '_wpm_gtin_code', '_wpm_gtin_code_variable', '_alg_ean', '_ean', 'ean', '_gtin', 'gtin', '_barcode', 'barcode']
const MPN_KEYS = ['_mpn', 'mpn', '_wpm_mpn', 'hwp_product_mpn']
const BRAND_KEYS = ['_brand', 'brand', '_wpm_brand']
const BRAND_ATTRIBUTE = /^(brand|marc[aă]|produc[aă]tor|manufacturer)$/i

function gtinOf(x: { global_unique_id?: string; meta_data?: WooMeta[] }): string | null {
  const v = str(x.global_unique_id) ?? metaValue(x.meta_data, GTIN_KEYS)
  return v && /^\d{8,14}$/.test(v) ? v : null
}

function availableOf(x: { purchasable: boolean; stock_status: string }): boolean {
  // Pe comandă (onbackorder) se poate cumpăra
  return x.purchasable !== false && x.stock_status !== 'outofstock'
}

function compareAtOf(x: { on_sale: boolean; price: string; regular_price: string }): number | null {
  return x.on_sale && num(x.regular_price) > num(x.price) ? num(x.regular_price) : null
}

export function isVariable(p: Pick<WooProduct, 'type'>): boolean {
  return p.type === 'variable' || p.type === 'variable-subscription'
}

/** Produsul ajunge în reclame: publicat, vizibil, vândut chiar în magazin (nu grupat, nu extern). */
export function isListed(p: Pick<WooProduct, 'type' | 'catalog_visibility'> & { status?: string }): boolean {
  return (p.status ?? 'publish') === 'publish' && p.catalog_visibility !== 'hidden' && p.type !== 'grouped' && p.type !== 'external'
}

/**
 * Ofertele unui produs: el însuși dacă e simplu, variațiile active dacă e
 * variabil. Fără preț nu e nicio ofertă: nu se poate vinde, nici trimite la Google.
 */
export function offerRows(ctx: Ctx, p: WooProduct, variations: WooVariation[], syncedAt: string): OfferRow[] {
  if (!isListed(p)) return []
  const base = {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_product_id: String(p.id),
    product_name: p.name,
    category: p.categories?.[0]?.name ?? null,
    currency: ctx.currency,
    brand: str(p.brands?.[0]?.name) ?? metaValue(p.meta_data, BRAND_KEYS)
      ?? str(p.attributes?.find(a => BRAND_ATTRIBUTE.test(a.name))?.options?.[0]),
    custom_labels: {},
    // WooCommerce nu știe ce face Google cu oferta; o aflăm din Merchant Center
    google_status: null,
    synced_at: syncedAt,
  }
  const mpn = metaValue(p.meta_data, MPN_KEYS)

  if (!isVariable(p)) {
    const price = num(p.price)
    if (!(price > 0)) return []
    return [{
      ...base,
      offer_id: String(p.id),
      item_group_id: null,
      title: p.name,
      variant_title: null,
      url: str(p.permalink),
      image_url: p.images?.[0]?.src ?? null,
      price,
      compare_at_price: compareAtOf(p),
      available: availableOf(p),
      stock: p.manage_stock ? p.stock_quantity : null,
      sku: str(p.sku),
      gtin: gtinOf(p),
      mpn,
      source_updated_at: gmt(p.date_modified_gmt),
    }]
  }

  return variations.flatMap(v => {
    const price = num(v.price)
    // O variație dezactivată are starea „private"
    if (v.status !== 'publish' || !(price > 0)) return []
    const variant = (v.attributes ?? []).map(a => a.option).filter(Boolean).join(' / ') || null
    const stock = v.manage_stock === true ? v.stock_quantity
      : v.manage_stock === 'parent' && p.manage_stock ? p.stock_quantity : null
    return [{
      ...base,
      offer_id: String(v.id),
      item_group_id: String(p.id),
      title: variant ? `${p.name} - ${variant}` : p.name,
      variant_title: variant,
      url: str(v.permalink) ?? str(p.permalink),
      image_url: v.image?.src ?? p.images?.[0]?.src ?? null,
      price,
      compare_at_price: compareAtOf(v),
      available: availableOf(v),
      stock,
      sku: str(v.sku) ?? str(p.sku),
      // Codul de bare e al variației: al produsului ar fi același pentru toate
      gtin: gtinOf(v),
      mpn: metaValue(v.meta_data, MPN_KEYS) ?? mpn,
      source_updated_at: gmt(v.date_modified_gmt) ?? gmt(p.date_modified_gmt),
    }]
  })
}

/** Costul din „Cost of Goods Sold": totalul efectiv, altfel suma valorilor scrise. */
export function cogsOf(x: { cost_of_goods_sold?: WooCogs }): number | null {
  const c = x.cost_of_goods_sold
  if (!c) return null
  const total = num(c.total_value)
  const sum = (c.values ?? []).reduce((s, v) => s + num(v.defined_value), 0)
  const cost = total > 0 ? total : sum
  return cost > 0 ? cost : null
}

/**
 * Costurile ofertelor unui produs, din WooCommerce, aduse pe baza prețului:
 * `multiplier` adaugă TVA-ul când prețurile îl includ (costul din WooCommerce e
 * contabil, fără TVA). Costul produsului variabil e cel implicit al variațiilor
 * care nu au unul al lor. Sincronizarea le scrie doar unde omul n-a pus el costul.
 */
export function costRows(p: WooProduct, variations: WooVariation[], multiplier: number): { offer_id: string; cost: number }[] {
  if (!isListed(p)) return []
  const own = cogsOf(p)
  const sources: { id: number; cost: number | null }[] = isVariable(p)
    ? variations.filter(v => v.status === 'publish').map(v => ({ id: v.id, cost: cogsOf(v) ?? own }))
    : [{ id: p.id, cost: own }]
  return sources.flatMap(x => (x.cost ? [{ offer_id: String(x.id), cost: round2(x.cost * multiplier) }] : []))
}

// ── Comenzile ──────────────────────────────────────────────────────────────

/** Nu sunt comenzi: ciorne de checkout și coșul de gunoi. */
const NOT_ORDERS = ['checkout-draft', 'auto-draft', 'trash']

export function orderState(status: string): OrderState {
  switch (status) {
    case 'completed': return 'fulfilled'
    case 'processing': return 'confirmed'
    case 'pending': case 'on-hold': return 'pending'
    case 'cancelled': case 'failed': return 'cancelled'
    case 'refunded': return 'refunded'
    // Stările adăugate de pluginuri (expediată, livrată...) sunt comenzi vii
    default: return 'confirmed'
  }
}

/** Vânzările de pe site sunt „store"; casa de marcat (POS) și importurile din alte canale, nu. */
function channelOf(createdVia: string | null | undefined): string {
  const v = (createdVia ?? '').toLowerCase()
  if (['', 'checkout', 'store-api', 'admin', 'rest-api'].includes(v)) return 'store'
  return v.startsWith('pos') ? 'pos' : v
}

const ATTR = '_wc_order_attribution_'

/**
 * Atribuirea comenzii (WooCommerce 8.5+). Se păstrează doar ce trebuie pentru
 * reclame: tipul sursei, originea paginii de proveniență, UTM-urile campaniilor
 * și id-urile de clic. Fără user agent, fără adrese întregi.
 *
 * ⚠ WooCommerce completează UTM-urile și pentru trafic organic sau direct
 * (sursa „google", mediul „organic"). Ca UTM-uri reale intră doar la tipul „utm";
 * altfel, căutarea Google devine origine, ca să fie numărată ca organică.
 */
export function attributionOf(meta: WooMeta[] | undefined) {
  const get = (k: string) => str(meta?.find(m => m.key === ATTR + k)?.value)
  const type = get('source_type')
  let landing: URL | null = null
  try { landing = get('session_entry') ? new URL(get('session_entry')!) : null } catch { landing = null }
  const param = (k: string) => str(landing?.searchParams.get(k))
  const isUtm = type === 'utm'
  const utm = (k: string) => (isUtm ? get(`utm_${k}`) : null) ?? param(`utm_${k}`)

  let referrer: string | null = null
  try { referrer = get('referrer') ? new URL(get('referrer')!).origin : null } catch { referrer = null }
  if (!referrer && type === 'organic' && get('utm_source')) referrer = `https://www.${get('utm_source')}.com`

  const values: Record<string, string | null> = {
    source_type: type,
    referrer,
    landing_path: landing?.pathname ?? null,
    utm_source: utm('source'),
    utm_medium: utm('medium'),
    utm_campaign: utm('campaign'),
    utm_content: utm('content'),
    utm_term: utm('term'),
    gclid: param('gclid') ?? metaValue(meta, ['_gclid', 'gclid']),
    gbraid: param('gbraid'),
    wbraid: param('wbraid'),
    device_type: get('device_type'),
  }
  const attribution = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as Record<string, string>
  return { values, attribution }
}

/**
 * Sumele comenzii, pe aceeași bază ca prețul din catalog: cu taxe dacă prețurile
 * au fost scrise cu taxe, fără dacă nu. Așa se potrivesc cu prețul de cost.
 */
export function orderRow(ctx: Ctx, o: WooOrder, syncedAt: string): OrderRow | null {
  if (NOT_ORDERS.includes(o.status)) return null
  const placedAt = gmt(o.date_created_gmt)
  if (!placedAt) return null
  const incl = !!o.prices_include_tax
  const subtotal = (o.line_items ?? []).reduce((s, l) => s + num(l.subtotal) + (incl ? num(l.subtotal_tax) : 0), 0)
  const fees = (o.fee_lines ?? []).reduce((s, f) => s + num(f.total) + num(f.total_tax), 0)
  const { values, attribution } = attributionOf(o.meta_data)
  const codes = (o.coupon_lines ?? []).map(c => str(c.code)).filter(Boolean)
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: String(o.id),
    order_number: String(o.number || o.id),
    placed_at: placedAt,
    source_updated_at: gmt(o.date_modified_gmt) ?? placedAt,
    status: o.status,
    state: orderState(o.status),
    payment_status: o.status === 'refunded' ? 'refunded' : o.date_paid_gmt ? 'paid' : 'unpaid',
    payment_method: str(o.payment_method),
    channel: channelOf(o.created_via),
    currency: o.currency || ctx.currency,
    subtotal: round2(subtotal),
    shipping: round2(num(o.shipping_total) + num(o.shipping_tax)),
    discount: round2(num(o.discount_total) + (incl ? num(o.discount_tax) : 0)),
    fees: round2(fees),
    tax: round2(num(o.total_tax)),
    total: round2(num(o.total)),
    discount_code: codes.length ? codes.join(', ') : null,
    // Singura dată a cumpărătorului care se păstrează
    country: str(o.billing?.country) ?? str(o.shipping?.country),
    gclid: values.gclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    attribution,
    synced_at: syncedAt,
  }
}

/** Liniile comenzii; prețul pe bucată e cel de dinaintea reducerilor pe comandă. */
export function lineRows(orderId: string, storeId: string, o: WooOrder, syncedAt: string): LineRow[] {
  const incl = !!o.prices_include_tax
  return (o.line_items ?? []).map((l, position) => {
    const quantity = num(l.quantity)
    const value = num(l.subtotal) + (incl ? num(l.subtotal_tax) : 0)
    const offer = l.variation_id || l.product_id
    // Atributele variației vândute, cum le arată WooCommerce pe comandă
    const variant = (l.meta_data ?? [])
      .filter(m => !m.key.startsWith('_') && (typeof m.display_value === 'string' || typeof m.value === 'string'))
      .map(m => str(m.display_value) ?? str(m.value))
      .filter(Boolean).join(' / ')
    return {
      order_id: orderId,
      store_id: storeId,
      position,
      external_product_id: l.product_id ? String(l.product_id) : null,
      offer_id: offer ? String(offer) : null,
      name: l.name,
      variant_title: l.variation_id && variant ? variant : null,
      quantity,
      unit_price: quantity > 0 ? round2(value / quantity) : 0,
      is_extra: false,
      synced_at: syncedAt,
    }
  })
}

// ── Magazinul ──────────────────────────────────────────────────────────────

/** Pluginuri care trimit catalogul la Google Merchant Center. */
export const FEED_PLUGINS: Record<string, string> = {
  'google-listings-and-ads': 'Google for WooCommerce',
  'woo-product-feed-pro': 'Product Feed PRO',
  'woo-product-feed-elite': 'Product Feed Elite',
  'webappick-product-feed-for-woocommerce': 'CTX Feed',
  'webappick-product-feed-for-woocommerce-pro': 'CTX Feed Pro',
  'woocommerce-product-feeds': 'WooCommerce Google Product Feed',
  'enhanced-e-commerce-for-woocommerce-store': 'Conversios',
}

/** Pluginuri care pot trimite conversia de cumpărare la Google Ads. */
export const TRACKING_PLUGINS: Record<string, string> = {
  'google-listings-and-ads': 'Google for WooCommerce',
  'woocommerce-google-adwords-conversion-tracking-tag': 'Pixel Manager for WooCommerce',
  'pixel-manager-pro-for-woocommerce': 'Pixel Manager Pro',
  'duracelltomi-google-tag-manager': 'GTM4WP',
  'google-site-kit': 'Site Kit by Google',
  'pixelyoursite': 'PixelYourSite',
  'pixelyoursite-pro': 'PixelYourSite Pro',
  'enhanced-e-commerce-for-woocommerce-store': 'Conversios',
}

// Fusul orar când WordPress are doar o diferență față de UTC, nu un oraș
const TIMEZONES: Record<string, string> = {
  RO: 'Europe/Bucharest', MD: 'Europe/Chisinau', BG: 'Europe/Sofia', HU: 'Europe/Budapest', DE: 'Europe/Berlin',
  AT: 'Europe/Vienna', IT: 'Europe/Rome', FR: 'Europe/Paris', ES: 'Europe/Madrid', PL: 'Europe/Warsaw', GB: 'Europe/London',
}

export type WooStoreInfo = {
  site: WooSiteInfo
  status: WooSystemStatus | null
  general: WooSetting[]
  tax: WooSetting[]
  /** Câte cote de TVA are magazinul; null = n-am putut afla. */
  taxRates?: number | null
  gla: { merchant: GlaConnection | null; ads: GlaConnection | null } | null
}

/** Ce din datele magazinului WooCommerce intră pe rândul din `stores`. */
export function storeFields(info: WooStoreInfo) {
  const setting = (list: WooSetting[], id: string) => list.find(s => s.id === id)?.value
  const country = str(String(setting(info.general, 'woocommerce_default_country') ?? '').split(':')[0])
  // Taxele „pornite" dar fără nicio cotă nu adaugă nimic la plată: e ca și cum ar fi oprite
  const calcTaxes = setting(info.general, 'woocommerce_calc_taxes') === 'yes' && info.taxRates !== 0
  const slugs = (info.status?.active_plugins ?? []).map(p => p.plugin.split('/')[0])
  const wpLanguage = str(info.status?.environment?.language)
  return {
    store_name: str(info.site.name),
    currency: str(setting(info.general, 'woocommerce_currency')),
    country,
    language: wpLanguage ? wpLanguage.split(/[_-]/)[0].toLowerCase() : null,
    timezone: str(info.site.timezone_string) ?? (country && TIMEZONES[country]) ?? 'UTC',
    platform_data: {
      wc_version: str(info.status?.environment?.version),
      wp_version: str(info.status?.environment?.wp_version),
      calc_taxes: calcTaxes,
      tax_rates: info.taxRates ?? null,
      // Fără taxe calculate, comenzile n-au TVA: cota se presupune după țară
      prices_include_vat: calcTaxes ? setting(info.tax, 'woocommerce_prices_include_tax') === 'yes' : null,
      // Null = n-am putut citi pluginurile (cheia nu vede starea sistemului)
      feed_plugins: info.status ? slugs.filter(s => FEED_PLUGINS[s]) : null,
      tracking_plugins: info.status ? slugs.filter(s => TRACKING_PLUGINS[s]) : null,
      google_for_woocommerce: info.gla,
    },
  }
}
