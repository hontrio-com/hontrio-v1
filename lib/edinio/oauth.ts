import crypto from 'crypto'
import { encrypt, decrypt } from '@/lib/security/encryption'
import { EDINIO_CLIENT_ID, EdinioError, getEdinioConfig } from './config'
import type { EdinioStore } from './types'

// =============================================
// Edinio — fluxul OAuth 2.0 cu cod de autorizare și PKCE (RFC 6749 + 7636)
// =============================================

export const EDINIO_OAUTH_COOKIE = 'edinio_oauth'

// Cât are omul la dispoziție între „Conectează" și aprobarea din Edinio
// (Edinio ține și el cererea 10 minute).
export const EDINIO_OAUTH_MAX_AGE_SEC = 600

type PendingAuth = { state: string; userId: string; verifier: string; createdAt: number }

/**
 * Cererea pornită de utilizator: `state` (împotriva CSRF) și verificatorul PKCE.
 * Verificatorul nu pleacă niciodată prin browser: în cookie stă criptat, iar
 * la Edinio ajunge doar provocarea (SHA-256 al lui).
 */
export function createPendingAuth(userId: string): { pending: PendingAuth; challenge: string } {
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url')
  return {
    pending: { state: crypto.randomBytes(24).toString('base64url'), userId, verifier, createdAt: Date.now() },
    challenge,
  }
}

export function sealPendingAuth(pending: PendingAuth): string {
  return encrypt(JSON.stringify(pending))
}

/**
 * Cererea din cookie, dacă e a ACESTUI utilizator, pentru ACEST `state` și n-a expirat.
 * Cookie-ul e criptat (AES-256-GCM), deci nu poate fi scris de altcineva.
 */
export function openPendingAuth(sealed: string | undefined, userId: string, state: string, now = Date.now()): PendingAuth | null {
  if (!sealed) return null
  try {
    const p = JSON.parse(decrypt(sealed)) as PendingAuth
    if (p.userId !== userId || p.state !== state) return null
    if (now - p.createdAt > EDINIO_OAUTH_MAX_AGE_SEC * 1000) return null
    return p
  } catch {
    return null
  }
}

export function buildEdinioAuthorizeUrl(redirectUri: string, state: string, challenge: string): string {
  const { baseUrl } = getEdinioConfig()
  const url = new URL(`${baseUrl}/api/hontrio/v1/autorizare`)
  url.searchParams.set('client_id', EDINIO_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Schimbă codul pe jeton, server la server, cu secretul clientului.
 * ⚠ Codul e de unică folosință: NU se reîncearcă la o pană. Dacă Edinio vede
 * același cod de două ori, revocă jetonul dat pe el.
 */
export async function exchangeEdinioCode(
  code: string, redirectUri: string, verifier: string,
): Promise<{ accessToken: string; store: EdinioStore | null }> {
  const { baseUrl, clientSecret } = getEdinioConfig()
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/hontrio/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${encodeURIComponent(EDINIO_CLIENT_ID)}:${encodeURIComponent(clientSecret)}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }),
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    throw new EdinioError(`Edinio nu a răspuns la schimbul codului: ${(err as Error).message}`, 'network')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data.access_token !== 'string') {
    const code = data.error === 'invalid_grant' ? 'invalid_grant'
      : data.error === 'invalid_client' ? 'not_configured'
      : res.status >= 500 ? 'unavailable' : 'bad_response'
    throw new EdinioError(`Schimb cod → jeton eșuat: ${data.error || res.status}`, code, res.status)
  }
  return { accessToken: data.access_token, store: (data.magazin as EdinioStore | null) ?? null }
}
