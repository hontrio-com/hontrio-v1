import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitApi } from '@/lib/security/rate-limit'
import { getT } from '@/lib/i18n/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id

    const limit = await rateLimitApi(userId, 'ticket-reply')
    if (!limit.success) {
      return NextResponse.json({ error: t('api.too_many_messages') }, { status: 429 })
    }

    const { message, attachments } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: t('api.reply_empty') }, { status: 400 })
    }
    if (message && message.length > 5000) {
      return NextResponse.json({ error: t('api.message_too_long') }, { status: 400 })
    }
    if (attachments && attachments.length > 5) {
      return NextResponse.json({ error: t('api.too_many_attachments') }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: t('api.ticket_not_found') }, { status: 404 })
    }
    if (ticket.status === 'closed') {
      return NextResponse.json({ error: t('api.ticket_closed') }, { status: 400 })
    }

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: id,
        user_id: userId,
        message: message?.trim() || '',
        is_admin: false,
        attachments: attachments || [],
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: t('api.reply_send_failed') }, { status: 500 })
    }

    if (ticket.status === 'resolved') {
      await supabase.from('tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', id)
    } else {
      await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', id)
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}