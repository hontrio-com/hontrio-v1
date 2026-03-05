import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
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

    // Update order
    await supabase.from('risk_orders').update({
      order_status,
      resolved_at: ['collected', 'refused', 'returned', 'cancelled'].includes(order_status)
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    // Update customer statistics
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('id', order.customer_id)
        .single()

      if (customer) {
        const statUpdates: any = {}
        if (order_status === 'collected') statUpdates.orders_collected = (customer.orders_collected || 0) + 1
        if (order_status === 'refused') statUpdates.orders_refused = (customer.orders_refused || 0) + 1
        if (order_status === 'not_home') statUpdates.orders_not_home = (customer.orders_not_home || 0) + 1
        if (order_status === 'cancelled') statUpdates.orders_cancelled = (customer.orders_cancelled || 0) + 1

        if (Object.keys(statUpdates).length) {
          // Recalculează risk score cu noile statistici
          const newHistory = {
            ...customer,
            ...statUpdates,
          }
          const collectionRate = newHistory.total_orders > 0
            ? (newHistory.orders_collected / newHistory.total_orders) * 100
            : 100

          // Ajustare simplă a scorului după outcome
          let scoreDelta = 0
          if (order_status === 'collected') scoreDelta = -5   // reducere risc după ridicare
          if (order_status === 'refused') scoreDelta = 15
          if (order_status === 'not_home') scoreDelta = 5
          if (order_status === 'cancelled') scoreDelta = 10

          const newScore = Math.min(Math.max((customer.risk_score || 0) + scoreDelta, 0), 100)

          await supabase.from('risk_customers').update({
            ...statUpdates,
            risk_score: newScore,
            updated_at: new Date().toISOString(),
          }).eq('id', order.customer_id)
        }
      }
    }

    // Audit log
    await supabase.from('risk_audit_log').insert({
      store_id: order.store_id,
      user_id: session.user.id,
      order_id,
      customer_id: order.customer_id,
      action: 'order_status_updated',
      old_value: order.order_status,
      new_value: order_status,
    })

    // ML Calibrare automată la finalizarea comenzii
    const terminalStatuses = ['collected', 'refused', 'returned', 'not_home', 'cancelled']
    if (terminalStatuses.includes(order_status) && order.customer_id) {
      try {
        // Ia comanda cu flag-urile originale
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

        const { data: settings } = await supabase
          .from('risk_store_settings')
          .select('ml_weights')
          .eq('store_id', order.store_id)
          .single()

        const currentWeights: MLWeights = settings?.ml_weights || { ...DEFAULT_ML_WEIGHTS }
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