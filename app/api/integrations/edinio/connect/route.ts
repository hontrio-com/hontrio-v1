import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { getEdinioRedirectUri, isEdinioConfigured } from '@/lib/edinio/config'
import { rememberReturn, startFailureUrl } from '@/lib/integrations/return-to'
import {
  buildEdinioAuthorizeUrl, createPendingAuth, sealPendingAuth,
  EDINIO_OAUTH_COOKIE, EDINIO_OAUTH_MAX_AGE_SEC,
} from '@/lib/edinio/oauth'

// =============================================
// GET /api/integrations/edinio/connect
// Pornește conectarea cu Edinio: omul aprobă accesul în panoul Edinio,
// apoi se întoarce la /api/integrations/edinio/callback cu un cod.
// =============================================

function back(request: Request, error: string) {
  return NextResponse.redirect(startFailureUrl(request, { edinio_error: error }))
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login?callbackUrl=/settings?tab=integrations', request.url))
  }
  const userId = session.user.id

  const rl = rateLimit(`edinio-connect:${userId}`, 10, 60 * 1000)
  if (!rl.success) return back(request, 'rate_limited')
  if (!isEdinioConfigured()) return back(request, 'not_configured')

  // Un cont poate avea mai multe magazine: magazinul Edinio se adaugă lângă celelalte
  try {
    const { pending, challenge } = createPendingAuth(userId)
    const response = NextResponse.redirect(
      buildEdinioAuthorizeUrl(getEdinioRedirectUri(request.url), pending.state, challenge),
    )
    response.cookies.set(EDINIO_OAUTH_COOKIE, sealPendingAuth(pending), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: EDINIO_OAUTH_MAX_AGE_SEC,
      path: '/',
      // lax: întoarcerea din Edinio e o navigare de pe alt site, cookie-ul trebuie să vină cu ea
      sameSite: 'lax',
    })
    return rememberReturn(request, response)
  } catch (err) {
    logApiError('/api/integrations/edinio/connect', 500, 'Eroare inițiere conectare Edinio', { error: (err as Error).message })
    return back(request, 'generic')
  }
}
