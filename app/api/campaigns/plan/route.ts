import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { MAIN_TYPES, MODES, planForPage, type MainType, type Mode } from '@/lib/campaigns/plan'
import { groupPlanForPage } from '@/lib/campaigns/groups'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanStore } from '@/lib/campaigns/context'
import { CAMPAIGN_COLUMNS, parseCampaign } from '@/lib/ads/listing'
import { readAllSoft } from '@/lib/ads/read-all'
import { addDays, isExpired, lastFiguresDay } from '@/lib/ads/schedule'
import { AUDIT_FRESH_MS } from '@/lib/google/audit'
import { getT } from '@/lib/i18n/server'
import { storeDisplayName } from '@/lib/commerce/platforms'
import { salesSource } from '@/lib/commerce/attribution'
import { ROMANIA_TZ } from '@/lib/commerce/time'
import { mergeStoreSales, storeSalesByCampaignDay, type DaySales } from '@/lib/ads/store-sales'

// =============================================
// GET   /api/campaigns/plan — planul, socotit acum din datele magazinului, cu
//       auditul contului, campaniile lansate, propunerile pilotului și jurnalul.
//       Fără lista ofertelor (la un catalog mare, zeci de MB): cifrele sunt în
//       `plan.summary`, iar ofertele se cer pe pagini (POST /api/campaigns/plan/offers)
// PATCH /api/campaigns/plan — bugetul zilnic, modul pilotului, bugetul maxim și tipul
//       campaniei principale (ciorna din ad_campaigns, una pe magazin)
// =============================================

const ROUTE = '/api/campaigns/plan'
const MAX_DAILY_BUDGET = 1_000_000
const JOURNAL = 30
// Cifrele paginii: ultimele 30 de zile, comparate cu cele 30 de dinainte
const SERIES_DAYS = 60

type Supabase = ReturnType<typeof createAdminClient>

/**
 * Planul e al magazinului activ al contului; ultimele citiri ale contului Google (trecerea zilnică, cifrele de azi)
 * spun până când sunt cifrele, iar eroarea trecerii, de ce pilotul n-a putut lucra.
 */
function readStore(supabase: Supabase, userId: string) {
  return getActiveStore<PlanStore & { ads_synced_at: string | null; ads_sync_error: string | null; ads_today_at: string | null }>(supabase, userId, `${STORE_PLAN_COLUMNS}, ads_synced_at, ads_sync_error, ads_today_at`)
}

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

  const [{ context, errors }, campaignsRes, actionsRes] = await Promise.all([
    loadPlanContext(supabase, userId, store),
    supabase.from('ad_campaigns').select(`${CAMPAIGN_COLUMNS}, paused_reason, updated_at`).eq('store_id', store.id).in('status', ['active', 'paused', 'ended']).not('google_campaign_id', 'is', null).order('launched_at', { ascending: false }),
    supabase.from('ad_actions').select('id, ad_campaign_id, kind, params, reason, status, source, error, created_at, decided_at, applied_at')
      .eq('store_id', store.id).order('created_at', { ascending: false }).limit(JOURNAL + 20),
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
  // zi citită: azi, cu cifrele citite din oră în oră cât campaniile rulează; altfel ieri sau, dacă contul n-a
  // mai fost citit de atunci, ziua dinaintea ultimei treceri (o zi necitită nu e o zi fără vânzări)
  const lastDay = lastFiguresDay(store.ads_synced_at, store.ads_today_at, Date.now())
  // Ultima zi vine din citirea din oră în oră: pagina spune de când sunt cifrele
  const liveAt = store.ads_today_at && store.ads_today_at.slice(0, 10) === lastDay ? store.ads_today_at : null
  const days = Array.from({ length: SERIES_DAYS }, (_, i) => addDays(lastDay, i - SERIES_DAYS + 1))
  const since = days[SERIES_DAYS - 30]
  // Toate rândurile (campaniile încheiate se adună în timp: pot trece de o pagină)
  const { data: metrics, error: metricsError } = ids.length
    ? await readAllSoft<{ google_campaign_id: string; date: string; cost: unknown; clicks: unknown; conversions: unknown; conversions_value: unknown }>((a, b) =>
      supabase.from('ad_metrics_daily').select('google_campaign_id, date, cost, clicks, conversions, conversions_value').eq('store_id', store.id).in('google_campaign_id', ids)
        .gte('date', days[0]).lte('date', lastDay).order('google_campaign_id').order('date').range(a, b))
    : { data: [], error: null }
  if (metricsError) logApiError(ROUTE, 500, 'Eroare la citirea cifrelor campaniilor', { userId, error: metricsError })
  const googleRows = metrics.map(m => ({
    google_campaign_id: m.google_campaign_id as string, date: m.date as string,
    cost: Number(m.cost) || 0, clicks: Number(m.clicks) || 0, conversions: Number(m.conversions) || 0, value: Number(m.conversions_value) || 0,
  }))
  // Comenzile din magazin aduse de campanii: unde Google a numărat mai puține vânzări, cifrele le iau pe ele, pe
  // fiecare fereastră de 30 de zile (lib/ads/store-sales.ts). Gomag n-are sursa comenzii: acolo rămâne Google
  let storeDays = new Map<string, DaySales>()
  if (ids.length && salesSource(store.platform) === 'store_orders') {
    try {
      storeDays = await storeSalesByCampaignDay(supabase, store.id, store.timezone || ROMANIA_TZ, days[0], lastDay)
    } catch (err) {
      logApiError(ROUTE, 500, 'Eroare la citirea comenzilor din campanii', { userId, error: err instanceof Error ? err.message : String(err) })
    }
  }
  const merged = mergeStoreSales(googleRows, ids, [days.slice(0, SERIES_DAYS - 30), days.slice(SERIES_DAYS - 30)], storeDays,
    (id, date) => ({ google_campaign_id: id, date, cost: 0, clicks: 0, conversions: 0, value: 0 }))
  const rows = merged.rows
  const recent = rows.filter(r => r.date >= since)
  const totals = new Map<string, { cost: number; clicks: number; conversions: number; value: number }>()
  for (const m of recent) {
    const prev = totals.get(m.google_campaign_id) ?? { cost: 0, clicks: 0, conversions: 0, value: 0 }
    totals.set(m.google_campaign_id, { cost: prev.cost + m.cost, clicks: prev.clicks + m.clicks, conversions: prev.conversions + m.conversions, value: prev.value + m.value })
  }

  const actions = actionsRes.data ?? []
  const audit = context.audit

  // Evoluția pe zi, a tuturor campaniilor Hontrio la un loc (pentru cifrele și graficele paginii)
  const empty = () => ({ cost: 0, value: 0, conversions: 0 })
  const byDay = new Map<string, ReturnType<typeof empty>>()
  const byCampaignDay = new Map<string, Map<string, ReturnType<typeof empty>>>()
  for (const r of rows) {
    const d = byDay.get(r.date) ?? empty()
    byDay.set(r.date, { cost: d.cost + r.cost, value: d.value + r.value, conversions: d.conversions + r.conversions })
    const own = byCampaignDay.get(r.google_campaign_id) ?? new Map()
    const c = own.get(r.date) ?? empty()
    own.set(r.date, { cost: c.cost + r.cost, value: c.value + r.value, conversions: c.conversions + r.conversions })
    byCampaignDay.set(r.google_campaign_id, own)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  const series = days.map(date => {
    const d = byDay.get(date) ?? empty()
    return { date, cost: round(d.cost), value: round(d.value), conversions: round(d.conversions) }
  })
  const trendOf = (googleId: string) => days.slice(-30).map(date => {
    const d = byCampaignDay.get(googleId)?.get(date) ?? empty()
    return { date, value: round(d.value), cost: round(d.cost) }
  })

  return NextResponse.json({
    store: {
      platform: store.platform,
      supported: true,
      store_name: storeDisplayName(store),
      currency: store.currency || 'RON',
      connection_status: store.connection_status,
      last_sync_at: store.last_sync_at,
      // Ultima trecere a pilotului și, dacă n-a putut lucra, de ce (cheie de traducere salvată); când s-au citit
      // cifrele zilei de azi, dacă pagina le arată
      pilot: { synced_at: store.ads_synced_at, error: store.ads_sync_error, live_at: liveAt },
    },
    plan: planForPage(context.plan),
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
      last30: totals.get(c.google_campaign_id!) ?? { cost: 0, clicks: 0, conversions: 0, value: 0 },
      trend: trendOf(c.google_campaign_id!),
    })),
    // Pe zi, ultimele 60 de zile, toate campaniile Hontrio la un loc
    series,
    // Cifrele de vânzări au luat comenzile din magazin acolo unde Google a numărat mai puține
    store_counted: merged.used,
    // O propunere mai veche de 7 zile a expirat, chiar dacă pilotul n-a apucat s-o treacă așa
    proposals: actions.filter(a => a.status === 'proposed' && !isExpired(a.created_at)),
    journal: actions.filter(a => a.status !== 'proposed').slice(0, JOURNAL),
    // Grupele omului, cu planul fiecăreia; ziua de azi a magazinului, pentru perioadele lor
    groups: context.groupPlans.map(groupPlanForPage),
    today: context.today,
  })
}

export async function PATCH(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: { daily_budget?: unknown; mode?: unknown; max_daily_budget?: unknown; campaign_type?: unknown }
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

  const fields: { daily_budget?: number | null; mode?: Mode; max_daily_budget?: number | null; chosen_type?: MainType } = {}
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
    // null = fără plafon pentru propunerile de creștere a bugetului
    const v = amount(body.max_daily_budget)
    if (v === 'invalid') return NextResponse.json({ error: t('campaigns.budget_invalid') }, { status: 400 })
    fields.max_daily_budget = v
  }
  if (body.campaign_type !== undefined) {
    // Tipul campaniei principale, pentru lansare: „auto" = după conversii, sau Performance Max de la început
    if (!MAIN_TYPES.includes(body.campaign_type as MainType)) return NextResponse.json({ error: t('campaigns.group_type_invalid') }, { status: 400 })
    fields.chosen_type = body.campaign_type as MainType
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
  const columns = 'daily_budget, mode, max_daily_budget, chosen_type'
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
  return NextResponse.json({ daily_budget: n(saved.daily_budget), mode: saved.mode, max_daily_budget: n(saved.max_daily_budget), campaign_type: saved.chosen_type })
}
