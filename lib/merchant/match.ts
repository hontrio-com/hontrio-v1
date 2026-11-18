import type { McProduct } from '@/lib/merchant/api'

// =============================================
// Potrivirea produselor din Merchant Center cu ofertele magazinului.
// Campaniile exclud produse după ID-ul din Merchant Center, iar eticheta
// Hontrio se pune tot pe el. La Edinio e chiar ID-ul ofertei; la WooCommerce și
// Shopify, aplicațiile de feed îl construiesc altfel:
//   Google for WooCommerce   gla_{id}
//   WooCommerce Product Feed woocommerce_gpf_{id}
//   Google & YouTube         shopify_{ȚARĂ}_{produs}_{variantă}
// Când formatul nu se potrivește, rămân SKU-ul, linkul și GTIN-ul.
// Funcție pură.
// =============================================

export type OfferRef = {
  offer_id: string
  external_product_id: string
  sku: string | null
  gtin: string | null
  url: string | null
}

const lower = (s: string) => s.trim().toLowerCase()

/** Linkul fără protocol, www, parametri și bară finală: aceeași pagină, scrisă oricum. */
export function normalizeLink(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${decodeURIComponent(u.pathname).replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return null
  }
}

function idCandidates(platform: string, o: OfferRef): string[] {
  const ids = [o.offer_id]
  if (platform === 'woocommerce') ids.push(`gla_${o.offer_id}`, `woocommerce_gpf_${o.offer_id}`, `wc_post_id_${o.offer_id}`)
  if (o.sku) ids.push(o.sku)
  return ids.map(lower)
}

/** shopify_RO_123_456 / shopify_123_456 → varianta 456 */
function shopifyVariant(offerId: string): string | null {
  const m = offerId.match(/^shopify_(?:[a-z]{2}_)?\d+_(\d+)$/i)
  return m ? m[1] : null
}

/**
 * Pentru fiecare ofertă, produsul din Merchant Center (cel mult unul). Un produs
 * apare în mai multe feeduri (țară/limbă): se preferă cel cu eticheta dată.
 */
export function matchProducts(platform: string, offers: OfferRef[], products: McProduct[], preferFeedLabel?: string | null): Map<string, McProduct> {
  const prefer = preferFeedLabel ? preferFeedLabel.toUpperCase() : null
  const better = (a: McProduct | undefined, b: McProduct) =>
    !a || (prefer !== null && a.feedLabel?.toUpperCase() !== prefer && b.feedLabel?.toUpperCase() === prefer)

  const byId = new Map<string, McProduct>()
  const byVariant = new Map<string, McProduct>()
  const byLink = new Map<string, McProduct>()
  const byGtin = new Map<string, McProduct>()
  for (const p of products) {
    const id = lower(p.offerId)
    if (better(byId.get(id), p)) byId.set(id, p)
    const variant = shopifyVariant(p.offerId)
    if (variant && better(byVariant.get(variant), p)) byVariant.set(variant, p)
    const link = normalizeLink(p.productAttributes?.link)
    if (link && better(byLink.get(link), p)) byLink.set(link, p)
    for (const g of p.productAttributes?.gtins ?? []) {
      const key = g.replace(/^0+/, '')
      if (key && better(byGtin.get(key), p)) byGtin.set(key, p)
    }
  }

  const out = new Map<string, McProduct>()
  const taken = new Set<string>()
  const take = (offer: OfferRef, p: McProduct | undefined) => {
    if (!p || taken.has(p.name)) return false
    out.set(offer.offer_id, p)
    taken.add(p.name)
    return true
  }

  // Întâi potrivirile sigure (ID), apoi cele după link și GTIN, pe ce a rămas
  for (const o of offers) {
    if (platform === 'shopify' && take(o, byVariant.get(o.offer_id))) continue
    for (const id of idCandidates(platform, o)) if (take(o, byId.get(id))) break
  }
  for (const o of offers) {
    if (out.has(o.offer_id)) continue
    const link = normalizeLink(o.url)
    // Linkul e unic doar pentru produsele simple: variantele împart pagina
    if (link && o.offer_id === o.external_product_id && take(o, byLink.get(link))) continue
    if (o.gtin) take(o, byGtin.get(o.gtin.replace(/^0+/, '')))
  }
  return out
}

export type GoogleStatus = 'active' | 'pending' | 'disapproved'

/** Starea pentru reclamele Shopping în țara campaniei, în vocabularul Hontrio (ca la Edinio). */
export function shoppingStatus(p: McProduct, country: string | null): GoogleStatus | null {
  const d = p.productStatus?.destinationStatuses?.find(s => s.reportingContext === 'SHOPPING_ADS')
  if (!d) return null
  const has = (list?: string[]) => !!list?.length && (country ? list.includes(country.toUpperCase()) : true)
  if (has(d.disapprovedCountries)) return 'disapproved'
  if (has(d.approvedCountries)) return 'active'
  if (has(d.pendingCountries)) return 'pending'
  return null
}

/**
 * Produsele din Merchant Center care nu sunt ale magazinului, dar ar intra în campania principală:
 * aceeași etichetă de feed (campania filtrează după ea) și pot rula în țara campaniei. Un cont
 * Merchant Center vechi sau împărțit (alt site, un feed rămas după mutarea pe altă platformă) le
 * poate avea; fără excludere, campania „toate produsele" le-ar promova și pe ele.
 */
export function foreignItems(products: McProduct[], ownOfferIds: Set<string>, feedLabel: string | null, country: string | null): string[] {
  const label = feedLabel?.trim().toUpperCase() || null
  const out = new Set<string>()
  for (const p of products) {
    if (ownOfferIds.has(p.offerId)) continue
    if (label && (p.feedLabel ?? '').trim().toUpperCase() !== label) continue
    const s = shoppingStatus(p, country)
    if (s === 'active' || s === 'pending') out.add(p.offerId)
  }
  return [...out]
}

export type MerchantIssue = { code: string; severity: string; attribute: string | null; description: string; documentation: string | null }

/** Problemele care opresc sau scad afișarea la Shopping (cel mult 5, cele grave primele). */
export function shoppingIssues(p: McProduct, country: string | null): MerchantIssue[] {
  const rank: Record<string, number> = { DISAPPROVED: 0, DEMOTED: 1, NOT_IMPACTED: 2 }
  return (p.productStatus?.itemLevelIssues ?? [])
    .filter(i => (!i.reportingContext || i.reportingContext === 'SHOPPING_ADS')
      && (!country || !i.applicableCountries?.length || i.applicableCountries.includes(country.toUpperCase()))
      && i.severity !== 'NOT_IMPACTED')
    .sort((a, b) => (rank[a.severity ?? ''] ?? 3) - (rank[b.severity ?? ''] ?? 3))
    .slice(0, 5)
    .map(i => ({
      code: i.code ?? 'unknown',
      severity: i.severity ?? 'UNKNOWN',
      attribute: i.attribute ?? null,
      description: i.description ?? '',
      documentation: i.documentation ?? null,
    }))
}

/** Primul custom_label_N pe care niciun produs al omului nu-l folosește (Hontrio îl poate lua). */
export function freeLabelIndex(products: McProduct[]): number | null {
  for (let i = 0; i <= 4; i++) {
    const key = `customLabel${i}` as const
    if (!products.some(p => (p.productAttributes as Record<string, unknown> | undefined)?.[key])) return i
  }
  return null
}

/** Eticheta de feed și limba cele mai folosite printre produsele potrivite. */
export function dominantFeed(products: McProduct[]): { feedLabel: string | null; contentLanguage: string | null } {
  const count = new Map<string, number>()
  for (const p of products) {
    const k = `${p.feedLabel}|${p.contentLanguage}`
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!top) return { feedLabel: null, contentLanguage: null }
  const [feedLabel, contentLanguage] = top.split('|')
  return { feedLabel: feedLabel || null, contentLanguage: contentLanguage || null }
}
