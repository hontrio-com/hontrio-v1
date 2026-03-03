import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const intent = searchParams.get('intent') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const supabase = createAdminClient()

    let query = supabase
      .from('visitor_sessions')
      .select('session_id, visitor_id, messages_count, intents, messages_log, search_queries, started_at, ended_at, starred, archived', { count: 'exact' })
      .eq('user_id', userId)
      .gte('started_at', since)
      .eq('archived', false)
      .order('started_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (intent) query = query.contains('intents', [intent])

    const { data: sessions, count } = await query

    // Filtrare după search în messages_log (client-side pentru simplitate)
    let filtered = sessions || []
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((s: any) =>
        (s.messages_log || []).some((m: any) => m.content?.toLowerCase().includes(q)) ||
        (s.search_queries || []).some((sq: string) => sq.toLowerCase().includes(q))
      )
    }

    // Formatare pentru UI
    const conversations = filtered.map((s: any) => {
      const msgs: Array<{ role: string; content: string }> = s.messages_log || []
      const lastMsg = msgs[msgs.length - 1]
      const firstUserMsg = msgs.find(m => m.role === 'user')
      const isEscalated = (s.intents || []).some((i: string) => ['escalate', 'problem'].includes(i))
      const dominantIntent = (s.intents || []).reduce((acc: any, i: string) => {
        acc[i] = (acc[i] || 0) + 1; return acc
      }, {})
      const topIntent = Object.entries(dominantIntent).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'browsing'

      return {
        session_id: s.session_id,
        visitor_id: s.visitor_id,
        messages_count: s.messages_count || msgs.length,
        intents: s.intents || [],
        dominant_intent: topIntent,
        is_escalated: isEscalated,
        preview: lastMsg?.content?.slice(0, 100) || firstUserMsg?.content?.slice(0, 100) || '',
        started_at: s.started_at,
        ended_at: s.ended_at,
        starred: s.starred || false,
        messages: msgs,
      }
    })

    return NextResponse.json({ conversations, total: count || 0, page, pages: Math.ceil((count || 0) / limit) })
  } catch (err) {
    console.error('[Inbox]', err)
    return NextResponse.json({ error: 'Eroare' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const { session_id, starred, archived } = await request.json()
    const supabase = createAdminClient()
    const update: any = {}
    if (typeof starred === 'boolean') update.starred = starred
    if (typeof archived === 'boolean') update.archived = archived
    await supabase.from('visitor_sessions').update(update).eq('session_id', session_id).eq('user_id', userId)
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Eroare' }, { status: 500 }) }
}