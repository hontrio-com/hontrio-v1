import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { storeSetup } from '@/lib/commerce/setup'
import { getActiveStore } from '@/lib/stores/active'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanStore } from '@/lib/campaigns/context'
import { storeAdsAccount } from '@/lib/google/accounts'
import { getT } from '@/lib/i18n/server'

type StoreRow = PlanStore & {
  sync_status: string | null; last_error: string | null; products_count: number | null; orders_count: number | null
}

// =============================================
// GET /api/overview?days=7|30|90|365
// Prezentarea generală: cât e de gata contul pentru campanii și ce vinde
// magazinul pe site (comparat cu perioada dinainte), din modelul comun.
// `store.last_error` e un mesaj salvat ca cheie de traducere (translateStored).
// =============================================

const ROUTE = '/api/overview'
const PERIOADE = [7, 30, 90, 365]
const TOP_PRODUSE = 5

type Costs = {
  with_cost: number; total: number
  /** Ca în planul campaniei: partea din vânzări (sau, fără vânzări, din oferte) care are cost */
  coverage: number; basis: 'sales' | 'catalog' | null
  /** Planul poate socoti marja: pasul e făcut */
  ready: boolean
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: (await getT())('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = PERIOADE.includes(daysParam) ? daysParam : 30

  const supabase = createAdminClient()
  const [storeRes, googleRes] = await Promise.all([
    getActiveStore<StoreRow>(supabase, userId,
      `${STORE_PLAN_COLUMNS}, sync_status, last_error, products_count, orders_count`),
    supabase.from('google_connections').select('status, google_email').eq('user_id', userId).maybeSingle(),
  ])
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: (await getT())('sync.store_read_failed') }, { status: 500 })
  }

  const store = storeRes.data
  const setup = store ? storeSetup(store) : null
  const supported = !!setup

  let overview: Record<string, unknown> | null = null
  let topProducts: unknown[] = []
  let costs: Costs = { with_cost: 0, total: 0, coverage: 0, basis: null, ready: false }
  const googleConnected = googleRes.data?.status === 'active'
  // Contul Google Ads e al magazinului (fiecare magazin își alege contul)
  const account = googleConnected && store ? await storeAdsAccount(supabase, userId, store.google_ads_customer_id) : null

  if (store && setup) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const [ovRes, salesRes, ads] = await Promise.all([
      supabase.rpc('commerce_overview', { p_store_id: store.id, p_days: days, p_tz: store.timezone || 'Europe/Bucharest' }),
      supabase.rpc('commerce_offer_sales', { p_store_id: store.id, p_since: since }),
      loadPlanContext(supabase, userId, store),
    ])
    if (ovRes.error) logApiError(ROUTE, 500, 'Eroare la commerce_overview', { userId, error: ovRes.error.message })
    if (salesRes.error) logApiError(ROUTE, 500, 'Eroare la commerce_offer_sales', { userId, error: salesRes.error.message })
    for (const error of ads.errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
    overview = (ovRes.data as Record<string, unknown> | null) ?? null

    // Pasul costurilor are regula planului de campanie, ca să nu se contrazică
    if (ads.context) {
      const { economics } = ads.context.plan
      costs = {
        with_cost: ads.context.data.offers.filter(o => o.cost_price !== null).length,
        total: ads.context.data.offers.length,
        coverage: economics.cost_coverage,
        basis: economics.cost_basis,
        ready: economics.margin !== null,
      }
    }

    const top = ((salesRes.data ?? []) as { offer_id: string; units: number; revenue: number; orders: number }[])
      .sort((a, b) => Number(b.revenue) - Number(a.revenue))
      .slice(0, TOP_PRODUSE)
    if (top.length) {
      const { data: offers } = await supabase.from('commerce_offers')
        .select('offer_id, title, product_name, variant_title, image_url, price, cost_price')
        .eq('store_id', store.id)
        .in('offer_id', top.map(t => t.offer_id))
      const byId = new Map((offers ?? []).map(o => [o.offer_id as string, o]))
      topProducts = top.map(t => {
        const o = byId.get(t.offer_id)
        return {
          offer_id: t.offer_id,
          title: o?.product_name || o?.title || t.offer_id,
          variant_title: o?.variant_title ?? null,
          image_url: o?.image_url ?? null,
          price: o ? Number(o.price) : null,
          cost_price: o?.cost_price === null || o?.cost_price === undefined ? null : Number(o.cost_price),
          units: Number(t.units) || 0,
          revenue: Number(t.revenue) || 0,
        }
      })
    }
  }

  // Pașii până la prima campanie, în ordinea în care se fac
  const checklist = [
    { id: 'store', done: !!store && supported && store.connection_status === 'active', href: '/settings?tab=integrations', external: false },
    { id: 'google_ads', done: googleConnected, href: '/settings?tab=integrations', external: false },
    { id: 'ads_account', done: !!account, href: '/settings?tab=integrations', external: false },
    // „De verificat" (un plugin pe care Hontrio nu-l poate întreba) trece, dar se spune
    ...(['merchant', 'conversion'] as const).map(id => {
      const step = setup?.[id]
      return {
        id, done: !!step && step.status !== 'missing', unverified: step?.status === 'unverified',
        variant: setup?.platform ?? null, via: step?.via ?? null,
        href: step?.href ?? '/settings?tab=integrations', external: !!step,
      }
    }),
    { id: 'costs', done: costs.ready, href: '/products?view=no_cost', external: false },
  ]

  return NextResponse.json({
    days,
    store: store ? {
      id: store.id,
      platform: store.platform,
      platform_name: setup?.platformName ?? store.platform,
      store_name: store.store_name,
      store_url: store.store_url,
      currency: store.currency || 'RON',
      timezone: store.timezone || 'Europe/Bucharest',
      connection_status: store.connection_status,
      sync_status: store.sync_status,
      last_sync_at: store.last_sync_at,
      last_error: store.last_error,
      offers_count: store.products_count ?? 0,
      orders_count: store.orders_count ?? 0,
      supported,
    } : null,
    google: {
      connected: googleConnected,
      status: googleRes.data?.status ?? null,
      account: account ? { id: account.customer_id, name: account.descriptive_name, currency: account.currency_code } : null,
    },
    checklist,
    costs,
    overview,
    top_products: topProducts,
  })
}
