import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { sendEmail, buildResetEmail } from '@/lib/email'
import { accountLocale } from '@/lib/auth/account'
import { newToken } from '@/lib/auth/tokens'
import { checkEmail } from '@/lib/auth/validation'
import { logError } from '@/lib/logger'
import { getLocale, tFor } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'

// =============================================
// POST /api/auth/forgot-password — { email, turnstile? }
// Răspunsul e același și repede, oricum ar fi adresa: căutarea contului și
// e-mailul se fac după răspuns (`after`), ca durata să nu spună dacă există.
// Linkul duce la /api/auth/reset-password?token=…, care mută jetonul într-un
// cookie; adresa de e-mail nu mai apare în link.
// =============================================

const ROUTE = '/api/auth/forgot-password'
const RESET_TTL_MS = 30 * 60 * 1000
const APP_URL = process.env.NEXTAUTH_URL || 'https://app.hontrio.com'

async function sendReset(email: string, locale: Locale) {
  const supabase = createAdminClient()
  const { data: user } = await supabase.from('users').select('id, ui_locale').eq('email', email).maybeSingle()
  if (!user) return

  // Un singur link valabil: cererile vechi se șterg
  await supabase.from('password_reset_tokens').delete().eq('user_id', user.id)
  const { token, hash } = newToken()
  const { error } = await supabase.from('password_reset_tokens').insert({
    user_id: user.id, token_hash: hash, expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
  })
  if (error) {
    logError(ROUTE, 'Jetonul de resetare n-a putut fi salvat', { userId: user.id, error: error.message })
    return
  }
  await sendEmail({ to: email, ...buildResetEmail(`${APP_URL}/api/auth/reset-password?token=${token}`, accountLocale(user.ui_locale, locale)) })
}

export async function POST(request: Request) {
  const locale = await getLocale()
  const t = tFor(locale)
  try {
    const ip = clientIp(request.headers)
    const body = await request.json().catch(() => null) as { email?: unknown; turnstile?: unknown } | null
    const email = checkEmail(body?.email)
    if (!email.ok) return NextResponse.json({ error: t(email.error) }, { status: 400 })

    const allowed = await rateLimitAll([
      [`forgot-ip:${ip}`, 5, 15 * 60 * 1000],
      [`forgot-email:${email.email}`, 3, 60 * 60 * 1000],
    ])
    if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })
    if (!(await verifyTurnstile(body?.turnstile, ip))) return NextResponse.json({ error: t('auth.captcha_failed') }, { status: 400 })

    after(() => sendReset(email.email, locale).catch(err => {
      logError(ROUTE, 'Resetarea n-a putut fi trimisă', { error: (err as Error).message })
    }))

    return NextResponse.json({ success: true, message: t('api.reset_email_sent') })
  } catch (err) {
    logError(ROUTE, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
