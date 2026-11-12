import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { log, logError } from '@/lib/logger'

// =============================================
// Cron (zilnic): curățenia datelor, ca Hontrio să nu țină nimic mai mult decât
// îi trebuie.
//   - comenzile magazinelor (cu liniile lor, în cascadă) mai vechi de 400 de zile
//   - metricile Google Ads, termenii de căutare și jurnalul pilotului, peste 400 de zile
//   - tot ce vine din Google (auditul, rapoartele Merchant, metricile, jurnalul) la
//     magazinele fără o legătură Google activă de 30 de zile. Campaniile și grupele
//     rămân: sunt setările omului și fără ele o reconectare ar dubla campaniile.
//   - magazinele deconectate (revoked / uninstalled) fără nicio sincronizare de 30 de
//     zile; ofertele, comenzile și campaniile lor pleacă în cascadă
//   - tichetele închise de peste 24 de luni, cu răspunsurile și atașamentele lor
//   - notificările mai vechi de 12 luni
//   - jetoanele de resetare a parolei expirate
//   - conturile neconfirmate mai vechi de 7 zile (users.email_verified_at, migrarea
//     025), niciodată adminii și niciodată conturile cu un magazin
// Se lucrează pe bucăți, cu un termen-limită; ce rămâne se face a doua zi.
// =============================================

export const maxDuration = 300

const ROUTE = '/api/cron/retention'
const DAY_MS = 86_400_000
/** Câte rânduri pe o cerere: ID-urile ajung în adresa cererii către Supabase. */
const BATCH = 200
const STORE_CHUNK = 100
const MAX_USERS_PER_RUN = 1000
const START_MARGIN_MS = 30_000

type Supabase = ReturnType<typeof createAdminClient>
type Rows<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
type Removal = PromiseLike<{ error: { message: string } | null; count: number | null }>

/** Bearer CRON_SECRET, comparat în timp constant. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
const day = (msAgo: number) => iso(msAgo).slice(0, 10)
const chunks = <T,>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore (răspuns pentru Vercel)
  }

  const deadline = Date.now() + 270_000
  const timeLeft = () => Date.now() < deadline - START_MARGIN_MS
  const supabase = createAdminClient()
  const counts: Record<string, number> = {}
  const failed: string[] = []

  const add = (key: string, n: number | null | undefined) => { counts[key] = (counts[key] ?? 0) + (n ?? 0) }

  /** Un pas al curățeniei: o eroare se notează și trece la următorul. */
  async function step(name: string, work: () => Promise<void>) {
    if (!timeLeft()) { failed.push(`${name}:skipped_time`); return }
    try {
      await work()
    } catch (err) {
      failed.push(name)
      logError(ROUTE, 'Un pas al curățeniei a eșuat', { step: name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  /** Șterge pe bucăți: alege ID-urile, apoi le șterge, până nu mai rămâne nimic sau se termină timpul. */
  async function inBatches<T extends { id: string | number }>(key: string, pick: () => Rows<T>, remove: (ids: (string | number)[]) => Removal) {
    while (timeLeft()) {
      const { data, error } = await pick()
      if (error) throw new Error(`${key}: ${error.message}`)
      const ids = (data ?? []).map(r => r.id)
      if (!ids.length) return
      const { error: eDel, count } = await remove(ids)
      if (eDel) throw new Error(`${key}: ${eDel.message}`)
      add(key, count ?? ids.length)
      if (ids.length < BATCH) return
    }
  }

  // ─── 1. Comenzile peste 400 de zile (liniile pleacă în cascadă) ──────────────
  const cutoff400 = iso(400 * DAY_MS)
  await step('commerce_orders', () => inBatches('commerce_orders',
    () => supabase.from('commerce_orders').select('id').lt('placed_at', cutoff400).limit(BATCH),
    ids => supabase.from('commerce_orders').delete({ count: 'exact' }).in('id', ids)))

  // ─── 2. Datele Google Ads peste 400 de zile, magazin cu magazin ──────────────
  let storeIds: string[] = []
  await step('stores_list', async () => {
    const { data, error } = await supabase.from('stores').select('id')
    if (error) throw new Error(error.message)
    storeIds = (data ?? []).map(s => s.id as string)
  })
  const day400 = day(400 * DAY_MS)
  await step('ads_history', async () => {
    for (const storeId of storeIds) {
      if (!timeLeft()) { failed.push('ads_history:skipped_time'); return }
      const results = await Promise.all([
        supabase.from('ad_metrics_daily').delete({ count: 'exact' }).eq('store_id', storeId).lt('date', day400),
        supabase.from('ad_product_metrics_daily').delete({ count: 'exact' }).eq('store_id', storeId).lt('date', day400),
        supabase.from('ad_search_terms').delete({ count: 'exact' }).eq('store_id', storeId).lt('period_end', day400),
      ])
      const tables = ['ad_metrics_daily', 'ad_product_metrics_daily', 'ad_search_terms']
      results.forEach((r, i) => {
        if (r.error) throw new Error(`${tables[i]}: ${r.error.message}`)
        add(tables[i], r.count)
      })
    }
  })
  await step('ad_actions', () => inBatches('ad_actions',
    () => supabase.from('ad_actions').select('id').lt('created_at', cutoff400).limit(BATCH),
    ids => supabase.from('ad_actions').delete({ count: 'exact' }).in('id', ids)))

  // ─── 3. Datele din Google, fără legătură Google activă de 30 de zile ─────────
  // Deconectarea șterge rândul din google_connections, deci timpul îl dă ultima
  // trecere a pilotului (ads_synced_at), care se oprește odată cu legătura.
  const cutoff30 = iso(30 * DAY_MS)
  await step('google_data', async () => {
    const { data: connections, error: eConn } = await supabase.from('google_connections').select('user_id, status, updated_at')
    if (eConn) throw new Error(eConn.message)
    // Legătura activă sau oprită de mai puțin de 30 de zile: datele rămân
    const keep = new Set((connections ?? [])
      .filter(c => c.status === 'active' || Date.parse(c.updated_at as string) >= Date.parse(cutoff30))
      .map(c => c.user_id as string))
    const { data: idle, error } = await supabase.from('stores').select('id, user_id').or(`ads_synced_at.is.null,ads_synced_at.lt.${cutoff30}`)
    if (error) throw new Error(error.message)
    const stale = (idle ?? []).filter(s => !keep.has(s.user_id as string)).map(s => s.id as string)
    const tables = ['google_audits', 'merchant_insights', 'ad_metrics_daily', 'ad_product_metrics_daily', 'ad_search_terms', 'ad_actions']
    for (const chunk of chunks(stale, STORE_CHUNK)) {
      if (!timeLeft()) { failed.push('google_data:skipped_time'); return }
      for (const table of tables) {
        const { error: eDel, count } = await supabase.from(table).delete({ count: 'exact' }).in('store_id', chunk)
        if (eDel) throw new Error(`${table}: ${eDel.message}`)
        add(`google_data.${table}`, count)
      }
    }
  })

  // ─── 4. Magazinele deconectate, fără sincronizare de 30 de zile ──────────────
  // (`stores` n-are o coloană updated_at în migrații: contează ultima sincronizare reușită)
  await step('stores_revoked', () => inBatches('stores_revoked',
    () => supabase.from('stores').select('id')
      .in('connection_status', ['revoked', 'uninstalled'])
      .or(`last_sync_at.lt.${cutoff30},and(last_sync_at.is.null,created_at.lt.${cutoff30})`)
      .limit(BATCH),
    ids => supabase.from('stores').delete({ count: 'exact' }).in('id', ids).in('connection_status', ['revoked', 'uninstalled'])))

  // ─── 5. Tichetele închise de peste 24 de luni, cu răspunsuri și atașamente ───
  const cutoff24m = iso(730 * DAY_MS)
  await step('tickets', async () => {
    while (timeLeft()) {
      const { data: tickets, error } = await supabase.from('tickets').select('id, attachments')
        .in('status', ['closed', 'resolved']).lt('updated_at', cutoff24m).limit(BATCH)
      if (error) throw new Error(error.message)
      if (!tickets?.length) return
      const ids = tickets.map(t => t.id as string)
      const { data: replies, error: eReplies } = await supabase.from('ticket_replies').select('attachments').in('ticket_id', ids)
      if (eReplies) throw new Error(eReplies.message)
      await removeAttachments(supabase, [...tickets, ...(replies ?? [])].flatMap(r => attachmentPaths(r.attachments)))
      const { error: eDelReplies, count: repliesCount } = await supabase.from('ticket_replies').delete({ count: 'exact' }).in('ticket_id', ids)
      if (eDelReplies) throw new Error(eDelReplies.message)
      const { error: eDel, count } = await supabase.from('tickets').delete({ count: 'exact' }).in('id', ids)
      if (eDel) throw new Error(eDel.message)
      add('ticket_replies', repliesCount)
      add('tickets', count)
      if (ids.length < BATCH) return
    }
  })

  // ─── 6. Notificările mai vechi de 12 luni ────────────────────────────────────
  const cutoff12m = iso(365 * DAY_MS)
  await step('notifications', () => inBatches('notifications',
    () => supabase.from('notifications').select('id').lt('created_at', cutoff12m).limit(BATCH),
    ids => supabase.from('notifications').delete({ count: 'exact' }).in('id', ids)))

  // ─── 7. Jetoanele de resetare a parolei expirate ─────────────────────────────
  await step('password_reset_tokens', async () => {
    const { error, count } = await supabase.from('password_reset_tokens').delete({ count: 'exact' }).lt('expires_at', new Date().toISOString())
    if (error) throw new Error(error.message)
    add('password_reset_tokens', count)
  })

  // ─── 8. Conturile neconfirmate de peste 7 zile (niciun admin, niciun magazin) ─
  await step('unverified_users', async () => {
    const { data: candidates, error } = await supabase.from('users').select('id')
      .is('email_verified_at', null).neq('role', 'admin').lt('created_at', iso(7 * DAY_MS))
      .order('created_at', { ascending: true }).limit(MAX_USERS_PER_RUN)
    if (error) throw new Error(error.message)
    for (const chunk of chunks((candidates ?? []).map(u => u.id as string), BATCH)) {
      if (!timeLeft()) { failed.push('unverified_users:skipped_time'); return }
      // Cine are un magazin sau o legătură Google a folosit platforma: nu se atinge
      const [{ data: owners, error: eStores }, { data: linked, error: eGoogle }] = await Promise.all([
        supabase.from('stores').select('user_id').in('user_id', chunk),
        supabase.from('google_connections').select('user_id').in('user_id', chunk),
      ])
      if (eStores || eGoogle) throw new Error((eStores ?? eGoogle)!.message)
      const used = new Set([...(owners ?? []), ...(linked ?? [])].map(r => r.user_id as string))
      const ids = chunk.filter(id => !used.has(id))
      if (!ids.length) continue
      // Condițiile se verifică din nou în ștergere, ca o confirmare de acum să nu fie prinsă
      const { data: removed, error: eDel } = await supabase.from('users').delete()
        .in('id', ids).is('email_verified_at', null).neq('role', 'admin')
        .select('id')
      if (eDel) throw new Error(eDel.message)
      add('unverified_users', removed?.length)
      // Contul din Supabase Auth (la înregistrarea cu parolă), ca adresa să poată fi folosită din nou
      for (const u of removed ?? []) {
        const { error: eAuth } = await supabase.auth.admin.deleteUser(u.id as string)
        if (eAuth && eAuth.status !== 404) logError(ROUTE, 'Contul din Supabase Auth nu s-a șters', { userId: u.id, error: eAuth.message })
      }
    }
  })

  log('INFO', ROUTE, 'Curățenia zilnică', { counts, failed })
  return NextResponse.json({ ok: failed.length === 0, counts, failed })
}

/** Căile fișierelor atașate (formatul vechi și cel nou au amândouă `path`). */
function attachmentPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(a => (a && typeof a === 'object' && typeof (a as { path?: unknown }).path === 'string' ? [(a as { path: string }).path] : []))
}

/** Atașamentele stau în bucketul privat `ticket-attachments` (migrarea 026) sau, cele vechi, în `uploads`. */
async function removeAttachments(supabase: Supabase, paths: string[]) {
  for (const chunk of chunks(paths, 100)) {
    for (const bucket of ['ticket-attachments', 'uploads']) {
      const { error } = await supabase.storage.from(bucket).remove(chunk)
      if (error) logError(ROUTE, 'Atașamentele nu s-au șters', { bucket, error: error.message })
    }
  }
}
