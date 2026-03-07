import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashIdentifier } from '@/lib/risk/engine'
import { sendRiskAlert } from '@/lib/risk/notifications'
import { extractCity, findClusterMatches, type ClusterCandidate } from '@/lib/risk/cluster'
import {
  phoneNorm, emailNorm, safeDecrypt, mapStatus,
  findOrCreate, recalc, wooFetch, buildOrder, getStoreAndSettings,
} from '@/lib/risk/identity'
import crypto from 'crypto'

function verifyHmac(body: string, sig: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}

// Background: import istoric pentru client nou
async function bgImportHistory(
  supabase: any, storeId: string, userId: string, customerId: string,
  storeUrl: string, apiKey: string, apiSecret: string,
  phone: string | null, email: string | null
) {
  const ck = safeDecrypt(apiKey), cs = safeDecrypt(apiSecret)
  if (!ck || !cs) return
  try {
    const ph = phone ? phoneNorm(phone) : null
    const em = email ? emailNorm(email) : null
    const seen = new Set<number>()
    const woo: any[] = []

    if (em) {
      try {
        const orders = await wooFetch(storeUrl, ck, cs, { billing_email: em, orderby: 'date', order: 'desc' }, 5)
        for (const o of orders) {
          const be = (o.billing?.email || '').toLowerCase().trim()
          if (!seen.has(o.id) && be === em) { seen.add(o.id); woo.push(o) }
        }
      } catch {}
    }
    if (phone) {
      try {
        const orders = await wooFetch(storeUrl, ck, cs, { search: phone.replace(/\s/g, ''), orderby: 'date', order: 'desc' }, 5)
        for (const o of orders) {
          if (!seen.has(o.id)) {
            const bp = (o.billing?.phone || '').replace(/\s/g, '')
            if (bp && ph && phoneNorm(bp) === ph) { seen.add(o.id); woo.push(o) }
          }
        }
      } catch {}
    }
    if (!woo.length) return

    const { data: existing } = await supabase.from('risk_orders')
      .select('external_order_id').eq('store_id', storeId)
    const existSet = new Set((existing || []).map((o: any) => String(o.external_order_id)))

    const ins = woo.filter(w => !existSet.has(String(w.id)))
      .map(w => buildOrder(w, storeId, userId, customerId))

    for (let i = 0; i < ins.length; i += 50) {
      await supabase.from('risk_orders').insert(ins.slice(i, i + 50))
    }
    if (ins.length) await recalc(supabase, customerId, storeId)
    console.log(`[Webhook] Imported ${ins.length} historic orders for ${customerId}`)
  } catch (e: any) { console.error('[Webhook] Import error:', e.message) }
}

export async function POST(req: Request) {
  let raw = ''
  try { raw = await req.text() } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
  }

  const topic = req.headers.get('x-wc-webhook-topic') || ''
  const sig = req.headers.get('x-wc-webhook-signature') || ''
  const src = req.headers.get('x-wc-webhook-source') || ''

  if (!['order.created', 'order.updated'].includes(topic)) {
    return NextResponse.json({ ok: true, skipped: topic })
  }

  let order: any
  try { order = JSON.parse(raw) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find store
  const { data: stores } = await supabase.from('stores')
    .select('id, user_id, store_url, webhook_secret, api_key, api_secret')
    .not('webhook_secret', 'is', null)
  if (!stores?.length) return NextResponse.json({ error: 'No stores' }, { status: 404 })

  let store: any = null
  for (const s of stores) { if (verifyHmac(raw, sig, s.webhook_secret)) { store = s; break } }
  if (!store && src) {
    store = stores.find((s: any) => s.store_url && src.replace(/\/$/, '')
      .includes(s.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')))
  }
  if (!store && stores.length === 1) store = stores[0]
  if (!store) return NextResponse.json({ error: 'Store not matched' }, { status: 401 })

  const storeId = store.id, userId = store.user_id
  const settings = await getStoreAndSettings(supabase, storeId)

  // Extract order data
  const phone = (order.billing?.phone || '').replace(/\s/g, '') || null
  const email = (order.billing?.email || '').toLowerCase().trim() || null
  const name = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || null
  const addr = [(order.shipping || order.billing)?.address_1, (order.shipping || order.billing)?.city,
    (order.shipping || order.billing)?.state, (order.shipping || order.billing)?.country].filter(Boolean).join(', ')
  const pm = (order.payment_method || '').toLowerCase()
  const pmType = pm.includes('cod') || pm.includes('cash') ? 'cod' as const : pm.includes('card') ? 'card' as const : 'bank_transfer' as const
  const value = parseFloat(order.total || '0')
  const curr = order.currency || 'RON'
  const ordAt = order.date_created || new Date().toISOString()
  const extId = String(order.id)
  const orderNr = order.number ? String(order.number) : null
  const status = mapStatus(order.status || 'pending')

  if (!phone && !email) return NextResponse.json({ ok: true, skipped: 'no_contact' })

  // Check existing
  const { data: existing } = await supabase.from('risk_orders')
    .select('id, order_status, customer_id')
    .eq('store_id', storeId).eq('external_order_id', extId).single()

  // ORDER.UPDATED
  if (topic === 'order.updated' && existing) {
    if (existing.order_status === status) return NextResponse.json({ ok: true, action: 'no_change' })

    await supabase.from('risk_orders')
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (existing.customer_id) {
      const result = await recalc(supabase, existing.customer_id, storeId, settings)

      if (['refused', 'returned', 'not_home'].includes(status) &&
          !['refused', 'returned', 'not_home'].includes(existing.order_status)) {
        await supabase.from('risk_alerts').insert({
          store_id: storeId, user_id: userId,
          customer_id: existing.customer_id, order_id: existing.id,
          alert_type: 'delivery_failed',
          severity: status === 'refused' ? 'warning' : 'info',
          title: `Livrare eșuată — ${name || phone || email}`,
          description: `Comanda #${orderNr || extId} → ${status}. Scor: ${result.score}/100`,
        })
      }
    }
    return NextResponse.json({ ok: true, action: 'updated', status })
  }

  // Skip duplicate
  if (existing) return NextResponse.json({ ok: true, action: 'duplicate_skipped' })

  // ORDER.CREATED
  const { customer, isNew } = await findOrCreate(supabase, storeId, userId, phone, email, name, ordAt)
  const cid = customer.id

  // Fill missing info
  const upd: any = { last_order_at: ordAt, updated_at: new Date().toISOString() }
  if (!customer.name && name) upd.name = name
  if (!customer.phone && phone) upd.phone = phone
  if (!customer.email && email) upd.email = emailNorm(email)
  await supabase.from('risk_customers').update(upd).eq('id', cid)

  // Global blacklist check
  if (settings.participate_in_global_blacklist) {
    for (const val of [phone, email].filter(Boolean)) {
      const h = hashIdentifier(val!)
      const { data: gb } = await supabase.from('risk_global_blacklist')
        .select('report_count').or(`phone_hash.eq.${h},email_hash.eq.${h}`).single()
      if (gb) await supabase.from('risk_customers').update({ in_global_blacklist: true }).eq('id', cid)
    }
  }

  // Insert order
  const { data: riskOrder } = await supabase.from('risk_orders').insert({
    store_id: storeId, user_id: userId, customer_id: cid,
    external_order_id: extId, order_number: orderNr,
    customer_phone: phone, customer_email: email, customer_name: name,
    shipping_address: addr, payment_method: pmType,
    total_value: value, currency: curr, order_status: status,
    risk_score_at_order: 0, risk_flags: [],
    ordered_at: ordAt, updated_at: new Date().toISOString(),
  }).select('id').single()

  // Recalc
  const result = await recalc(supabase, cid, storeId, settings)

  if (riskOrder?.id) {
    await supabase.from('risk_orders').update({
      risk_score_at_order: result.score, risk_flags: result.flags,
    }).eq('id', riskOrder.id)
  }

  // Alerts
  const shouldAlert =
    (result.label === 'blocked' && settings.alert_on_blocked !== false) ||
    (result.label === 'problematic' && settings.alert_on_problematic !== false) ||
    (result.label === 'watch' && settings.alert_on_watch === true)

  if (shouldAlert) {
    const topFlags = result.flags.slice(0, 3).map((f: any) => f.label).join(', ')
    await supabase.from('risk_alerts').insert({
      store_id: storeId, user_id: userId, customer_id: cid, order_id: riskOrder?.id,
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
      }).catch(() => {})
    }
  }

  // Background: import history + cluster
  if (isNew && store.api_key) {
    bgImportHistory(supabase, storeId, userId, cid, store.store_url, store.api_key, store.api_secret, phone, email).catch(() => {})
  }
  if (cid && (phone || email)) {
    void (async () => {
      try {
        const { data: pool } = await supabase.from('risk_customers')
          .select('id,name,phone,email').eq('store_id', storeId).neq('id', cid).limit(200)
        if (!pool?.length) return
        const matches = findClusterMatches(
          { id: cid, name, phone, email, shipping_address: addr, city: extractCity(addr) },
          pool.map((c: any) => ({ ...c, shipping_address: null, city: null })), 0.75)
        if (matches.length) {
          await supabase.from('risk_audit_log').insert(
            matches.slice(0, 3).map(m => ({
              store_id: storeId, user_id: userId, customer_id: cid,
              action: 'cluster_match',
              old_value: JSON.stringify({ similarity: m.similarity, reasons: m.matchReason }),
              new_value: m.matchedCustomerId,
            })))
        }
      } catch {}
    })()
  }

  return NextResponse.json({
    ok: true, action: 'created', score: result.score, label: result.label,
    customer_id: cid, is_new_customer: isNew,
  })
}