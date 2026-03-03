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
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const supabase = createAdminClient()

    const { data: events } = await supabase
      .from('product_events')
      .select('product_id, product_name, event_type')
      .eq('user_id', userId)
      .gte('created_at', since)

    // Agregare pe produs
    const map: Record<string, { name: string; shown: number; clicked: number; compared: number; escalated: number; carted: number; score: number }> = {}

    for (const e of (events || [])) {
      if (!map[e.product_id]) map[e.product_id] = { name: e.product_name || e.product_id, shown: 0, clicked: 0, compared: 0, escalated: 0, carted: 0, score: 0 }
      const p = map[e.product_id]
      if (e.event_type === 'shown') p.shown++
      else if (e.event_type === 'clicked') p.clicked++
      else if (e.event_type === 'compared') p.compared++
      else if (e.event_type === 'escalated') p.escalated++
      else if (e.event_type === 'carted') p.carted++
    }

    // Scor agregat: cereri × 1 + click × 3 + comparat × 2 + coș × 5 + escalat × -1
    const products = Object.entries(map).map(([id, p]) => ({
      id, ...p,
      score: p.shown * 1 + p.clicked * 3 + p.compared * 2 + p.carted * 5 - p.escalated * 1,
    })).sort((a, b) => b.score - a.score)

    return NextResponse.json({ products })
  } catch { return NextResponse.json({ error: 'Eroare' }, { status: 500 }) }
}

// Track click / carted events din widget
export async function POST(request: Request) {
  try {
    const { userId, productId, externalId, productName, eventType, sessionId } = await request.json()
    if (!userId || !productId || !eventType) return NextResponse.json({ ok: false }, { status: 400 })
    if (!['clicked', 'carted'].includes(eventType)) return NextResponse.json({ ok: false }, { status: 400 })
    const supabase = createAdminClient()
    await supabase.from('product_events').insert({
      user_id: userId, product_id: productId,
      external_id: externalId ? String(externalId) : null,
      product_name: productName, event_type: eventType, session_id: sessionId,
    })
    return NextResponse.json({ ok: true }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch { return NextResponse.json({ ok: false }, { status: 500 }) }
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}