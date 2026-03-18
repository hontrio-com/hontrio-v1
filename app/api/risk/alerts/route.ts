import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    const unread_only = searchParams.get('unread_only') === 'true'
    const limit = parseInt(searchParams.get('limit') || '30')

    const supabase = createAdminClient()

    let query = supabase
      .from('risk_alerts')
      .select('*', { count: 'exact' })
      .eq('user_id', (session.user as any).id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (store_id) query = query.eq('store_id', store_id)
    if (unread_only) query = query.eq('is_read', false)

    const { data, count } = await query
    const { count: unreadCount } = await supabase
      .from('risk_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', (session.user as any).id)
      .eq('is_read', false)

    return NextResponse.json({ alerts: data || [], total: count || 0, unread: unreadCount || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { alert_id, mark_all_read, is_resolved } = await req.json()
    const supabase = createAdminClient()

    if (mark_all_read) {
      await supabase.from('risk_alerts')
        .update({ is_read: true })
        .eq('user_id', (session.user as any).id)
      return NextResponse.json({ ok: true })
    }

    if (alert_id) {
      const updates: any = { is_read: true }
      if (is_resolved) {
        updates.is_resolved = true
        updates.resolved_by = (session.user as any).id
        updates.resolved_at = new Date().toISOString()
      }
      await supabase.from('risk_alerts').update(updates)
        .eq('id', alert_id)
        .eq('user_id', (session.user as any).id)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}