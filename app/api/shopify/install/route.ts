import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { isShopDomain } from '@/lib/shopify/hmac'
import { SHOPIFY_ONBOARDING_COOKIE, SHOPIFY_SCOPES, SHOPIFY_STATE_COOKIE, shopifyCookieOptions } from '@/lib/shopify/oauth'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/shopify/install?shop=magazin.myshopify.com[&redirect_onboarding=true]
// Pornește conectarea unui magazin Shopify (OAuth) pentru omul intrat în cont:
// `state` se leagă de cont printr-un cookie, ca întoarcerea să nu poată lega
// magazinul la alt cont decât cel care a pornit conectarea.
// =============================================

export async function GET(request: Request) {
  // Omul ajunge aici din browser (butonul de conectare): erorile sunt în limba lui
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', request.url))
  const userId = session.user.id

  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')?.trim().toLowerCase() || ''
  if (!shop) return NextResponse.json({ error: t('sync.shopify_shop_missing') }, { status: 400 })
  if (!isShopDomain(shop)) return NextResponse.json({ error: t('sync.shopify_shop_invalid') }, { status: 400 })

  const allowed = await rateLimitAll([
    [`shopify-install:${userId}`, 10, 10 * 60 * 1000],
    [`shopify-install-ip:${clientIp(request.headers)}`, 30, 10 * 60 * 1000],
  ])
  if (!allowed) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  const clientId = process.env.SHOPIFY_CLIENT_ID
  if (!clientId) {
    logApiError('/api/shopify/install', 500, 'SHOPIFY_CLIENT_ID lipsește din variabilele de mediu')
    return NextResponse.json({ error: t('sync.server_not_configured') }, { status: 500 })
  }

  const state = crypto.randomUUID()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', SHOPIFY_SCOPES)
  authUrl.searchParams.set('redirect_uri', `${appUrl}/api/shopify/callback`)
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(SHOPIFY_STATE_COOKIE, `${state}.${userId}`, shopifyCookieOptions())
  if (searchParams.get('redirect_onboarding') === 'true') response.cookies.set(SHOPIFY_ONBOARDING_COOKIE, '1', shopifyCookieOptions())
  return response
}
