import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { syncCommerceStore } from '@/lib/commerce/sync'
import { setActiveStore } from '@/lib/stores/active'
import { checkWooKeys, parseWooKeys } from '@/lib/woocommerce/connect'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/connect — leagă un magazin WooCommerce (cheile REST).
// Cheia se verifică întâi la magazin (adresă publică, cheie acceptată, poate
// citi comenzile), apoi se salvează criptată. Prima sincronizare rulează în
// `after`, în limita duratei rutei.
// =============================================

export const maxDuration = 300

const ROUTE = '/api/stores/connect'

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

    const parsed = parseWooKeys(await request.json().catch(() => null))
    if (!parsed.ok) return NextResponse.json({ error: t(parsed.key, parsed.params) }, { status: parsed.status })
    const { storeUrl, consumerKey, consumerSecret } = parsed.keys

    const check = await checkWooKeys(parsed.keys)
    if (!check.ok) return NextResponse.json({ error: t(check.key, check.params) }, { status: check.status })

    const supabase = createAdminClient()

    // Un magazin e al unui singur cont
    const { data: existingByUrl, error: eExisting } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', storeUrl)
      .limit(1)
      .maybeSingle()
    if (eExisting) {
      logApiError(ROUTE, 500, 'Eroare la verificarea magazinului', { userId, error: eExisting.message })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }
    if (existingByUrl) {
      return NextResponse.json({ error: t(existingByUrl.user_id === userId ? 'sync.store_already_connected' : 'sync.store_taken') }, { status: 400 })
    }

    let encryptedKey: string
    let encryptedSecret: string
    try {
      encryptedKey = encrypt(consumerKey)
      encryptedSecret = encrypt(consumerSecret)
    } catch (err) {
      logApiError(ROUTE, 500, 'Cheile nu au putut fi criptate', { error: (err as Error).message })
      return NextResponse.json({ error: t('sync.encryption_failed') }, { status: 500 })
    }

    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        platform: 'woocommerce',
        store_url: storeUrl,
        api_key: encryptedKey,
        api_secret: encryptedSecret,
        sync_status: 'active',
        connection_status: 'active',
        webhook_secret: crypto.randomUUID(),
        currency: check.currency ?? 'RON',
        ...(check.storeName ? { store_name: check.storeName } : {}),
      })
      // Fără cheile API (nici criptate nu pleacă spre browser)
      .select('id, platform, store_url, store_name, currency, sync_status, connection_status, last_sync_at, products_count, created_at')
      .single()

    if (error || !store) {
      logApiError(ROUTE, 500, 'Eroare la salvarea magazinului', { userId, error: error?.message ?? 'niciun rând' })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }

    // Magazinul abia legat e cel pe care omul vrea să-l vadă
    await setActiveStore(supabase, userId, store.id)

    // Prima sincronizare completă: după ce omul a primit răspunsul. Un magazin mare continuă la cron.
    after(async () => {
      const result = await syncCommerceStore(store.id, 'woocommerce', 'full')
      if (!result.ok && result.reason !== 'locked') {
        logApiError(ROUTE, 500, 'Prima sincronizare WooCommerce a eșuat', { storeId: store.id, reason: result.reason, message: result.message })
      }
    })

    return NextResponse.json({ store })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
