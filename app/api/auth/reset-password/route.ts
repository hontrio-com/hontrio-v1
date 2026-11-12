import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { bumpSessionVersion } from '@/lib/auth/account'
import { hashToken, isTokenShape } from '@/lib/auth/tokens'
import { checkPassword } from '@/lib/auth/validation'
import { logError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// Resetarea parolei.
//
// GET  /api/auth/reset-password?token=… — linkul din e-mail: jetonul trece într-un
//      cookie (httpOnly, doar pe această rută), apoi pagina /reset-password, fără
//      jeton în adresă.
// POST /api/auth/reset-password — { password }: parola nouă. Jetonul e de unică
//      folosință și expiră în 30 de minute. Toate sesiunile contului se închid,
//      iar adresa devine confirmată (linkul a ajuns în inbox).
// =============================================

const ROUTE = '/api/auth/reset-password'
const COOKIE = 'hontrio_reset'

function cookieOptions(maxAgeSec: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: ROUTE, maxAge: maxAgeSec }
}

async function findToken(token: string) {
  const { data } = await createAdminClient()
    .from('password_reset_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!data || Date.parse(data.expires_at) < Date.now()) return null
  return data as { id: string; user_id: string; expires_at: string }
}

export async function GET(request: Request) {
  const page = (status?: string) => new URL(status ? `/reset-password?status=${status}` : '/reset-password', request.url)
  if (!(await rateLimitAll([[`reset-open:${clientIp(request.headers)}`, 30, 10 * 60 * 1000]]))) return NextResponse.redirect(page('rate_limited'))

  const token = new URL(request.url).searchParams.get('token')
  if (!isTokenShape(token)) return NextResponse.redirect(page('invalid'))
  const row = await findToken(token)
  if (!row) return NextResponse.redirect(page('invalid'))

  const response = NextResponse.redirect(page())
  const left = Math.floor((Date.parse(row.expires_at) - Date.now()) / 1000)
  response.cookies.set(COOKIE, token, cookieOptions(Math.max(60, left)))
  return response
}

export async function POST(request: Request) {
  const t = await getT()
  try {
    const allowed = await rateLimitAll([[`reset-ip:${clientIp(request.headers)}`, 10, 15 * 60 * 1000]])
    if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

    const token = (await cookies()).get(COOKIE)?.value
    if (!isTokenShape(token)) return NextResponse.json({ error: t('api.reset_link_invalid'), code: 'invalid' }, { status: 400 })

    const body = await request.json().catch(() => null) as { password?: unknown } | null
    const password = checkPassword(body?.password)
    if (!password.ok) return NextResponse.json({ error: t(password.error) }, { status: 400 })

    const row = await findToken(token)
    if (!row) {
      const response = NextResponse.json({ error: t('api.reset_link_expired'), code: 'invalid' }, { status: 400 })
      response.cookies.set(COOKIE, '', cookieOptions(0))
      return response
    }

    const supabase = createAdminClient()
    // Jetonul se consumă întâi: două cereri cu același link nu pot trece amândouă
    const { data: consumed } = await supabase.from('password_reset_tokens').delete().eq('id', row.id).select('id')
    if (!consumed?.length) return NextResponse.json({ error: t('api.reset_link_invalid'), code: 'invalid' }, { status: 400 })

    const { error: updateError } = await supabase.auth.admin.updateUserById(row.user_id, { password: password.password })
    if (updateError) {
      logError(ROUTE, 'Parola n-a putut fi schimbată', { userId: row.user_id, error: updateError.message })
      return NextResponse.json({ error: t('api.password_update_failed') }, { status: 500 })
    }

    // Linkul a ajuns în inbox: adresa e confirmată; orice sesiune deschisă cu parola veche se închide
    const { data: user } = await supabase.from('users').select('email_verified_at').eq('id', row.user_id).maybeSingle()
    if (user && !user.email_verified_at) {
      await supabase.from('users').update({
        email_verified_at: new Date().toISOString(), email_verify_token_hash: null, email_verify_expires_at: null,
      }).eq('id', row.user_id)
    }
    await bumpSessionVersion(supabase, row.user_id)
    await supabase.from('password_reset_tokens').delete().eq('user_id', row.user_id)

    const response = NextResponse.json({ success: true, message: t('api.password_reset_done') })
    response.cookies.set(COOKIE, '', cookieOptions(0))
    return response
  } catch (err) {
    logError(ROUTE, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
