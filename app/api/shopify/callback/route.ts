import { after, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { setActiveStore } from '@/lib/stores/active'
import { syncCommerceStore } from '@/lib/commerce/sync'
import { ShopifyApi } from '@/lib/shopify/api'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// =============================================
// GET /api/shopify/callback
// Callback OAuth Shopify — rută publică (verifică sesiunea manual)
// =============================================

const ROUTE = '/api/shopify/callback'

/**
 * După răspunsul către om: anunțul la dezinstalare și prima sincronizare
 * completă în modelul de reclame (un magazin mare continuă la cron).
 */
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shop  = searchParams.get('shop')  || ''
    const code  = searchParams.get('code')  || ''
    const state = searchParams.get('state') || ''
    const hmac  = searchParams.get('hmac')  || ''

    if (!shop || !code || !state || !hmac) {
      return NextResponse.json(
        { error: 'Parametri lipsă din callback-ul Shopify' },
        { status: 400 }
      )
    }

    // Rate limit pe shop — max 5 cereri/minut
    const rl = rateLimit(`shopify-callback:${shop}`, 5, 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Prea multe cereri. Încearcă din nou.' },
        { status: 429 }
      )
    }

    // ─── Verifică HMAC Shopify ────────────────────────────────────────────────
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
    if (!clientSecret) {
      logApiError('/api/shopify/callback', 500, 'SHOPIFY_CLIENT_SECRET lipsește')
      return NextResponse.json({ error: 'Configurație server lipsă' }, { status: 500 })
    }

    // Construiește query string fără hmac, sortat alfabetic
    const params = new URLSearchParams(searchParams.toString())
    params.delete('hmac')
    const sortedQuery = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')

    const calculatedHmac = crypto
      .createHmac('sha256', clientSecret)
      .update(sortedQuery)
      .digest('hex')

    if (calculatedHmac !== hmac) {
      logApiError('/api/shopify/callback', 401, 'HMAC invalid', { shop })
      return NextResponse.json({ error: 'Semnătură HMAC invalidă' }, { status: 401 })
    }

    // ─── Verifică state cu cookie ─────────────────────────────────────────────
    const cookieStore = await cookies()
    const savedState         = cookieStore.get('shopify_oauth_state')?.value
    const isOnboardingReturn = cookieStore.get('shopify_redirect_onboarding')?.value === '1'

    if (!savedState || savedState !== state) {
      logApiError('/api/shopify/callback', 401, 'State OAuth invalid sau cookie expirat', { shop })
      return NextResponse.json(
        { error: 'State OAuth invalid sau sesiunea a expirat. Încearcă din nou.' },
        { status: 401 }
      )
    }

    // ─── Schimbă codul cu access_token ───────────────────────────────────────
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: clientSecret,
        code,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '')
      logApiError('/api/shopify/callback', 400, 'Schimb cod → access_token eșuat', {
        shop, status: tokenRes.status, body: errBody.substring(0, 300),
      })
      return NextResponse.json(
        { error: 'Nu s-a putut obține access_token de la Shopify. Încearcă din nou.' },
        { status: 400 }
      )
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Shopify nu a returnat un access_token valid' },
        { status: 400 }
      )
    }

    // ─── Verifică sesiunea NextAuth (obligatoriu autentificat) ───────────────
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      // Redirecționează la login — utilizatorul trebuie să se autentifice mai întâi
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', '/settings?tab=integrations')
      return NextResponse.redirect(loginUrl)
    }

    const userId = session.user.id
    const supabase = createAdminClient()

    // ─── Verifică duplicat: shop conectat deja ────────────────────────────────
    const { data: existingByUrl } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', shop)
      .maybeSingle()

    if (existingByUrl) {
      if (existingByUrl.user_id === userId) {
        // Reconectare (ex. după dezinstalare): tokenul vechi nu mai merge, cel nou da
        const { error: eUpdate } = await supabase.from('stores').update({
          api_key: encrypt(accessToken), connection_status: 'active', last_error: null,
        }).eq('id', existingByUrl.id)
        if (eUpdate) {
          logApiError(ROUTE, 500, 'Eroare la reconectarea magazinului Shopify', { error: eUpdate.message, shop })
          return NextResponse.json({ error: 'Eroare la reconectarea magazinului' }, { status: 500 })
        }
        await setActiveStore(supabase, userId, existingByUrl.id)
        afterConnect(existingByUrl.id, shop, accessToken)
        const destination = isOnboardingReturn
          ? '/onboarding?step=3&shopify=connected'
          : '/dashboard?shopify=connected'
        const resp = NextResponse.redirect(new URL(destination, request.url))
        resp.cookies.delete('shopify_oauth_state')
        resp.cookies.delete('shopify_redirect_onboarding')
        return resp
      }
      return NextResponse.json(
        { error: 'Acest magazin Shopify este deja conectat la un alt cont Hontrio.' },
        { status: 400 }
      )
    }

    // Un cont poate avea mai multe magazine: cel nou devine cel activ (mai jos)

    // ─── Criptează access_token (AES-256-GCM) ────────────────────────────────
    let encryptedToken: string
    try {
      encryptedToken = encrypt(accessToken)
    } catch (encErr) {
      logApiError('/api/shopify/callback', 500, 'Eroare criptare access_token', {
        error: (encErr as Error).message,
      })
      return NextResponse.json(
        { error: 'Eroare la criptarea credențialelor. Verifică ENCRYPTION_KEY.' },
        { status: 500 }
      )
    }

    // ─── Salvează magazinul în Supabase ──────────────────────────────────────
    const { data: saved, error: storeError } = await supabase
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

    if (storeError || !saved) {
      logApiError('/api/shopify/callback', 500, 'Eroare salvare magazin Shopify', {
        error: storeError?.message, shop,
      })
      return NextResponse.json(
        { error: 'Eroare la salvarea magazinului: ' + (storeError?.message ?? 'fără rând') },
        { status: 500 }
      )
    }

    // Magazinul abia legat e cel pe care omul vrea să-l vadă
    await setActiveStore(supabase, userId, saved.id)
    afterConnect(saved.id, shop, accessToken)

    console.log('[ShopifyCallback] Magazin conectat cu succes:', shop, 'user:', userId)

    // ─── Șterge cookie-urile OAuth și redirecționează ─────────────────────────
    const destination = isOnboardingReturn
      ? '/onboarding?step=3&shopify=connected'
      : '/dashboard?shopify=connected'

    const response = NextResponse.redirect(new URL(destination, request.url))
    response.cookies.delete('shopify_oauth_state')
    response.cookies.delete('shopify_redirect_onboarding')

    return response
  } catch (err) {
    logApiError('/api/shopify/callback', 500, 'Eroare internă callback Shopify', {
      error: (err as Error).message,
    })
    return NextResponse.json(
      { error: 'Eroare internă: ' + (err as Error).message },
      { status: 500 }
    )
  }
}
