import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteAccount } from '@/lib/auth/delete-account'
import { logApiError, logWarn } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/admin/users/delete — { user_id }: un admin șterge contul unui om
// (nu pe al lui, nu al altui admin). Aceeași ștergere ca din Setări: accesurile
// retrase, fișierele și datele șterse, contul din Supabase Auth.
// =============================================

const ROUTE = '/api/admin/users/delete'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    const adminId = session.user.id

    const body = await request.json().catch(() => null) as { user_id?: unknown } | null
    const userId = typeof body?.user_id === 'string' ? body.user_id : ''
    if (!userId) return NextResponse.json({ error: t('api.user_id_missing') }, { status: 400 })
    if (userId === adminId) return NextResponse.json({ error: t('api.cannot_delete_self') }, { status: 400 })

    const { data: user } = await createAdminClient().from('users').select('id, email, role').eq('id', userId).maybeSingle()
    if (!user) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })
    if (user.role === 'admin') return NextResponse.json({ error: t('api.cannot_delete_admin') }, { status: 400 })

    const result = await deleteAccount(userId)
    if (!result.ok) {
      logApiError(ROUTE, 500, 'Ștergerea contului s-a oprit', { userId, step: result.step })
      return NextResponse.json({ error: t('api.user_delete_failed') }, { status: 500 })
    }
    logWarn(ROUTE, 'Cont șters de un admin', { userId, adminId })
    return NextResponse.json({ success: true, message: t('api.user_deleted', { email: user.email }) })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: (err as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
