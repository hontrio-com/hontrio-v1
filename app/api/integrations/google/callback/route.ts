import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/security/encryption'
import {
  exchangeCode, getRedirectUri, clearCachedAccessToken,
  GOOGLE_ADS_SCOPE, GOOGLE_OAUTH_STATE_COOKIE,
} from '@/lib/google/oauth'
import { syncGoogleAdsAccounts } from '@/lib/google/accounts'
import { logApiError } from '@/lib/logger'
import { forgetReturn, returnUrl } from '@/lib/integrations/return-to'

// =============================================
// GET /api/integrations/google/callback
// Callback OAuth Google — salvează conexiunea și descoperă conturile Google Ads
// =============================================

/** Înapoi în Setări (sau în onboarding, dacă de acolo a pornit conectarea), cu rezultatul. */
function back(request: Request, params: Record<string, string>) {
  const response = NextResponse.redirect(returnUrl(request, params))
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE)
  return forgetReturn(response)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  // Utilizatorul a apăsat „Cancel” pe ecranul Google
  if (oauthError) return back(request, { google_error: oauthError === 'access_denied' ? 'access_denied' : 'oauth' })
  if (!code || !state) return back(request, { google_error: 'oauth' })

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login?callbackUrl=/settings?tab=integrations', request.url))
  }
  const userId = session.user.id

  // State-ul trebuie să corespundă cookie-ului ȘI utilizatorului care a pornit fluxul
  const cookieStore = await cookies()
  const saved = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  if (!saved || saved !== `${state}.${userId}`) {
    logApiError('/api/integrations/google/callback', 401, 'State OAuth invalid sau expirat', { userId })
    return back(request, { google_error: 'state' })
  }

  try {
    const tokens = await exchangeCode(code, getRedirectUri(request.url))

    // Consimțământ granular: utilizatorul poate debifa accesul la Google Ads
    if (!tokens.scopes.includes(GOOGLE_ADS_SCOPE)) {
      return back(request, { google_error: 'missing_scope' })
    }
    if (!tokens.refreshToken) {
      return back(request, { google_error: 'no_refresh_token' })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Alt cont Google decât cel conectat anterior → conturile Ads vechi nu mai sunt valabile
    const { data: previous } = await supabase
      .from('google_connections')
      .select('id, google_user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (previous && previous.google_user_id !== tokens.googleUserId) {
      await supabase.from('google_connections').delete().eq('id', previous.id)
    }

    const { data: conn, error } = await supabase
      .from('google_connections')
      .upsert({
        user_id: userId,
        google_user_id: tokens.googleUserId,
        google_email: tokens.email,
        refresh_token_encrypted: encrypt(tokens.refreshToken),
        scopes: tokens.scopes,
        status: 'active',
        last_error: null,
        updated_at: now,
      }, { onConflict: 'user_id' })
      .select('id')
      .single()

    if (error || !conn) {
      logApiError('/api/integrations/google/callback', 500, 'Eroare salvare conexiune Google', { error: error?.message })
      return back(request, { google_error: 'save' })
    }
    clearCachedAccessToken(userId)

    // Descoperirea conturilor nu blochează conectarea: dacă eșuează, se reîncearcă din Setări
    try {
      const result = await syncGoogleAdsAccounts(userId, conn.id, tokens.accessToken)
      if (result.count === 0 && result.errorCode) {
        return back(request, { google: 'connected', google_warning: result.errorCode })
      }
    } catch (err) {
      logApiError('/api/integrations/google/callback', 502, 'Eroare descoperire conturi Google Ads', {
        error: (err as Error).message,
      })
      return back(request, { google: 'connected', google_warning: 'discovery_failed' })
    }

    return back(request, { google: 'connected' })
  } catch (err) {
    logApiError('/api/integrations/google/callback', 500, 'Eroare callback OAuth Google', {
      error: (err as Error).message,
    })
    return back(request, { google_error: 'oauth' })
  }
}
