import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { deleteAccount } from '@/lib/auth/delete-account'
import { logApiError, logWarn } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/user/delete — { password? }: omul își șterge contul.
// Cere parola; un cont intrat cu Google (fără parolă) trebuie să fi intrat în
// ultimele 10 minute. Ștergerea retrage accesurile (Google, Edinio, Shopify),
// șterge fișierele și datele. Campaniile din Google Ads rămân ale omului și
// merg mai departe: pagina îl trimite întâi să le oprească.
// =============================================

const ROUTE = '/api/user/delete'
const RECENT_LOGIN_MS = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id
    // Un admin nu se șterge singur de aici: platforma ar putea rămâne fără admin
    if (session.user.role === 'admin') return NextResponse.json({ error: t('settings.delete_admin_blocked') }, { status: 400 })

    const rl = await rateLimitAsync(`delete-account:${userId}`, 5, 60 * 60 * 1000)
    if (!rl.success) return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })

    const body = await request.json().catch(() => null) as { password?: unknown } | null
    const password = typeof body?.password === 'string' ? body.password : ''

    const supabase = createAdminClient()
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
    if (!user) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })

    // Dovada că e chiar omul: parola, sau o intrare cu Google de curând
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
      if (error) return NextResponse.json({ error: t('api.current_password_wrong') }, { status: 400 })
    } else {
      const cookie = authOptions.cookies?.sessionToken
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, cookieName: cookie?.name })
      const recentGoogle = token?.provider === 'google' && Date.now() - (Number(token.authAt) || 0) < RECENT_LOGIN_MS
      if (!recentGoogle) {
        return NextResponse.json({ error: t(token?.provider === 'google' ? 'settings.delete_reauth_google' : 'settings.delete_password_required'), code: token?.provider === 'google' ? 'reauth' : 'password' }, { status: 400 })
      }
    }

    const result = await deleteAccount(userId)
    if (!result.ok) {
      logApiError(ROUTE, 500, 'Ștergerea contului s-a oprit', { userId, step: result.step })
      return NextResponse.json({ error: t('settings.delete_failed') }, { status: 500 })
    }
    logWarn(ROUTE, 'Cont șters la cererea omului', { userId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
