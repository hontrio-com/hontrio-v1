// =============================================
// Rândurile modelului comun (commerce_*), aceleași pentru toate platformele.
// Fiecare conector are maparea lui; aici e doar forma rândurilor.
// =============================================

export type Ctx = { storeId: string; userId: string; currency: string }

/**
 * ⚠ `cost_price` și `ads_mode` lipsesc dinadins: le scrie omul în Hontrio, iar
 * upsert-ul actualizează doar coloanele trimise, deci sincronizarea nu le atinge.
 */
export type OfferRow = {
  store_id: string; user_id: string; offer_id: string; external_product_id: string
  item_group_id: string | null; title: string; product_name: string; variant_title: string | null
  category: string | null; url: string | null; image_url: string | null
  price: number; compare_at_price: number | null; currency: string; available: boolean; stock: number | null
  sku: string | null; gtin: string | null; mpn: string | null; brand: string | null
  custom_labels: Record<string, string>; google_status: string | null
  source_updated_at: string | null; synced_at: string
}

export type OrderState = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled' | 'refunded'

export type OrderRow = {
  store_id: string; user_id: string; external_id: string; order_number: string
  placed_at: string; source_updated_at: string; status: string; state: OrderState
  payment_status: string | null; payment_method: string | null; channel: string; currency: string
  subtotal: number; shipping: number; discount: number; fees: number; tax: number; total: number
  discount_code: string | null; country: string | null
  gclid: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  attribution: Record<string, string | boolean>; synced_at: string
}

export type LineRow = {
  order_id: string; store_id: string; position: number
  external_product_id: string | null; offer_id: string | null
  name: string; variant_title: string | null; quantity: number; unit_price: number
  is_extra: boolean; synced_at: string
}

export function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
