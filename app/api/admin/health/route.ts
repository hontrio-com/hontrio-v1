import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/sync'

// =============================================
// GET /api/admin/health — ce ține platforma în viață: baza de date, cheile
// OAuth pentru Google Ads și cele două cronuri. Pilotul (din oră în oră) face
// o trecere pe zi pe fiecare magazin cu Google conectat; sincronizarea
// magazinelor rulează la 15 minute. Un cron pare oprit când cea mai nouă
// trecere a lui e mai veche decât pragul. Fără magazine de trecut, cronul
// n-are ce face, deci nu e o problemă.
// Detaliile tehnice rămân în jurnal; pagina primește doar starea.
// =============================================

const ROUTE = '/api/admin/health'
const TIMEOUT_MS = 5000
// Un magazin intră din nou la pilot după 20 de ore, la următoarea rulare: cu un singur magazin, ~21 de ore
const ADS_STALE_MS = 25 * 60 * 60 * 1000
// Sincronizarea rulează la 15 minute și o ia de la magazinele cele mai vechi
const COMMERCE_STALE_MS = 60 * 60 * 1000

type Supabase = ReturnType<typeof createAdminClient>
type CheckId = 'database' | 'google_oauth' | 'ads_sync' | 'commerce_sync'
type Check = { id: CheckId; ok: boolean; latency?: number; last_at?: string | null; idle?: boolean }

function withTimeout<T>(work: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(work),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ])
}

const fresh = (iso: string | null, staleMs: number) => !!iso && Date.now() - Date.parse(iso) < staleMs

async function database(supabase: Supabase): Promise<Check> {
  const start = Date.now()
  try {
    const { error } = await withTimeout(supabase.from('users').select('id').limit(1))
    if (error) throw new Error(error.message)
    return { id: 'database', ok: true, latency: Date.now() - start }
  } catch (err) {
    logApiError(ROUTE, 500, 'Baza de date nu răspunde', { error: err instanceof Error ? err.message : String(err) })
    return { id: 'database', ok: false, latency: Date.now() - start }
  }
}

/** Cheile cu care Hontrio cere acces la Google Ads și Merchant Center (lib/google/oauth.ts). */
function googleOAuth(): Check {
  return { id: 'google_oauth', ok: !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET) }
}

/** Pilotul: aceleași magazine ca în /api/cron/ads-sync, cea mai nouă trecere (`ads_synced_at`). */
async function adsSync(supabase: Supabase): Promise<Check> {
  const { data: connections, error: eConn } = await withTimeout(supabase.from('google_connections').select('user_id').eq('status', 'active'))
  if (eConn) throw new Error(eConn.message)
  const users = (connections ?? []).map(c => c.user_id as string)
  if (!users.length) return { id: 'ads_sync', ok: true, idle: true, last_at: null }

  const { data: newest, error } = await withTimeout(supabase.from('stores')
    .select('ads_synced_at')
    .in('user_id', users)
    .in('platform', [...COMMERCE_PLATFORMS])
    .order('ads_synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle())
  if (error) throw new Error(error.message)
  if (!newest) return { id: 'ads_sync', ok: true, idle: true, last_at: null }
  const last = (newest.ads_synced_at as string | null) ?? null
  return { id: 'ads_sync', ok: fresh(last, ADS_STALE_MS), last_at: last }
}

/** Sincronizarea magazinelor: aceleași magazine ca în /api/cron/commerce-sync, cea mai nouă reușită (`last_sync_at`). */
async function commerceSync(supabase: Supabase): Promise<Check> {
  const { data: newest, error } = await withTimeout(supabase.from('stores')
    .select('last_sync_at')
    .in('platform', [...COMMERCE_PLATFORMS])
    .or('connection_status.is.null,connection_status.neq.revoked')
    .order('last_sync_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle())
  if (error) throw new Error(error.message)
  if (!newest) return { id: 'commerce_sync', ok: true, idle: true, last_at: null }
  const last = (newest.last_sync_at as string | null) ?? null
  return { id: 'commerce_sync', ok: fresh(last, COMMERCE_STALE_MS), last_at: last }
}

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  }

  const supabase = createAdminClient()
  const checks: Check[] = [await database(supabase), googleOAuth()]
  // Cronurile se citesc tot din bază: când nu se pot citi, starea lor e necunoscută, deci problemă
  for (const [id, run] of [['ads_sync', adsSync], ['commerce_sync', commerceSync]] as const) {
    try {
      checks.push(await run(supabase))
    } catch (err) {
      logApiError(ROUTE, 500, 'Nu am putut citi starea cronului', { check: id, error: err instanceof Error ? err.message : String(err) })
      checks.push({ id, ok: false, last_at: null })
    }
  }

  return NextResponse.json({ checks, allOk: checks.every(c => c.ok), checkedAt: new Date().toISOString() })
}
