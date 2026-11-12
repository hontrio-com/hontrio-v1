import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp, rateLimitAll } from '@/lib/security/rate-limit'
import { bumpSessionVersion } from '@/lib/auth/account'
import { reissueSession } from '@/lib/auth/session-cookie'
import { checkPassword } from '@/lib/auth/validation'
import { verifyPassword } from '@/lib/auth/password'
import { logError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/user/change-password — { currentPassword, newPassword }
// Cere parola curentă. După schimbare se închid celelalte sesiuni ale contului;
// dispozitivul de pe care s-a schimbat parola rămâne în cont.
// =============================================

const ROUTE = '/api/user/change-password'

export async function POST(request: NextRequest) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const allowed = await rateLimitAll([
      [`change-password:${userId}`, 5, 60 * 60 * 1000],
      [`change-password-ip:${clientIp(request.headers)}`, 20, 60 * 60 * 1000],
    ])
    if (!allowed) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

    const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null
    const current = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    if (!current) return NextResponse.json({ error: t('api.fields_required') }, { status: 400 })
    const next = checkPassword(body?.newPassword)
    if (!next.ok) return NextResponse.json({ error: t(next.error) }, { status: 400 })

    const supabase = createAdminClient()
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
    if (!user) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })

    if (!(await verifyPassword(user.email, current)).ok) return NextResponse.json({ error: t('api.current_password_wrong') }, { status: 400 })

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: next.password })
    if (updateError) {
      logError(ROUTE, 'Parola n-a putut fi schimbată', { userId, error: updateError.message })
      return NextResponse.json({ error: t('api.password_update_failed') }, { status: 500 })
    }

    const version = await bumpSessionVersion(supabase, userId)
    const response = NextResponse.json({ message: t('api.password_changed') })
    if (version !== null) await reissueSession(request, response, version)
    return response
  } catch (err) {
    logError(ROUTE, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
