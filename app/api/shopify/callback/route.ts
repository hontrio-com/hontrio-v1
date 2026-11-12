import { after, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { safeEqual } from '@/lib/security/compare'
import { clientIp, rateLimitAsync } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { setActiveStore } from '@/lib/stores/active'
import { syncCommerceStore } from '@/lib/commerce/sync'
import { ShopifyApi } from '@/lib/shopify/api'
import { isShopDomain, verifyOAuthHmac } from '@/lib/shopify/hmac'
import { SHOPIFY_ONBOARDING_COOKIE, SHOPIFY_STATE_COOKIE } from '@/lib/shopify/oauth'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/shopify/callback — întoarcerea din Shopify.
// Verifică semnătura Shopify (HMAC, în timp constant), forma magazinului și că
// `state` e al cererii pornite de ACEST cont, din acest browser; apoi schimbă
// codul pe jeton, salvează magazinul (jetonul criptat) și pornește prima
// sincronizare după răspuns.
// =============================================

const ROUTE = '/api/shopify/callback'

/** După răspunsul către om: anunțul la dezinstalare și prima sincronizare completă. */
function afterConnect(storeId: string, shop: string, accessToken: string) {
  after(async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
    try {
      await new ShopifyApi(shop, accessToken).subscribeUninstalled(`${appUrl}/api/shopify/webhooks`)
    } catch (e) {
      // Fără anunț, sincronizarea află oricum la primul refuz al lui Shopify
      logApiError(ROUTE, 500, 'Abonarea Shopify la dezinstalare a eșuat', { storeId, error: (e as Error).message })
    }
    const result = await syncCommerceStore(storeId, 'shopify', 'full')
    if (!result.ok && result.reason !== 'locked') {
      logApiError(ROUTE, 500, 'Prima sincronizare Shopify a eșuat', { storeId, reason: result.reason, message: result.message })
    }
  })
}

function done(request: Request, onboarding: boolean) {
  const response = NextResponse.redirect(new URL(onboarding ? '/onboarding?shopify=connected' : '/dashboard?shopify=connected', request.url))
  response.cookies.delete(SHOPIFY_STATE_COOKIE)
  response.cookies.delete(SHOPIFY_ONBOARDING_COOKIE)
  return response
}

export async function GET(request: Request) {
  // Omul ajunge aici din browser (întoarcerea din Shopify): erorile sunt în limba lui
  const t = await getT()
  try {
    const { searchParams } = new URL(request.url)
    const shop = (searchParams.get('shop') || '').toLowerCase()
    const code = searchParams.get('code') || ''
    const state = searchParams.get('state') || ''
    if (!shop || !code || !state || !searchParams.get('hmac')) {
      return NextResponse.json({ error: t('sync.shopify_callback_invalid') }, { status: 400 })
    }

    const rl = await rateLimitAsync(`shopify-callback:${clientIp(request.headers)}`, 20, 10 * 60 * 1000)
    if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
    if (!clientSecret || !process.env.SHOPIFY_CLIENT_ID) {
      logApiError(ROUTE, 500, 'SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET lipsesc')
      return NextResponse.json({ error: t('sync.server_not_configured') }, { status: 500 })
    }

    // Semnătura Shopify peste toți parametrii; apoi forma magazinului (codul pleacă doar la Shopify)
    if (!verifyOAuthHmac(searchParams, clientSecret) || !isShopDomain(shop)) {
      logApiError(ROUTE, 401, 'Semnătură sau magazin invalid la întoarcerea din Shopify', { shop: shop.slice(0, 100) })
      return NextResponse.json({ error: t('sync.shopify_signature_invalid') }, { status: 401 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', '/settings?tab=integrations')
      return NextResponse.redirect(loginUrl)
    }
    const userId = session.user.id

    // `state` trebuie să fie al cererii pornite de acest cont, din acest browser
    const cookieStore = await cookies()
    const savedState = cookieStore.get(SHOPIFY_STATE_COOKIE)?.value
    const isOnboardingReturn = cookieStore.get(SHOPIFY_ONBOARDING_COOKIE)?.value === '1'
    if (!savedState || !safeEqual(savedState, `${state}.${userId}`)) {
      logApiError(ROUTE, 401, 'State OAuth invalid sau cookie expirat', { userId })
      return NextResponse.json({ error: t('sync.connect_session_expired') }, { status: 401 })
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: clientSecret, code }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    })
    if (!tokenRes.ok) {
      logApiError(ROUTE, 400, 'Schimb cod → access_token eșuat', { shop, status: tokenRes.status })
      return NextResponse.json({ error: t('sync.shopify_token_failed') }, { status: 400 })
    }
    const tokenData = await tokenRes.json().catch(() => null) as { access_token?: unknown } | null
    const accessToken = typeof tokenData?.access_token === 'string' ? tokenData.access_token : ''
    if (!accessToken) return NextResponse.json({ error: t('sync.shopify_token_failed') }, { status: 400 })

    let encryptedToken: string
    try {
      encryptedToken = encrypt(accessToken)
    } catch (err) {
      logApiError(ROUTE, 500, 'Eroare criptare access_token', { error: (err as Error).message })
      return NextResponse.json({ error: t('sync.encryption_failed') }, { status: 500 })
    }

    const supabase = createAdminClient()
    const { data: existing, error: eExisting } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', shop)
      .limit(1)
      .maybeSingle()
    if (eExisting) {
      logApiError(ROUTE, 500, 'Eroare la verificarea magazinului Shopify', { userId, error: eExisting.message })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }

    if (existing) {
      if (existing.user_id !== userId) return NextResponse.json({ error: t('sync.store_taken') }, { status: 400 })
      // Reconectare (ex. după dezinstalare): tokenul vechi nu mai merge, cel nou da
      const { error } = await supabase.from('stores').update({
        api_key: encryptedToken, connection_status: 'active', last_error: null, sync_failures: 0, next_sync_at: null,
      }).eq('id', existing.id)
      if (error) {
        logApiError(ROUTE, 500, 'Eroare la reconectarea magazinului Shopify', { userId, error: error.message })
        return NextResponse.json({ error: t('sync.store_reconnect_failed') }, { status: 500 })
      }
      await setActiveStore(supabase, userId, existing.id)
      afterConnect(existing.id, shop, accessToken)
      return done(request, isOnboardingReturn)
    }

    const { data: saved, error } = await supabase
      .from('stores')
      .insert({
        user_id: userId,
        platform: 'shopify',
        store_url: shop,
        api_key: encryptedToken,
        api_secret: null,
        sync_status: 'active',
        connection_status: 'active',
        webhook_secret: crypto.randomUUID(),
      })
      .select('id')
      .single()
    if (error || !saved) {
      logApiError(ROUTE, 500, 'Eroare salvare magazin Shopify', { userId, error: error?.message ?? 'niciun rând' })
      return NextResponse.json({ error: t('sync.store_save_failed') }, { status: 500 })
    }

    // Magazinul abia legat e cel pe care omul vrea să-l vadă
    await setActiveStore(supabase, userId, saved.id)
    afterConnect(saved.id, shop, accessToken)
    return done(request, isOnboardingReturn)
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare internă callback Shopify', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
