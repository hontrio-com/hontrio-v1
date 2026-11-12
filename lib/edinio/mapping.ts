import { round2, str, type Ctx, type LineRow, type OfferRow, type OrderRow, type OrderState } from '@/lib/commerce/rows'
import type { EdinioOrder, EdinioProduct, EdinioStore } from './types'

// =============================================
// Edinio → rândurile modelului comun (commerce_*)
// Funcții pure: nu ating baza, ca să poată fi verificate separat.
// =============================================

/**
 * Ofertele unui produs. Produsul stins sau fără ofertă (prețul din catalog nu e
 * cel plătit) nu dă niciun rând: la sincronizare, ofertele lui vechi se șterg.
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

// Din sursa comenzii se păstrează doar ce trebuie reclamelor. Acordul de marketing al
// cumpărătorului (consimtamant_marketing) și orice alt câmp nou de la Edinio rămân acolo.
const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'captured_at'] as const

/** Lista albă a sursei: UTM-urile, id-urile de clic, pagina de intrare (fără parametri) și originea. */
export function attributionOf(src: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!src) return out
  for (const k of SOURCE_KEYS) {
    const v = str(src[k])
    if (v) out[k] = v.slice(0, 300)
  }
  const landing = str(src.landing)
  if (landing) {
    try { out.landing_path = new URL(landing, 'https://magazin.invalid').pathname.slice(0, 300) } catch { /* adresă stricată: o lăsăm */ }
  }
  const referrer = str(src.referrer)
  if (referrer) {
    try { out.referrer = new URL(referrer).origin } catch { /* adresă stricată: o lăsăm */ }
  }
  return out
}

export function orderRow(ctx: Ctx, o: EdinioOrder, syncedAt: string): OrderRow {
  const src = attributionOf(o.sursa)
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
