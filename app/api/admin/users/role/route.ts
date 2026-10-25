import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }

    const { user_id, role } = await request.json()

    if (!user_id || !role) {
      return NextResponse.json({ error: t('api.incomplete_data') }, { status: 400 })
    }

    const validRoles = ['user', 'admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: t('api.invalid_role') }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ error: t('api.role_update_failed') }, { status: 500 })
    }

    return NextResponse.json({ success: true, role })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}