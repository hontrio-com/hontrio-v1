import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { buildAuthUrl, getRedirectUri, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google/oauth'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/integrations/google/connect
// Inițiază fluxul OAuth Google (Google Ads + Merchant Center)
// =============================================

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login?callbackUrl=/settings?tab=integrations', request.url))
  }
  const userId = session.user.id

  const rl = rateLimit(`google-connect:${userId}`, 10, 60 * 1000)
  if (!rl.success) {
    return NextResponse.redirect(new URL('/settings?tab=integrations&google_error=rate_limited', request.url))
  }

  try {
    const state = crypto.randomUUID()
    const response = NextResponse.redirect(buildAuthUrl(getRedirectUri(request.url), state))
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, `${state}.${userId}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
      sameSite: 'lax',
    })
    return response
  } catch (err) {
    logApiError('/api/integrations/google/connect', 500, 'Eroare inițiere OAuth Google', {
      error: (err as Error).message,
    })
    return NextResponse.redirect(new URL('/settings?tab=integrations&google_error=not_configured', request.url))
  }
}
