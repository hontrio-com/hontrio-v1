import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

const VALID_TYPES = ['info', 'warning', 'success', 'error']
const VALID_TARGETS = ['all', 'plan', 'paid', 'free']

export async function POST(req: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }
    const { title, message, type = 'info', target = 'all', plan } = await req.json()
    if (!title || !message) return NextResponse.json({ error: t('api.title_message_required') }, { status: 400 })

    if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: t('api.invalid_type') }, { status: 400 })
    if (!VALID_TARGETS.includes(target)) return NextResponse.json({ error: t('api.invalid_target') }, { status: 400 })

    const supabase = createAdminClient()
    let query = supabase.from('users').select('id')
    if (target === 'plan' && plan) query = query.eq('plan', plan)
    else if (target === 'paid') query = query.neq('plan', 'free')
    else if (target === 'free') query = query.eq('plan', 'free')

    const { data: users } = await query
    if (!users?.length) return NextResponse.json({ error: t('api.no_users_found') }, { status: 400 })

    // Insert notification for each user
    const notifications = users.map(u => ({
      user_id: u.id,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('notifications').insert(notifications)
    if (error) {
      console.error('[Admin Broadcast] Insert error:', error.message)
      return NextResponse.json({ error: error.message || t('api.notifications_send_failed') }, { status: 500 })
    }

    return NextResponse.json({ sent: users.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ broadcasts: data || [] })
  } catch {
    return NextResponse.json({ broadcasts: [] })
  }
}
