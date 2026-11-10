import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { buildRecommendations, CSS_COUNTRIES } from '@/lib/recommendations/engine'
import { loadPlanContext, STORE_PLAN_COLUMNS, statusesKnown, type PlanStore } from '@/lib/campaigns/context'
import { merchantIdForStore, type BestSellerRow, type PriceCompetitivenessRow, type PriceInsightRow } from '@/lib/merchant/sync'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/recommendations
// Recomandările magazinului, calculate acum din modelul comun: setările care
// blochează campaniile, contul Google Ads (auditul), ofertele care nu pot rula
// la Google, stocul și piața (rapoartele din Merchant Center).
// =============================================

const ROUTE = '/api/recommendations'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const storeRes = await getActiveStore<PlanStore>(supabase, userId, STORE_PLAN_COLUMNS)
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  const store = storeRes.data
  if (!store) return NextResponse.json({ store: null, recommendations: [] })
  if (!isCommercePlatform(store.platform)) {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, recommendations: [] })
  }

  const [{ context, errors }, insightsRes] = await Promise.all([
    loadPlanContext(supabase, userId, store),
    supabase.from('merchant_insights').select('kind, rows').eq('store_id', store.id),
  ])
  for (const error of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
  if (!context) return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })

  const rows = (kind: string) => ((insightsRes.data ?? []).find(r => r.kind === kind)?.rows ?? []) as unknown[]
  const country = (context.setup.feed.country || store.country || '').toUpperCase()

  const recommendations = buildRecommendations({
    store: { connection_status: store.connection_status },
    setup: context.setup,
    google: { connected: context.googleConnected, account_selected: !!context.account },
    offers: context.data.offers,
    sales90: context.data.sales90,
    orders90: context.data.orders90,
    audit: context.audit?.result ?? null,
    merchant: {
      id: merchantIdForStore(store, context.audit?.result?.merchant_id ?? null),
      from_merchant: store.platform !== 'edinio' && statusesKnown(context.setup, store),
      css_region: CSS_COUNTRIES.has(country),
    },
    insights: {
      price_competitiveness: rows('price_competitiveness') as PriceCompetitivenessRow[],
      price_insights: rows('price_insights') as PriceInsightRow[],
      best_sellers: rows('best_sellers') as BestSellerRow[],
    },
  })

  return NextResponse.json({
    store: {
      platform: store.platform,
      supported: true,
      store_name: store.store_name,
      currency: store.currency || 'RON',
      last_sync_at: store.last_sync_at,
      // Fără vânzări în ultimele 90 de zile, recomandările de stoc n-au pe ce se sprijini
      has_recent_sales: context.data.sales90.size > 0,
    },
    recommendations,
  })
}
