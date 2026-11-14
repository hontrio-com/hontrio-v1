import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { bearerMatches } from '@/lib/security/compare'
import { COMMERCE_PLATFORMS, syncCommerceStore, type SyncMode } from '@/lib/commerce/sync'

// =============================================
// Cron (la 15 minute): sincronizează magazinele de pe toate platformele (Edinio,
// WooCommerce, Shopify, Gomag, MerchantPro, OpenCart).
// Incremental de obicei; complet o dată pe zi, ca să prindă ștergerile.
// O trecere completă rămasă la jumătate (magazin mare) continuă oricum.
//
// Magazinele vin în ordinea în care le-a venit rândul (next_sync_at): după un
// eșec, un magazin așteaptă tot mai mult, iar fiecare are cel mult PER_STORE_MS
// din rulare. Așa unul care nu răspunde nu ține pe loc restul.
// =============================================

export const maxDuration = 300

const FULL_EVERY_MS = 24 * 60 * 60 * 1000
// Nu se mai pornește un magazin nou cu mai puțin de atât rămas din funcție
const START_MARGIN_MS = 60_000
// Cât poate lua un singur magazin dintr-o rulare
const PER_STORE_MS = 90_000

export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore (răspuns pentru Vercel)
  }

  const deadline = Date.now() + 270_000
  const now = new Date().toISOString()
  const supabase = createAdminClient()
  // Cele cărora le-a venit rândul, cele mai vechi primele. Un magazin care nu răspunde (eroare)
  // se încearcă în continuare, cu pauză tot mai mare; unul cu cheia refuzată, nu.
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, platform, last_full_sync_at')
    .in('platform', [...COMMERCE_PLATFORMS])
    // Un singur filtru `or` (două ar însemna doi parametri cu același nume în cerere)
    .or(`and(or(connection_status.is.null,connection_status.neq.revoked),or(next_sync_at.is.null,next_sync_at.lte.${now}))`)
    .order('next_sync_at', { ascending: true, nullsFirst: true })
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(100)

  if (error) {
    logError('/api/cron/commerce-sync', 'Nu am putut citi magazinele', { error: error.message })
    return NextResponse.json({ error: 'db' }, { status: 500 })
  }

  const results: Record<string, string> = {}
  for (const s of stores ?? []) {
    if (Date.now() > deadline - START_MARGIN_MS) { results[s.id] = 'skipped_time'; continue }
    const full = !s.last_full_sync_at || Date.now() - new Date(s.last_full_sync_at).getTime() > FULL_EVERY_MS
    const mode: SyncMode = full ? 'full' : 'incremental'
    const r = await syncCommerceStore(s.id, s.platform, mode, { deadline: Math.min(deadline, Date.now() + PER_STORE_MS) })
    results[s.id] = r.ok
      ? `${r.mode}${r.complete ? '' : ' (continuă)'}: ${r.offers} oferte, ${r.orders} comenzi`
      : r.reason
  }

  return NextResponse.json({ stores: (stores ?? []).length, results })
}
