import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderTotals } from '@/lib/ads/economics'

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
  price: number
  cost_price: number | null
  available: boolean
  stock: number | null
  gtin: string | null
  mpn: string | null
  brand: string | null
  google_status: string | null
  ads_mode: AdsMode
}

export type Sales = Map<string, { units: number; revenue: number }>

export type AdsData = {
  offers: Offer[]
  sales90: Sales
  orders90: OrderTotals
  /** Comenzile aduse de Google Ads (gclid sau UTM), în aceleași 90 de zile. */
  googleAds90: { orders: number; total: number }
}

export const SALES_DAYS = 90
const PAGE = 1000
const OFFER_COLUMNS = 'offer_id, title, product_name, variant_title, image_url, price, cost_price, available, stock, gtin, mpn, brand, google_status, ads_mode'

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
          cost_price: o.cost_price === null ? null : Number(o.cost_price),
        })
      }
      if (!data || data.length < PAGE) return all
    }
  }

  const since = new Date(Date.now() - SALES_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [offers, salesRes, econRes] = await Promise.all([
    readOffers(),
    supabase.rpc('commerce_offer_sales', { p_store_id: storeId, p_since: since }),
    supabase.rpc('commerce_order_economics', { p_store_id: storeId, p_since: since }),
  ])
  if (salesRes.error) errors.push(`commerce_offer_sales: ${salesRes.error.message}`)
  if (econRes.error) errors.push(`commerce_order_economics: ${econRes.error.message}`)
  if (!offers) return { data: null, errors }

  const sales90: Sales = new Map(
    ((salesRes.data ?? []) as { offer_id: string; units: number; revenue: number }[])
      .map(s => [s.offer_id, { units: Number(s.units) || 0, revenue: Number(s.revenue) || 0 }]),
  )
  const e = (econRes.data ?? {}) as Record<string, number | undefined>
  const n = (k: string) => Number(e[k]) || 0

  return {
    data: {
      offers,
      sales90,
      orders90: { orders: n('orders'), total: n('total'), items: n('items'), discount: n('discount'), tax: n('tax') },
      googleAds90: { orders: n('google_ads_orders'), total: n('google_ads_total') },
    },
    errors,
  }
}
