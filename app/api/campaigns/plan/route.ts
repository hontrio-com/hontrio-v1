import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { GOALS, MODES, type Goal, type Mode } from '@/lib/campaigns/plan'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanStore } from '@/lib/campaigns/context'
import { CAMPAIGN_COLUMNS, parseCampaign } from '@/lib/ads/apply'
import { campaignBreakEvens, profitByCampaign, profitOfRow, segmentSplits } from '@/lib/ads/campaign-economics'
import { AUDIT_FRESH_MS } from '@/lib/google/audit'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET   /api/campaigns/plan — planul, socotit acum din datele magazinului, cu
//       auditul contului, campaniile lansate, propunerile pilotului și jurnalul
// PATCH /api/campaigns/plan — obiectivul, bugetul zilnic, modul pilotului și
//       bugetul maxim (ciorna din ad_campaigns, una pe magazin)
// =============================================

const ROUTE = '/api/campaigns/plan'
const MAX_DAILY_BUDGET = 1_000_000
const JOURNAL = 30
// Cifrele paginii: ultimele 30 de zile, comparate cu cele 30 de dinainte
const SERIES_DAYS = 60

type Supabase = ReturnType<typeof createAdminClient>

/** Planul e al magazinului activ al contului; ultima citire a contului Google spune până când sunt cifrele. */
function readStore(supabase: Supabase, userId: string) {
  return getActiveStore<PlanStore & { ads_synced_at: string | null }>(supabase, userId, `${STORE_PLAN_COLUMNS}, ads_synced_at`)
}

const DAY_MS = 86_400_000
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const storeRes = await readStore(supabase, userId)
  if (storeRes.error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeRes.error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  const store = storeRes.data
  if (!store) return NextResponse.json({ store: null, plan: null })
  if (!isCommercePlatform(store.platform)) {
    return NextResponse.json({ store: { platform: store.platform, supported: false }, plan: null })
  }

  const [{ context, errors }, campaignsRes, actionsRes, segmentsRes] = await Promise.all([
    loadPlanContext(supabase, userId, store),
    supabase.from('ad_campaigns').select(`${CAMPAIGN_COLUMNS}, paused_reason, updated_at`).eq('store_id', store.id).in('status', ['active', 'paused', 'ended']).not('google_campaign_id', 'is', null).order('launched_at', { ascending: false }),
    supabase.from('ad_actions').select('id, ad_campaign_id, kind, params, reason, status, source, error, created_at, decided_at, applied_at')
      .eq('store_id', store.id).order('created_at', { ascending: false }).limit(JOURNAL + 20),
    // Împărțirea pe marje, oricât de veche: de la ea „restul" are pragul lui
    supabase.from('ad_actions').select('kind, status, ad_campaign_id, applied_at').eq('store_id', store.id).eq('kind', 'segment').eq('status', 'applied'),
  ])
  for (const error of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error })
  if (!context) return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })

  // Cifrele campaniilor Hontrio pe ultimele 30 de zile (din cronul zilnic)
  const campaignRows = (campaignsRes.data ?? []) as Record<string, unknown>[]
  const campaigns = campaignRows.map(r => parseCampaign(r))
  // De ce e oprită sau încheiată o campanie, și de când
  const stateOf = new Map(campaignRows.map(r => [String(r.id), { paused_reason: (r.paused_reason as string | null) ?? null, updated_at: (r.updated_at as string | null) ?? null }]))
  const ids = campaigns.map(c => c.google_campaign_id!).filter(Boolean)
  // 60 de zile: ultimele 30 și cele 30 de dinainte, ca cifrele să aibă cu ce se compara. Se termină în ultima
  // zi completă: ieri sau, dacă contul n-a mai fost citit de atunci, ziua dinaintea ultimei citiri (o zi
  // necitită nu e o zi fără vânzări)
  const yesterday = shiftDay(new Date().toISOString().slice(0, 10), -1)
  const syncedDay = store.ads_synced_at ? shiftDay(store.ads_synced_at.slice(0, 10), -1) : null
  const lastDay = syncedDay && syncedDay < yesterday ? syncedDay : yesterday
  const days = Array.from({ length: SERIES_DAYS }, (_, i) => shiftDay(lastDay, i - SERIES_DAYS + 1))
  const since = days[SERIES_DAYS - 30]
  const { data: metrics } = ids.length
    ? await supabase.from('ad_metrics_daily').select('google_campaign_id, date, cost, clicks, conversions, conversions_value').eq('store_id', store.id).in('google_campaign_id', ids)
      .gte('date', days[0]).lte('date', lastDay)
    : { data: [] }
  const rows = (metrics ?? []).map(m => ({
    google_campaign_id: m.google_campaign_id as string, date: m.date as string,
    cost: Number(m.cost) || 0, clicks: Number(m.clicks) || 0, conversions: Number(m.conversions) || 0, value: Number(m.conversions_value) || 0,
  }))
  const recent = rows.filter(r => r.date >= since)
  const totals = new Map<string, { cost: number; clicks: number; conversions: number; value: number }>()
  for (const m of recent) {
    const prev = totals.get(m.google_campaign_id) ?? { cost: 0, clicks: 0, conversions: 0, value: 0 }
    totals.set(m.google_campaign_id, { cost: prev.cost + m.cost, clicks: prev.clicks + m.clicks, conversions: prev.conversions + m.conversions, value: prev.value + m.value })
  }

  const actions = actionsRes.data ?? []
  const audit = context.audit
  // Segmentele de marjă au pragul lor: profitul fiecărei campanii se socotește cu el, pe zi
  const breakEvens = campaignBreakEvens(campaigns, context.plan)
  const storeBe = context.plan.economics.break_even
  const splits = segmentSplits(campaigns, segmentsRes.data ?? [])
  const profits = profitByCampaign(recent, breakEvens, storeBe, splits)

  // Evoluția pe zi, a tuturor campaniilor Hontrio la un loc (pentru cifrele și graficele paginii)
  const empty = () => ({ cost: 0, value: 0, conversions: 0, profit: 0 })
  const byDay = new Map<string, ReturnType<typeof empty>>()
  const byCampaignDay = new Map<string, Map<string, ReturnType<typeof empty>>>()
  for (const r of rows) {
    const p = storeBe === null ? 0 : profitOfRow(r, breakEvens, storeBe, splits)
    const d = byDay.get(r.date) ?? empty()
    byDay.set(r.date, { cost: d.cost + r.cost, value: d.value + r.value, conversions: d.conversions + r.conversions, profit: d.profit + p })
    const own = byCampaignDay.get(r.google_campaign_id) ?? new Map()
    const c = own.get(r.date) ?? empty()
    own.set(r.date, { cost: c.cost + r.cost, value: c.value + r.value, conversions: c.conversions + r.conversions, profit: c.profit + p })
    byCampaignDay.set(r.google_campaign_id, own)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  const series = days.map(date => {
    const d = byDay.get(date) ?? empty()
    return { date, cost: round(d.cost), value: round(d.value), conversions: round(d.conversions), profit: storeBe === null ? null : round(d.profit) }
  })
  const trendOf = (googleId: string) => days.slice(-30).map(date => {
    const d = byCampaignDay.get(googleId)?.get(date) ?? empty()
    return { date, value: round(d.value), profit: storeBe === null ? null : round(d.profit) }
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
    plan: context.plan,
    audit: audit ? {
      checked_at: audit.checked_at,
      fresh: Date.now() - Date.parse(audit.checked_at) < AUDIT_FRESH_MS,
      error: audit.error,
      result: audit.result,
    } : null,
    campaigns: campaigns.map(c => ({
      id: c.id, name: c.name, type: c.type, status: c.status, stage: c.stage, segment: c.segment, group_id: c.product_group_id,
      google_campaign_id: c.google_campaign_id, daily_budget: c.daily_budget, target_roas: c.target_roas,
      cpc_ceiling: c.cpc_ceiling, launched_at: c.launched_at, excluded: c.excluded_item_ids.length,
      included: c.included_item_ids?.length ?? null,
      paused_reason: c.status === 'active' ? null : stateOf.get(c.id)?.paused_reason ?? null,
      ended_at: c.status === 'ended' ? stateOf.get(c.id)?.updated_at ?? null : null,
      break_even: breakEvens.get(c.google_campaign_id!) ?? context.plan.economics.break_even,
      last30: {
        ...(totals.get(c.google_campaign_id!) ?? { cost: 0, clicks: 0, conversions: 0, value: 0 }),
        profit: profits ? Math.round((profits.get(c.google_campaign_id!) ?? 0) * 100) / 100 : null,
      },
      trend: trendOf(c.google_campaign_id!),
    })),
    // Pe zi, ultimele 60 de zile, toate campaniile Hontrio la un loc
    series,
    proposals: actions.filter(a => a.status === 'proposed'),
    journal: actions.filter(a => a.status !== 'proposed').slice(0, JOURNAL),
    // Grupele omului, cu planul fiecăreia; ziua de azi a magazinului, pentru perioadele lor
    groups: context.groupPlans,
    today: context.today,
  })
}

export async function PATCH(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: { goal?: unknown; daily_budget?: unknown; mode?: unknown; max_daily_budget?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }

  const amount = (v: unknown): number | null | 'invalid' => {
    if (v === null) return null
    const n = Number(v)
    if (typeof v !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_DAILY_BUDGET) return 'invalid'
    return Math.round(n * 100) / 100
  }

  const fields: { goal?: Goal; daily_budget?: number | null; mode?: Mode; max_daily_budget?: number | null } = {}
  if (body.goal !== undefined) {
    if (!GOALS.includes(body.goal as Goal)) return NextResponse.json({ error: t('sync.goal_invalid') }, { status: 400 })
    fields.goal = body.goal as Goal
  }
  if (body.daily_budget !== undefined) {
    // null = bugetul propus de Hontrio
    const v = amount(body.daily_budget)
    if (v === 'invalid') return NextResponse.json({ error: t('campaigns.budget_invalid') }, { status: 400 })
    fields.daily_budget = v
  }
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode as Mode)) return NextResponse.json({ error: t('sync.mode_invalid') }, { status: 400 })
    fields.mode = body.mode as Mode
  }
  if (body.max_daily_budget !== undefined) {
    // null = fără plafon: pilotul doar propune creșterile de buget
    const v = amount(body.max_daily_budget)
    if (v === 'invalid') return NextResponse.json({ error: t('campaigns.budget_invalid') }, { status: 400 })
    fields.max_daily_budget = v
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: t('sync.nothing_to_save') }, { status: 400 })

  const supabase = createAdminClient()
  const { data: store, error: storeError } = await readStore(supabase, userId)
  if (storeError) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeError.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })

  const now = new Date().toISOString()
  const columns = 'goal, daily_budget, mode, max_daily_budget'
  const update = () => supabase.from('ad_campaigns')
    .update({ ...fields, updated_at: now })
    .eq('store_id', store.id).eq('status', 'draft')
    .select(columns)

  let { data: rows, error } = await update()
  if (!error && !rows?.length) {
    // Prima alegere: planul nu are încă ciornă
    const inserted = await supabase.from('ad_campaigns')
      .insert({ user_id: userId, store_id: store.id, currency: store.currency || 'RON', ...fields })
      .select(columns)
    // Două salvări deodată: cealaltă a creat ciorna între timp
    if (inserted.error?.code === '23505') ({ data: rows, error } = await update())
    else ({ data: rows, error } = inserted)
  }
  if (error || !rows?.length) {
    logApiError(ROUTE, 500, 'Eroare la salvarea planului', { userId, error: error?.message ?? 'niciun rând' })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }

  const saved = rows[0]
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return NextResponse.json({ goal: saved.goal, daily_budget: n(saved.daily_budget), mode: saved.mode, max_daily_budget: n(saved.max_daily_budget) })
}
