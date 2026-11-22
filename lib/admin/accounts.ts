import { createAdminClient } from '@/lib/supabase/admin'
import { localToUtcIso, utcToLocal, ROMANIA_TZ } from '@/lib/commerce/time'
import { addDays } from '@/lib/ads/schedule'
import { readAll } from '@/lib/ads/read-all'
import { storeDisplayName } from '@/lib/commerce/platforms'
import { addMoney, round2, type Money } from '@/lib/admin/money'

// =============================================
// Conturile, pentru panoul de administrare: lista și pagina unui cont.
//
// Fără datele Google ale clienților: politica de confidențialitate promite că
// echipa Hontrio nu le citește fără cererea clientului și nu le amestecă între
// clienți. Panoul arată deci contul, magazinele (conexiunea, catalogul,
// pilotul), campaniile lansate de Hontrio (fără cifrele lor din Google), ce a
// făcut pilotul, comenzile aduse de campaniile Hontrio (utm_campaign
// „hontrio-…”, baza taxei din Termeni, art. 9) și activitatea. Sumele sunt pe
// monede ({ RON: 120, EUR: 3 }): nu se adună lei cu euro.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type { Money }

export type Period = 'month' | 'd30' | 'all'
export const PERIODS: Period[] = ['month', 'd30', 'all']

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** Începutul perioadei, după ceasul României: luna aceasta, ultimele 30 de zile (cu azi), de la început. */
export function periodStart(period: Period, nowMs: number): string {
  if (period === 'all') return '2000-01-01T00:00:00.000Z'
  const today = utcToLocal(new Date(nowMs).toISOString(), ROMANIA_TZ).slice(0, 10)
  const day = period === 'month' ? `${today.slice(0, 8)}01` : addDays(today, -29)
  return localToUtcIso(`${day} 00:00:00`, ROMANIA_TZ) ?? `${day}T00:00:00.000Z`
}

/** Comenzile aduse de campaniile Hontrio (neanulate, cu TVA), pe monede. */
export type HontrioSales = { orders: number; sales: Money }

export const emptySales = (): HontrioSales => ({ orders: 0, sales: {} })

/** Adaugă comenzile unui magazin, în moneda lui. */
export function addSales(into: HontrioSales, orders: number, sales: number, currency: string | null): HontrioSales {
  into.orders += orders
  addMoney(into.sales, currency, sales)
  return into
}

/** Comenzile din campaniile Hontrio ale fiecărui magazin de la o dată încoace (ale unui cont sau ale tuturor). */
export async function storeSales(supabase: Supabase, since: string, userId?: string): Promise<Map<string, { orders: number; sales: number }>> {
  const { data, error } = await supabase.rpc('admin_hontrio_sales', { p_since: since, p_user_id: userId ?? null })
  if (error) throw new Error(`admin_hontrio_sales: ${error.message}`)
  return new Map(((data ?? []) as Record<string, unknown>[]).map(r => [String(r.store_id), { orders: num(r.orders), sales: round2(num(r.sales)) }]))
}

// ─── Lista conturilor ───────────────────────────────────────────────────────

export type AccountRow = {
  id: string; email: string; name: string | null; role: string; created_at: string; last_seen_at: string | null
  email_verified: boolean; terms_accepted: boolean; onboarding_completed: boolean
  /** Google e conectat la Hontrio (fără nimic din contul Google). */
  google_connected: boolean
  stores: { id: string; name: string; platform: string; status: string | null; currency: string | null }[]
  campaigns: { active: number; total: number }
  /** Ultimele 30 de zile. */
  d30: HontrioSales
}

export type AccountsList = {
  accounts: AccountRow[]
  totals: { accounts: number; new_this_month: number; active_7d: number; stores: number; campaigns_active: number; d30: HontrioSales }
}

const USER_COLUMNS = 'id, email, name, role, created_at, last_seen_at, email_verified_at, terms_accepted_at, onboarding_completed'

export async function listAccounts(supabase: Supabase, nowMs: number): Promise<AccountsList> {
  const [users, stores, connections, campaigns, sales] = await Promise.all([
    readAll<Record<string, unknown>>((a, b) => supabase.from('users').select(USER_COLUMNS).order('created_at', { ascending: false }).order('id').range(a, b)),
    readAll<Record<string, unknown>>((a, b) => supabase.from('stores')
      .select('id, user_id, platform, store_name, store_url, connection_status, currency').order('created_at').order('id').range(a, b)),
    readAll<Record<string, unknown>>((a, b) => supabase.from('google_connections').select('user_id, status').order('user_id').range(a, b)),
    readAll<Record<string, unknown>>((a, b) => supabase.from('ad_campaigns').select('user_id, status')
      .not('google_campaign_id', 'is', null).order('id').range(a, b)),
    storeSales(supabase, periodStart('d30', nowMs)),
  ])

  const monthStart = periodStart('month', nowMs)
  const weekAgo = new Date(nowMs - 7 * 86_400_000).toISOString()
  const totals = { accounts: users.length, new_this_month: 0, active_7d: 0, stores: stores.length, campaigns_active: 0, d30: emptySales() }

  const accounts: AccountRow[] = users.map(u => {
    const id = String(u.id)
    const own = stores.filter(s => s.user_id === id)
    const d30 = emptySales()
    for (const s of own) {
      const f = sales.get(String(s.id)) ?? { orders: 0, sales: 0 }
      addSales(d30, f.orders, f.sales, (s.currency as string | null) ?? null)
      addSales(totals.d30, f.orders, f.sales, (s.currency as string | null) ?? null)
    }
    const ownCampaigns = campaigns.filter(c => c.user_id === id)
    const active = ownCampaigns.filter(c => c.status === 'active').length
    totals.campaigns_active += active
    if (String(u.created_at) >= monthStart) totals.new_this_month++
    if (u.last_seen_at && String(u.last_seen_at) >= weekAgo) totals.active_7d++
    return {
      id, email: String(u.email), name: (u.name as string | null) ?? null, role: String(u.role ?? 'user'), created_at: String(u.created_at),
      last_seen_at: (u.last_seen_at as string | null) ?? null, email_verified: !!u.email_verified_at, terms_accepted: !!u.terms_accepted_at,
      onboarding_completed: !!u.onboarding_completed,
      google_connected: connections.some(c => c.user_id === id && c.status === 'active'),
      stores: own.map(s => ({
        id: String(s.id), name: storeDisplayName(s as { store_name?: string | null; store_url?: string | null }), platform: String(s.platform),
        status: (s.connection_status as string | null) ?? null, currency: (s.currency as string | null) ?? null,
      })),
      campaigns: { active, total: ownCampaigns.filter(c => c.status !== 'removed').length },
      d30,
    }
  })
  return { accounts, totals }
}

// ─── Un cont ────────────────────────────────────────────────────────────────

export type StoreDetail = {
  id: string; name: string; url: string | null; platform: string; connection_status: string | null; sync_status: string | null
  last_sync_at: string | null; last_error: string | null; orders_count: number; offers: number
  currency: string | null; timezone: string | null; country: string | null; created_at: string
  /** S-a ales un cont Google Ads, respectiv un Merchant Center (fără datele lor). */
  setup: { ads_account: boolean; merchant: boolean }
  /** Starea pilotului (erorile lui, pentru suport). */
  pilot: { mode: string | null; synced_at: string | null; error: string | null; today_at: string | null; suspended_at: string | null }
  sales: Record<Period, { orders: number; sales: number }>
  /** Ultimele 30 de zile, pe zi (ora României): comenzile din campaniile Hontrio. */
  series: { date: string; orders: number; sales: number }[]
}

/** O campanie lansată de Hontrio, cum o știe Hontrio (fără cifrele ei din Google). */
export type CampaignDetail = {
  id: string; store_id: string; name: string | null; type: string; status: string; stage: string | null
  daily_budget: number | null; currency: string | null; launched_at: string | null
  paused_reason: string | null; last_error: string | null; group: string | null
}

export type AccountDetail = {
  user: {
    id: string; email: string; name: string | null; role: string; created_at: string; last_seen_at: string | null
    email_verified_at: string | null; terms_accepted_at: string | null; terms_version: string | null
    onboarding_completed: boolean; ui_locale: string | null; active_store_id: string | null
  }
  /** Legătura cu Google, ca stare (fără contul Google). */
  google: { status: string; connected_at: string; last_error: string | null } | null
  stores: StoreDetail[]
  sales: Record<Period, HontrioSales>
  campaigns: CampaignDetail[]
  proposals_open: number
  actions: { id: string; kind: string; status: string; source: string; created_at: string; campaign: string | null; error: string | null }[]
  tickets: { id: string; subject: string; status: string; priority: string | null; created_at: string }[]
  notifications: { id: string; title: string; type: string | null; is_read: boolean; created_at: string }[]
  /** Intrările administratorilor în acest cont („Conectare”), din admin_impersonations. */
  impersonations: { id: string; admin_email: string; started_at: string; expires_at: string; ended_at: string | null; ended_by: string | null }[]
}

const STORE_COLUMNS = 'id, user_id, platform, store_name, store_url, connection_status, sync_status, last_sync_at, last_error, orders_count, currency, timezone, country, created_at, google_ads_customer_id, merchant_center_id, ads_synced_at, ads_sync_error, ads_today_at, billing_suspended_at'

export async function accountDetail(supabase: Supabase, userId: string, nowMs: number): Promise<AccountDetail | null> {
  const { data: u } = await supabase.from('users')
    .select('id, email, name, role, created_at, last_seen_at, email_verified_at, terms_accepted_at, terms_version, onboarding_completed, ui_locale, active_store_id')
    .eq('id', userId).maybeSingle()
  if (!u) return null

  const starts: Record<Period, string> = { month: periodStart('month', nowMs), d30: periodStart('d30', nowMs), all: periodStart('all', nowMs) }
  const [storesRes, connRes, campaignsRes, groupsRes, actionsRes, proposalsRes, ticketsRes, notifRes, drafts, impRes, month, d30, all] = await Promise.all([
    supabase.from('stores').select(STORE_COLUMNS).eq('user_id', userId).order('created_at'),
    supabase.from('google_connections').select('status, last_error, created_at').eq('user_id', userId).maybeSingle(),
    supabase.from('ad_campaigns').select('id, store_id, name, type, status, stage, daily_budget, currency, launched_at, paused_reason, last_error, product_group_id')
      .eq('user_id', userId).not('google_campaign_id', 'is', null).order('launched_at', { ascending: false }),
    supabase.from('ad_product_groups').select('id, name').eq('user_id', userId),
    supabase.from('ad_actions').select('id, kind, status, source, created_at, ad_campaign_id, error').eq('user_id', userId).neq('status', 'proposed').order('created_at', { ascending: false }).limit(20),
    supabase.from('ad_actions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'proposed'),
    supabase.from('tickets').select('id, subject, status, priority, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('notifications').select('id, title, type, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('ad_campaigns').select('store_id, mode').eq('user_id', userId).eq('status', 'draft'),
    supabase.from('admin_impersonations').select('id, admin_email, started_at, expires_at, ended_at, ended_by').eq('user_id', userId).order('started_at', { ascending: false }).limit(20),
    storeSales(supabase, starts.month, userId),
    storeSales(supabase, starts.d30, userId),
    storeSales(supabase, starts.all, userId),
  ])

  const stores = (storesRes.data ?? []) as Record<string, unknown>[]
  const storeIds = stores.map(s => String(s.id))
  const campaigns = (campaignsRes.data ?? []) as Record<string, unknown>[]
  const groups = new Map(((groupsRes.data ?? []) as Record<string, unknown>[]).map(g => [String(g.id), String(g.name)]))

  // Comenzile din campaniile Hontrio pe zi (ultimele 30 de zile) și mărimea catalogului fiecărui magazin
  const [hontrioOrders, offerCounts] = await Promise.all([
    storeIds.length
      ? readAll<Record<string, unknown>>((a, b) => supabase.from('commerce_orders').select('store_id, placed_at, total')
        .in('store_id', storeIds).ilike('utm_campaign', 'hontrio-%').not('state', 'in', '(cancelled,refunded)').gte('placed_at', starts.d30)
        .order('placed_at').order('id').range(a, b))
      : Promise.resolve([] as Record<string, unknown>[]),
    Promise.all(storeIds.map(async id => {
      const { count } = await supabase.from('commerce_offers').select('*', { count: 'exact', head: true }).eq('store_id', id)
      return [id, count ?? 0] as const
    })),
  ])
  const offers = new Map(offerCounts)
  const byDay = new Map<string, Map<string, { orders: number; sales: number }>>()
  for (const o of hontrioOrders) {
    const date = utcToLocal(String(o.placed_at), ROMANIA_TZ).slice(0, 10)
    const days = byDay.get(String(o.store_id)) ?? new Map<string, { orders: number; sales: number }>()
    byDay.set(String(o.store_id), days)
    const p = days.get(date) ?? { orders: 0, sales: 0 }
    days.set(date, { orders: p.orders + 1, sales: round2(p.sales + num(o.total)) })
  }
  const today = utcToLocal(new Date(nowMs).toISOString(), ROMANIA_TZ).slice(0, 10)
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))

  const modes = new Map(((drafts.data ?? []) as Record<string, unknown>[]).map(d => [String(d.store_id), (d.mode as string | null) ?? null]))
  const byPeriod: Record<Period, Map<string, { orders: number; sales: number }>> = { month, d30, all }
  const sales: Record<Period, HontrioSales> = { month: emptySales(), d30: emptySales(), all: emptySales() }

  const storeDetails: StoreDetail[] = stores.map(s => {
    const id = String(s.id)
    const own = {} as Record<Period, { orders: number; sales: number }>
    for (const p of PERIODS) {
      own[p] = byPeriod[p].get(id) ?? { orders: 0, sales: 0 }
      addSales(sales[p], own[p].orders, own[p].sales, (s.currency as string | null) ?? null)
    }
    const series = byDay.get(id)
    return {
      id, name: storeDisplayName(s as { store_name?: string | null; store_url?: string | null }), url: (s.store_url as string | null) ?? null,
      platform: String(s.platform), connection_status: (s.connection_status as string | null) ?? null, sync_status: (s.sync_status as string | null) ?? null,
      last_sync_at: (s.last_sync_at as string | null) ?? null, last_error: (s.last_error as string | null) ?? null,
      orders_count: num(s.orders_count), offers: offers.get(id) ?? 0,
      currency: (s.currency as string | null) ?? null, timezone: (s.timezone as string | null) ?? null, country: (s.country as string | null) ?? null,
      created_at: String(s.created_at),
      setup: { ads_account: !!s.google_ads_customer_id, merchant: !!s.merchant_center_id },
      pilot: {
        mode: modes.get(id) ?? null, synced_at: (s.ads_synced_at as string | null) ?? null, error: (s.ads_sync_error as string | null) ?? null,
        today_at: (s.ads_today_at as string | null) ?? null, suspended_at: (s.billing_suspended_at as string | null) ?? null,
      },
      sales: own,
      series: days.map(date => ({ date, ...(series?.get(date) ?? { orders: 0, sales: 0 }) })),
    }
  })

  const conn = connRes.data as Record<string, unknown> | null
  const campaignName = new Map(campaigns.map(c => [String(c.id), (c.name as string | null) ?? null]))
  return {
    user: {
      id: String(u.id), email: String(u.email), name: (u.name as string | null) ?? null, role: String(u.role ?? 'user'),
      created_at: String(u.created_at), last_seen_at: (u.last_seen_at as string | null) ?? null,
      email_verified_at: (u.email_verified_at as string | null) ?? null, terms_accepted_at: (u.terms_accepted_at as string | null) ?? null,
      terms_version: (u.terms_version as string | null) ?? null, onboarding_completed: !!u.onboarding_completed,
      ui_locale: (u.ui_locale as string | null) ?? null, active_store_id: (u.active_store_id as string | null) ?? null,
    },
    google: conn ? { status: String(conn.status), connected_at: String(conn.created_at), last_error: (conn.last_error as string | null) ?? null } : null,
    stores: storeDetails,
    sales,
    campaigns: campaigns.map(c => ({
      id: String(c.id), store_id: String(c.store_id), name: (c.name as string | null) ?? null, type: String(c.type), status: String(c.status),
      stage: (c.stage as string | null) ?? null, daily_budget: c.daily_budget === null ? null : num(c.daily_budget), currency: (c.currency as string | null) ?? null,
      launched_at: (c.launched_at as string | null) ?? null, paused_reason: (c.paused_reason as string | null) ?? null,
      last_error: (c.last_error as string | null) ?? null, group: c.product_group_id ? groups.get(String(c.product_group_id)) ?? null : null,
    })),
    proposals_open: proposalsRes.count ?? 0,
    actions: ((actionsRes.data ?? []) as Record<string, unknown>[]).map(a => ({
      id: String(a.id), kind: String(a.kind), status: String(a.status), source: String(a.source), created_at: String(a.created_at),
      campaign: a.ad_campaign_id ? campaignName.get(String(a.ad_campaign_id)) ?? null : null, error: (a.error as string | null) ?? null,
    })),
    tickets: ((ticketsRes.data ?? []) as Record<string, unknown>[]).map(tk => ({
      id: String(tk.id), subject: String(tk.subject), status: String(tk.status), priority: (tk.priority as string | null) ?? null, created_at: String(tk.created_at),
    })),
    notifications: ((notifRes.data ?? []) as Record<string, unknown>[]).map(n => ({
      id: String(n.id), title: String(n.title), type: (n.type as string | null) ?? null, is_read: !!n.is_read, created_at: String(n.created_at),
    })),
    impersonations: ((impRes.data ?? []) as Record<string, unknown>[]).map(i => ({
      id: String(i.id), admin_email: String(i.admin_email), started_at: String(i.started_at), expires_at: String(i.expires_at),
      ended_at: (i.ended_at as string | null) ?? null, ended_by: (i.ended_by as string | null) ?? null,
    })),
  }
}
