import type { EdinioOrder, EdinioProduct, EdinioStore } from './types'

// =============================================
// Edinio → rândurile modelului comun (commerce_*)
// Funcții pure: nu ating baza, ca să poată fi verificate separat.
// =============================================

type Ctx = { storeId: string; userId: string; currency: string }

export type OfferRow = {
  store_id: string; user_id: string; offer_id: string; external_product_id: string
  item_group_id: string | null; title: string; product_name: string; variant_title: string | null
  category: string | null; url: string | null; image_url: string | null
  price: number; compare_at_price: number | null; currency: string; available: boolean; stock: number | null
  sku: string | null; gtin: string | null; mpn: string | null; brand: string | null
  custom_labels: Record<string, string>; google_status: string | null
  source_updated_at: string; synced_at: string
}

/**
 * Ofertele unui produs. Produsul stins sau fără ofertă (prețul din catalog nu e
 * cel plătit) nu dă niciun rând: la sincronizare, ofertele lui vechi se șterg.
 * ⚠ `cost_price` lipsește dinadins: îl scrie omul în Hontrio, iar upsert-ul
 * actualizează doar coloanele trimise, deci nu-l atinge.
 */
export function offerRows(ctx: Ctx, product: EdinioProduct, syncedAt: string): OfferRow[] {
  if (!product.activ) return []
  return product.oferte.map(o => ({
    store_id: ctx.storeId,
    user_id: ctx.userId,
    offer_id: o.id,
    external_product_id: product.id,
    item_group_id: o.grup_id,
    title: o.titlu,
    product_name: product.nume,
    variant_title: o.varianta,
    category: product.categorie,
    url: o.url || null,
    image_url: o.imagine,
    price: o.pret,
    compare_at_price: o.pret_vechi,
    currency: ctx.currency,
    available: o.disponibil,
    stock: o.stoc,
    sku: o.sku,
    gtin: o.gtin,
    mpn: o.mpn,
    brand: o.brand,
    custom_labels: o.etichete || {},
    google_status: o.stare_google,
    source_updated_at: product.actualizat_la,
    synced_at: syncedAt,
  }))
}

export type OrderState = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled' | 'refunded'

/** Starea Edinio spusă la fel pentru toate platformele. Necunoscută = încă deschisă. */
export function orderState(status: string): OrderState {
  switch (status) {
    case 'delivered': return 'fulfilled'
    case 'cancelled': return 'cancelled'
    case 'refunded': return 'refunded'
    case 'confirmed': case 'processing': case 'shipped': return 'confirmed'
    default: return 'pending'
  }
}

export type OrderRow = {
  store_id: string; user_id: string; external_id: string; order_number: string
  placed_at: string; source_updated_at: string; status: string; state: OrderState
  payment_status: string | null; payment_method: string | null; channel: string; currency: string
  subtotal: number; shipping: number; discount: number; fees: number; tax: number; total: number
  discount_code: string | null; country: string | null
  gclid: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  attribution: Record<string, string | boolean>; synced_at: string
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function orderRow(ctx: Ctx, o: EdinioOrder, syncedAt: string): OrderRow {
  const src = o.sursa || {}
  return {
    store_id: ctx.storeId,
    user_id: ctx.userId,
    external_id: o.id,
    order_number: o.numar,
    placed_at: o.creata_la,
    source_updated_at: o.actualizata_la,
    status: o.stare,
    state: orderState(o.stare),
    payment_status: o.stare_plata || null,
    payment_method: o.metoda_plata,
    // Edinio spune „magazin" pentru vitrină; în modelul comun e „store"
    channel: o.canal === 'magazin' ? 'store' : o.canal,
    currency: o.moneda || ctx.currency,
    subtotal: round2(o.subtotal),
    shipping: round2(o.transport),
    discount: round2(o.reducere_cupon + o.reducere_oferte + o.reducere_card + o.reducere_ramburs),
    fees: round2(o.taxa_ramburs),
    tax: round2(o.tva),
    total: round2(o.total),
    discount_code: o.cod_reducere,
    country: o.tara || null,
    gclid: str(src.gclid),
    utm_source: str(src.utm_source),
    utm_medium: str(src.utm_medium),
    utm_campaign: str(src.utm_campaign),
    attribution: src,
    synced_at: syncedAt,
  }
}

export type LineRow = {
  order_id: string; store_id: string; position: number
  external_product_id: string | null; offer_id: string | null
  name: string; variant_title: string | null; quantity: number; unit_price: number
  is_extra: boolean; synced_at: string
}

export type ExistingLine = { order_id: string; position: number; external_product_id: string | null; name: string; offer_id: string | null }

/**
 * Liniile unei comenzi.
 *
 * ⚠ O OFERTĂ ȘTIUTĂ NU SE PIERDE LA O RESINCRONIZARE. Edinio găsește varianta
 * vândută după numele liniei, deci dacă între timp comerciantul redenumește
 * combinația, aceeași linie vine înapoi fără ofertă. Vânzarea a fost totuși a
 * acelei oferte: se păstrează ce știam, cât timp e aceeași linie (aceeași
 * poziție, același produs, același nume).
 */
export function lineRows(orderId: string, storeId: string, o: EdinioOrder, existing: ExistingLine[], syncedAt: string): LineRow[] {
  return o.linii.map((l, position) => {
    const before = existing.find(e => e.order_id === orderId && e.position === position)
    const sameLine = before && before.external_product_id === l.produs_id && before.name === l.nume
    return {
      order_id: orderId,
      store_id: storeId,
      position,
      external_product_id: l.produs_id,
      offer_id: l.oferta_id ?? (sameLine ? before!.offer_id : null),
      name: l.nume,
      variant_title: l.varianta,
      quantity: Number(l.cantitate) || 0,
      unit_price: round2(l.pret),
      is_extra: !!l.extra,
      synced_at: syncedAt,
    }
  })
}

/** Ce din datele magazinului Edinio intră pe rândul din `stores`. */
export function storeFields(s: EdinioStore) {
  return {
    external_id: s.id,
    store_url: s.url,
    store_name: s.nume,
    currency: s.moneda,
    country: s.tara,
    language: s.limba,
    timezone: s.fus_orar,
    platform_data: {
      published: s.publicat,
      prices_include_vat: s.preturi_cu_tva,
      google_merchant: s.google_merchant,
      google_ads: s.google_ads,
      google_analytics: s.google_analytics,
    },
  }
}
