import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/sync'
import { refreshToday, runAutopilot } from '@/lib/ads/autopilot'
import { safeEqual } from '@/lib/ads/schedule'

// =============================================
// Cron (din oră în oră): pilotul, o dată pe zi pe fiecare magazin al
// oamenilor cu Google conectat — oprirea de siguranță întâi, apoi auditul
// contului, metricile, Merchant Center, produsele din campanii și bucla de
// optimizare. Fiecare oră ia magazinele netrecute de cel puțin 20 de ore,
// cele mai vechi primele. O trecere care n-a ajuns la capăt (timpul cronului,
// o eroare Google trecătoare) nu se socotește: magazinul revine la ora
// următoare, primul la rând.
// În timpul rămas, magazinele cu campanii pornite primesc cifrele de azi
// (o cerere la Google pe magazin), ca paginile să nu aștepte trecerea zilnică.
// =============================================

export const maxDuration = 300

const DUE_MS = 20 * 60 * 60 * 1000
const START_MARGIN_MS = 60_000

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !safeEqual(request.headers.get('authorization') ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore (răspuns pentru Vercel)
  }

  const deadline = Date.now() + 270_000
  const supabase = createAdminClient()
  const { data: connections, error: connError } = await supabase.from('google_connections').select('user_id').eq('status', 'active')
  if (connError) {
    logError('/api/cron/ads-sync', 'Nu am putut citi conexiunile Google', { error: connError.message })
    return NextResponse.json({ error: 'db' }, { status: 500 })
  }
  const users = (connections ?? []).map(c => c.user_id)
  if (!users.length) return NextResponse.json({ stores: 0, results: {} })

  const due = new Date(Date.now() - DUE_MS).toISOString()
  const { data: stores, error } = await supabase.from('stores')
    .select('id')
    .in('user_id', users)
    .in('platform', [...COMMERCE_PLATFORMS])
    .or(`ads_synced_at.is.null,ads_synced_at.lt.${due}`)
    .order('ads_synced_at', { ascending: true, nullsFirst: true })
    .limit(50)
  if (error) {
    logError('/api/cron/ads-sync', 'Nu am putut citi magazinele', { error: error.message })
    return NextResponse.json({ error: 'db' }, { status: 500 })
  }

  const results: Record<string, string> = {}
  let first = true
  for (const s of stores ?? []) {
    if (Date.now() > deadline - START_MARGIN_MS) { results[s.id] = 'skipped_time'; continue }
    try {
      const r = await runAutopilot(s.id, { deadline: deadline - 30_000, first })
      results[s.id] = r.note
    } catch (err) {
      // Un magazin cu probleme nu oprește restul; se reîncearcă la ora următoare
      logError('/api/cron/ads-sync', 'Pilotul a eșuat pe un magazin', { storeId: s.id, error: err instanceof Error ? err.message : String(err) })
      results[s.id] = 'error'
    }
    first = false
  }

  // Cifrele de azi: și pentru magazinele trecute acum (trecerea zilnică citește doar până ieri), cele necitite
  // de cel mai mult timp primele
  const today: Record<string, string> = {}
  const { data: live, error: liveError } = await supabase.from('stores')
    .select('id, ad_campaigns!inner(id)')
    .in('user_id', users)
    .eq('ad_campaigns.status', 'active')
    .not('ad_campaigns.google_campaign_id', 'is', null)
    .order('ads_today_at', { ascending: true, nullsFirst: true })
    .limit(200)
  if (liveError) logError('/api/cron/ads-sync', 'Nu am putut citi magazinele cu campanii pornite', { error: liveError.message })
  for (const s of live ?? []) {
    if (Date.now() > deadline) { today[s.id] = 'skipped_time'; continue }
    try {
      today[s.id] = await refreshToday(s.id)
    } catch (err) {
      logError('/api/cron/ads-sync', 'Cifrele de azi nu s-au putut citi', { storeId: s.id, error: err instanceof Error ? err.message : String(err) })
      today[s.id] = 'error'
    }
  }
  return NextResponse.json({ stores: (stores ?? []).length, results, today })
}
