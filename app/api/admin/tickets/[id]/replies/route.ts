import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAttachments, showAttachments } from '@/lib/tickets/attachments'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/admin/tickets/{id}/replies — { message, attachments? }: răspunsul
// echipei. Atașamentele sunt fișiere încărcate de acest admin. La primul
// răspuns, tichetul trece „În lucru".
// =============================================

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })

    const { id } = await params
    const userId = session.user.id
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const attachments = parseAttachments(body?.attachments, userId)
    if (!attachments.ok) return NextResponse.json({ error: t(attachments.error) }, { status: 400 })
    if (!message && !attachments.list.length) return NextResponse.json({ error: t('api.reply_empty') }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: t('api.message_too_long') }, { status: 400 })

    const supabase = createAdminClient()
    const { data: ticket } = await supabase.from('tickets').select('id, status').eq('id', id).maybeSingle()
    if (!ticket) return NextResponse.json({ error: t('api.ticket_not_found') }, { status: 404 })

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({ ticket_id: id, user_id: userId, message, is_admin: true, attachments: attachments.list })
      .select('id, user_id, message, is_admin, created_at, attachments')
      .single()
    if (error || !reply) return NextResponse.json({ error: t('api.reply_send_failed') }, { status: 500 })

    const now = new Date().toISOString()
    await supabase.from('tickets').update(ticket.status === 'open' ? { status: 'in_progress', updated_at: now } : { updated_at: now }).eq('id', id)

    const [shown] = await showAttachments(supabase, [reply.attachments])
    return NextResponse.json({ reply: { ...reply, attachments: shown } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
