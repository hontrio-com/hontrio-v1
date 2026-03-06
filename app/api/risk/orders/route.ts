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

    // Actualizează statisticile clientului și recalculează scorul complet
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('id', order.customer_id)
        .single()

      if (customer) {
        const statUpdates: any = {}
        if (order_status === 'collected') statUpdates.orders_collected = (customer.orders_collected || 0) + 1
        if (order_status === 'refused')   statUpdates.orders_refused   = (customer.orders_refused   || 0) + 1
        if (order_status === 'not_home')  statUpdates.orders_not_home  = (customer.orders_not_home  || 0) + 1
        if (order_status === 'cancelled') statUpdates.orders_cancelled = (customer.orders_cancelled || 0) + 1

        if (Object.keys(statUpdates).length) {
          // Statistici actualizate pentru recalculare
          const updatedStats = { ...customer, ...statUpdates }

          // Recalculare completă a scorului cu engine-ul real (nu delta simplu)
          const { calculateRiskScore } = await import('@/lib/risk/engine')

          // Ia setările magazinului pentru praguri
          const { data: storeSettings } = await supabase
            .from('risk_store_settings')
            .select('score_watch_threshold, score_problematic_threshold, score_blocked_threshold, custom_rules, ml_weights')
            .eq('store_id', order.store_id)
            .single()

          const rules = {
            ...(storeSettings?.custom_rules || {}),
            score_watch_threshold: storeSettings?.score_watch_threshold || 41,
            score_problematic_threshold: storeSettings?.score_problematic_threshold || 61,
            score_blocked_threshold: storeSettings?.score_blocked_threshold || 81,
            ml_weights: storeSettings?.ml_weights,
          }

          // Ia comanda curentă pentru context
          const { data: fullOrder } = await supabase
            .from('risk_orders')
            .select('payment_method, total_value, currency, ordered_at, customer_email, shipping_address')
            .eq('id', order_id)
            .single()

          const history = {
            totalOrders: updatedStats.total_orders || 0,
            ordersCollected: updatedStats.orders_collected || 0,
            ordersRefused: updatedStats.orders_refused || 0,
            ordersNotHome: updatedStats.orders_not_home || 0,
            ordersCancelled: updatedStats.orders_cancelled || 0,
            ordersToday: 0,
            lastOrderAt: updatedStats.last_order_at,
            firstOrderAt: updatedStats.first_order_at,
            accountCreatedAt: null,
            phoneValidated: !!(updatedStats.phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
            isNewAccount: false,
            addressChanges: 0,
            avgOrderValue: updatedStats.avg_order_value,
          }

          const orderCtx = {
            paymentMethod: (fullOrder?.payment_method || 'cod') as any,
            totalValue: fullOrder?.total_value || 0,
            currency: fullOrder?.currency || 'RON',
            orderedAt: fullOrder?.ordered_at || new Date().toISOString(),
            customerEmail: fullOrder?.customer_email || updatedStats.email || '',
            shippingAddress: fullOrder?.shipping_address || '',
            inGlobalBlacklist: updatedStats.in_global_blacklist || false,
            globalReportCount: 0,
          }

          const recalcResult = calculateRiskScore(history, orderCtx, rules)

          // Păstrează override-ul manual dacă există
          const finalLabel = updatedStats.manual_label_override || recalcResult.label

          await supabase.from('risk_customers').update({
            ...statUpdates,
            risk_score: recalcResult.score,
            risk_label: finalLabel,
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