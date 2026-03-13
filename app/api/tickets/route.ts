import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitApi } from '@/lib/security/rate-limit'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: tickets, error } = await supabase
      .from('tickets').select('*').eq('user_id', userId).order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Eroare la încărcarea tichetelor' }, { status: 500 })
    if (!tickets || tickets.length === 0) return NextResponse.json({ tickets: [] })

    const ticketIds = tickets.map((t: any) => t.id)
    const { data: replies } = await supabase
      .from('ticket_replies').select('ticket_id, is_admin, created_at').in('ticket_id', ticketIds)

    const enriched = tickets.map((ticket: any) => {
      const ticketReplies = (replies || []).filter((r: any) => r.ticket_id === ticket.id)
      const adminReplies = ticketReplies.filter((r: any) => r.is_admin)
      const hasUnreadAdmin = adminReplies.length > 0 && (
        !ticket.user_last_read_at ||
        new Date(adminReplies[adminReplies.length - 1].created_at) > new Date(ticket.user_last_read_at)
      )
      return { ...ticket, replies_count: ticketReplies.length, admin_replies_count: adminReplies.length, has_unread: hasUnreadAdmin }
    })

    return NextResponse.json({ tickets: enriched })
  } catch { return NextResponse.json({ error: 'Eroare internă' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const limit = await rateLimitApi(userId, 'create-ticket')
    if (!limit.success) return NextResponse.json({ error: 'Prea multe tichete. Așteaptă puțin.' }, { status: 429 })

    const { subject, message, category, priority, attachments } = await request.json()

    if (!subject || !message) return NextResponse.json({ error: 'Subiectul și mesajul sunt obligatorii' }, { status: 400 })
    if (subject.length > 200) return NextResponse.json({ error: 'Subiectul nu poate depăși 200 caractere' }, { status: 400 })
    if (message.length > 5000) return NextResponse.json({ error: 'Mesajul nu poate depăși 5000 caractere' }, { status: 400 })
    if (attachments && attachments.length > 5) return NextResponse.json({ error: 'Maxim 5 atașamente' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({ user_id: userId, subject: subject.trim(), message: message.trim(), category: category || 'general', priority: priority || 'normal', attachments: attachments || [] })
      .select().single()

    if (error) return NextResponse.json({ error: 'Eroare la crearea tichetului' }, { status: 500 })
    return NextResponse.json({ ticket }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Eroare internă' }, { status: 500 }) }
}