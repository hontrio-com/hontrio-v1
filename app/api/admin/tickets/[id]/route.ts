import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — ticket with replies
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()

    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, subject, message, status, priority, category, created_at, updated_at, attachments, users!inner(name, email)')
      .eq('id', id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Tichet negăsit' }, { status: 404 })
    }

    const { data: replies } = await supabase
      .from('ticket_replies')
      .select('id, user_id, message, is_admin, created_at, attachments')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    // Fetch user names separately to avoid join breaking JSONB columns
    const userIds = [...new Set((replies || []).map((r: any) => r.user_id).filter(Boolean))]
    let usersMap: Record<string, { name: string; email: string }> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)
      for (const u of (users || [])) {
        usersMap[u.id] = { name: u.name, email: u.email }
      }
    }

    const enrichedReplies = (replies || []).map((r: any) => ({
      ...r,
      attachments: r.attachments || [],
      users: usersMap[r.user_id] || { name: r.is_admin ? 'Admin' : 'User', email: '' },
    }))

    return NextResponse.json({ ticket, replies: enrichedReplies })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// PATCH — update ticket status/priority
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createAdminClient()

    const updateData: Record<string, any> = {}

    if (body.status) {
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Status invalid' }, { status: 400 })
      }
      updateData.status = body.status
      if (body.status === 'closed') updateData.closed_at = new Date().toISOString()
    }

    if (body.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent']
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json({ error: 'Prioritate invalidă' }, { status: 400 })
      }
      updateData.priority = body.priority
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Eroare la actualizare' }, { status: 500 })
    }

    return NextResponse.json({ ticket })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}