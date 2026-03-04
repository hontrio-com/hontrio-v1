import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - fetch alerts with optional filter
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const supabase = createAdminClient()

    let query = supabase
      .from('competitor_alerts')
      .select(`*, competitor_monitors(competitor_url, competitor_label)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (unreadOnly) query = query.eq('is_read', false)

    const { data, error } = await query
    if (error) return NextResponse.json({ alerts: [] })
    return NextResponse.json({ alerts: data || [] })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// PATCH - mark alert(s) as read
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { ids, all } = await request.json()
    const supabase = createAdminClient()

    if (all) {
      await supabase.from('competitor_alerts').update({ is_read: true }).eq('user_id', userId)
    } else if (ids?.length) {
      await supabase.from('competitor_alerts').update({ is_read: true }).in('id', ids).eq('user_id', userId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}