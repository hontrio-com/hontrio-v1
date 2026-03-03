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

    const supabase = createAdminClient()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all sessions in period
    const { data: sessions } = await supabase
      .from('visitor_sessions')
      .select('visitor_id, session_id, messages_count, intents, products_shown, search_queries, started_at, ended_at')
      .eq('user_id', userId)
      .gte('started_at', since)
      .order('started_at', { ascending: true })

    // Fallback: also read from agent_conversations (older data source)
    const { data: agentConvs } = await supabase
      .from('agent_conversations')
      .select('visitor_id, session_id, message_count, intent, products_shown, started_at, last_message_at')
      .eq('user_id', userId)
      .gte('started_at', since)
      .order('started_at', { ascending: true })

    // Merge: prefer visitor_sessions, supplement with agent_conversations
    const sessionIds = new Set((sessions || []).map((s: any) => s.session_id))
    const extraFromConvs = (agentConvs || [])
      .filter((c: any) => !sessionIds.has(c.session_id))
      .map((c: any) => ({
        visitor_id: c.visitor_id,
        session_id: c.session_id,
        messages_count: c.message_count || 0,
        intents: c.intent ? [c.intent] : [],
        products_shown: c.products_shown || [],
        search_queries: [],
        started_at: c.started_at,
        ended_at: c.last_message_at,
      }))

    const { data: memory } = await supabase
      .from('visitor_memory')
      .select('visitor_id, total_sessions, return_count, preferred_categories, last_seen_at')
      .eq('user_id', userId)

    // Fetch product titles for product IDs
    const allProductIds = [...new Set((sessions || []).flatMap(s => s.products_shown || []))]
    let productMap: Record<string, string> = {}
    if (allProductIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, optimized_title, original_title')
        .in('id', allProductIds.slice(0, 200))
        .eq('user_id', userId)
      for (const p of products || []) {
        productMap[p.id] = p.optimized_title || p.original_title || p.id
      }
    }

    const sess = [...(sessions || []), ...extraFromConvs]

    // 1. Conversații pe zile
    const byDay: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      byDay[d.toISOString().slice(0, 10)] = 0
    }
    for (const s of sess) {
      const day = s.started_at?.slice(0, 10)
      if (day && byDay[day] !== undefined) byDay[day]++
    }
    const conversationsPerDay = Object.entries(byDay).map(([date, count]) => ({ date, count }))

    // 2. Distribuție intenții
    const intentCounts: Record<string, number> = {}
    for (const s of sess) {
      for (const intent of s.intents || []) {
        if (intent) intentCounts[intent] = (intentCounts[intent] || 0) + 1
      }
    }

    // 3. Top produse cerute
    const productCounts: Record<string, number> = {}
    for (const s of sess) {
      for (const pid of s.products_shown || []) {
        if (pid) productCounts[pid] = (productCounts[pid] || 0) + 1
      }
    }
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, name: productMap[id] || id, count }))

    // 4. Top căutări
    const searchCounts: Record<string, number> = {}
    for (const s of sess) {
      for (const q of s.search_queries || []) {
        if (q && q.length > 1) {
          const norm = q.toLowerCase().trim()
          searchCounts[norm] = (searchCounts[norm] || 0) + 1
        }
      }
    }
    const topSearches = Object.entries(searchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }))

    // 5. Distribuție ore (heatmap)
    const hourCounts: number[] = Array(24).fill(0)
    for (const s of sess) {
      if (s.started_at) {
        const h = new Date(s.started_at).getHours()
        hourCounts[h]++
      }
    }

    // 6. Vizitatori unici vs reveniri
    const uniqueVisitors = new Set(sess.map(s => s.visitor_id)).size
    const returningVisitors = (memory || []).filter(m => m.return_count > 0).length
    const totalSessions = sess.length
    const avgMessages = totalSessions > 0
      ? Math.round(sess.reduce((s, c) => s + (c.messages_count || 0), 0) / totalSessions)
      : 0
    const escalated = sess.filter(s => (s.intents || []).includes('escalate')).length

    // 7. Categorii preferate
    const catCounts: Record<string, number> = {}
    for (const m of memory || []) {
      for (const cat of m.preferred_categories || []) {
        catCounts[cat] = (catCounts[cat] || 0) + 1
      }
    }
    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }))

    // 8. Trend săptămânal (this week vs last week)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const thisWeek = sess.filter(s => s.started_at >= weekAgo).length
    const lastWeek = sess.filter(s => s.started_at >= twoWeeksAgo && s.started_at < weekAgo).length
    const weekTrend = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0

    return NextResponse.json({
      summary: { totalSessions, uniqueVisitors, returningVisitors, avgMessages, escalated, weekTrend, thisWeek, lastWeek },
      conversationsPerDay,
      intentCounts,
      topProducts,
      topSearches,
      topCategories,
      hourCounts,
    })
  } catch (err) {
    console.error('[Analytics]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}