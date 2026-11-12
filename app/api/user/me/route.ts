import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/user/me — profilul contului din sesiune.
// Un cont fără rând în users nu se mai „repară" de aici: un cont șters rămâne șters.
// =============================================

const ROUTE = '/api/user/me'

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, onboarding_completed, avatar_url, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logApiError(ROUTE, 500, 'Profilul n-a putut fi citit', { userId, error: error.message })
      return NextResponse.json({ error: t('api.profile_load_failed') }, { status: 500 })
    }
    if (!user) return NextResponse.json({ error: t('api.session_invalid') }, { status: 401 })

    return NextResponse.json({
      user,
      role: user.role,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
