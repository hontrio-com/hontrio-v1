import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { addDays, lastFiguresDay } from '@/lib/ads/schedule'
import { readAll } from '@/lib/ads/read-all'
import { addRow, emptyTotals, isStatsPeriod, type Totals } from '@/lib/campaigns/stats'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { salesSource } from '@/lib/commerce/attribution'
import { localToUtcIso, ROMANIA_TZ } from '@/lib/commerce/time'
import { mergeStoreSales, storeSalesByCampaignDay, storeSalesByItem, storeSalesByOffer, type DaySales } from '@/lib/ads/store-sales'
import type { StoreSales } from '@/lib/ads/optimizer'
import { offersByItems } from '@/lib/campaigns/plan-store'

// =============================================
// GET /api/campaigns/stats?ids=…&days=7|30|90 — cifrele din fișa unei campanii
// (campaniile Google din spatele ei, ale omului): sumele perioadei și ale
// celei de dinainte, evoluția pe zi, produsele cu cele mai multe clicuri și
// căutările oamenilor. Perioada se termină în ultima zi citită (azi, cu
// cifrele din oră în oră); produsele și căutările vin din trecerea zilnică.
// Unde Google a numărat mai puține vânzări decât magazinul (comenzile cu sursa
// campaniei), conversiile și valoarea vin din magazin (lib/ads/store-sales.ts);
// căutările rămân ale Google, fiindcă o comandă nu se poate lega de o căutare.
// =============================================

const ROUTE = '/api/campaigns/stats'
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOP = 10

/** Sumele unei chei (zi, căutare), făcute la prima folosire. */
const bucket = (m: Map<string, Totals>, key: string) => {
  let v = m.get(key)
  if (!v) { v = emptyTotals(); m.set(key, v) }
  return v
}

type DayRow = { google_campaign_id: string; date: string; cost: unknown; clicks: unknown; impressions: unknown; conversions: unknown; conversions_value: unknown }

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const url = new URL(request.url)
  const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(s => UUID_RE.test(s)))].slice(0, 10)
  const daysParam = Number(url.searchParams.get('days'))
  const days = isStatsPeriod(daysParam) ? daysParam : 30
  if (!ids.length) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

  try {
    const supabase = createAdminClient()
    // Doar campaniile omului, cu Google în spate, ale aceluiași magazin
    const { data: rows } = await supabase.from('ad_campaigns').select('store_id, google_campaign_id, currency')
      .in('id', ids).eq('user_id', userId).not('google_campaign_id', 'is', null)
    const campaigns = (rows ?? []) as { store_id: string; google_campaign_id: string; currency: string | null }[]
    if (!campaigns.length) return NextResponse.json({ error: t('api.invalid_request') }, { status: 404 })
    const storeId = campaigns[0].store_id
    const googleIds = campaigns.filter(c => c.store_id === storeId).map(c => String(c.google_campaign_id))

    const { data: store } = await supabase.from('stores').select('platform, timezone, ads_synced_at, ads_today_at').eq('id', storeId).maybeSingle()
    const to = lastFiguresDay(store?.ads_synced_at ?? null, store?.ads_today_at ?? null, Date.now())
    const from = addDays(to, -(days - 1))
    const prevFrom = addDays(from, -days)
    // Ultima zi vine din citirea din oră în oră: fișa spune de când sunt cifrele
    const liveAt = store?.ads_today_at && String(store.ads_today_at).slice(0, 10) === to ? String(store.ads_today_at) : null

    const [dayRows, products, termRows] = await Promise.all([
      readAll<DayRow>((a, b) => supabase.from('ad_metrics_daily')
        .select('google_campaign_id, date, cost, clicks, impressions, conversions, conversions_value')
        .eq('store_id', storeId).in('google_campaign_id', googleIds).gte('date', prevFrom).lte('date', to)
        .order('date').order('google_campaign_id').range(a, b)),
      supabase.rpc('campaign_product_stats', { p_store_id: storeId, p_campaign_ids: googleIds, p_from: from, p_to: to, p_limit: TOP }),
      readAll<{ search_term: string; clicks: unknown; impressions: unknown; cost: unknown; conversions: unknown; conversions_value: unknown; period_start: string | null; period_end: string | null }>((a, b) =>
        supabase.from('ad_search_terms').select('search_term, clicks, impressions, cost, conversions, conversions_value, period_start, period_end')
          .eq('store_id', storeId).in('google_campaign_id', googleIds).order('clicks', { ascending: false }).order('search_term').range(a, b)),
    ])
    if (products.error) logApiError(ROUTE, 500, 'Produsele campaniei nu s-au putut citi', { userId, error: products.error.message })

    // Comenzile din magazin aduse de campanie, pe zi, și pe produs în perioadă (nu și la Gomag, fără sursa comenzii)
    const tz = (store?.timezone as string | null) || ROMANIA_TZ
    const window = (start: string) => Array.from({ length: days }, (_, i) => addDays(start, i))
    let storeDays = new Map<string, DaySales>()
    let storeItems = new Map<string, StoreSales>()
    if (salesSource(store?.platform as string | null) === 'store_orders') {
      try {
        storeDays = await storeSalesByCampaignDay(supabase, storeId, tz, prevFrom, to)
        if (storeDays.size) {
          const byOffer = await storeSalesByOffer(supabase, storeId, localToUtcIso(`${from} 00:00:00`, tz) ?? `${from}T00:00:00Z`,
            localToUtcIso(`${addDays(to, 1)} 00:00:00`, tz) ?? `${addDays(to, 1)}T00:00:00Z`, googleIds)
          storeItems = await storeSalesByItem(supabase, storeId, byOffer)
        }
      } catch (err) {
        logApiError(ROUTE, 500, 'Comenzile din campanie nu s-au putut citi', { userId, error: err instanceof Error ? err.message : String(err) })
      }
    }
    const merged = mergeStoreSales(
      dayRows.map(r => ({ google_campaign_id: r.google_campaign_id, date: r.date, cost: num(r.cost), clicks: num(r.clicks), impressions: num(r.impressions), conversions: num(r.conversions), value: num(r.conversions_value) })),
      googleIds, [window(prevFrom), window(from)], storeDays,
      (id, date) => ({ google_campaign_id: id, date, cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 }),
    )

    // Perioada, cea de dinainte și fiecare zi a perioadei (și zilele fără cifre)
    const totals = emptyTotals()
    const previous = emptyTotals()
    const byDay = new Map<string, Totals>()
    for (const r of merged.rows) {
      if (r.date >= from) {
        addRow(totals, r)
        addRow(bucket(byDay, r.date), r)
      } else addRow(previous, r)
    }
    const daily = Array.from({ length: days }, (_, i) => addDays(from, i)).map(date => ({ date, ...(byDay.get(date) ?? emptyTotals()) }))

    // Căutările: același termen poate apărea în mai multe campanii; perioada lor e fixă (30 de zile, până ieri)
    const terms = new Map<string, Totals>()
    for (const r of termRows) addRow(bucket(terms, r.search_term), r)
    const topTerms = [...terms].sort((a, b) => b[1].clicks - a[1].clicks || b[1].cost - a[1].cost).slice(0, TOP).map(([term, s]) => ({ term, ...s }))

    const p = (products.data ?? { total: 0, top: [] }) as { total: number; top: Record<string, unknown>[] }
    // Produsele: conversiile și valoarea, cele din magazin când sunt mai multe
    let productsFromStore = false
    const top = (p.top ?? []).map(r => {
      const g = addRow(emptyTotals(), r)
      const s = storeItems.get(String(r.item_id).trim().toLowerCase())
      if (s && (s.orders > g.conversions || s.value > g.value)) {
        productsFromStore = true
        return { item_id: String(r.item_id), ...g, conversions: Math.max(g.conversions, s.orders), value: Math.max(g.value, s.value) }
      }
      return { item_id: String(r.item_id), ...g }
    })
    // Numele și poza din magazin, doar pentru produsele din listă (pagina nu mai primește tot catalogul)
    const { offers: named, error: namesError } = await offersByItems(supabase, storeId, top.map(r => r.item_id))
    if (namesError) logApiError(ROUTE, 500, 'Eroare la numele produselor', { userId, error: namesError })
    const topNamed = top.map(r => {
      const o = named.get(r.item_id.trim().toLowerCase())
      return { ...r, title: o?.title ?? null, variant_title: o?.variant_title ?? null, image_url: o?.image_url ?? null }
    })
    return NextResponse.json({
      days, from, to, live_at: liveAt, currency: campaigns[0].currency,
      totals, previous, daily,
      store_counted: merged.used || productsFromStore,
      products: { total: Number(p.total) || 0, top: topNamed },
      terms: { total: terms.size, from: termRows[0]?.period_start ?? null, to: termRows[0]?.period_end ?? null, top: topTerms },
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Cifrele campaniei nu s-au putut citi', { userId, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
