import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { showAttachments } from '@/lib/tickets/attachments'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/tickets/{id} — un tichet al contului, cu răspunsurile și atașamentele
// (linkuri semnate). Deschiderea lui îl marchează citit.
// =============================================

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })

    const { id } = await params
    const userId = session.user.id
    const supabase = createAdminClient()

    const { data: ticket } = await supabase.from('tickets').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
    if (!ticket) return NextResponse.json({ error: t('api.ticket_not_found') }, { status: 404 })

    const { data: replies } = await supabase
      .from('ticket_replies')
      .select('id, message, is_admin, created_at, attachments')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    const list = replies ?? []

    const [shown] = await Promise.all([
      showAttachments(supabase, [ticket.attachments, ...list.map(r => r.attachments)]),
      supabase.from('tickets').update({ user_last_read_at: new Date().toISOString() }).eq('id', id),
    ])

    return NextResponse.json({
      ticket: { ...ticket, attachments: shown[0] },
      replies: list.map((r, i) => ({ ...r, attachments: shown[i + 1] })),
    })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
