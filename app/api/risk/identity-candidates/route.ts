/**
 * GET  /api/risk/identity-candidates — list pending duplicate candidates
 * PATCH /api/risk/identity-candidates — dismiss (mark as not_duplicate)
 */
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

    const { data: store } = await supabase.from('stores')
      .select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ candidates: [] })

    const { data: candidates } = await supabase
      .from('risk_identity_candidates')
      .select(`
        id, confidence, match_reasons, status, created_at,
        customer_a_id, customer_b_id
      `)
      .eq('store_id', store.id)
      .eq('status', 'pending')
      .order('confidence', { ascending: false })
      .limit(50)

    if (!candidates?.length) return NextResponse.json({ candidates: [] })

    // Fetch both customer records for each candidate
    const allIds = [...new Set(candidates.flatMap((c: any) => [c.customer_a_id, c.customer_b_id]))]
    const { data: customerRows } = await supabase.from('risk_customers')
      .select('id, name, phone, email, risk_score, risk_label, total_orders, orders_refused, is_guest, is_merged')
      .in('id', allIds)

    const custMap = Object.fromEntries((customerRows || []).map((c: any) => [c.id, c]))

    const enriched = candidates
      .filter((c: any) => {
        const a = custMap[c.customer_a_id], b = custMap[c.customer_b_id]
        return a && b && !a.is_merged && !b.is_merged
      })
      .map((c: any) => ({
        ...c,
        customer_a: custMap[c.customer_a_id],
        customer_b: custMap[c.customer_b_id],
      }))

    return NextResponse.json({ candidates: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const { id, status } = await request.json()

    if (!id || !['not_duplicate', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: store } = await supabase.from('stores')
      .select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 404 })

    await supabase.from('risk_identity_candidates')
      .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', store.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
