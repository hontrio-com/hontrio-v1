// =============================================
// WooCommerce — ce citește Hontrio din API-ul REST (wc/v3), doar câmpurile
// folosite. ⚠ Comenzile vin cu datele cumpărătorului (nume, email, adrese):
// tipul le lasă dinadins pe dinafară, iar maparea păstrează doar țara.
// =============================================

export type WooMeta = { key: string; value: unknown; display_key?: string; display_value?: unknown }

export type WooProduct = {
  id: number
  name: string
  permalink: string
  /** simple | variable | grouped | external, plus tipurile pluginurilor (subscription...) */
  type: string
  /** publish | draft | pending | private */
  status: string
  /** visible | catalog | search | hidden */
  catalog_visibility: string
  sku: string
  price: string
  regular_price: string
  on_sale: boolean
  purchasable: boolean
  manage_stock: boolean
  stock_quantity: number | null
  /** instock | outofstock | onbackorder */
  stock_status: string
  date_modified_gmt: string | null
  categories?: { name: string }[]
  images?: { src: string }[]
  attributes?: { name: string; options?: string[] }[]
  /** Mărcile din WooCommerce (9.6+) */
  brands?: { name: string }[]
  /** GTIN / UPC / EAN / ISBN (WooCommerce 9.2+) */
  global_unique_id?: string
  meta_data?: WooMeta[]
}

export type WooVariation = {
  id: number
  permalink: string
  sku: string
  price: string
  regular_price: string
  on_sale: boolean
  /** publish = activă, private = dezactivată */
  status: string
  purchasable: boolean
  /** 'parent' = stocul e al produsului */
  manage_stock: boolean | 'parent'
  stock_quantity: number | null
  stock_status: string
  date_modified_gmt: string | null
  image?: { src: string } | null
  attributes?: { name: string; option: string }[]
  global_unique_id?: string
  meta_data?: WooMeta[]
}

export type WooLineItem = {
  name: string
  product_id: number
  variation_id: number
  quantity: number
  /** Înainte de reduceri, fără taxe */
  subtotal: string
  subtotal_tax: string
  meta_data?: WooMeta[]
}

export type WooOrder = {
  id: number
  number: string
  status: string
  currency: string
  /** checkout | store-api | admin | rest-api | pos-rest-api | ... */
  created_via: string
  date_created_gmt: string
  date_modified_gmt: string | null
  date_paid_gmt: string | null
  /** Prețurile comenzii au fost scrise cu taxe incluse */
  prices_include_tax: boolean
  discount_total: string
  discount_tax: string
  shipping_total: string
  shipping_tax: string
  total: string
  total_tax: string
  payment_method: string
  billing?: { country?: string }
  shipping?: { country?: string }
  line_items: WooLineItem[]
  fee_lines?: { total: string; total_tax: string }[]
  coupon_lines?: { code: string }[]
  meta_data?: WooMeta[]
}

export type WooSiteInfo = { name?: string; timezone_string?: string }

export type WooSystemStatus = {
  environment?: { version?: string; wp_version?: string; language?: string }
  active_plugins?: { plugin: string; name?: string; version?: string }[]
}

export type WooSetting = { id: string; value: unknown }

/** Legătura Google for WooCommerce cu Merchant Center sau cu Google Ads. */
export type GlaConnection = { connected: boolean; account_id: string | null }
