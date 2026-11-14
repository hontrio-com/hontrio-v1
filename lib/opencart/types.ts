// =============================================
// OpenCart — ce întoarce extensia Hontrio pentru OpenCart (contractul v1,
// docs/integrari/OPENCART.md). Sumele sunt în moneda implicită a magazinului,
// datele sunt ISO 8601 cu fus orar. Comenzile nu au nicio dată personală a
// cumpărătorului: extensia trimite doar țara (cod ISO).
// =============================================

export type OcMeta = { page: number; limit: number; total: number; pages: number }

export type OcEnvelope<T> = {
  hontrio_api: number
  ok: boolean
  data?: T
  meta?: OcMeta
  error?: { code?: string; message?: string }
}

export type OcStatus = { id: number; name: string; processing: boolean; complete: boolean }

export type OcInfo = {
  extension_version: string
  opencart_version: string
  php_version?: string
  store: {
    id: number
    name: string | null
    url: string | null
    country: string | null
    language: string | null
    currency: string | null
    timezone: string | null
    prices_include_tax: boolean
    customer_group_id?: number
  }
  counts?: { products: number; orders: number }
  statuses: OcStatus[]
  extensions?: { feed?: string[]; analytics?: string[]; module?: string[] }
  tracking?: { enabled: boolean; since: string | null }
  server_time?: string
}

export type OcOption = { name: string; value: string }

export type OcProduct = {
  product_id: number
  master_id: number
  variant: OcOption[] | null
  name: string
  model: string | null
  sku: string | null
  upc: string | null
  ean: string | null
  jan: string | null
  isbn: string | null
  mpn: string | null
  url: string | null
  image: string | null
  manufacturer: string | null
  categories: string[][]
  /** Cu taxe, la adresa implicită a magazinului (cum cere Google) */
  price: number
  price_net: number
  regular_price: number | null
  regular_price_net: number | null
  special_ends: string | null
  tax_rate: number
  quantity: number
  subtract: boolean
  available: boolean
  stock_status: string | null
  date_added: string | null
  date_modified: string | null
}

export type OcOrderProduct = {
  order_product_id: number
  product_id: number
  master_id: number
  name: string
  model: string | null
  quantity: number
  /** Pe bucată, fără taxe */
  price: number
  /** Taxa pe bucată */
  tax: number
  /** price × quantity, fără taxe */
  total: number
  options: OcOption[]
}

export type OcSource = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  gclid: string | null
  gbraid: string | null
  wbraid: string | null
  referrer: string | null
  landing_path: string | null
  captured_at: string | null
}

export type OcOrder = {
  order_id: number
  invoice: string | null
  status_id: number
  status: string | null
  date_added: string
  date_modified: string | null
  currency: string
  currency_code: string | null
  currency_value: number | null
  total: number
  totals: { code: string; title: string | null; value: number }[]
  payment_method: string | null
  payment_code: string | null
  shipping_method: string | null
  country: string | null
  coupon: string | null
  marketing_id: number | null
  tracking: string | null
  products: OcOrderProduct[]
  source: OcSource | null
}
