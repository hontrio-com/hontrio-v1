import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitApi } from '@/lib/security/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id

    const limit = rateLimitApi(userId, 'ticket-reply')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe mesaje. Așteaptă puțin.' }, { status: 429 })
    }

    const { message } = await request.json()

    if (!message || message.length > 5000) {
      return NextResponse.json({ error: 'Mesajul este obligatoriu (max 5000 caractere)' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify ticket belongs to user
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Tichet negăsit' }, { status: 404 })
    }

    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'Tichetul este închis' }, { status: 400 })
    }

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: id,
        user_id: userId,
        message: message.trim(),
        is_admin: false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Eroare la trimiterea răspunsului' }, { status: 500 })
    }

    // Reopen ticket if it was resolved
    if (ticket.status === 'resolved') {
      await supabase.from('tickets').update({ status: 'open' }).eq('id', id)
    }

    return NextResponse.json({ reply }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}