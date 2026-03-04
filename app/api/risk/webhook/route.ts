import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import crypto from 'crypto'

// ─── Verifică semnătura HMAC-SHA256 trimisă de WooCommerce ───────────────────
function verifyWooSignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')
    // timingSafeEqual necesită buffere de aceeași lungime
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

// ─── Mapare status WooCommerce → status intern Hontrio ───────────────────────
function mapWooStatus(wooStatus: string): string {
  const map: Record<string, string> = {
    'pending':    'pending',
    'processing': 'processing',
    'on-hold':    'pending',
    'completed':  'collected',
    'cancelled':  'cancelled',
    'refunded':   'returned',
    'failed':     'cancelled',
    'shipped':    'shipped',
    'delivered':  'collected',
    'returned':   'returned',
  }
  return map[wooStatus] || 'pending'
}

// ─── Extrage adresa de livrare din obiectul WooCommerce ──────────────────────
function extractShippingAddress(order: any): string {
  const s = order.shipping || {}
  const b = order.billing || {}
  const parts = [
    s.address_1 || b.address_1,
    s.city || b.city,
    s.state || b.state,
    s.country || b.country,
  ].filter(Boolean)
  return parts.join(', ')
}

// ─── Extrage metoda de plată ─────────────────────────────────────────────────
function extractPaymentMethod(order: any): 'cod' | 'card' | 'bank_transfer' {
  const method = (order.payment_method || '').toLowerCase()
  if (method.includes('cod') || method.includes('cash')) return 'cod'
  if (method.includes('card') || method.includes('stripe') || method.includes('paypal')) return 'card'
  return 'bank_transfer'
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-wc-webhook-signature') || ''
    const topic = req.headers.get('x-wc-webhook-topic') || ''
    const webhookId = req.headers.get('x-wc-webhook-id') || ''
    const sourceUrl = req.headers.get('x-wc-webhook-source') || ''

    console.log('[Risk Webhook] IN:', { topic, webhookId, sourceUrl, sig: signature.slice(0,20), bodyLen: rawBody.length })

    // Parsează body
    let order: any
    try {
      order = JSON.parse(rawBody)
    } catch {
      console.log('[Risk Webhook] Invalid JSON')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    console.log('[Risk Webhook] Order:', order?.id, order?.status, order?.billing?.email, order?.billing?.phone)

    const supabase = createAdminClient()

    // ─── Găsește store-ul după webhook_secret ─────────────────────────────────
    const { data: storesList, error: storesErr } = await supabase
      .from('stores')
      .select('id, user_id, store_url, webhook_secret')
      .not('webhook_secret', 'is', null)

    console.log('[Risk Webhook] Stores with secret:', storesList?.length, storesErr?.message)

    if (!storesList || storesList.length === 0) {
      return NextResponse.json({ error: 'No webhook configured' }, { status: 404 })
    }

    // 1. Verifică semnătura HMAC
    let matchedStore: any = null
    for (const s of storesList) {
      const valid = verifyWooSignature(rawBody, signature, s.webhook_secret)
      console.log('[Risk Webhook] Store', s.store_url, 'sig valid:', valid)
      if (valid) { matchedStore = s; break }
    }

    // 2. Fallback: source URL header
    if (!matchedStore && sourceUrl) {
      matchedStore = storesList.find(s =>
        s.store_url && sourceUrl.replace(/\/$/, '').includes(
          s.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        )
      )
      if (matchedStore) console.log('[Risk Webhook] Matched by sourceUrl')
    }

    // 3. Ultimul fallback: dacă e un singur magazin
    if (!matchedStore && storesList.length === 1) {
      console.log('[Risk Webhook] Single store fallback')
      matchedStore = storesList[0]
    }

    if (!matchedStore) {
      console.log('[Risk Webhook] No store matched — 401')
      return NextResponse.json({ error: 'Store not found or invalid signature' }, { status: 401 })
    }

    console.log('[Risk Webhook] Matched:', matchedStore.store_url)

    // Aduce setările Risk pentru store-ul găsit
    const { data: riskSettings } = await supabase
      .from('risk_store_settings')
      .select('*')
      .eq('store_id', matchedStore.id)
      .single()

    const storeId = matchedStore.id
    const userId = matchedStore.user_id
    const matchedSettings = {
      ...riskSettings,
      store_id: storeId,
      stores: matchedStore,
      participate_in_global_blacklist: riskSettings?.participate_in_global_blacklist ?? true,
      alert_on_blocked: riskSettings?.alert_on_blocked ?? true,
      alert_on_problematic: riskSettings?.alert_on_problematic ?? true,
      alert_on_watch: riskSettings?.alert_on_watch ?? false,
      score_watch_threshold: riskSettings?.score_watch_threshold ?? 41,
      score_problematic_threshold: riskSettings?.score_problematic_threshold ?? 61,
      score_blocked_threshold: riskSettings?.score_blocked_threshold ?? 81,
      custom_rules: riskSettings?.custom_rules || {},
    }

    // ─── Procesează în funcție de topic ──────────────────────────────────────
    if (topic === 'order.created' || topic === 'order.updated') {
      const customerPhone = order.billing?.phone || null
      const customerEmail = order.billing?.email || null
      const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || null
      const shippingAddress = extractShippingAddress(order)
      const paymentMethod = extractPaymentMethod(order)
      const totalValue = parseFloat(order.total || '0')
      const currency = order.currency || 'RON'
      const orderedAt = order.date_created || new Date().toISOString()
      const externalOrderId = String(order.id)
      const orderNumber = order.number ? String(order.number) : null
      const wooStatus = order.status || 'pending'
      const hontrioStatus = mapWooStatus(wooStatus)

      if (!customerPhone && !customerEmail) {
        return NextResponse.json({ ok: true, skipped: 'no_contact_info' })
      }

      // Caută clientul existent
      let customer: any = null
      if (customerPhone) {
        const { data } = await supabase
          .from('risk_customers')
          .select('*')
          .eq('store_id', storeId)
          .eq('phone', customerPhone)
          .single()
        customer = data
      }
      if (!customer && customerEmail) {
        const { data } = await supabase
          .from('risk_customers')
          .select('*')
          .eq('store_id', storeId)
          .eq('email', customerEmail)
          .single()
        customer = data
      }

      // Verifică dacă comanda există deja (pentru update)
      const { data: existingOrder } = await supabase
        .from('risk_orders')
        .select('id, order_status')
        .eq('store_id', storeId)
        .eq('external_order_id', externalOrderId)
        .single()

      if (topic === 'order.updated' && existingOrder) {
        // Actualizează doar statusul comenzii și recalculează contoarele
        await supabase
          .from('risk_orders')
          .update({
            order_status: hontrioStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOrder.id)

        // Dacă statusul s-a schimbat relevant, actualizează contoarele clientului
        if (customer && existingOrder.order_status !== hontrioStatus) {
          const oldStatus = existingOrder.order_status
          const updates: Record<string, any> = {}

          // Scade din vechiul status
          if (oldStatus === 'collected') updates.orders_collected = Math.max(0, (customer.orders_collected || 0) - 1)
          if (oldStatus === 'refused') updates.orders_refused = Math.max(0, (customer.orders_refused || 0) - 1)
          if (oldStatus === 'not_home') updates.orders_not_home = Math.max(0, (customer.orders_not_home || 0) - 1)
          if (oldStatus === 'cancelled') updates.orders_cancelled = Math.max(0, (customer.orders_cancelled || 0) - 1)

          // Adaugă la noul status
          if (hontrioStatus === 'collected') updates.orders_collected = (customer.orders_collected || 0) + 1
          if (hontrioStatus === 'refused') updates.orders_refused = (customer.orders_refused || 0) + 1
          if (hontrioStatus === 'not_home') updates.orders_not_home = (customer.orders_not_home || 0) + 1
          if (hontrioStatus === 'cancelled') updates.orders_cancelled = (customer.orders_cancelled || 0) + 1

          if (Object.keys(updates).length > 0) {
            // Recalculează scorul după update contoare
            const updatedCustomer = { ...customer, ...updates }
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
            const { count: ordersToday } = await supabase
              .from('risk_orders')
              .select('id', { count: 'exact', head: true })
              .eq('store_id', storeId)
              .eq('customer_id', customer.id)
              .gte('ordered_at', todayStart.toISOString())

            const history: CustomerHistory = {
              totalOrders: updatedCustomer.total_orders,
              ordersCollected: updatedCustomer.orders_collected || 0,
              ordersRefused: updatedCustomer.orders_refused || 0,
              ordersNotHome: updatedCustomer.orders_not_home || 0,
              ordersCancelled: updatedCustomer.orders_cancelled || 0,
              ordersToday: ordersToday || 0,
              lastOrderAt: customer.last_order_at,
              firstOrderAt: customer.first_order_at,
              accountCreatedAt: null,
              phoneValidated: !!(customerPhone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
              isNewAccount: false,
              addressChanges: 1,
            }

            // Verifică blacklist global
            let inGlobalBlacklist = customer.in_global_blacklist || false
            let globalReportCount = 0
            if (matchedSettings.participate_in_global_blacklist) {
              for (const id of [customerPhone, customerEmail].filter(Boolean)) {
                const hash = hashIdentifier(id!)
                const { data: globalEntry } = await supabase
                  .from('risk_global_blacklist')
                  .select('report_count')
                  .or(`phone_hash.eq.${hash},email_hash.eq.${hash}`)
                  .single()
                if (globalEntry) { inGlobalBlacklist = true; globalReportCount = Math.max(globalReportCount, globalEntry.report_count) }
              }
            }

            const orderCtx: OrderContext = {
              paymentMethod, totalValue, currency, orderedAt,
              customerEmail: customerEmail || '',
              shippingAddress,
              inGlobalBlacklist,
              globalReportCount,
            }

            const result = calculateRiskScore(history, orderCtx, matchedSettings)
            const finalLabel = customer.manual_label_override || result.label

            await supabase.from('risk_customers').update({
              ...updates,
              risk_score: result.score,
              risk_label: finalLabel,
              in_global_blacklist: inGlobalBlacklist,
              updated_at: new Date().toISOString(),
            }).eq('id', customer.id)

            // Alertă dacă a devenit problematic după update status
            if (['problematic', 'blocked'].includes(finalLabel)) {
              await supabase.from('risk_alerts').insert({
                store_id: storeId,
                user_id: userId,
                customer_id: customer.id,
                order_id: existingOrder.id,
                alert_type: finalLabel === 'blocked' ? 'blocked_customer' : 'status_update_risk',
                severity: finalLabel === 'blocked' ? 'critical' : 'warning',
                title: `Status actualizat — client ${finalLabel}: ${customerName || customerPhone || customerEmail}`,
                description: `Comanda #${orderNumber || externalOrderId} → ${hontrioStatus}. Scor risc: ${result.score}/100`,
              })
            }
          }
        }

        return NextResponse.json({ ok: true, action: 'order_updated', order_id: existingOrder.id })
      }

      if (topic === 'order.created') {
        // Comenzi azi
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        let ordersToday = 0
        if (customerPhone || customerEmail) {
          const filter = [
            customerPhone ? `customer_phone.eq.${customerPhone}` : null,
            customerEmail ? `customer_email.eq.${customerEmail}` : null,
          ].filter(Boolean).join(',')
          const { count } = await supabase
            .from('risk_orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .gte('ordered_at', todayStart.toISOString())
            .or(filter)
          ordersToday = count || 0
        }

        // Adrese unice
        let addressChanges = 0
        if (customer) {
          const { data: addresses } = await supabase
            .from('risk_orders')
            .select('shipping_address')
            .eq('customer_id', customer.id)
            .not('shipping_address', 'is', null)
          const uniqueAddr = new Set((addresses || []).map((a: any) => a.shipping_address?.trim().toLowerCase()))
          addressChanges = uniqueAddr.size
        }

        // Blacklist global
        let inGlobalBlacklist = false
        let globalReportCount = 0
        if (matchedSettings.participate_in_global_blacklist) {
          for (const id of [customerPhone, customerEmail].filter(Boolean)) {
            const hash = hashIdentifier(id!)
            const { data: globalEntry } = await supabase
              .from('risk_global_blacklist')
              .select('report_count')
              .or(`phone_hash.eq.${hash},email_hash.eq.${hash}`)
              .single()
            if (globalEntry) { inGlobalBlacklist = true; globalReportCount = Math.max(globalReportCount, globalEntry.report_count) }
          }
        }

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
          phoneValidated: !!(customerPhone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
          isNewAccount: !customer,
          addressChanges,
        }

        const orderCtx: OrderContext = {
          paymentMethod, totalValue, currency, orderedAt,
          customerEmail: customerEmail || '',
          shippingAddress,
          inGlobalBlacklist,
          globalReportCount,
        }

        const result = calculateRiskScore(history, orderCtx, matchedSettings)
        const finalLabel = customer?.manual_label_override || result.label

        // Upsert client
        const customerPayload = {
          store_id: storeId,
          user_id: userId,
          phone: customerPhone || customer?.phone,
          email: customerEmail || customer?.email,
          name: customerName || customer?.name,
          risk_score: result.score,
          risk_label: finalLabel,
          total_orders: (customer?.total_orders || 0) + 1,
          orders_collected: customer?.orders_collected || 0,
          orders_refused: customer?.orders_refused || 0,
          orders_not_home: customer?.orders_not_home || 0,
          orders_cancelled: customer?.orders_cancelled || 0,
          last_order_at: orderedAt,
          first_order_at: customer?.first_order_at || orderedAt,
          in_global_blacklist: inGlobalBlacklist,
          updated_at: new Date().toISOString(),
        }

        let customerId = customer?.id
        if (customer) {
          await supabase.from('risk_customers').update(customerPayload).eq('id', customer.id)
        } else {
          const { data: newC } = await supabase
            .from('risk_customers')
            .insert(customerPayload)
            .select('id').single()
          customerId = newC?.id
        }

        // Inserează comanda
        const { data: riskOrder } = await supabase
          .from('risk_orders')
          .upsert({
            store_id: storeId,
            user_id: userId,
            customer_id: customerId,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            customer_name: customerName,
            shipping_address: shippingAddress,
            payment_method: paymentMethod,
            total_value: totalValue,
            currency,
            order_status: hontrioStatus,
            risk_score_at_order: result.score,
            risk_flags: result.flags,
            ordered_at: orderedAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'store_id,external_order_id' })
          .select('id').single()

        // Alertă
        if (['problematic', 'blocked', 'watch'].includes(finalLabel)) {
          const shouldAlert =
            (finalLabel === 'blocked' && matchedSettings.alert_on_blocked !== false) ||
            (finalLabel === 'problematic' && matchedSettings.alert_on_problematic !== false) ||
            (finalLabel === 'watch' && matchedSettings.alert_on_watch === true)

          if (shouldAlert) {
            const severity = finalLabel === 'blocked' ? 'critical' : finalLabel === 'problematic' ? 'warning' : 'info'
            const topFlags = result.flags.slice(0, 3).map((f: any) => f.label).join(', ')
            await supabase.from('risk_alerts').insert({
              store_id: storeId,
              user_id: userId,
              customer_id: customerId,
              order_id: riskOrder?.id,
              alert_type: finalLabel === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
              severity,
              title: `Comandă nouă — client ${finalLabel}: ${customerName || customerPhone || customerEmail}`,
              description: `Scor: ${result.score}/100. ${topFlags ? 'Motive: ' + topFlags : ''}`,
            })
          }
        }

        // Raportare blacklist global
        if (matchedSettings.participate_in_global_blacklist && result.score >= 61) {
          const upsertGlobal = async (field: 'phone_hash' | 'email_hash', value: string) => {
            const hash = hashIdentifier(value)
            const { data: existing } = await supabase
              .from('risk_global_blacklist')
              .select('id, report_count')
              .eq(field, hash)
              .single()
            if (existing) {
              await supabase.from('risk_global_blacklist').update({
                report_count: existing.report_count + 1,
                last_reported_at: new Date().toISOString(),
                global_risk_score: Math.min(existing.report_count * 20, 100),
              }).eq('id', existing.id)
            } else {
              await supabase.from('risk_global_blacklist').insert({ [field]: hash, report_count: 1, global_risk_score: 20 })
            }
          }
          if (customerPhone) await upsertGlobal('phone_hash', customerPhone)
          if (customerEmail) await upsertGlobal('email_hash', customerEmail)
        }

        return NextResponse.json({
          ok: true,
          action: 'order_created',
          score: result.score,
          label: finalLabel,
          customer_id: customerId,
        })
      }
    }

    // Alte topic-uri (ignorăm)
    return NextResponse.json({ ok: true, skipped: true, topic })

  } catch (err: any) {
    console.error('Risk webhook error:', err)
    // Returnăm 200 ca WooCommerce să nu retrimită la nesfârșit
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 })
  }
}