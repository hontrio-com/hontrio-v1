import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('training_corrections')
      .select('id, original_question, wrong_answer, correct_answer, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return NextResponse.json({ corrections: data || [] })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { original_question, wrong_answer, correct_answer } = await request.json()
    if (!original_question || !correct_answer) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Generează embedding pentru întrebare
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: original_question.slice(0, 500) })
    const embedding = embRes.data[0].embedding

    const supabase = createAdminClient()
    const { data, error } = await supabase.from('training_corrections').insert({
      user_id: userId, original_question, wrong_answer, correct_answer, embedding,
    }).select('id, original_question, wrong_answer, correct_answer, is_active, created_at').single()

    if (error) throw error
    return NextResponse.json({ correction: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { id, is_active, correct_answer } = await request.json()
    const supabase = createAdminClient()
    const update: any = { updated_at: new Date().toISOString() }
    if (typeof is_active === 'boolean') update.is_active = is_active
    if (correct_answer) update.correct_answer = correct_answer
    await supabase.from('training_corrections').update(update).eq('id', id).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await request.json()
    const supabase = createAdminClient()
    await supabase.from('training_corrections').delete().eq('id', id).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}