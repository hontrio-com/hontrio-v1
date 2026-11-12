import { createAdminClient } from '@/lib/supabase/admin'
import { readAllSoft } from '@/lib/ads/read-all'
import type { OrderTotals } from '@/lib/ads/economics'
import type { MerchantIssue } from '@/lib/merchant/match'

// =============================================
// Datele magazinului din care se socotesc recomandările și planul de
// campanie: toate ofertele, vânzările de pe site pe ofertă și cifrele
// comenzilor din ultimele 90 de zile.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type AdsMode = 'auto' | 'include' | 'exclude'

export type Offer = {
  offer_id: string
  title: string
  product_name: string | null
  variant_title: string | null
  image_url: string | null
  /** Categoria din magazin (la WooCommerce, prima; la Shopify, tipul produsului). */
  category: string | null
  price: number
  /** Prețul de dinainte de reducere, când produsul e la reducere. */
  compare_at_price: number | null
  available: boolean
  stock: number | null
  gtin: string | null
  mpn: string | null
  brand: string | null
  google_status: string | null
  ads_mode: AdsMode
  /** ID-ul ofertei în Merchant Center (la Edinio e chiar offer_id). */
  merchant_offer_id: string | null
  /** Problemele raportate de Merchant Center pentru reclamele Shopping. */
  merchant_issues: MerchantIssue[] | null
  /** Scoasă din campanii de pilot, după cifrele din Google Ads. */
  ads_auto_reason: 'no_sales' | 'unprofitable' | null
}

export type Sales = Map<string, { units: number; revenue: number; orders?: number }>

/** Cifrele Google pe produs (ID-ul din Merchant Center, cu litere mici), din toate campaniile Shopping și PMax. */
export type ProductTotals = Map<string, { cost: number; clicks: number; conversions: number; value: number }>

export type AdsData = {
  offers: Offer[]
  sales90: Sales
  orders90: OrderTotals
  /** Comenzile aduse de Google Ads (gclid sau UTM), în aceleași 90 de zile. */
  googleAds90: { orders: number; total: number }
  /** La fel, pe ultimele 30 de zile: treapta campaniei când auditul Google lipsește. */
  googleAds30: { orders: number; total: number }
  /** Vânzările aduse de Google Ads în 30 de zile, pe ofertă: conversiile unei grupe înainte să ruleze. */
  googleSales30: Sales
  /** Ce a raportat Google pe produs în 30 de zile; gol până la prima trecere a pilotului. */
  products30: ProductTotals
}

export const SALES_DAYS = 90
const PAGE = 1000
const OFFER_COLUMNS = 'offer_id, title, product_name, variant_title, image_url, category, price, compare_at_price, available, stock, gtin, mpn, brand, google_status, ads_mode, merchant_offer_id, merchant_issues, ads_auto_reason'

/**
 * Citește tot. Fără oferte nu se poate socoti nimic, deci `data` e null; fără
 * vânzări sau comenzi se merge mai departe pe zero. Erorile le scrie apelantul.
 */
export async function loadAdsData(supabase: Supabase, storeId: string): Promise<{ data: AdsData | null; errors: string[] }> {
  const errors: string[] = []

  async function readOffers(): Promise<Offer[] | null> {
    const all: Offer[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('commerce_offers')
        .select(OFFER_COLUMNS)
        .eq('store_id', storeId)
        .order('offer_id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        errors.push(`commerce_offers: ${error.message}`)
        return null
      }
      for (const o of data ?? []) {
        all.push({
          ...(o as Offer),
          price: Number(o.price),
          compare_at_price: o.compare_at_price === null ? null : Number(o.compare_at_price),
        })
      }
      if (!data || data.length < PAGE) return all
    }
  }

  const since = new Date(Date.now() - SALES_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // Câte un rând pe ofertă sau pe produs: la un catalog mare trec de o pagină (1.000), deci se citesc toate
  const [offers, salesRes, econRes, econ30Res, google30Res, productsRes] = await Promise.all([
    readOffers(),
    readAllSoft((a, b) => supabase.rpc('commerce_offer_sales', { p_store_id: storeId, p_since: since }).order('offer_id').range(a, b)),
    supabase.rpc('commerce_order_economics', { p_store_id: storeId, p_since: since }),
    supabase.rpc('commerce_order_economics', { p_store_id: storeId, p_since: since30 }),
    readAllSoft((a, b) => supabase.rpc('commerce_offer_google_sales', { p_store_id: storeId, p_since: since30 }).order('offer_id').range(a, b)),
    readAllSoft((a, b) => supabase.rpc('ad_product_totals', { p_store_id: storeId, p_since: since30.slice(0, 10) }).order('item_id').range(a, b)),
  ])
  if (salesRes.error) errors.push(`commerce_offer_sales: ${salesRes.error}`)
  if (econRes.error) errors.push(`commerce_order_economics: ${econRes.error.message}`)
  if (econ30Res.error) errors.push(`commerce_order_economics (30): ${econ30Res.error.message}`)
  if (google30Res.error) errors.push(`commerce_offer_google_sales: ${google30Res.error}`)
  if (productsRes.error) errors.push(`ad_product_totals: ${productsRes.error}`)
  if (!offers) return { data: null, errors }

  type SalesRow = { offer_id: string; units: number; revenue: number; orders: number }
  const salesOf = (rows: unknown): Sales => new Map(((rows ?? []) as SalesRow[])
    .map(s => [s.offer_id, { units: Number(s.units) || 0, revenue: Number(s.revenue) || 0, orders: Number(s.orders) || 0 }]))
  const sales90 = salesOf(salesRes.data)
  const products30: ProductTotals = new Map(
    ((productsRes.data ?? []) as { item_id: string; cost: number; clicks: number; conversions: number; conversions_value: number }[])
      .map(r => [r.item_id.toLowerCase(), { cost: Number(r.cost) || 0, clicks: Number(r.clicks) || 0, conversions: Number(r.conversions) || 0, value: Number(r.conversions_value) || 0 }]),
  )
  const e = (econRes.data ?? {}) as Record<string, number | undefined>
  const n = (k: string) => Number(e[k]) || 0
  const e30 = (econ30Res.data ?? {}) as Record<string, number | undefined>

  return {
    data: {
      offers,
      sales90,
      orders90: { orders: n('orders'), total: n('total'), items: n('items'), discount: n('discount'), tax: n('tax') },
      googleAds90: { orders: n('google_ads_orders'), total: n('google_ads_total') },
      googleAds30: { orders: Number(e30.google_ads_orders) || 0, total: Number(e30.google_ads_total) || 0 },
      googleSales30: salesOf(google30Res.data),
      products30,
    },
    errors,
  }
}
