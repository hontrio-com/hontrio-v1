import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { syncEdinioStore, type SyncMode } from '@/lib/edinio/sync'

// =============================================
// Cron (la 15 minute): sincronizează magazinele Edinio conectate.
// Incremental de obicei; complet o dată pe zi, ca să prindă ștergerile.
// =============================================

export const maxDuration = 300

const FULL_EVERY_MS = 24 * 60 * 60 * 1000
// Nu se mai pornește un magazin nou cu mai puțin de atât rămas din funcție
const START_MARGIN_MS = 60_000

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const deadline = Date.now() + 270_000
  const supabase = createAdminClient()
  // Cele mai de mult nesincronizate primele, ca niciun magazin să nu rămână mereu la coadă
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, last_full_sync_at')
    .eq('platform', 'edinio')
    .eq('connection_status', 'active')
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(100)

  if (error) {
    logError('/api/cron/edinio-sync', 'Nu am putut citi magazinele Edinio', { error: error.message })
    return NextResponse.json({ error: 'db' }, { status: 500 })
  }

  const results: Record<string, string> = {}
  for (const s of stores ?? []) {
    if (Date.now() > deadline - START_MARGIN_MS) { results[s.id] = 'skipped_time'; continue }
    const full = !s.last_full_sync_at || Date.now() - new Date(s.last_full_sync_at).getTime() > FULL_EVERY_MS
    const mode: SyncMode = full ? 'full' : 'incremental'
    const r = await syncEdinioStore(s.id, mode, { deadline })
    results[s.id] = r.ok ? `${r.mode}: ${r.offers} oferte, ${r.orders} comenzi` : r.reason
  }

  return NextResponse.json({ stores: (stores ?? []).length, results })
}
