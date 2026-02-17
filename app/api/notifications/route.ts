import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - fetch notifications for the logged-in user (personal + global)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    // Fetch personal notifications + global notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Notifications fetch error:', error)
      return NextResponse.json({ error: 'Eroare la încărcare' }, { status: 500 })
    }

    const unreadCount = (notifications || []).filter(n => !n.is_read).length

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// POST - send a notification (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const adminId = (session.user as any).id
    const { user_id, title, message, type, is_global } = await request.json()

    if (!title || !message) {
      return NextResponse.json({ error: 'Titlul și mesajul sunt obligatorii' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (is_global) {
      // Global notification - user_id is null, is_global is true
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: null,
          title,
          message,
          type: type || 'info',
          is_global: true,
          created_by: adminId,
        })
        .select()
        .single()

      if (error) {
        console.error('Global notification error:', error)
        return NextResponse.json({ error: 'Eroare la trimitere' }, { status: 500 })
      }

      return NextResponse.json({ notification: data, message: 'Notificare globală trimisă cu succes!' })
    } else {
      // Personal notification to specific user
      if (!user_id) {
        return NextResponse.json({ error: 'ID utilizator lipsă' }, { status: 400 })
      }

      // Verify user exists
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', user_id)
        .single()

      if (!user) {
        return NextResponse.json({ error: 'Utilizatorul nu a fost găsit' }, { status: 404 })
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id,
          title,
          message,
          type: type || 'info',
          is_global: false,
          created_by: adminId,
        })
        .select()
        .single()

      if (error) {
        console.error('Notification error:', error)
        return NextResponse.json({ error: 'Eroare la trimitere' }, { status: 500 })
      }

      return NextResponse.json({ notification: data, message: 'Notificare trimisă cu succes!' })
    }
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// PATCH - mark notifications as read
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { notification_ids, mark_all } = await request.json()
    const supabase = createAdminClient()

    if (mark_all) {
      // Mark all personal notifications as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      return NextResponse.json({ success: true })
    }

    if (notification_ids && notification_ids.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notification_ids)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nimic de actualizat' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}