import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { loadAdsData } from '@/lib/commerce/ads-data'
import { storeSetup } from '@/lib/commerce/setup'
import { getActiveStore } from '@/lib/stores/active'
import { buildRecommendations } from '@/lib/recommendations/engine'
import { storeAdsAccount } from '@/lib/google/accounts'

// =============================================
// GET /api/recommendations
// Recomandările magazinului, calculate acum din modelul comun: setările care
// blochează campaniile, ofertele care nu pot rula la Google, stocul, marjele.
// =============================================

const ROUTE = '/api/recommendations'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const [storeRes, googleRes] = await Promise.all([
    getActiveStore<{
      id: string; platform: string; store_name: string | null; store_url: string; currency: string | null
      country: string | null; language: string | null; connection_status: string | null; last_sync_at: string | null; platform_data: unknown
      google_ads_customer_id: string | null
    }>(supabase, userId, 'id, platform, store_name, store_url, currency, country, language, connection_status, last_sync_at, platform_data, google_ads_customer_id'),
    supabase.from('google_connections').select('status').eq('user_id', userId).maybeSingle(),
  ])
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  const store = storeRes.data
  if (!store) return NextResponse.json({ store: null, recommendations: [] })
  const setup = storeSetup(store)
  if (!setup) {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, recommendations: [] })
  }

  const googleConnected = googleRes.data?.status === 'active'
  const [{ data, errors }, account] = await Promise.all([
    loadAdsData(supabase, store.id),
    // Contul Google Ads e al magazinului
    googleConnected ? storeAdsAccount(supabase, userId, store.google_ads_customer_id) : null,
  ])
  for (const error of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
  if (!data) return NextResponse.json({ error: 'Nu am putut citi produsele' }, { status: 500 })

  const recommendations = buildRecommendations({
    store: { connection_status: store.connection_status },
    setup,
    google: { connected: googleConnected, account_selected: !!account },
    offers: data.offers,
    sales90: data.sales90,
    orders90: data.orders90,
  })

  return NextResponse.json({
    store: {
      platform: store.platform,
      supported: true,
      store_name: store.store_name,
      currency: store.currency || 'RON',
      last_sync_at: store.last_sync_at,
      // Fără vânzări în ultimele 90 de zile, recomandările de stoc și marjă n-au pe ce se sprijini
      has_recent_sales: data.sales90.size > 0,
    },
    recommendations,
  })
}
