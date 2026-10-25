import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { loadAdsData } from '@/lib/commerce/ads-data'
import { storeSetup } from '@/lib/commerce/setup'
import { buildRecommendations } from '@/lib/recommendations/engine'

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
  const [storeRes, googleRes, accountRes] = await Promise.all([
    supabase.from('stores')
      .select('id, platform, store_name, store_url, currency, country, language, connection_status, last_sync_at, platform_data')
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
  const setup = storeSetup(store)
  if (!setup) {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, recommendations: [] })
  }

  const { data, errors } = await loadAdsData(supabase, store.id)
  for (const error of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
  if (!data) return NextResponse.json({ error: 'Nu am putut citi produsele' }, { status: 500 })

  const googleConnected = googleRes.data?.status === 'active'

  const recommendations = buildRecommendations({
    store: { connection_status: store.connection_status },
    setup,
    google: { connected: googleConnected, account_selected: googleConnected && !!accountRes.data },
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
