import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('unanswered_questions')
      .select('id, question, intent, confidence, count, resolved, last_seen_at, created_at')
      .eq('user_id', userId)
      .order('count', { ascending: false })
      .limit(100)

    return NextResponse.json({ questions: data || [] })
  } catch { return NextResponse.json({ error: 'Eroare' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { id, resolved } = await request.json()
    const supabase = createAdminClient()
    await supabase.from('unanswered_questions').update({ resolved }).eq('id', id).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Eroare' }, { status: 500 }) }
}