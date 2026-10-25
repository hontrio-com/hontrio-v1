import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'

// =============================================
// Google OAuth 2.0 — conectarea contului Google Ads / Merchant Center
// =============================================

export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'
export const GOOGLE_CONTENT_SCOPE = 'https://www.googleapis.com/auth/content'

const SCOPES = ['openid', 'email', GOOGLE_ADS_SCOPE, GOOGLE_CONTENT_SCOPE]

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state'

export class GoogleAuthError extends Error {
  constructor(message: string, public code: 'not_configured' | 'invalid_grant' | 'token_exchange' | 'refresh') {
    super(message)
  }
}

function getClientCredentials() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError('GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET lipsesc', 'not_configured')
  }
  return { clientId, clientSecret }
}

// Redirect URI-ul trebuie să fie identic la autorizare și la schimbul codului,
// și înregistrat în Google Cloud. Îl derivăm din originea cererii, ca să meargă
// la fel pe localhost:3000, localhost:3002 și app.hontrio.com.
export function getRedirectUri(requestUrl: string): string {
  return `${new URL(requestUrl).origin}/api/integrations/google/callback`
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = getClientCredentials()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('state', state)
  // offline + consent → primim mereu refresh_token, și la reconectare
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  return url.toString()
}

export type GoogleTokens = {
  accessToken: string
  refreshToken: string | null
  expiresIn: number
  scopes: string[]
  googleUserId: string
  email: string | null
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientCredentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new GoogleAuthError(`Schimb cod → token eșuat: ${data.error || res.status} ${data.error_description || ''}`.trim(), 'token_exchange')
  }

  // id_token vine direct de la Google prin HTTPS, deci payload-ul poate fi citit
  // fără verificarea semnăturii (conform documentației OpenID Connect Google).
  const payload = decodeJwtPayload(data.id_token)
  if (!payload?.sub) {
    throw new GoogleAuthError('Google nu a returnat identitatea utilizatorului', 'token_exchange')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || 3600,
    scopes: typeof data.scope === 'string' ? data.scope.split(' ') : [],
    googleUserId: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : null,
  }
}

function decodeJwtPayload(jwt: unknown): Record<string, unknown> | null {
  if (typeof jwt !== 'string') return null
  const part = jwt.split('.')[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// ─── Access token din refresh token (cu cache în memorie) ─────────────────────

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getClientCredentials()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    // invalid_grant = utilizatorul a revocat accesul sau tokenul a expirat
    if (data.error === 'invalid_grant') throw new GoogleAuthError('Accesul Google a fost revocat', 'invalid_grant')
    throw new GoogleAuthError(`Refresh token eșuat: ${data.error || res.status}`, 'refresh')
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in || 3600 }
}

/**
 * Access token valid pentru conexiunea Google a utilizatorului.
 * Dacă Google a revocat accesul, marchează conexiunea ca 'revoked'.
 */
export async function getAccessTokenForUser(userId: string): Promise<string> {
  const cached = tokenCache.get(userId)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const supabase = createAdminClient()
  const { data: conn } = await supabase
    .from('google_connections')
    .select('id, refresh_token_encrypted, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!conn) throw new GoogleAuthError('Contul Google nu este conectat', 'invalid_grant')
  if (conn.status === 'revoked') throw new GoogleAuthError('Accesul Google a fost revocat', 'invalid_grant')

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(decrypt(conn.refresh_token_encrypted))
    tokenCache.set(userId, { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 })
    return accessToken
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      await supabase
        .from('google_connections')
        .update({ status: 'revoked', last_error: err.message, updated_at: new Date().toISOString() })
        .eq('id', conn.id)
    }
    throw err
  }
}

export function clearCachedAccessToken(userId: string) {
  tokenCache.delete(userId)
}

/** Revocă tokenul la Google (best effort). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10000),
    })
  } catch {}
}
