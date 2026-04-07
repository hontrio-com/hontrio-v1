import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/shopify/install
// Inițiază fluxul OAuth Shopify
// Rută publică — nu necesită autentificare NextAuth
// =============================================

const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'read_customers',
  'write_script_tags',
  'read_inventory',
].join(',')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shop = searchParams.get('shop')?.trim().toLowerCase() || ''
    const redirectOnboarding = searchParams.get('redirect_onboarding')

    if (!shop) {
      return NextResponse.json(
        { error: 'Parametrul shop lipsește. Exemplu: ?shop=magazin.myshopify.com' },
        { status: 400 }
      )
    }

    // Validare format: trebuie să fie *.myshopify.com
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)) {
      return NextResponse.json(
        { error: 'Format shop invalid. Trebuie să fie yourstore.myshopify.com' },
        { status: 400 }
      )
    }

    // Rate limit pe IP — max 10 cereri/minut
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const rl = rateLimit(`shopify-install:${ip}`, 10, 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Prea multe cereri. Încearcă din nou în câteva minute.' },
        { status: 429 }
      )
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID
    if (!clientId) {
      logApiError('/api/shopify/install', 500, 'SHOPIFY_CLIENT_ID lipsește din variabilele de mediu')
      return NextResponse.json(
        { error: 'Configurație server lipsă. Contactează suportul.' },
        { status: 500 }
      )
    }

    // Generează state UUID și salvează în cookie httpOnly (5 minute)
    const state = crypto.randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
    const redirectUri = `${appUrl}/api/shopify/callback`

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('scope', SHOPIFY_SCOPES)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    const response = NextResponse.redirect(authUrl.toString())

    // Cookie state OAuth (5 minute)
    response.cookies.set('shopify_oauth_state', state, {
      httpOnly: true,
      maxAge: 300,
      path: '/',
      sameSite: 'lax',
    })

    // Cookie flag onboarding (dacă vine din onboarding)
    if (redirectOnboarding === 'true') {
      response.cookies.set('shopify_redirect_onboarding', '1', {
        httpOnly: true,
        maxAge: 300,
        path: '/',
        sameSite: 'lax',
      })
    }

    return response
  } catch (err) {
    logApiError('/api/shopify/install', 500, 'Eroare internă', {
      error: (err as Error).message,
    })
    return NextResponse.json(
      { error: 'Eroare internă: ' + (err as Error).message },
      { status: 500 }
    )
  }
}
