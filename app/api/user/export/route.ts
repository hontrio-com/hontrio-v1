import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/user/export — datele contului, într-un fișier JSON descărcat:
// profilul, magazinele (fără chei de acces), ofertele, comenzile (cu liniile),
// campaniile, grupele, propunerile și jurnalul pilotului, notificările și
// tichetele. Fișierul se scrie pe bucăți (un magazin mare are mii de comenzi),
// fără să țină totul în memorie.
// =============================================

export const maxDuration = 120

const ROUTE = '/api/user/export'
const PAGE = 1000

type Supabase = ReturnType<typeof createAdminClient>
type Row = Record<string, unknown>

// Ce nu iese din Hontrio: secrete, jetoane, stări interne ale sincronizării
const SECRET_USER_COLUMNS = ['email_verify_token_hash', 'email_verify_expires_at', 'session_version']
const SECRET_STORE_COLUMNS = ['api_key', 'api_secret', 'webhook_secret', 'sync_cursor']

const without = (row: Row | null, keys: string[]) => {
  if (!row) return null
  const copy = { ...row }
  for (const k of keys) delete copy[k]
  return copy
}

/** Toate rândurile unei cereri, pe pagini de câte 1000. */
async function* rows(fetchPage: (from: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): AsyncGenerator<Row> {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) yield r
    if (!data || data.length < PAGE) return
  }
}

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const rl = await rateLimitAsync(`export:${userId}`, 3, 60 * 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  const supabase: Supabase = createAdminClient()
  const [{ data: profile, error: eProfile }, { data: storeRows, error: eStores }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('stores').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
  ])
  if (eProfile || eStores || !profile) {
    logApiError(ROUTE, 500, 'Exportul n-a putut porni', { userId, error: eProfile?.message ?? eStores?.message ?? 'fără profil' })
    return NextResponse.json({ error: t('settings.export_failed') }, { status: 500 })
  }
  const storeIds = (storeRows ?? []).map(s => s.id as string)
  const byStores = (table: string) => (from: number) => storeIds.length
    ? supabase.from(table).select('*').in('store_id', storeIds).order('id', { ascending: true }).range(from, from + PAGE - 1)
    : Promise.resolve({ data: [] as Row[], error: null })
  const byUser = (table: string, columns = '*') => (from: number) =>
    supabase.from(table).select(columns).eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, from + PAGE - 1) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>

  const sections: [string, AsyncGenerator<Row>][] = [
    ['google_connection', rows(byUser('google_connections', 'google_email, status, scopes, created_at, updated_at'))],
    ['google_ads_accounts', rows(byUser('google_ads_accounts'))],
    ['offers', rows(byStores('commerce_offers'))],
    ['orders', rows(byStores('commerce_orders'))],
    ['order_lines', rows(byStores('commerce_order_lines'))],
    ['campaigns', rows(byUser('ad_campaigns'))],
    ['product_groups', rows(byUser('ad_product_groups'))],
    ['autopilot_actions', rows(byUser('ad_actions'))],
    ['notifications', rows(byUser('notifications'))],
    ['tickets', rows(byUser('tickets'))],
    ['ticket_replies', rows(byUser('ticket_replies'))],
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s))
      try {
        write(`{\n"format": "hontrio-export-v1",\n"exported_at": ${JSON.stringify(new Date().toISOString())}`)
        write(`,\n"profile": ${JSON.stringify(without(profile as Row, SECRET_USER_COLUMNS))}`)
        write(`,\n"stores": ${JSON.stringify((storeRows ?? []).map(s => without(s as Row, SECRET_STORE_COLUMNS)))}`)
        for (const [name, gen] of sections) {
          write(`,\n${JSON.stringify(name)}: [`)
          let first = true
          for await (const row of gen) {
            write(`${first ? '' : ','}\n${JSON.stringify(row)}`)
            first = false
          }
          write('\n]')
        }
        write('\n}\n')
        controller.close()
      } catch (err) {
        logApiError(ROUTE, 500, 'Exportul s-a oprit', { userId, error: (err as Error).message })
        controller.error(err)
      }
    },
  })

  const day = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="hontrio-export-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
