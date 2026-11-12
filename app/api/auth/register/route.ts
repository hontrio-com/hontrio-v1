import { NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll, rateLimitAsync } from '@/lib/security/rate-limit'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { buildAccountExistsEmail, sendEmail } from '@/lib/email'
import { accountLocale, bumpSessionVersion, sendEmailVerification } from '@/lib/auth/account'
import { checkEmail, checkName, checkPassword, TERMS_VERSION } from '@/lib/auth/validation'
import { logError, logWarn } from '@/lib/logger'
import { getLocale, tFor } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'

// =============================================
// POST /api/auth/register — { name, email, password, accept_terms, accept_clauses, turnstile? }
//
// Contul nou nu intră până nu-și confirmă adresa (linkul din e-mail + parola).
// Răspunsul e mereu același („verifică-ți e-mailul"), oricum ar fi adresa:
// - nouă: contul neconfirmat și e-mailul de confirmare;
// - cu cont neconfirmat: ultima înscriere câștigă (parola nouă, link nou);
//   fără inbox, nimeni nu poate activa contul;
// - cu cont confirmat: un e-mail „ai deja cont", nimic altceva.
// Lucrul se face după răspuns (`after`), ca durata să nu spună care e cazul.
// =============================================

const ROUTE = '/api/auth/register'
const HOUR = 60 * 60 * 1000

async function register(name: string, email: string, password: string, locale: Locale) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: existing, error: eExisting } = await supabase
    .from('users').select('id, email_verified_at, ui_locale').eq('email', email).maybeSingle()
  if (eExisting) {
    logError(ROUTE, 'Contul n-a putut fi căutat', { error: eExisting.message })
    return
  }

  if (existing?.email_verified_at) {
    // Un singur e-mail de acest fel pe zi pentru o adresă
    const rl = await rateLimitAsync(`register-exists:${email}`, 1, 24 * HOUR)
    if (rl.success) await sendEmail({ to: email, ...buildAccountExistsEmail(accountLocale(existing.ui_locale, locale)) })
    return
  }

  if (existing) {
    // Cont neconfirmat: ultima înscriere își pune parola; linkul vechi nu mai merge
    const { error: ePw } = await supabase.auth.admin.updateUserById(existing.id, { password })
    if (ePw) {
      logError(ROUTE, 'Parola contului neconfirmat n-a putut fi schimbată', { userId: existing.id, error: ePw.message })
      return
    }
    await supabase.from('users').update({ name, terms_accepted_at: now, terms_version: TERMS_VERSION, ui_locale: locale }).eq('id', existing.id)
    await bumpSessionVersion(supabase, existing.id)
    await sendEmailVerification(supabase, existing.id, email, locale)
    return
  }

  // Supabase Auth ține parola; adresa o confirmă Hontrio (users.email_verified_at)
  const { data: created, error: eCreate } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (eCreate || !created.user) {
    // Ex. un cont Supabase fără rând în users: nu-l atingem, doar îl notăm
    logWarn(ROUTE, 'Contul n-a putut fi creat', { error: eCreate?.message ?? 'fără utilizator' })
    return
  }
  const { error: eProfile } = await supabase.from('users').insert({
    id: created.user.id,
    email,
    name,
    role: 'user',
    onboarding_completed: false,
    ui_locale: locale,
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
  })
  if (eProfile) {
    logError(ROUTE, 'Profilul n-a putut fi creat', { error: eProfile.message })
    await supabase.auth.admin.deleteUser(created.user.id)
    return
  }
  await sendEmailVerification(supabase, created.user.id, email, locale)
}

export async function POST(request: Request) {
  // Limba cererii: și pentru mesajele de aici, și pentru e-mailuri
  const locale = await getLocale()
  const t = tFor(locale)
  try {
    const ip = clientIp(request.headers)
    const allowed = await rateLimitAll([
      [`register-ip:${ip}`, 5, HOUR],
      [`register-ip-day:${ip}`, 20, 24 * HOUR],
    ])
    if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

    const name = checkName(body.name)
    if (!name.ok) return NextResponse.json({ error: t(name.error) }, { status: 400 })
    const email = checkEmail(body.email)
    if (!email.ok) return NextResponse.json({ error: t(email.error) }, { status: 400 })
    const password = checkPassword(body.password)
    if (!password.ok) return NextResponse.json({ error: t(password.error) }, { status: 400 })
    if (body.accept_terms !== true || body.accept_clauses !== true) {
      return NextResponse.json({ error: t('auth.terms_required') }, { status: 400 })
    }
    if (!(await verifyTurnstile(body.turnstile, ip))) return NextResponse.json({ error: t('auth.captcha_failed') }, { status: 400 })

    // Câteva înscrieri pe zi pentru aceeași adresă (fiecare trimite un e-mail)
    const perEmail = await rateLimitAsync(`register-email:${email.email}`, 3, 24 * HOUR)
    if (!perEmail.success) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

    after(() => register(name.name, email.email, password.password, locale).catch(err => {
      logError(ROUTE, 'Înscrierea a eșuat', { error: (err as Error).message })
    }))

    return NextResponse.json({ ok: true, message: t('auth.check_inbox_desc') })
  } catch (err) {
    logError(ROUTE, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
