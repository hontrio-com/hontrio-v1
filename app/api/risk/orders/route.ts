import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalcCustomerFromDB } from '@/lib/risk/identity'
import { recalibrateWeights, DEFAULT_ML_WEIGHTS, type MLWeights } from '@/lib/risk/engine'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    const customer_id = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createAdminClient()

    let query = supabase
      .from('risk_orders')
      .select('*', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('ordered_at', { ascending: false })
      .limit(limit)

    if (store_id) query = query.eq('store_id', store_id)
    if (customer_id) query = query.eq('customer_id', customer_id)
    if (status && status !== 'all') query = query.eq('order_status', status)

    const { data, count } = await query

    return NextResponse.json({ orders: data || [], total: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { order_id, order_status } = await req.json()
    if (!order_id || !order_status) return NextResponse.json({ error: 'order_id și order_status obligatorii' }, { status: 400 })

    const VALID_STATUSES = ['pending', 'processing', 'shipped', 'collected', 'refused', 'not_home', 'cancelled', 'returned']
    if (!VALID_STATUSES.includes(order_status)) {
      return NextResponse.json({ error: `Status invalid. Valori acceptate: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: order } = await supabase
      .from('risk_orders')
      .select('id, customer_id, order_status, store_id')
      .eq('id', order_id)
      .eq('user_id', session.user.id)
      .single()
    if (!order) return NextResponse.json({ error: 'Comandă negăsită' }, { status: 404 })

    const oldStatus = order.order_status

    // Update order status
    await supabase.from('risk_orders').update({
      order_status,
      resolved_at: ['collected', 'refused', 'returned', 'cancelled'].includes(order_status)
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    // Recalculează clientul din scratch (nu increment/decrement — FIX PROBLEMA 5)
    if (order.customer_id) {
      const { data: rs } = await supabase
        .from('risk_store_settings')
        .select('score_watch_threshold, score_problematic_threshold, score_blocked_threshold, custom_rules, ml_weights')
        .eq('store_id', order.store_id)
        .single()

      const settings = {
        score_watch_threshold: rs?.score_watch_threshold || 41,
        score_problematic_threshold: rs?.score_problematic_threshold || 61,
        score_blocked_threshold: rs?.score_blocked_threshold || 81,
        ...(rs?.custom_rules || {}),
        ml_weights: rs?.ml_weights,
      }

      await recalcCustomerFromDB(supabase, order.customer_id, order.store_id, settings)
    }

    // Audit log
    await supabase.from('risk_audit_log').insert({
      store_id: order.store_id,
      user_id: session.user.id,
      order_id,
      customer_id: order.customer_id,
      action: 'order_status_updated',
      old_value: oldStatus,
      new_value: order_status,
    })

    // ML Calibrare automată la finalizarea comenzii
    const terminalStatuses = ['collected', 'refused', 'returned', 'not_home', 'cancelled']
    if (terminalStatuses.includes(order_status) && order.customer_id) {
      try {
        const { data: fullOrder } = await supabase
          .from('risk_orders')
          .select('risk_score_at_order, risk_flags')
          .eq('id', order_id)
          .single()

        const { data: customer } = await supabase
          .from('risk_customers')
          .select('risk_label')
          .eq('id', order.customer_id)
          .single()

        const { data: mlSettings } = await supabase
          .from('risk_store_settings')
          .select('ml_weights')
          .eq('store_id', order.store_id)
          .single()

        const currentWeights: MLWeights = mlSettings?.ml_weights || { ...DEFAULT_ML_WEIGHTS }
        const flagsActivated = (fullOrder?.risk_flags || []).map((f: any) => f.code).filter(Boolean)
        const predictedLabel = customer?.risk_label || 'new'

        const newWeights = recalibrateWeights(currentWeights, predictedLabel, order_status as any, flagsActivated)

        await supabase.from('risk_store_settings').upsert({
          store_id: order.store_id,
          user_id: session.user.id,
          ml_weights: newWeights,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id' })
      } catch (mlErr) {
        console.error('[Risk ML] Calibration error:', mlErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}