import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitApi } from '@/lib/security/rate-limit'
import { parseAttachments, showAttachments } from '@/lib/tickets/attachments'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/tickets/{id}/replies — { message, attachments? }: răspunsul omului
// la tichetul lui. Un tichet rezolvat se redeschide; unul închis nu mai primește.
// =============================================

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })

    const { id } = await params
    const userId = session.user.id

    const limit = await rateLimitApi(userId, 'ticket-reply')
    if (!limit.success) return NextResponse.json({ error: t('api.too_many_messages') }, { status: 429 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const attachments = parseAttachments(body?.attachments, userId)
    if (!attachments.ok) return NextResponse.json({ error: t(attachments.error) }, { status: 400 })
    if (!message && !attachments.list.length) return NextResponse.json({ error: t('api.reply_empty') }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: t('api.message_too_long') }, { status: 400 })

    const supabase = createAdminClient()
    const { data: ticket } = await supabase.from('tickets').select('id, status').eq('id', id).eq('user_id', userId).maybeSingle()
    if (!ticket) return NextResponse.json({ error: t('api.ticket_not_found') }, { status: 404 })
    if (ticket.status === 'closed') return NextResponse.json({ error: t('api.ticket_closed') }, { status: 400 })

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({ ticket_id: id, user_id: userId, message, is_admin: false, attachments: attachments.list })
      .select('id, message, is_admin, created_at, attachments')
      .single()
    if (error || !reply) return NextResponse.json({ error: t('api.reply_send_failed') }, { status: 500 })

    const now = new Date().toISOString()
    await supabase.from('tickets').update(ticket.status === 'resolved' ? { status: 'open', updated_at: now } : { updated_at: now }).eq('id', id)

    const [shown] = await showAttachments(supabase, [reply.attachments])
    return NextResponse.json({ reply: { ...reply, attachments: shown } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
