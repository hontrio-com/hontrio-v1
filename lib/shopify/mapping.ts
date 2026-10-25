import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import { API_VERSION } from './api'
import type { MoneyBag, ShopifyOrder, ShopifyProductRef, ShopifyShop, ShopifyVariant, ShopifyVisit } from './types'

// =============================================
// Shopify → rândurile modelului comun (commerce_*)
// Oferta = varianta (și produsele fără variante au una, „Default Title").
// Sumele sunt în moneda magazinului, pe baza prețului din catalog: cu taxe
// dacă prețurile le includ. Din comenzi se păstrează doar țara cumpărătorului.
// =============================================

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const money = (m: MoneyBag | null | undefined) => num(m?.shopMoney?.amount)

const DEFAULT_TITLE = 'Default Title'

/** Produsul ajunge în reclame: activ, publicat în magazinul online, nu card cadou. */
export function isListed(p: Pick<ShopifyProductRef, 'status' | 'onlineStoreUrl' | 'isGiftCard'>): boolean {
  return p.status === 'ACTIVE' && !!p.onlineStoreUrl && !p.isGiftCard
}

function gtinOf(barcode: string | null): string | null {
  const v = str(barcode)
  return v && /^\d{8,14}$/.test(v) ? v : null
}

const imageOf = (m: { preview?: { image?: { url: string } | null } | null } | null | undefined) => m?.preview?.image?.url ?? null

/** Varianta ca ofertă; null dacă nu se poate vinde prin reclame (produs nelistat, fără preț). */
export function offerRow(ctx: Ctx, v: ShopifyVariant, syncedAt: string): OfferRow | null {
  const p = v.product
  if (!isListed(p)) return null
  const price = num(v.price)
  if (!(price > 0)) return null
  const variant = p.hasOnlyDefaultVariant || v.title === DEFAULT_TITLE ? null
    : (v.selectedOptions ?? []).map(o => str(o.value)).filter(Boolean).join(' / ') || str(v.title)
  const compareAt = num(v.compareAtPrice)
  const updated = [v.updatedAt, p.updatedAt].filter(Boolean).sort().pop() ?? null
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    offer_id: v.legacyResourceId,
    external_product_id: p.legacyResourceId,
    item_group_id: p.hasOnlyDefaultVariant ? null : p.legacyResourceId,
    title: variant ? `${p.title} - ${variant}` : p.title,
    product_name: p.title,
    variant_title: variant,
    // Tipul pus de comerciant spune mai mult decât categoria generală din taxonomie
    category: str(p.productType) ?? str(p.category?.name),
    url: p.hasOnlyDefaultVariant ? p.onlineStoreUrl : `${p.onlineStoreUrl}?variant=${v.legacyResourceId}`,
    image_url: imageOf(v.media?.nodes?.[0]) ?? imageOf(p.featuredMedia),
    price,
    compare_at_price: compareAt > price ? compareAt : null,
    currency: ctx.currency,
    available: v.availableForSale,
    // Fără urmărirea stocului, cantitatea nu înseamnă nimic
    stock: v.inventoryItem?.tracked ? v.inventoryQuantity : null,
    sku: str(v.sku),
    gtin: gtinOf(v.barcode),
    mpn: null,
    // La Shopify, „vendor" e marca (în feedul Google la fel)
    brand: str(p.vendor),
    custom_labels: {},
    // Shopify nu știe ce face Google cu oferta; o aflăm din Merchant Center
    google_status: null,
    source_updated_at: updated,
    synced_at: syncedAt,
  }
}

/**
 * Costul ofertei din „Cost per item", adus pe baza prețului: `multiplier`
 * adaugă TVA-ul când prețurile îl includ (costul din Shopify e cel contabil).
 */
export function costRow(v: ShopifyVariant, multiplier: number): { offer_id: string; cost: number } | null {
  if (!isListed(v.product)) return null
  const cost = num(v.inventoryItem?.unitCost?.amount)
  return cost > 0 ? { offer_id: v.legacyResourceId, cost: round2(cost * multiplier) } : null
}

// ── Comenzile ──────────────────────────────────────────────────────────────

export function orderState(o: Pick<ShopifyOrder, 'cancelledAt' | 'displayFinancialStatus' | 'displayFulfillmentStatus'>): OrderState {
  if (o.cancelledAt) return 'cancelled'
  const financial = (o.displayFinancialStatus ?? '').toUpperCase()
  if (financial === 'REFUNDED') return 'refunded'
  if (financial === 'VOIDED' || financial === 'EXPIRED') return 'cancelled'
  if (o.displayFulfillmentStatus === 'FULFILLED') return 'fulfilled'
  // Ramburs: plata vine la livrare, comanda e totuși vie
  if (financial === 'PENDING') return 'pending'
  return 'confirmed'
}

/** Vânzările de pe site sunt „store"; casa de marcat și celelalte canale (aplicații), nu. */
function channelOf(sourceName: string | null): string {
  const v = (sourceName ?? '').toLowerCase()
  // Comenzile puse de personal (ciornă, aplicația de mobil) sunt tot ale magazinului
  if (['', 'web', 'shopify_draft_order', 'iphone', 'android'].includes(v)) return 'store'
  return v === 'pos' ? 'pos' : v
}

/** O vizită cu sursă (reclamă, campanie, alt site), nu intrare directă. */
function hasSource(v: ShopifyVisit | null): v is ShopifyVisit {
  if (!v) return false
  if (v.referrerUrl || v.utmParameters?.source) return true
  try {
    const params = v.landingPage ? new URL(v.landingPage).searchParams : null
    return !!params && ['gclid', 'gbraid', 'wbraid', 'utm_source'].some(k => params.has(k))
  } catch {
    return false
  }
}

/**
 * Atribuirea comenzii, din drumul clientului. Ca Google Ads, se ia ultima
 * vizită cu sursă: o întoarcere directă nu șterge clicul pe reclamă.
 * Se păstrează doar ce trebuie pentru reclame: originea, pagina de intrare
 * (fără parametri), UTM-urile și id-urile de clic.
 */
export function attributionOf(journey: ShopifyOrder['customerJourneySummary']) {
  const visits = [journey?.lastVisit ?? null, journey?.firstVisit ?? null]
  const visit = visits.find(hasSource) ?? visits.find(Boolean) ?? null
  let landing: URL | null = null
  try { landing = visit?.landingPage ? new URL(visit.landingPage) : null } catch { landing = null }
  const param = (k: string) => str(landing?.searchParams.get(k))
  const utm = (k: 'source' | 'medium' | 'campaign' | 'content' | 'term') => str(visit?.utmParameters?.[k]) ?? param(`utm_${k}`)
  let referrer: string | null = null
  try { referrer = visit?.referrerUrl ? new URL(visit.referrerUrl).origin : null } catch { referrer = null }

  const values: Record<string, string | null> = {
    source_type: str(visit?.source),
    referrer,
    landing_path: landing?.pathname ?? null,
    utm_source: utm('source'),
    utm_medium: utm('medium'),
    utm_campaign: utm('campaign'),
    utm_content: utm('content'),
    utm_term: utm('term'),
    gclid: param('gclid'),
    gbraid: param('gbraid'),
    wbraid: param('wbraid'),
  }
  const attribution = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as Record<string, string>
  return { values, attribution }
}

/** Comanda ca rând; null pentru comenzile de test. */
export function orderRow(ctx: Ctx, o: ShopifyOrder, syncedAt: string): OrderRow | null {
  if (o.test) return null
  const lines = o.lineItems?.nodes ?? []
  const total = money(o.totalPriceSet)
  const tax = money(o.totalTaxSet)
  const shipping = money(o.totalShippingPriceSet)
  const discount = money(o.totalDiscountsSet)
  // Liniile prea multe pentru o pagină: suma produselor vine din totaluri
  const subtotal = o.lineItems?.pageInfo?.hasNextPage
    ? total - shipping + discount - (o.taxesIncluded ? 0 : tax)
    : lines.reduce((s, l) => s + money(l.originalUnitPriceSet) * num(l.quantity), 0)
  const financial = (o.displayFinancialStatus ?? 'PENDING').toLowerCase()
  const { values, attribution } = attributionOf(o.customerJourneySummary)
  const codes = (o.discountCodes ?? []).map(c => str(c)).filter(Boolean)
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: o.legacyResourceId,
    order_number: str(o.name)?.replace(/^#/, '') ?? o.legacyResourceId,
    placed_at: new Date(o.createdAt).toISOString(),
    source_updated_at: new Date(o.updatedAt || o.createdAt).toISOString(),
    status: o.cancelledAt ? 'cancelled' : `${financial}/${(o.displayFulfillmentStatus ?? '').toLowerCase()}`,
    state: orderState(o),
    payment_status: financial,
    payment_method: str(o.paymentGatewayNames?.[0]),
    channel: channelOf(o.sourceName),
    currency: o.currencyCode || ctx.currency,
    subtotal: round2(subtotal),
    shipping: round2(shipping),
    discount: round2(discount),
    fees: 0,
    tax: round2(tax),
    total: round2(total),
    discount_code: codes.length ? codes.join(', ') : null,
    // Singura dată a cumpărătorului care se păstrează. Adresa necerută (Shopify n-a dat
    // acces) lasă neatinsă țara aflată înainte
    ...(o.shippingAddress === undefined && o.billingAddress === undefined ? {}
      : { country: str(o.shippingAddress?.countryCodeV2) ?? str(o.billingAddress?.countryCodeV2) }),
    gclid: values.gclid,
    utm_source: values.utm_source,
    utm_medium: values.utm_medium,
    utm_campaign: values.utm_campaign,
    attribution,
    synced_at: syncedAt,
  }
}

/** Liniile comenzii; prețul pe bucată e cel de dinaintea reducerilor. */
export function lineRows(orderId: string, storeId: string, o: ShopifyOrder, syncedAt: string): LineRow[] {
  return (o.lineItems?.nodes ?? []).map((l, position) => ({
    order_id: orderId,
    store_id: storeId,
    position,
    external_product_id: l.product?.legacyResourceId ?? null,
    offer_id: l.variant?.legacyResourceId ?? null,
    name: l.name,
    variant_title: str(l.variantTitle) === DEFAULT_TITLE ? null : str(l.variantTitle),
    quantity: num(l.quantity),
    unit_price: round2(money(l.originalUnitPriceSet)),
    is_extra: false,
    synced_at: syncedAt,
  }))
}

// ── Magazinul ──────────────────────────────────────────────────────────────

export type ShopifyStoreInfo = { shop: ShopifyShop; scopes: string[] | null; locale: string | null }

/** Ce din datele magazinului Shopify intră pe rândul din `stores`. */
export function storeFields(info: ShopifyStoreInfo) {
  return {
    store_name: str(info.shop.name),
    currency: str(info.shop.currencyCode),
    country: str(info.shop.billingAddress?.countryCodeV2),
    language: info.locale ? info.locale.split(/[_-]/)[0].toLowerCase() : null,
    timezone: str(info.shop.ianaTimezone) ?? 'UTC',
    platform_data: {
      api_version: API_VERSION,
      prices_include_vat: info.shop.taxesIncluded,
      // Fără `read_all_orders`, Shopify dă doar comenzile din ultimele 60 de zile
      all_orders: info.scopes ? info.scopes.includes('read_all_orders') : null,
      scopes: info.scopes,
    },
  }
}
