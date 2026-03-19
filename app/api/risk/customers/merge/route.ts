/**
 * POST /api/risk/customers/merge
 *
 * Merges source_id into target_id:
 * - Moves all orders from source to target
 * - Moves all alerts from source to target
 * - Recalculates target's risk score
 * - Marks source as merged (soft-delete, keeps data for audit)
 * - Marks any identity_candidates as 'merged'
 * - Creates audit log entry
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalc, getSettings } from '@/lib/risk/identity'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const { target_id, source_id } = await request.json()

    if (!target_id || !source_id) {
      return NextResponse.json({ error: 'target_id and source_id are required' }, { status: 400 })
    }
    if (target_id === source_id) {
      return NextResponse.json({ error: 'Cannot merge a customer with itself' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify both customers belong to this user's store
    const { data: customers } = await supabase.from('risk_customers')
      .select('id, store_id, name, phone, email, is_merged, risk_score, total_orders')
      .in('id', [target_id, source_id])
      .eq('user_id', userId)

    if (!customers || customers.length !== 2) {
      return NextResponse.json({ error: 'One or both customers not found' }, { status: 404 })
    }

    const target = customers.find((c: any) => c.id === target_id)
    const source = customers.find((c: any) => c.id === source_id)

    if (!target || !source) {
      return NextResponse.json({ error: 'Customer lookup failed' }, { status: 404 })
    }
    if (source.is_merged) {
      return NextResponse.json({ error: 'Source customer is already merged' }, { status: 400 })
    }

    const storeId = target.store_id

    // 1. Move all orders from source → target
    await supabase.from('risk_orders')
      .update({ customer_id: target_id, updated_at: new Date().toISOString() })
      .eq('customer_id', source_id)
      .eq('store_id', storeId)

    // 2. Move all alerts from source → target
    await supabase.from('risk_alerts')
      .update({ customer_id: target_id })
      .eq('customer_id', source_id)
      .eq('store_id', storeId)

    // 3. Mark source as merged
    await supabase.from('risk_customers')
      .update({
        is_merged: true,
        merged_into_id: target_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source_id)

    // 4. Recalculate target's risk score from all (now combined) orders
    const settings = await getSettings(supabase, storeId)
    const result = await recalc(supabase, target_id, storeId, settings)

    // 5. Mark identity candidates involving these two as 'merged'
    const [a, b] = [target_id, source_id].sort()
    await supabase.from('risk_identity_candidates')
      .update({ status: 'merged', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('customer_a_id', a).eq('customer_b_id', b)

    // Also clean up any other pending candidates that involve source (now merged)
    await supabase.from('risk_identity_candidates')
      .update({ status: 'merged', reviewed_at: new Date().toISOString() })
      .or(`customer_a_id.eq.${source_id},customer_b_id.eq.${source_id}`)
      .eq('status', 'pending')

    // 6. Audit log
    await supabase.from('risk_audit_log').insert({
      store_id: storeId, user_id: userId,
      customer_id: target_id,
      action: 'customer_merge',
      old_value: JSON.stringify({ source_id, source_name: source.name, source_orders: source.total_orders }),
      new_value: JSON.stringify({ target_id, new_score: result.score, new_label: result.label }),
    })

    return NextResponse.json({
      ok: true,
      target_id,
      source_id,
      new_score: result.score,
      new_label: result.label,
      message: `Merged "${source.name || source_id}" into "${target.name || target_id}"`,
    })

  } catch (err: any) {
    console.error('[merge] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
