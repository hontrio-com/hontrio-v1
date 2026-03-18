import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    const label = searchParams.get('label')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    let query = supabase
      .from('risk_customers')
      .select('*', { count: 'exact' })
      .eq('user_id', (session.user as any).id)
      .order('risk_score', { ascending: false })
      .range(offset, offset + limit - 1)

    if (store_id) query = query.eq('store_id', store_id)
    if (label && label !== 'all') query = query.eq('risk_label', label)
    if (search) {
      query = query.or(`phone.ilike.%${search}%,email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Stats per label — query separat fara paginare, cu store_id inclus
    let statsQuery = supabase
      .from('risk_customers')
      .select('risk_label, store_id')
      .eq('user_id', (session.user as any).id)

    if (store_id) statsQuery = statsQuery.eq('store_id', store_id)

    const { data: labelStats } = await statsQuery

    const stats = { trusted: 0, new: 0, watch: 0, problematic: 0, blocked: 0 }
    ;(labelStats || []).forEach((r: any) => {
      if (stats[r.risk_label as keyof typeof stats] !== undefined) {
        stats[r.risk_label as keyof typeof stats]++
      }
    })

    // Alerte necitite pentru acest store
    let alertsQuery = supabase
      .from('risk_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', (session.user as any).id)
      .eq('is_read', false)
    if (store_id) alertsQuery = alertsQuery.eq('store_id', store_id)
    const { count: unreadAlerts } = await alertsQuery

    return NextResponse.json({ customers: data || [], total: count || 0, stats, unreadAlerts: unreadAlerts || 0, page, limit })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { customer_id, label_override, operator_notes, in_local_blacklist } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('risk_customers')
      .select('id, risk_label, store_id')
      .eq('id', customer_id)
      .eq('user_id', (session.user as any).id)
      .single()
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const updates: any = { manually_reviewed: true, updated_at: new Date().toISOString() }
    if (label_override !== undefined) {
      if (label_override === null) {
        // Sterge override-ul și restaurează scorul calculat automat
        updates.manual_label_override = null
        updates.override_by = null
        updates.override_at = null
        // Recalculează label din scorul existent
        const { data: fullCustomer } = await supabase
          .from('risk_customers')
          .select('risk_score')
          .eq('id', customer_id)
          .single()
        if (fullCustomer) {
          const score = fullCustomer.risk_score || 0
          updates.risk_label = score >= 81 ? 'blocked' : score >= 61 ? 'problematic' : score >= 41 ? 'watch' : 'trusted'
        }
      } else {
        updates.manual_label_override = label_override
        updates.risk_label = label_override
        updates.override_by = (session.user as any).id
        updates.override_at = new Date().toISOString()
      }
    }
    if (operator_notes !== undefined) updates.operator_notes = operator_notes
    if (in_local_blacklist !== undefined) updates.in_local_blacklist = in_local_blacklist

    await supabase.from('risk_customers').update(updates).eq('id', customer_id)

    // Audit log
    if (label_override !== undefined) {
      await supabase.from('risk_audit_log').insert({
        store_id: customer.store_id,
        user_id: (session.user as any).id,
        customer_id,
        action: 'label_override',
        old_value: customer.risk_label,
        new_value: label_override,
      })
    }
    if (in_local_blacklist !== undefined) {
      await supabase.from('risk_audit_log').insert({
        store_id: customer.store_id,
        user_id: (session.user as any).id,
        customer_id,
        action: in_local_blacklist ? 'add_to_blacklist' : 'remove_from_blacklist',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}