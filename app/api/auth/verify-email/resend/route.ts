import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { accountLocale, sendEmailVerification } from '@/lib/auth/account'
import { checkEmail } from '@/lib/auth/validation'
import { verifyPassword } from '@/lib/auth/password'
import { logError } from '@/lib/logger'
import { getLocale, tFor } from '@/lib/i18n/server'

// =============================================
// POST /api/auth/verify-email/resend — { email, password }
// Un link nou de confirmare, doar pentru cine știe parola contului (de pe
// pagina de intrare sau de după înscriere). Răspunsul e același oricum:
// nu spune dacă adresa are cont sau dacă parola e bună.
// =============================================

const ROUTE = '/api/auth/verify-email/resend'

export async function POST(request: Request) {
  const locale = await getLocale()
  const t = tFor(locale)
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null
  const email = checkEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email.ok || !password || password.length > 200) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

  const allowed = await rateLimitAll([
    [`verify-resend-ip:${clientIp(request.headers)}`, 10, 60 * 60 * 1000],
    [`verify-resend-email:${email.email}`, 3, 60 * 60 * 1000],
  ])
  if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

  after(async () => {
    try {
      const check = await verifyPassword(email.email, password)
      if (!check.ok) return
      const supabase = createAdminClient()
      const { data: user } = await supabase.from('users').select('id, email, email_verified_at, ui_locale').eq('id', check.userId).maybeSingle()
      if (!user || user.email_verified_at) return
      await sendEmailVerification(supabase, user.id, user.email, accountLocale(user.ui_locale, locale))
    } catch (err) {
      logError(ROUTE, 'Linkul de confirmare n-a putut fi retrimis', { error: (err as Error).message })
    }
  })

  return NextResponse.json({ ok: true, message: t('auth.verify_resent') })
}
