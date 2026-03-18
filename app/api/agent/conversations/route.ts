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

    const now = new Date()
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: conversations } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', last30)
      .order('last_message_at', { ascending: false })

    const total = conversations?.length || 0
    const last7Count = conversations?.filter(c => c.started_at >= last7).length || 0
    const escalated = conversations?.filter(c => c.escalated).length || 0
    const avgMessages = total > 0
      ? Math.round((conversations || []).reduce((s, c) => s + (c.message_count || 0), 0) / total)
      : 0

    // Intent breakdown
    const intents: Record<string, number> = {}
    for (const c of conversations || []) {
      if (c.intent) intents[c.intent] = (intents[c.intent] || 0) + 1
    }

    // Recent conversations (last 10)
    const recent = (conversations || []).slice(0, 10).map(c => ({
      id: c.id,
      session_id: c.session_id,
      intent: c.intent,
      message_count: c.message_count,
      escalated: c.escalated,
      started_at: c.started_at,
      last_message_at: c.last_message_at,
    }))

    return NextResponse.json({
      stats: { total, last7: last7Count, escalated, avgMessages },
      intents,
      recent,
    })
  } catch (err) {
    console.error('[Agent Conversations]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}