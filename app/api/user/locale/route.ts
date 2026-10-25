import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/config'
import { tFor, getT } from '@/lib/i18n/server'

// =============================================
// PATCH /api/user/locale — limba interfeței aleasă de om { locale: 'ro' | 'en' }
// Se ține în cont (o primesc și celelalte dispozitive, și e-mailurile) și în cookie.
// =============================================

const ROUTE = '/api/user/locale'

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: (await getT())('api.unauthorized') }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!isLocale(body.locale)) return NextResponse.json({ error: (await getT())('api.invalid_request') }, { status: 400 })
  const t = tFor(body.locale)

  const supabase = createAdminClient()
  const { error } = await supabase.from('users').update({ ui_locale: body.locale }).eq('id', session.user.id)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la salvarea limbii', { userId: session.user.id, error: error.message })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }

  const response = NextResponse.json({ locale: body.locale })
  response.cookies.set(LOCALE_COOKIE, body.locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' })
  return response
}
