import { NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { buildWelcomeEmail, sendEmail } from '@/lib/email'
import { accountLocale } from '@/lib/auth/account'
import { hashToken, isTokenShape } from '@/lib/auth/tokens'
import { verifyPassword } from '@/lib/auth/password'
import { logError } from '@/lib/logger'
import { getLocale, tFor } from '@/lib/i18n/server'

// =============================================
// Confirmarea adresei de e-mail.
//
// GET  /api/auth/verify-email?token=… — linkul din e-mail. Jetonul trece într-un
//      cookie (httpOnly, doar pe această rută), apoi omul ajunge pe /verify-email,
//      fără jeton în adresă (nici în istoric, nici în statistici).
// POST /api/auth/verify-email — { password }: cine are linkul (inboxul) ȘI parola
//      aleasă la înscriere activează contul. Unul fără celălalt nu ajunge: un
//      link primit pentru un cont făcut de altcineva nu dă acel cont nimănui.
// =============================================

const ROUTE = '/api/auth/verify-email'
const COOKIE = 'hontrio_verify'

function cookieOptions(maxAgeSec: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: ROUTE, maxAge: maxAgeSec }
}

type Pending = { id: string; email: string; ui_locale: string | null; email_verified_at: string | null; email_verify_expires_at: string | null }

async function findPending(token: string): Promise<Pending | null> {
  const { data } = await createAdminClient()
    .from('users')
    .select('id, email, ui_locale, email_verified_at, email_verify_expires_at')
    .eq('email_verify_token_hash', hashToken(token))
    .maybeSingle()
  const row = data as Pending | null
  if (!row || !row.email_verify_expires_at || Date.parse(row.email_verify_expires_at) < Date.now()) return null
  return row
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers)
  const page = (status?: string) => new URL(status ? `/verify-email?status=${status}` : '/verify-email', request.url)
  if (!(await rateLimitAll([[`verify-open:${ip}`, 30, 10 * 60 * 1000]]))) return NextResponse.redirect(page('rate_limited'))

  const token = new URL(request.url).searchParams.get('token')
  if (!isTokenShape(token)) return NextResponse.redirect(page('invalid'))
  const pending = await findPending(token)
  if (!pending) return NextResponse.redirect(page('invalid'))
  if (pending.email_verified_at) return NextResponse.redirect(new URL('/login?verified=1', request.url))

  const response = NextResponse.redirect(page())
  const left = Math.floor((Date.parse(pending.email_verify_expires_at!) - Date.now()) / 1000)
  response.cookies.set(COOKIE, token, cookieOptions(Math.max(60, Math.min(left, 60 * 60))))
  return response
}

export async function POST(request: Request) {
  const t = tFor(await getLocale())
  const ip = clientIp(request.headers)
  const token = (await cookies()).get(COOKIE)?.value
  if (!isTokenShape(token)) return NextResponse.json({ error: t('auth.verify_link_invalid'), code: 'invalid' }, { status: 400 })

  // Parola se poate ghici doar câteva ori (pe IP și pe link)
  const allowed = await rateLimitAll([
    [`verify-ip:${ip}`, 10, 10 * 60 * 1000],
    [`verify-token:${hashToken(token)}`, 5, 60 * 60 * 1000],
  ])
  if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

  const body = await request.json().catch(() => null) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password || password.length > 200) return NextResponse.json({ error: t('auth.password_required') }, { status: 400 })

  const pending = await findPending(token)
  if (!pending) {
    const response = NextResponse.json({ error: t('auth.verify_link_invalid'), code: 'invalid' }, { status: 400 })
    response.cookies.set(COOKIE, '', cookieOptions(0))
    return response
  }

  const check = await verifyPassword(pending.email, password)
  if (!check.ok) return NextResponse.json({ error: t('auth.verify_password_wrong') }, { status: 400 })

  const supabase = createAdminClient()

  const { error } = await supabase.from('users').update({
    email_verified_at: pending.email_verified_at ?? new Date().toISOString(),
    email_verify_token_hash: null,
    email_verify_expires_at: null,
  }).eq('id', pending.id)
  if (error) {
    logError(ROUTE, 'Adresa n-a putut fi confirmată', { userId: pending.id, error: error.message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }

  // Bun venit abia acum, fără nimic scris de vizitator în e-mail
  if (!pending.email_verified_at) {
    const locale = accountLocale(pending.ui_locale)
    after(() => sendEmail({ to: pending.email, ...buildWelcomeEmail(locale) }).then(() => undefined))
  }

  // Pagina intră în cont cu adresa și parola pe care omul tocmai le-a dovedit
  const response = NextResponse.json({ ok: true, email: pending.email })
  response.cookies.set(COOKIE, '', cookieOptions(0))
  return response
}
