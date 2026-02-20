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
    const { message } = await request.json()

    if (!message || message.length > 5000) {
      return NextResponse.json({ error: 'Mesajul este obligatoriu (max 5000 caractere)' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify ticket exists
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Tichet negăsit' }, { status: 404 })
    }

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: id,
        user_id: userId,
        message: message.trim(),
        is_admin: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Eroare la trimiterea răspunsului' }, { status: 500 })
    }

    // Auto-update status to in_progress if it was open
    if (ticket.status === 'open') {
      await supabase.from('tickets').update({ status: 'in_progress' }).eq('id', id)
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}