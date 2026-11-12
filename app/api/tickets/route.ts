import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { parseAttachments, showAttachments } from '@/lib/tickets/attachments'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET  /api/tickets — tichetele contului, cu atașamentele (linkuri semnate)
// POST /api/tickets — { subject, message, category, attachments? }
//   Categoria e din listă; prioritatea o pune echipa (un tichet nou e „normal").
//   Atașamentele sunt doar fișiere încărcate de acest cont (/api/tickets/upload).
// =============================================

const ROUTE = '/api/tickets'
const CATEGORIES = ['general', 'bug', 'feature', 'billing', 'integration']

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id
    const supabase = createAdminClient()

    const { data: tickets, error } = await supabase
      .from('tickets').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ error: t('api.tickets_load_failed') }, { status: 500 })
    if (!tickets?.length) return NextResponse.json({ tickets: [] })

    const ticketIds = tickets.map(x => x.id)
    const [{ data: replies }, shown] = await Promise.all([
      supabase.from('ticket_replies').select('ticket_id, is_admin, created_at').in('ticket_id', ticketIds),
      showAttachments(supabase, tickets.map(x => x.attachments)),
    ])

    const enriched = tickets.map((ticket, i) => {
      const ticketReplies = (replies ?? []).filter(r => r.ticket_id === ticket.id)
      const adminReplies = ticketReplies.filter(r => r.is_admin)
      const lastAdmin = adminReplies.map(r => r.created_at as string).sort().pop()
      const hasUnreadAdmin = !!lastAdmin && (!ticket.user_last_read_at || new Date(lastAdmin) > new Date(ticket.user_last_read_at))
      return { ...ticket, attachments: shown[i], replies_count: ticketReplies.length, admin_replies_count: adminReplies.length, has_unread: hasUnreadAdmin }
    })

    return NextResponse.json({ tickets: enriched })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const limit = await rateLimitAsync(`create-ticket:${userId}`, 10, 60 * 60 * 1000)
    if (!limit.success) return NextResponse.json({ error: t('api.too_many_tickets') }, { status: 429 })

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!subject || !message) return NextResponse.json({ error: t('api.ticket_fields_required') }, { status: 400 })
    if (subject.length > 200) return NextResponse.json({ error: t('api.subject_too_long') }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: t('api.message_too_long') }, { status: 400 })
    const category = typeof body?.category === 'string' && CATEGORIES.includes(body.category) ? body.category : 'general'
    const attachments = parseAttachments(body?.attachments, userId)
    if (!attachments.ok) return NextResponse.json({ error: t(attachments.error) }, { status: 400 })

    const supabase = createAdminClient()
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({ user_id: userId, subject, message, category, priority: 'normal', attachments: attachments.list })
      .select()
      .single()
    if (error || !ticket) {
      logApiError(ROUTE, 500, 'Tichetul n-a putut fi creat', { userId, error: error?.message ?? 'niciun rând' })
      return NextResponse.json({ error: t('api.ticket_create_failed') }, { status: 500 })
    }
    const [shown] = await showAttachments(supabase, [ticket.attachments])
    return NextResponse.json({ ticket: { ...ticket, attachments: shown } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
