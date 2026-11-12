import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { showAttachments } from '@/lib/tickets/attachments'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET   /api/admin/tickets/{id} — tichetul, cu răspunsurile și atașamentele
//       (linkuri semnate, valabile o oră)
// PATCH /api/admin/tickets/{id} — { status?, priority? }
// =============================================

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

type Reply = { id: string; user_id: string | null; message: string; is_admin: boolean; created_at: string; attachments: unknown }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()

    const { data: found } = await supabase
      .from('tickets')
      .select('id, subject, message, status, priority, category, created_at, updated_at, attachments, users!inner(name, email)')
      .eq('id', id)
      .maybeSingle()
    if (!found) return NextResponse.json({ error: t('api.ticket_not_found') }, { status: 404 })

    const { data } = await supabase
      .from('ticket_replies')
      .select('id, user_id, message, is_admin, created_at, attachments')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    const replies = (data ?? []) as Reply[]

    // Numele celor care au scris, separat (un join ar strica coloanele JSONB)
    const userIds = [...new Set(replies.map(r => r.user_id).filter((x): x is string => !!x))]
    const usersMap: Record<string, { name: string; email: string }> = {}
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, name, email').in('id', userIds)
      for (const u of users ?? []) usersMap[u.id] = { name: u.name, email: u.email }
    }

    const shown = await showAttachments(supabase, [found.attachments, ...replies.map(r => r.attachments)])
    return NextResponse.json({
      ticket: { ...found, attachments: shown[0] },
      replies: replies.map((r, i) => ({
        ...r,
        attachments: shown[i + 1],
        users: (r.user_id && usersMap[r.user_id]) || { name: r.is_admin ? t('api.fallback_admin_name') : t('api.default_user_name'), email: '' },
      })),
    })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })

    const { id } = await params
    const body = await request.json().catch(() => null) as { status?: unknown; priority?: unknown } | null
    const updateData: Record<string, string> = {}

    if (body?.status !== undefined) {
      if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) return NextResponse.json({ error: t('api.invalid_status') }, { status: 400 })
      updateData.status = body.status
      if (body.status === 'closed') updateData.closed_at = new Date().toISOString()
    }
    if (body?.priority !== undefined) {
      if (typeof body.priority !== 'string' || !PRIORITIES.includes(body.priority)) return NextResponse.json({ error: t('api.invalid_priority') }, { status: 400 })
      updateData.priority = body.priority
    }
    if (!Object.keys(updateData).length) return NextResponse.json({ error: t('api.nothing_to_update') }, { status: 400 })

    const { data: ticket, error } = await createAdminClient().from('tickets').update(updateData).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
    return NextResponse.json({ ticket })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
