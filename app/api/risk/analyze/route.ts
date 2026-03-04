import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const body = await req.json()
    const {
      store_id,
      external_order_id,
      order_number,
      customer_phone,
      customer_email,
      customer_name,
      shipping_address,
      payment_method = 'cod',
      total_value,
      currency = 'RON',
      ordered_at,
    } = body

    if (!store_id || !external_order_id || (!customer_phone && !customer_email)) {
      return NextResponse.json({ error: 'store_id, external_order_id și telefon/email sunt obligatorii' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verifică că store-ul aparține userului
    const { data: store } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', store_id)
      .eq('user_id', session.user.id)
      .single()
    if (!store) return NextResponse.json({ error: 'Store negăsit' }, { status: 404 })

    // Aduce setările magazinului
    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single()

    const rules = settings?.custom_rules || {}
    const storeSettings = {
      ...rules,
      score_watch_threshold: settings?.score_watch_threshold || 41,
      score_problematic_threshold: settings?.score_problematic_threshold || 61,
      score_blocked_threshold: settings?.score_blocked_threshold || 81,
    }

    // Caută sau creează profilul clientului
    let customer: any = null
    if (customer_phone) {
      const { data } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('store_id', store_id)
        .eq('phone', customer_phone)
        .single()
      customer = data
    }
    if (!customer && customer_email) {
      const { data } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('store_id', store_id)
        .eq('email', customer_email)
        .single()
      customer = data
    }

    // Comenzi azi pentru același client
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let ordersToday = 0
    if (customer_phone || customer_email) {
      const { count } = await supabase
        .from('risk_orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store_id)
        .gte('ordered_at', todayStart.toISOString())
        .or(
          [
            customer_phone ? `customer_phone.eq.${customer_phone}` : null,
            customer_email ? `customer_email.eq.${customer_email}` : null,
          ].filter(Boolean).join(',')
        )
      ordersToday = count || 0
    }

    // Adrese unice folosite
    let addressChanges = 0
    if (customer) {
      const { data: addresses } = await supabase
        .from('risk_orders')
        .select('shipping_address')
        .eq('customer_id', customer.id)
        .not('shipping_address', 'is', null)
      const uniqueAddresses = new Set((addresses || []).map(a => a.shipping_address?.trim().toLowerCase()))
      addressChanges = uniqueAddresses.size
    }

    // Verifică blacklist global
    let inGlobalBlacklist = false
    let globalReportCount = 0
    if (settings?.participate_in_global_blacklist) {
      const hashesToCheck = [
        customer_phone ? hashIdentifier(customer_phone) : null,
        customer_email ? hashIdentifier(customer_email) : null,
      ].filter(Boolean)

      for (const hash of hashesToCheck) {
        const { data: globalEntry } = await supabase
          .from('risk_global_blacklist')
          .select('report_count, global_risk_score')
          .or(`phone_hash.eq.${hash},email_hash.eq.${hash}`)
          .single()
        if (globalEntry) {
          inGlobalBlacklist = true
          globalReportCount = Math.max(globalReportCount, globalEntry.report_count)
        }
      }
    }

    // Construiește istoricul
    const history: CustomerHistory = {
      totalOrders: customer?.total_orders || 0,
      ordersCollected: customer?.orders_collected || 0,
      ordersRefused: customer?.orders_refused || 0,
      ordersNotHome: customer?.orders_not_home || 0,
      ordersCancelled: customer?.orders_cancelled || 0,
      ordersToday,
      lastOrderAt: customer?.last_order_at || null,
      firstOrderAt: customer?.first_order_at || null,
      accountCreatedAt: null,
      phoneValidated: !!(customer_phone && customer_phone.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: !customer,
      addressChanges,
    }

    const orderCtx: OrderContext = {
      paymentMethod: payment_method,
      totalValue: total_value || 0,
      currency,
      orderedAt: ordered_at || new Date().toISOString(),
      customerEmail: customer_email || '',
      shippingAddress: shipping_address || '',
      inGlobalBlacklist,
      globalReportCount,
    }

    // Calculează scorul
    const result = calculateRiskScore(history, orderCtx, storeSettings)

    // Folosește override manual dacă există
    const finalLabel = customer?.manual_label_override || result.label

    // Upsert client
    const customerData = {
      store_id,
      user_id: session.user.id,
      phone: customer_phone || customer?.phone,
      email: customer_email || customer?.email,
      name: customer_name || customer?.name,
      risk_score: result.score,
      risk_label: finalLabel,
      total_orders: (customer?.total_orders || 0) + 1,
      orders_collected: customer?.orders_collected || 0,
      orders_refused: customer?.orders_refused || 0,
      orders_not_home: customer?.orders_not_home || 0,
      orders_cancelled: customer?.orders_cancelled || 0,
      last_order_at: ordered_at || new Date().toISOString(),
      first_order_at: customer?.first_order_at || ordered_at || new Date().toISOString(),
      in_global_blacklist: inGlobalBlacklist,
      updated_at: new Date().toISOString(),
    }

    let customerId = customer?.id
    if (customer) {
      await supabase.from('risk_customers').update(customerData).eq('id', customer.id)
    } else {
      const { data: newCustomer } = await supabase
        .from('risk_customers')
        .insert({ ...customerData, first_order_at: ordered_at || new Date().toISOString() })
        .select('id')
        .single()
      customerId = newCustomer?.id
    }

    // Inserează comanda
    const { data: riskOrder } = await supabase
      .from('risk_orders')
      .upsert({
        store_id,
        user_id: session.user.id,
        customer_id: customerId,
        external_order_id,
        order_number,
        customer_phone,
        customer_email,
        customer_name,
        shipping_address,
        payment_method,
        total_value,
        currency,
        order_status: 'pending',
        risk_score_at_order: result.score,
        risk_flags: result.flags,
        ordered_at: ordered_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,external_order_id' })
      .select('id')
      .single()

    // Generează alertă dacă e necesar
    if (
      (finalLabel === 'problematic' && settings?.alert_on_problematic !== false) ||
      (finalLabel === 'blocked' && settings?.alert_on_blocked !== false) ||
      (finalLabel === 'watch' && settings?.alert_on_watch === true)
    ) {
      const severity = finalLabel === 'blocked' ? 'critical' : finalLabel === 'problematic' ? 'warning' : 'info'
      const topFlags = result.flags.slice(0, 3).map(f => f.label).join(', ')

      await supabase.from('risk_alerts').insert({
        store_id,
        user_id: session.user.id,
        customer_id: customerId,
        order_id: riskOrder?.id,
        alert_type: finalLabel === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
        severity,
        title: `Client ${finalLabel === 'blocked' ? 'blocat' : 'problematic'}: ${customer_name || customer_phone || customer_email}`,
        description: `Scor risc: ${result.score}/100. Motive: ${topFlags || 'Vezi detalii'}`,
      })
    }

    // Raportează în blacklist global (opțional)
    if (settings?.participate_in_global_blacklist && result.score >= 61) {
      const upsertGlobal = async (field: 'phone_hash' | 'email_hash', value: string) => {
        const hash = hashIdentifier(value)
        const { data: existing } = await supabase
          .from('risk_global_blacklist')
          .select('id, report_count')
          .eq(field, hash)
          .single()

        if (existing) {
          await supabase
            .from('risk_global_blacklist')
            .update({
              report_count: existing.report_count + 1,
              last_reported_at: new Date().toISOString(),
              global_risk_score: Math.min(existing.report_count * 20, 100),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('risk_global_blacklist').insert({
            [field]: hash,
            report_count: 1,
            global_risk_score: 20,
          })
        }
      }

      if (customer_phone) await upsertGlobal('phone_hash', customer_phone)
      if (customer_email) await upsertGlobal('email_hash', customer_email)
    }

    return NextResponse.json({
      score: result.score,
      label: finalLabel,
      flags: result.flags,
      recommendation: result.recommendation,
      customerId,
      orderId: riskOrder?.id,
      action: finalLabel === 'blocked'
        ? 'block'
        : finalLabel === 'problematic'
        ? 'hold'
        : 'proceed',
    })
  } catch (err: any) {
    console.error('Risk analyze error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}