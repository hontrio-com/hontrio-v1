import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanStore } from '@/lib/campaigns/context'
import { CAMPAIGN_COLUMNS, parseCampaign } from '@/lib/ads/listing'
import { readAll } from '@/lib/ads/read-all'
import { getT } from '@/lib/i18n/server'
import { storeDisplayName } from '@/lib/commerce/platforms'
import { salesSource } from '@/lib/commerce/attribution'

// =============================================
// GET /api/reports?days=7|30|90
// Rapoartele: cheltuiala și valoarea din Google Ads (din cronul zilnic), pe
// zi, campanie, produs și termen de căutare; plus vânzările de pe site pe
// sursă. Verdictul pe produs e regula pilotului: fără vânzări, sau vânzări
// sub costul reclamei (ROAS sub 1).
// =============================================

const ROUTE = '/api/reports'
const PERIODS = [7, 30, 90]
const TOP_PRODUCTS = 50
const TOP_TERMS = 30

type Sum = { cost: number; clicks: number; impressions: number; conversions: number; value: number }
const ZERO: Sum = { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 }
const add = (a: Sum, r: { cost: unknown; clicks: unknown; impressions?: unknown; conversions: unknown; conversions_value: unknown }): Sum => ({
  cost: a.cost + (Number(r.cost) || 0),
  clicks: a.clicks + (Number(r.clicks) || 0),
  impressions: a.impressions + (Number(r.impressions) || 0),
  conversions: a.conversions + (Number(r.conversions) || 0),
  value: a.value + (Number(r.conversions_value) || 0),
})
const round2 = (n: number) => Math.round(n * 100) / 100
const roasOf = (s: Sum) => (s.cost > 0 ? Math.round((s.value / s.cost) * 100) / 100 : null)

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id
  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = PERIODS.includes(daysParam) ? daysParam : 30

  const supabase = createAdminClient()
  const { data: store, error } = await getActiveStore<PlanStore & { ads_synced_at: string | null; ads_sync_error: string | null }>(supabase, userId, `${STORE_PLAN_COLUMNS}, ads_synced_at, ads_sync_error`)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store) return NextResponse.json({ store: null })
  if (!isCommercePlatform(store.platform)) return NextResponse.json({ store: { platform: store.platform, supported: false } })

  // Zilele raportate de Google: până ieri inclusiv
  const to = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10)

  // Cifrele contului ales acum (un cont ales înainte își păstrează rândurile, dar nu se mai arată)
  const customerId = store.google_ads_customer_id

  try {
    const [{ context }, salesRes, campaignsRes, metrics, allProductRows, termsRes] = await Promise.all([
      loadPlanContext(supabase, userId, store),
      supabase.rpc('commerce_sales_report', { p_store_id: store.id, p_days: days, p_tz: store.timezone || 'Europe/Bucharest' }),
      supabase.from('ad_campaigns').select(CAMPAIGN_COLUMNS).eq('store_id', store.id).not('google_campaign_id', 'is', null),
      readAll<{ google_campaign_id: string; date: string; campaign_name: string | null; channel_type: string | null; cost: number; clicks: number; impressions: number; conversions: number; conversions_value: number }>((a, b) => {
        let q = supabase.from('ad_metrics_daily').select('google_campaign_id, date, campaign_name, channel_type, cost, clicks, impressions, conversions, conversions_value')
          .eq('store_id', store.id).gte('date', from).lte('date', to)
        if (customerId) q = q.eq('customer_id', customerId)
        // O ordine întreagă (zi, campanie): altfel paginile pot repeta sau sări rânduri
        return q.order('date').order('google_campaign_id').range(a, b)
      }),
      readAll<{ google_campaign_id: string; item_id: string; cost: number; clicks: number; impressions: number; conversions: number; conversions_value: number }>((a, b) =>
        supabase.from('ad_product_metrics_daily').select('google_campaign_id, item_id, cost, clicks, impressions, conversions, conversions_value')
          .eq('store_id', store.id).gte('date', from).lte('date', to).order('date').order('google_campaign_id').order('item_id').range(a, b)),
      supabase.from('ad_search_terms').select('search_term, google_campaign_id, cost, clicks, conversions, conversions_value').eq('store_id', store.id).order('cost', { ascending: false }).limit(TOP_TERMS),
    ])
    if (salesRes.error) logApiError(ROUTE, 500, 'Eroare la commerce_sales_report', { userId, error: salesRes.error.message })
    // Produsele: doar ale campaniilor din contul de acum
    const accountCampaigns = new Set(metrics.map(m => m.google_campaign_id))
    const productRows = customerId ? allProductRows.filter(r => accountCampaigns.has(r.google_campaign_id)) : allProductRows

    const plan = context?.plan ?? null
    const campaignRows = (campaignsRes.data ?? []).map(r => parseCampaign(r as Record<string, unknown>))
    const ours = new Set(campaignRows.map(c => String(c.google_campaign_id)))
    const kindOf = new Map(campaignRows.map(c => [String(c.google_campaign_id), { type: c.type, segment: c.segment }]))

    // ── Google Ads ─────────────────────────────────────────────────────────
    let total = ZERO
    let hontrio = ZERO
    const daily = new Map<string, Sum>()
    const byCampaign = new Map<string, Sum & { name: string; channel: string }>()
    for (const m of metrics) {
      total = add(total, m)
      if (ours.has(m.google_campaign_id)) hontrio = add(hontrio, m)
      daily.set(m.date, add(daily.get(m.date) ?? ZERO, m))
      const prev = byCampaign.get(m.google_campaign_id)
      byCampaign.set(m.google_campaign_id, { ...add(prev ?? ZERO, m), name: m.campaign_name || m.google_campaign_id, channel: m.channel_type || 'UNKNOWN' })
    }
    // Produsele: legate de ofertele magazinului prin ID-ul din Merchant Center
    const offers = new Map((plan?.offers ?? []).filter(o => o.item_id).map(o => [o.item_id!.toLowerCase(), o]))
    const byItem = new Map<string, Sum>()
    for (const r of productRows) byItem.set(r.item_id, add(byItem.get(r.item_id) ?? ZERO, r))
    const products = [...byItem.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, TOP_PRODUCTS)
      .map(([item, s]) => {
        const o = offers.get(item)
        const roas = roasOf(s)
        return {
          item_id: item,
          offer_id: o?.offer_id ?? null,
          title: o ? (o.variant_title ? `${o.title} · ${o.variant_title}` : o.title) : item,
          image_url: o?.image_url ?? null,
          cost: round2(s.cost), clicks: s.clicks, conversions: round2(s.conversions), value: round2(s.value), roas,
          // Ca pilotul: fără vânzări, sau vânzări sub costul reclamei
          verdict: s.conversions === 0 ? (s.cost > 0 ? 'no_sales' : 'none') : roas !== null && roas < 1 ? 'below_cost' : 'sells',
        }
      })

    const hasAds = metrics.length > 0
    return NextResponse.json({
      store: { platform: store.platform, supported: true, store_name: storeDisplayName(store), currency: store.currency || 'RON' },
      // Gomag nu dă sursa comenzii: vânzările aduse de Hontrio se văd din conversiile Google Ads (ads.hontrio)
      sales_source: salesSource(store.platform),
      period: { days, from, to },
      google: {
        connected: !!context?.googleConnected,
        account: context?.account ? { id: context.account.customer_id, name: context.account.descriptive_name } : null,
        // Prima citire a contului nu s-a încheiat încă (null) sau ultima n-a reușit (sync_error): cifrele vin
        synced_at: store.ads_synced_at,
        sync_error: store.ads_sync_error,
      },
      ads: hasAds ? {
        total: { ...total, cost: round2(total.cost), value: round2(total.value), roas: roasOf(total) },
        hontrio: ours.size ? { ...hontrio, cost: round2(hontrio.cost), value: round2(hontrio.value), roas: roasOf(hontrio) } : null,
        daily: [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, s]) => ({ date, cost: round2(s.cost), value: round2(s.value) })),
        campaigns: [...byCampaign.entries()].sort((a, b) => b[1].cost - a[1].cost).map(([id, s]) => ({
          id, name: s.name, channel: s.channel, hontrio: ours.has(id), kind: kindOf.get(id) ?? null,
          cost: round2(s.cost), clicks: s.clicks, conversions: round2(s.conversions), value: round2(s.value), roas: roasOf(s),
        })),
        products,
        search_terms: (termsRes.data ?? []).map(r => ({
          term: r.search_term, cost: round2(Number(r.cost)), clicks: Number(r.clicks), conversions: round2(Number(r.conversions)), value: round2(Number(r.conversions_value)),
        })),
      } : null,
      sales: salesRes.data ?? null,
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare la citirea rapoartelor', { userId, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('reports.load_error') }, { status: 500 })
  }
}
