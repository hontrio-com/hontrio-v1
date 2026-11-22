import { createAdminClient } from '@/lib/supabase/admin'
import { readAll } from '@/lib/ads/read-all'
import { HONTRIO_UTM_PREFIX, salesSource } from '@/lib/commerce/attribution'

// =============================================
// Comenzile din magazin aduse de campaniile Hontrio, față de conversiile
// numărate de Google pentru ele, în ultimele 30 de zile. Când magazinul are
// comenzi din campanii, iar Google nu are nicio conversie, conversia nu se
// măsoară (eticheta lipsă sau stricată, cookie-urile refuzate): Google nu
// află ce vinde, iar campania nu poate trece pe Performance Max.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

const DAY_MS = 86_400_000
/** Google are o zi să înregistreze conversia unei comenzi, înainte să socotim că lipsește. */
const GRACE_MS = DAY_MS
const WINDOW_DAYS = 30

export type CampaignSales = { orders: number; value: number; conversions: number }

/** null = nu se poate spune (Gomag, fără campanii Hontrio lansate). */
export async function campaignSalesCheck(supabase: Supabase, store: { id: string; platform: string }, nowMs = Date.now()): Promise<CampaignSales | null> {
  if (salesSource(store.platform) !== 'store_orders') return null
  const { data: campaigns } = await supabase.from('ad_campaigns').select('google_campaign_id').eq('store_id', store.id).not('google_campaign_id', 'is', null)
  const ids = (campaigns ?? []).map(c => String(c.google_campaign_id))
  if (!ids.length) return null

  const fromIso = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString()
  const toIso = new Date(nowMs - GRACE_MS).toISOString()
  const [orders, days] = await Promise.all([
    readAll<{ total: unknown }>((a, b) => supabase.from('commerce_orders').select('total')
      .eq('store_id', store.id).ilike('utm_campaign', `${HONTRIO_UTM_PREFIX}%`).not('state', 'in', '(cancelled,refunded)')
      .gte('placed_at', fromIso).lte('placed_at', toIso).order('placed_at').order('id').range(a, b)),
    // Conversiile stau pe ziua clicului: de la începutul ferestrei până azi
    readAll<{ conversions: unknown }>((a, b) => supabase.from('ad_metrics_daily').select('conversions')
      .eq('store_id', store.id).in('google_campaign_id', ids).gte('date', fromIso.slice(0, 10))
      .order('date').order('google_campaign_id').range(a, b)),
  ])
  return {
    orders: orders.length,
    value: Math.round(orders.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100,
    conversions: days.reduce((s, d) => s + (Number(d.conversions) || 0), 0),
  }
}
