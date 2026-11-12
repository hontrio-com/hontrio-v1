// =============================================
// Cloudflare Turnstile: verificarea că formularul (înscriere, intrare, parolă
// uitată) e trimis de un om. Pornește doar cu TURNSTILE_SECRET_KEY setat;
// fără cheie, verificarea trece (dezvoltare). Widgetul apare în pagini când e
// setat NEXT_PUBLIC_TURNSTILE_SITE_KEY.
// =============================================

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

/** Jetonul din widget e valid (o singură folosire). Dacă Cloudflare nu răspunde: refuzat. */
export async function verifyTurnstile(token: unknown, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'unknown') body.set('remoteip', ip)
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000), cache: 'no-store' })
    const data = await res.json().catch(() => null) as { success?: boolean } | null
    return data?.success === true
  } catch {
    return false
  }
}
