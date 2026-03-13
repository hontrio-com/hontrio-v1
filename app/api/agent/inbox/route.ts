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

    // Source 1: visitor_sessions (detailed — has messages_log)
    let vsQuery = supabase
      .from('visitor_sessions')
      .select('session_id, visitor_id, messages_count, intents, messages_log, search_queries, started_at, ended_at, starred, archived', { count: 'exact' })
      .eq('user_id', userId)
      .gte('started_at', since)
      .eq('archived', false)
      .order('started_at', { ascending: false })

    if (intent) vsQuery = vsQuery.contains('intents', [intent])

    const { data: vsSessions, count: vsCount } = await vsQuery

    // Source 2: agent_conversations (fallback — always has data)
    const { data: agentConvs } = await supabase
      .from('agent_conversations')
      .select('session_id, visitor_id, message_count, intent, messages, escalated, started_at, last_message_at')
      .eq('user_id', userId)
      .gte('started_at', since)
      .order('last_message_at', { ascending: false })

    // Merge: visitor_sessions first, then agent_conversations for missing sessions
    const vsSessionIds = new Set((vsSessions || []).map(s => s.session_id))

    // Format visitor_sessions
    const fromVS = (vsSessions || []).map((s: any) => {
      const msgs: Array<{ role: string; content: string }> = s.messages_log || []
      const lastMsg = msgs[msgs.length - 1]
      const firstUserMsg = msgs.find((m: any) => m.role === 'user')
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

    // Format agent_conversations (for sessions NOT in visitor_sessions)
    const fromAC = (agentConvs || [])
      .filter((c: any) => !vsSessionIds.has(c.session_id))
      .map((c: any) => {
        const msgs: Array<{ role: string; content: string }> = c.messages || []
        const lastMsg = msgs[msgs.length - 1]
        const firstUserMsg = msgs.find((m: any) => m.role === 'user')

        return {
          session_id: c.session_id,
          visitor_id: c.visitor_id,
          messages_count: c.message_count || msgs.length,
          intents: c.intent ? [c.intent] : [],
          dominant_intent: c.intent || 'browsing',
          is_escalated: c.escalated || false,
          preview: lastMsg?.content?.slice(0, 100) || firstUserMsg?.content?.slice(0, 100) || 'Conversație',
          started_at: c.started_at,
          ended_at: c.last_message_at,
          starred: false,
          messages: msgs,
        }
      })

    // Combine and sort by date
    let conversations = [...fromVS, ...fromAC]
      .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      conversations = conversations.filter(c =>
        c.messages.some((m: any) => m.content?.toLowerCase().includes(q)) ||
        c.preview.toLowerCase().includes(q)
      )
    }

    // Intent filter on combined results
    if (intent) {
      conversations = conversations.filter(c => c.intents.includes(intent))
    }

    // Paginate
    const total = conversations.length
    const paginated = conversations.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      conversations: paginated,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
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