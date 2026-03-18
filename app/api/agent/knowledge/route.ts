import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: docs } = await supabase
      .from('knowledge_documents')
      .select('id, name, type, status, chunk_count, size_bytes, error_msg, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ documents: docs || [] })
  } catch (err) {
    console.error('[Knowledge GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const supabase = createAdminClient()
    // Chunks se șterg automat prin CASCADE
    await supabase.from('knowledge_documents').delete().eq('id', id).eq('user_id', userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Knowledge DELETE]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}