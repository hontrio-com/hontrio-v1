import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { loadAdsData } from '@/lib/commerce/ads-data'
import { storeSetup } from '@/lib/commerce/setup'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { buildPlan, GOALS, type Goal } from '@/lib/campaigns/plan'

// =============================================
// GET   /api/campaigns/plan — planul campaniei, socotit acum din datele magazinului
// PATCH /api/campaigns/plan — obiectivul și bugetul zilnic alese de om
// Până la lansare, planul e ciorna din ad_campaigns (una pe magazin).
// =============================================

const ROUTE = '/api/campaigns/plan'
const MAX_DAILY_BUDGET = 1_000_000

type Supabase = ReturnType<typeof createAdminClient>

type StoreRow = {
  id: string; platform: string; store_name: string | null; store_url: string; currency: string | null
  country: string | null; language: string | null; connection_status: string | null; last_sync_at: string | null; platform_data: unknown
}

/** Planul e al magazinului activ al contului. */
function readStore(supabase: Supabase, userId: string) {
  return getActiveStore<StoreRow>(supabase, userId,
    'id, platform, store_name, store_url, currency, country, language, connection_status, last_sync_at, platform_data')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const [storeRes, googleRes, accountRes] = await Promise.all([
    readStore(supabase, userId),
    supabase.from('google_connections').select('status').eq('user_id', userId).maybeSingle(),
    supabase.from('google_ads_accounts').select('customer_id, descriptive_name, currency_code')
      .eq('user_id', userId).eq('is_selected', true).maybeSingle(),
  ])
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  const store = storeRes.data
  if (!store) return NextResponse.json({ store: null, plan: null })
  const setup = storeSetup(store)
  if (!setup) {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, plan: null })
  }

  const [{ data, errors }, draftRes] = await Promise.all([
    loadAdsData(supabase, store.id),
    supabase.from('ad_campaigns').select('goal, daily_budget').eq('store_id', store.id).eq('status', 'draft').maybeSingle(),
  ])
  for (const error of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
  if (draftRes.error) logApiError(ROUTE, 500, 'Eroare la citirea planului', { userId, error: draftRes.error.message })
  if (!data) return NextResponse.json({ error: 'Nu am putut citi produsele' }, { status: 500 })

  const draft = draftRes.data
  const googleConnected = googleRes.data?.status === 'active'
  const account = googleConnected && accountRes.data ? accountRes.data : null

  const plan = buildPlan({
    store: { currency: store.currency || 'RON', connection_status: store.connection_status },
    setup,
    google: {
      connected: googleConnected,
      account: account ? { customer_id: account.customer_id, name: account.descriptive_name, currency: account.currency_code } : null,
    },
    offers: data.offers,
    sales90: data.sales90,
    orders90: data.orders90,
    googleAds90: data.googleAds90,
    settings: {
      goal: GOALS.includes(draft?.goal as Goal) ? (draft!.goal as Goal) : 'balanced',
      daily_budget: draft?.daily_budget === null || draft?.daily_budget === undefined ? null : Number(draft.daily_budget),
    },
  })

  return NextResponse.json({
    store: {
      platform: store.platform,
      supported: true,
      store_name: store.store_name,
      currency: store.currency || 'RON',
      connection_status: store.connection_status,
      last_sync_at: store.last_sync_at,
    },
    plan,
  })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  let body: { goal?: unknown; daily_budget?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  }

  const fields: { goal?: Goal; daily_budget?: number | null } = {}
  if (body.goal !== undefined) {
    if (!GOALS.includes(body.goal as Goal)) return NextResponse.json({ error: 'Obiectiv invalid' }, { status: 400 })
    fields.goal = body.goal as Goal
  }
  if (body.daily_budget !== undefined) {
    // null = bugetul propus de Hontrio
    if (body.daily_budget === null) fields.daily_budget = null
    else {
      const n = Number(body.daily_budget)
      if (typeof body.daily_budget !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_DAILY_BUDGET) {
        return NextResponse.json({ error: 'Buget invalid' }, { status: 400 })
      }
      fields.daily_budget = Math.round(n * 100) / 100
    }
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: 'Nimic de salvat' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: store, error: storeError } = await readStore(supabase, userId)
  if (storeError) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeError.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: 'Magazin nesuportat' }, { status: 400 })

  const now = new Date().toISOString()
  const update = () => supabase.from('ad_campaigns')
    .update({ ...fields, updated_at: now })
    .eq('store_id', store.id).eq('status', 'draft')
    .select('goal, daily_budget')

  let { data: rows, error } = await update()
  if (!error && !rows?.length) {
    // Prima alegere: planul nu are încă ciornă
    const inserted = await supabase.from('ad_campaigns')
      .insert({ user_id: userId, store_id: store.id, currency: store.currency || 'RON', ...fields })
      .select('goal, daily_budget')
    // Două salvări deodată: cealaltă a creat ciorna între timp
    if (inserted.error?.code === '23505') ({ data: rows, error } = await update())
    else ({ data: rows, error } = inserted)
  }
  if (error || !rows?.length) {
    logApiError(ROUTE, 500, 'Eroare la salvarea planului', { userId, error: error?.message ?? 'niciun rând' })
    return NextResponse.json({ error: 'Nu am putut salva planul' }, { status: 500 })
  }

  const saved = rows[0]
  return NextResponse.json({
    goal: saved.goal,
    daily_budget: saved.daily_budget === null ? null : Number(saved.daily_budget),
  })
}
