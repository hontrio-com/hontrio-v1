// =============================================
// MerchantPro — ce citește Hontrio din API-ul REST v2
// (https://docs.merchantpro.com/api/, specificația /swagger.yml), doar câmpurile
// cerute prin `fields`. Prețurile `*_gross` sunt cu TVA. Datele vin ca
// „2024-05-13 09:54:46" (ora magazinului, fără fus). ⚠ Din comenzi se cer
// doar câmpuri fără date personale; din adrese, numai codul țării.
// =============================================

export type MproImage = { thumb?: string | null; medium?: string | null; large?: string | null }

export type MproVariant = {
  id: number | string
  sku?: string | null
  ean?: string | null
  /** on / off */
  inventory_enabled?: string | null
  stock?: number | string | null
  price_gross?: number | string | null
  old_price_gross?: number | string | null
  variant_image?: string | null
  /** visible / discontinued / hidden / bundle_only */
  visibility?: string | null
  in_stock?: boolean | null
  variant_options?: { id?: number; name?: string | null; value?: string | null; option_id?: number }[] | null
}

export type MproProduct = {
  id: number | string
  /** basic / multi_variant / bundle / digital / gift_card */
  type?: string | null
  sku?: string | null
  ean?: string | null
  name?: string | null
  inventory_enabled?: string | null
  stock?: number | string | null
  allow_backorders?: boolean | null
  category_name?: string | null
  manufacturer_name?: string | null
  price_on_request?: boolean | null
  price_gross?: number | string | null
  old_price_gross?: number | string | null
  tax_value?: number | string | null
  url?: string | null
  image_url?: MproImage | string | null
  /** Doar la produsele cu variante; la celelalte vine `{}` sau `[]`. */
  variants?: MproVariant[] | Record<string, MproVariant> | null
  in_stock?: boolean | null
  /** visible / discontinued / hidden / bundle_only */
  visibility?: string | null
  /** active / inactive */
  status?: string | null
  date_modified?: string | null
}

export type MproLineItem = {
  /** product / coupon / discount / promo_cart / promo_product / promo / shipping */
  item_type?: string | null
  product_id?: number | string | null
  variant_id?: number | string | null
  variant_name?: string | null
  variant_options?: { name?: string | null; value?: string | null }[] | null
  product_sku?: string | null
  product_name?: string | null
  quantity?: number | string | null
  unit_price_gross?: number | string | null
  line_subtotal_gross?: number | string | null
}

export type MproOrder = {
  id: number | string
  /** temporary / awaiting / partially_paid / paid / failed / cancelled / refunded / rejected */
  payment_status?: string | null
  /** temporary / awaiting / confirmed / in_process / shipped / delivered / returned / cancelled */
  shipping_status?: string | null
  /** online_card / wire / cash_delivery / voucher */
  payment_method_code?: string | null
  billing_country_code?: string | null
  shipping_country_code?: string | null
  line_items?: MproLineItem[] | null
  /** api / app / user / shop / system */
  created_by?: string | null
  /** desktop / mobile / tablet */
  customer_device?: string | null
  /** Sursa vizitei (UTM-uri); structura nu e descrisă în documentație */
  traffic_source?: Record<string, unknown> | null
  source_referrer?: string | null
  source_type?: string | null
  /** Produsele, cu TVA, fără transport */
  subtotal_including_tax?: number | string | null
  tax_amount?: number | string | null
  /** Transportul, cu TVA (în exemplul API: subtotal + transport = total) */
  shipping_amount?: number | string | null
  shipping_tax_amount?: number | string | null
  total_amount?: number | string | null
  currency?: string | null
  coupon_code?: string | null
  channel_name?: string | null
  date_created?: string | null
  date_modified?: string | null
}

export type MproList<T> = {
  data?: T[] | null
  meta?: {
    count?: { total?: number; current?: number; start?: number; limit?: number }
    links?: { prev?: string | null; current?: string | null; next?: string | null }
  }
}

export type MproErrorBody = { error?: { name?: string; message?: string; details?: { retry_after?: number } } }
