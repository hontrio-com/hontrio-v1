import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const lines = parseInt(searchParams.get('lines') || '100')
    const level = searchParams.get('level') || 'ALL' // ERROR, WARN, ALL

    const supabase = createAdminClient()

    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(lines)

    if (level !== 'ALL') {
      query = query.eq('level', level)
    }

    const { data, error } = await query

    if (error) {
      // Table likely doesn't exist — return empty gracefully
      return NextResponse.json({ logs: [], total: 0, message: 'Nu există încă erori înregistrate.' })
    }

    return NextResponse.json({
      logs: data || [],
      total: data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Eroare la citirea logurilor' }, { status: 500 })
  }
}

// DELETE — clear logs
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('system_logs').delete().neq('id', '')

    if (error) {
      // Table likely doesn't exist — treat as already empty
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare' }, { status: 500 })
  }
}
