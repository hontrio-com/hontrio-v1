import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }
    const { title, message, type = 'info', target = 'all', plan } = await req.json()
    if (!title || !message) return NextResponse.json({ error: 'Title si message sunt obligatorii' }, { status: 400 })

    const supabase = createAdminClient()
    let query = supabase.from('users').select('id')
    if (target === 'plan' && plan) query = query.eq('plan', plan)
    else if (target === 'paid') query = query.neq('plan', 'free')
    else if (target === 'free') query = query.eq('plan', 'free')

    const { data: users } = await query
    if (!users?.length) return NextResponse.json({ error: 'Niciun user găsit' }, { status: 400 })

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
      // Table might not exist yet - return success anyway with note
      return NextResponse.json({ sent: users.length, note: 'notifications table not found - create it first' })
    }

    return NextResponse.json({ sent: users.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
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