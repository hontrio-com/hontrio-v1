import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { id } = await params
    const userId = (session.user as any).id
    const { message, attachments } = await request.json()

    if (!message && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Mesajul sau un atașament este obligatoriu' }, { status: 400 })
    }
    if (message && message.length > 5000) {
      return NextResponse.json({ error: 'Mesajul nu poate depăși 5000 caractere' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: ticket } = await supabase
      .from('tickets').select('id, status').eq('id', id).single()

    if (!ticket) return NextResponse.json({ error: 'Tichet negăsit' }, { status: 404 })

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({ ticket_id: id, user_id: userId, message: message?.trim() || '', is_admin: true, attachments: attachments || [] })
      .select().single()

    if (error) return NextResponse.json({ error: 'Eroare la trimiterea răspunsului' }, { status: 500 })

    if (ticket.status === 'open') {
      await supabase.from('tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', id)
    } else {
      await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', id)
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}