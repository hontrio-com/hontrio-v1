import { NextResponse, after } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { syncCommerceStore } from '@/lib/commerce/sync'
import { setActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'

// Prima sincronizare (produse și comenzi) rulează în `after`, în limita duratei rutei
export const maxDuration = 300

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: 5 connect attempts per 10 minutes
    const rl = rateLimit(`store-connect:${userId}`, 5, 10 * 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: t('sync.too_many_attempts') },
        { status: 429 }
      )
    }

    const { store_url, consumer_key, consumer_secret } = await request.json()

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json(
        { error: t('sync.fields_required') },
        { status: 400 }
      )
    }

    // Validate & sanitize URL (SSRF protection)
    const urlValidation = validateStoreUrl(store_url)
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: t(urlValidation.error ?? 'sync.store_url_invalid') },
        { status: 400 }
      )
    }
    const cleanUrl = urlValidation.cleaned

    // Validate API key format
    if (typeof consumer_key !== 'string' || !consumer_key.startsWith('ck_') || consumer_key.length < 10) {
      return NextResponse.json(
        { error: t('sync.woo_consumer_key_invalid') },
        { status: 400 }
      )
    }
    if (typeof consumer_secret !== 'string' || !consumer_secret.startsWith('cs_') || consumer_secret.length < 10) {
      return NextResponse.json(
        { error: t('sync.woo_consumer_secret_invalid') },
        { status: 400 }
      )
    }

    // Test connection with WooCommerce (HTTPS only) + fetch store info
    let detectedCurrency = 'RON'
    let detectedStoreName: string | null = null
    try {
      const authHeader = 'Basic ' + Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
      const testUrl = `${cleanUrl}/wp-json/wc/v3/system_status`

      const testRes = await fetch(testUrl, {
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })

      if (!testRes.ok) {
        return NextResponse.json(
          { error: t('sync.woo_connect_failed') },
          { status: 400 }
        )
      }

      // Parse currency and store name from system_status
      try {
        const status = await testRes.json()
        if (status?.settings?.currency) detectedCurrency = status.settings.currency
        if (status?.settings?.blog_name) detectedStoreName = status.settings.blog_name
      } catch { /* ignore parse errors */ }
    } catch {
      return NextResponse.json(
        { error: t('sync.store_no_response_check_url') },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check if this store_url is already connected by ANY user
    const { data: existingByUrl } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', cleanUrl)
      .maybeSingle()

    if (existingByUrl) {
      if (existingByUrl.user_id === userId) {
        return NextResponse.json(
          { error: t('sync.store_already_connected') },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: t('sync.store_taken') },
        { status: 400 }
      )
    }

    // Un cont poate avea mai multe magazine: cel nou devine cel activ (mai jos)

    // Encrypt API keys before storing (AES-256-GCM)
    let encryptedKey: string
    let encryptedSecret: string
    try {
      encryptedKey = encrypt(consumer_key)
      encryptedSecret = encrypt(consumer_secret)
    } catch (encErr) {
      console.error('Encryption error:', encErr)
      return NextResponse.json(
        { error: t('sync.encryption_failed') },
        { status: 500 }
      )
    }

    // Save store with encrypted credentials + detected currency/name
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        platform: 'woocommerce',
        store_url: cleanUrl,
        api_key: encryptedKey,
        api_secret: encryptedSecret,
        sync_status: 'active',
        connection_status: 'active',
        webhook_secret: crypto.randomUUID(),
        currency: detectedCurrency,
        ...(detectedStoreName ? { store_name: detectedStoreName } : {}),
      })
      // Fără cheile API (nici criptate nu pleacă spre browser)
      .select('id, platform, store_url, store_name, currency, sync_status, connection_status, last_sync_at, products_count, created_at')
      .single()

    if (error) {
      console.error('Store insert error:', error.message, error.code, error.details)
      return NextResponse.json(
        { error: t('sync.store_save_failed') },
        { status: 500 }
      )
    }

    // Magazinul abia legat e cel pe care omul vrea să-l vadă
    await setActiveStore(supabase, userId, store.id)

    // Prima sincronizare completă în modelul de reclame: după ce omul a primit răspunsul.
    // Un magazin mare continuă la rulările cronului.
    after(async () => {
      const result = await syncCommerceStore(store.id, 'woocommerce', 'full')
      if (!result.ok && result.reason !== 'locked') {
        logApiError('/api/stores/connect', 500, 'Prima sincronizare WooCommerce a eșuat', { storeId: store.id, reason: result.reason, message: result.message })
      }
    })

    return NextResponse.json({ store })
  } catch (err) {
    console.error('Stores connect unexpected error:', err)
    return NextResponse.json(
      { error: t('api.internal_error') },
      { status: 500 }
    )
  }
}