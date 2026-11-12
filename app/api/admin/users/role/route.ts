import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { bumpSessionVersion } from '@/lib/auth/account'
import { logWarn } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/admin/users/role — { user_id, role: 'user' | 'admin' }
// Sesiunile omului se închid: rolul nou contează de la următoarea intrare.
// Un admin nu-și poate lua singur rolul (ar rămâne platforma fără admin).
// =============================================

const ROLES = ['user', 'admin']

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })

    const body = await request.json().catch(() => null) as { user_id?: unknown; role?: unknown } | null
    const userId = typeof body?.user_id === 'string' ? body.user_id : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    if (!userId || !role) return NextResponse.json({ error: t('api.incomplete_data') }, { status: 400 })
    if (!ROLES.includes(role)) return NextResponse.json({ error: t('api.invalid_role') }, { status: 400 })
    if (userId === session.user.id && role !== 'admin') return NextResponse.json({ error: t('api.cannot_demote_self') }, { status: 400 })

    const supabase = createAdminClient()
    const { data: updated, error } = await supabase.from('users').update({ role }).eq('id', userId).select('id')
    if (error) return NextResponse.json({ error: t('api.role_update_failed') }, { status: 500 })
    if (!updated?.length) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })

    await bumpSessionVersion(supabase, userId)
    logWarn('/api/admin/users/role', 'Rol schimbat', { userId, role, adminId: session.user.id })
    return NextResponse.json({ success: true, role })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
