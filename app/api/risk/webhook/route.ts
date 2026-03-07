import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashIdentifier } from '@/lib/risk/engine'
import { sendRiskAlert } from '@/lib/risk/notifications'
import { extractCity, findClusterMatches, type ClusterCandidate } from '@/lib/risk/cluster'
import { decrypt } from '@/lib/security/encryption'
import {
  normalizePhone, normalizeEmail, mapWooStatus,
  extractAddress, extractPayment, extractCustomerName,
  findOrCreateCustomer, recalcCustomerFromDB,
  fetchWooOrders, buildRiskOrderFromWoo,
} from '@/lib/risk/identity'
import crypto from 'crypto'

// ─── Utilitare ────────────────────────────────────────────────────────────────

function safeDecrypt(val: string | null): string {
  if (!val) return ''
  try { return val.includes(':') ? decrypt(val) : val } catch { return val }
}

function verifyHmac(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}

// ─── Import istoric (background, non-blocking) ───────────────────────────────

async function importHistoryBackground(params: {
  supabase: any; storeId: string; userId: string; customerId: string
  storeUrl: string; apiKey: string; apiSecret: string
  phone: string | null; email: string | null
}): Promise<void> {
  const { supabase, storeId, userId, customerId, storeUrl, apiKey, apiSecret, phone, email } = params
  const ck = safeDecrypt(apiKey), cs = safeDecrypt(apiSecret)
  if (!ck || !cs) return

  try {
    const phoneNorm = phone ? normalizePhone(phone) : null
    const emailNorm = email ? normalizeEmail(email) : null
    const seen = new Set<number>()
    const wooOrders: any[] = []

    if (emailNorm) {
      try {
        const { orders } = await fetchWooOrders(storeUrl, ck, cs, {
          billing_email: emailNorm, orderby: 'date', order: 'desc',
        }, 5)
        for (const o of orders) {
          const bEmail = (o.billing?.email || '').toLowerCase().trim()
          if (!seen.has(o.id) && bEmail === emailNorm) {
            seen.add(o.id); wooOrders.push(o)
          }
        }
      } catch (e: any) { console.error('[Webhook/Import] email error:', e.message) }
    }

    if (phone) {
      try {
        const { orders } = await fetchWooOrders(storeUrl, ck, cs, {
          search: phone.replace(/\s/g, ''), orderby: 'date', order: 'desc',
        }, 5)
        for (const o of orders) {
          if (!seen.has(o.id)) {
            const bPhone = (o.billing?.phone || '').replace(/\s/g, '')
            if (bPhone && phoneNorm && normalizePhone(bPhone) === phoneNorm) {
              seen.add(o.id); wooOrders.push(o)
            }
          }
        }
      } catch (e: any) { console.error('[Webhook/Import] phone error:', e.message) }
    }

    if (!wooOrders.length) return

    const { data: existing } = await supabase
      .from('risk_orders').select('external_order_id').eq('store_id', storeId)
    const existSet = new Set<string>((existing || []).map((o: any) => String(o.external_order_id)))

    const toInsert: any[] = []
    for (const woo of wooOrders) {
      if (existSet.has(String(woo.id))) continue
      toInsert.push(buildRiskOrderFromWoo(woo, storeId, userId, customerId, phone, email))
    }

    for (let i = 0; i < toInsert.length; i += 50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i + 50))
    }

    if (toInsert.length > 0) {
      await recalcCustomerFromDB(supabase, customerId, storeId, {})
    }

    console.log(`[Webhook] Imported ${toInsert.length} historical orders for customer ${customerId}`)
  } catch (e: any) {
    console.error('[Webhook] History import error:', e.message)
  }
}

// ─── MAIN WEBHOOK ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let rawBody = ''
  try { rawBody = await req.text() } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
  }

  const topic = req.headers.get('x-wc-webhook-topic') || ''
  const signature = req.headers.get('x-wc-webhook-signature') || ''
  const sourceUrl = req.headers.get('x-wc-webhook-source') || ''

  console.log('[Webhook] topic:', topic, 'bytes:', rawBody.length)

  if (!['order.created', 'order.updated'].includes(topic)) {
    return NextResponse.json({ ok: true, skipped: topic })
  }

  let order: any
  try { order = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Găsește store-ul ──────────────────────────────────────────────────────
  const { data: stores } = await supabase
    .from('stores').select('id, user_id, store_url, webhook_secret, api_key, api_secret')
    .not('webhook_secret', 'is', null)

  if (!stores?.length) return NextResponse.json({ error: 'No stores' }, { status: 404 })

  let store: any = null
  for (const s of stores) {
    if (verifyHmac(rawBody, signature, s.webhook_secret)) { store = s; break }
  }
  if (!store && sourceUrl) {
    store = stores.find((s: any) =>
      s.store_url && sourceUrl.replace(/\/$/, '').includes(
        s.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
      )
    )
  }
  if (!store && stores.length === 1) store = stores[0]
  if (!store) return NextResponse.json({ error: 'Store not matched' }, { status: 401 })

  const storeId = store.id
  const userId = store.user_id

  // ── Setări Risk Shield ────────────────────────────────────────────────────
  const { data: rs } = await supabase
    .from('risk_store_settings').select('*').eq('store_id', storeId).single()
  const settings = {
    participate_in_global_blacklist: rs?.participate_in_global_blacklist ?? true,
    alert_on_blocked: rs?.alert_on_blocked ?? true,
    alert_on_problematic: rs?.alert_on_problematic ?? true,
    alert_on_watch: rs?.alert_on_watch ?? false,
    score_watch_threshold: rs?.score_watch_threshold ?? 41,
    score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
    score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
    alert_email: rs?.alert_email,
    email_alerts_enabled: rs?.email_alerts_enabled ?? true,
    ...(rs?.custom_rules || {}),
    ml_weights: rs?.ml_weights,
  }

  // ── Date din comanda WooCommerce ──────────────────────────────────────────
  const phone = (order.billing?.phone || '').replace(/\s/g, '') || null
  const email = (order.billing?.email || '').toLowerCase().trim() || null
  const name = extractCustomerName(order)
  const addr = extractAddress(order)
  const pm = extractPayment(order)
  const value = parseFloat(order.total || '0')
  const curr = order.currency || 'RON'
  const ordAt = order.date_created || new Date().toISOString()
  const extId = String(order.id)
  const orderNr = order.number ? String(order.number) : null
  const status = mapWooStatus(order.status || 'pending')

  if (!phone && !email) {
    return NextResponse.json({ ok: true, skipped: 'no_contact' })
  }

  // ── Verifică dacă comanda există deja ─────────────────────────────────────
  const { data: existingOrder } = await supabase
    .from('risk_orders').select('id, order_status, customer_id')
    .eq('store_id', storeId).eq('external_order_id', extId).single()

  // ─── ORDER.UPDATED ────────────────────────────────────────────────────────
  if (topic === 'order.updated' && existingOrder) {
    if (existingOrder.order_status === status) {
      return NextResponse.json({ ok: true, action: 'no_change' })
    }

    await supabase.from('risk_orders')
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq('id', existingOrder.id)

    if (existingOrder.customer_id) {
      const result = await recalcCustomerFromDB(
        supabase, existingOrder.customer_id, storeId, settings,
        { phone, email, paymentMethod: pm, totalValue: value, currency: curr, orderedAt: ordAt, shippingAddress: addr }
      )

      const failStatuses = ['refused', 'returned', 'not_home']
      if (failStatuses.includes(status) && !failStatuses.includes(existingOrder.order_status)) {
        await supabase.from('risk_alerts').insert({
          store_id: storeId, user_id: userId,
          customer_id: existingOrder.customer_id, order_id: existingOrder.id,
          alert_type: 'delivery_failed',
          severity: status === 'refused' ? 'warning' : 'info',
          title: `Livrare eșuată — ${name || phone || email}`,
          description: `Comanda #${orderNr || extId} → ${status}. Scor: ${result.score}/100`,
        })
      }
    }

    return NextResponse.json({ ok: true, action: 'updated', status })
  }

  // ─── DUPLICAT ─────────────────────────────────────────────────────────────
  if (existingOrder) {
    console.log('[Webhook] Duplicate order.created for', extId, '— skipping')
    return NextResponse.json({ ok: true, action: 'duplicate_skipped' })
  }

  // ─── ORDER.CREATED — comandă nouă ─────────────────────────────────────────

  const { customer, isNew } = await findOrCreateCustomer(
    supabase, storeId, userId, phone, email, name, ordAt
  )
  const customerId = customer.id

  const custUpdates: any = { last_order_at: ordAt, updated_at: new Date().toISOString() }
  if (!customer.name && name) custUpdates.name = name
  if (!customer.phone && phone) custUpdates.phone = phone
  if (!customer.email && email) custUpdates.email = normalizeEmail(email)
  await supabase.from('risk_customers').update(custUpdates).eq('id', customerId)

  // Blacklist global
  let inGlobalBlacklist = false, globalReportCount = 0
  if (settings.participate_in_global_blacklist) {
    for (const val of [phone, email].filter(Boolean)) {
      const hash = hashIdentifier(val!)
      const { data: gb } = await supabase.from('risk_global_blacklist')
        .select('report_count').or(`phone_hash.eq.${hash},email_hash.eq.${hash}`).single()
      if (gb) { inGlobalBlacklist = true; globalReportCount = Math.max(globalReportCount, gb.report_count) }
    }
    if (inGlobalBlacklist) {
      await supabase.from('risk_customers')
        .update({ in_global_blacklist: true }).eq('id', customerId)
    }
  }

  // Inserează comanda
  const { data: riskOrder } = await supabase.from('risk_orders').insert({
    store_id: storeId, user_id: userId, customer_id: customerId,
    external_order_id: extId, order_number: orderNr,
    customer_phone: phone, customer_email: email, customer_name: name,
    shipping_address: addr, payment_method: pm,
    total_value: value, currency: curr, order_status: status,
    risk_score_at_order: 0, risk_flags: [],
    ordered_at: ordAt, updated_at: new Date().toISOString(),
  }).select('id').single()

  // Recalculează scorul din DB
  const result = await recalcCustomerFromDB(
    supabase, customerId, storeId, settings,
    { phone, email, paymentMethod: pm, totalValue: value, currency: curr, orderedAt: ordAt, shippingAddress: addr }
  )

  if (riskOrder?.id) {
    await supabase.from('risk_orders').update({
      risk_score_at_order: result.score,
      risk_flags: result.flags,
    }).eq('id', riskOrder.id)
  }

  // Alerte
  const shouldAlert =
    (result.label === 'blocked' && settings.alert_on_blocked !== false) ||
    (result.label === 'problematic' && settings.alert_on_problematic !== false) ||
    (result.label === 'watch' && settings.alert_on_watch === true)

  if (shouldAlert) {
    const topFlags = result.flags.slice(0, 3).map((f: any) => f.label).join(', ')
    await supabase.from('risk_alerts').insert({
      store_id: storeId, user_id: userId,
      customer_id: customerId, order_id: riskOrder?.id,
      alert_type: result.label === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
      severity: result.label === 'blocked' ? 'critical' : result.label === 'problematic' ? 'warning' : 'info',
      title: `Comandă nouă — client ${result.label}: ${name || phone || email}`,
      description: `Scor: ${result.score}/100. ${topFlags ? 'Motive: ' + topFlags : ''}`,
    })

    if (settings.alert_email && settings.email_alerts_enabled !== false) {
      sendRiskAlert({
        to: settings.alert_email,
        storeName: store.store_url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        storeUrl: store.store_url, customerName: name, customerPhone: phone,
        customerEmail: email, riskScore: result.score, riskLabel: result.label,
        orderNumber: orderNr || extId, orderValue: value, currency: curr,
        flags: result.flags.slice(0, 5), recommendation: result.recommendation,
        refusalProbability: result.refusalProbability,
        dashboardUrl: `${process.env.NEXTAUTH_URL || 'https://app.hontrio.com'}/risk`,
      }).catch(e => console.error('[Webhook] Email failed:', e?.message))
    }
  }

  // Blacklist global
  if (settings.participate_in_global_blacklist && result.score >= 61) {
    const upsertBl = async (field: 'phone_hash' | 'email_hash', val: string) => {
      const hash = hashIdentifier(val)
      const { data: ex } = await supabase.from('risk_global_blacklist')
        .select('id, report_count').eq(field, hash).single()
      if (ex) {
        await supabase.from('risk_global_blacklist').update({
          report_count: ex.report_count + 1, last_reported_at: new Date().toISOString(),
          global_risk_score: Math.min(ex.report_count * 20, 100),
        }).eq('id', ex.id)
      } else {
        await supabase.from('risk_global_blacklist').insert({ [field]: hash, report_count: 1, global_risk_score: 20 })
      }
    }
    if (phone) await upsertBl('phone_hash', phone)
    if (email) await upsertBl('email_hash', email)
  }

  // Import istoric — DOAR pentru client nou, non-blocking
  if (isNew && store.api_key) {
    importHistoryBackground({
      supabase, storeId, userId, customerId,
      storeUrl: store.store_url, apiKey: store.api_key, apiSecret: store.api_secret,
      phone, email,
    }).catch(() => {})
  }

  // Cluster detection — non-blocking
  if (customerId && (phone || email)) {
    void (async () => {
      try {
        const { data: pool } = await supabase.from('risk_customers')
          .select('id,name,phone,email').eq('store_id', storeId).neq('id', customerId).limit(200)
        if (!pool?.length) return
        const candidates: ClusterCandidate[] = pool.map((c: any) => ({
          id: c.id, name: c.name, phone: c.phone, email: c.email, shipping_address: null, city: null,
        }))
        const matches = findClusterMatches(
          { id: customerId, name, phone, email, shipping_address: addr, city: extractCity(addr) },
          candidates, 0.75
        )
        if (matches.length) {
          await supabase.from('risk_audit_log').insert(
            matches.slice(0, 3).map(m => ({
              store_id: storeId, user_id: userId, customer_id: customerId,
              action: 'cluster_match',
              old_value: JSON.stringify({ similarity: m.similarity, reasons: m.matchReason }),
              new_value: m.matchedCustomerId,
            }))
          )
        }
      } catch {}
    })()
  }

  console.log(`[Webhook] Done: customer=${customerId} isNew=${isNew} score=${result.score} label=${result.label}`)

  return NextResponse.json({
    ok: true, action: 'created',
    score: result.score, label: result.label,
    refusal_probability: result.refusalProbability,
    customer_id: customerId, is_new_customer: isNew,
  })
}