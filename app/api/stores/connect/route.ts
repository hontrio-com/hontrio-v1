import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { syncCommerceStore } from '@/lib/commerce/sync'
import { KEY_CONNECTORS, keyPlatformOf } from '@/lib/commerce/connect'
import { wwwVariants } from '@/lib/commerce/connect-types'
import { PLATFORM_NAMES } from '@/lib/commerce/platforms'
import { setActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/connect — leagă un magazin cu chei: WooCommerce (implicit),
// Gomag, MerchantPro sau OpenCart (extensia Hontrio), după `platform`.
// Cheile se verifică întâi la platformă (adresă publică, cheie acceptată, poate
// citi comenzile), apoi se salvează criptate. Prima sincronizare rulează în
// `after`, în limita duratei rutei.
//
// Același magazin, din nou, în același cont și pe aceeași platformă: cheile se
// înlocuiesc pe rândul existent (o cheie refuzată se repară fără să pierzi
// campaniile și istoria magazinului).
// =============================================

export const maxDuration = 300

const ROUTE = '/api/stores/connect'
const PUBLIC_COLUMNS = 'id, platform, store_url, store_name, currency, sync_status, connection_status, last_sync_at, products_count, created_at'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const allowed = await rateLimitAll([
      [`store-connect:${userId}`, 5, 10 * 60 * 1000],
      [`store-connect-ip:${clientIp(request.headers)}`, 20, 10 * 60 * 1000],
    ])
    if (!allowed) return NextResponse.json({ error: t('sync.too_many_attempts') }, { status: 429 })

    const body = await request.json().catch(() => null)
    const platform = keyPlatformOf(body)
    if (!platform) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })
    const connector = KEY_CONNECTORS[platform]

    const parsed = connector.parse(body)
    if (!parsed.ok) return NextResponse.json({ error: t(parsed.key, parsed.params) }, { status: parsed.status })

    const check = await connector.check(parsed.keys)
    if (!check.ok) return NextResponse.json({ error: t(check.key, check.params) }, { status: check.status })
    // Adresa la care platforma a răspuns (poate cu „www." în plus sau în minus)
    const storeUrl = check.storeUrl

    const supabase = createAdminClient()

    // Un magazin e al unui singur cont (oricum ar fi scrisă adresa: cu sau fără „www.")
    const { data: existing, error: eExisting } = await supabase
      .from('stores')
      .select('id, user_id, platform, platform_data')
      .in('store_url', wwwVariants(storeUrl))
      .limit(1)
      .maybeSingle()
    if (eExisting) {
      logApiError(ROUTE, 500, 'Eroare la verificarea magazinului', { userId, error: eExisting.message })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }
    if (existing && (existing.user_id !== userId || existing.platform !== platform)) {
      return NextResponse.json({ error: t(existing.user_id === userId ? 'sync.store_already_connected' : 'sync.store_taken') }, { status: 400 })
    }

    let encryptedKey: string
    let encryptedSecret: string | null
    try {
      encryptedKey = encrypt(parsed.keys.apiKey)
      encryptedSecret = parsed.keys.apiSecret ? encrypt(parsed.keys.apiSecret) : null
    } catch (err) {
      logApiError(ROUTE, 500, 'Cheile nu au putut fi criptate', { error: (err as Error).message })
      return NextResponse.json({ error: t('sync.encryption_failed') }, { status: 500 })
    }

    const credentials = {
      store_url: storeUrl,
      api_key: encryptedKey,
      api_secret: encryptedSecret,
      connection_status: 'active',
      last_error: null,
      sync_failures: 0,
      next_sync_at: null,
      ...(check.storeName ? { store_name: check.storeName } : {}),
      // Ce a aflat verificarea despre magazin (ex. forma adresei recunoscută de Gomag), peste ce știam
      ...(check.platformData ? { platform_data: { ...((existing?.platform_data as Record<string, unknown> | null) ?? {}), ...check.platformData } } : {}),
    }

    // Fără cheile API în răspuns (nici criptate nu pleacă spre browser)
    const { data: store, error } = existing
      ? await supabase.from('stores').update(credentials).eq('id', existing.id).eq('user_id', userId).select(PUBLIC_COLUMNS).single()
      : await supabase.from('stores').insert({
        ...credentials,
        user_id: userId,
        platform,
        sync_status: 'active',
        webhook_secret: crypto.randomUUID(),
        currency: check.currency ?? 'RON',
      }).select(PUBLIC_COLUMNS).single()

    if (error || !store) {
      logApiError(ROUTE, 500, 'Eroare la salvarea magazinului', { userId, platform, error: error?.message ?? 'niciun rând' })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }

    // Magazinul abia legat e cel pe care omul vrea să-l vadă
    await setActiveStore(supabase, userId, store.id)

    // Prima sincronizare completă: după ce omul a primit răspunsul. Un magazin mare continuă la cron.
    after(async () => {
      const result = await syncCommerceStore(store.id, platform, 'full')
      if (!result.ok && result.reason !== 'locked') {
        logApiError(ROUTE, 500, `Prima sincronizare ${PLATFORM_NAMES[platform]} a eșuat`, { storeId: store.id, reason: result.reason, message: result.message })
      }
    })

    return NextResponse.json({ store, reconnected: !!existing })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
