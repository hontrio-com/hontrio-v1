import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { buildRecommendations, type OfferIn } from '@/lib/recommendations/engine'

// =============================================
// GET /api/recommendations
// Recomandările magazinului, calculate acum din modelul comun: setările care
// blochează campaniile, ofertele care nu pot rula la Google, stocul, marjele.
// =============================================

const ROUTE = '/api/recommendations'
const PAGINA = 1000

type PlatformData = {
  prices_include_vat?: boolean | null
  google_merchant?: { conectat?: boolean } | null
  google_ads?: { conversie_id?: string | null } | null
} | null

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const [storeRes, googleRes, accountRes] = await Promise.all([
    supabase.from('stores')
      .select('id, platform, store_name, currency, timezone, connection_status, last_sync_at, platform_data')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('google_connections').select('status').eq('user_id', userId).maybeSingle(),
    supabase.from('google_ads_accounts').select('customer_id').eq('user_id', userId).eq('is_selected', true).maybeSingle(),
  ])
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  const store = storeRes.data
  if (!store) return NextResponse.json({ store: null, recommendations: [] })
  if (store.platform !== 'edinio') {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, recommendations: [] })
  }

  async function readOffers(): Promise<OfferIn[] | null> {
    const all: OfferIn[] = []
    for (let from = 0; ; from += PAGINA) {
      const { data, error } = await supabase.from('commerce_offers')
        .select('offer_id, title, product_name, variant_title, image_url, price, cost_price, available, stock, gtin, mpn, brand, google_status')
        .eq('store_id', store!.id)
        .order('offer_id', { ascending: true })
        .range(from, from + PAGINA - 1)
      if (error) {
        logApiError(ROUTE, 500, 'Eroare la citirea ofertelor', { userId, error: error.message })
        return null
      }
      for (const o of data ?? []) {
        all.push({
          ...(o as OfferIn),
          price: Number(o.price),
          cost_price: o.cost_price === null ? null : Number(o.cost_price),
        })
      }
      if (!data || data.length < PAGINA) return all
    }
  }

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const [offers, salesRes, ovRes] = await Promise.all([
    readOffers(),
    supabase.rpc('commerce_offer_sales', { p_store_id: store.id, p_since: since90 }),
    supabase.rpc('commerce_overview', { p_store_id: store.id, p_days: 90, p_tz: store.timezone || 'Europe/Bucharest' }),
  ])
  if (!offers) return NextResponse.json({ error: 'Nu am putut citi produsele' }, { status: 500 })
  if (salesRes.error) logApiError(ROUTE, 500, 'Eroare la commerce_offer_sales', { userId, error: salesRes.error.message })
  if (ovRes.error) logApiError(ROUTE, 500, 'Eroare la commerce_overview', { userId, error: ovRes.error.message })

  const sales90 = new Map(
    ((salesRes.data ?? []) as { offer_id: string; units: number; revenue: number }[])
      .map(s => [s.offer_id, { units: Number(s.units) || 0, revenue: Number(s.revenue) || 0 }]),
  )
  const current = ((ovRes.data as { current?: { revenue?: number; tax?: number } } | null)?.current) ?? {}
  const pd = (store.platform_data ?? null) as PlatformData
  const googleConnected = googleRes.data?.status === 'active'

  const recommendations = buildRecommendations({
    store: {
      connection_status: store.connection_status,
      prices_include_vat: pd?.prices_include_vat ?? null,
      gmc_connected: !!pd?.google_merchant?.conectat,
      conversion_id: pd?.google_ads?.conversie_id ?? null,
    },
    google: { connected: googleConnected, account_selected: googleConnected && !!accountRes.data },
    offers,
    sales90,
    totals90: { revenue: Number(current.revenue) || 0, tax: Number(current.tax) || 0 },
    edinioBase: (process.env.EDINIO_BASE_URL || 'https://www.edinio.com').replace(/\/+$/, ''),
  })

  return NextResponse.json({
    store: {
      platform: store.platform,
      supported: true,
      store_name: store.store_name,
      currency: store.currency || 'RON',
      last_sync_at: store.last_sync_at,
      // Fără vânzări în ultimele 90 de zile, recomandările de stoc și marjă n-au pe ce se sprijini
      has_recent_sales: sales90.size > 0,
    },
    recommendations,
  })
}
