// =============================================
// Ce primește Dashboard-ul de la GET /api/overview.
// =============================================

export type Totals = { revenue: number; orders: number; google_ads_orders: number; google_ads_revenue: number }

export type Overview = {
  current: Totals
  previous: Totals
  daily: { day: string; revenue: number; orders: number }[]
  sources: { source: string; orders: number; revenue: number }[]
}

export type StoreInfo = {
  id: string; platform: string; platform_name: string; store_name: string | null; store_url: string; currency: string; timezone: string
  connection_status: string | null; sync_status: string | null; last_sync_at: string | null; last_error: string | null
  offers_count: number; orders_count: number; supported: boolean
}

export type TopProduct = {
  offer_id: string; title: string; variant_title: string | null; image_url: string | null
  price: number | null; units: number; revenue: number
}

export type OverviewData = {
  days: number
  store: StoreInfo | null
  google: { connected: boolean; status: string | null; account: { id: string; name: string | null; currency: string | null } | null }
  /** `unverified`: un plugin pe care Hontrio nu-l poate întreba (se verifică la lansare); `variant`: platforma. */
  checklist: { id: string; done: boolean; href: string; external: boolean; unverified?: boolean; variant?: string | null; via?: string | null }[]
  /** Cifrele din Google Ads ale perioadei (null = nicio cheltuială încă). */
  ads: { cost: number; value: number; conversions: number; roas: number | null } | null
  overview: Overview | null
  top_products: TopProduct[]
}

export type Period = 7 | 30 | 90 | 365
export const PERIODS: Period[] = [7, 30, 90, 365]
