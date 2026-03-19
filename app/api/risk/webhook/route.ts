import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRiskAlert } from '@/lib/risk/notifications'
import { extractCity, findClusterMatches } from '@/lib/risk/cluster'
import { safeDecrypt, mapStatus, resolveCustomer, recalc, getSettings } from '@/lib/risk/identity'
import { normalizePhone } from '@/lib/risk/utils'
import crypto from 'crypto'

function verifyHmac(body: string, sig: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}

/**
 * IMPORTANT: This handler ALWAYS returns HTTP 200.
 * WooCommerce pauses webhooks after consecutive non-200 responses.
 * Errors are logged but never exposed as HTTP errors.
 */
export async function POST(req: Request) {
  let raw = ''
  try { raw = await req.text() } catch {
    // Even body read errors → 200, WooCommerce will retry
    return NextResponse.json({ ok: true, skipped: 'body_read_error' })
  }

  const topic = req.headers.get('x-wc-webhook-topic') || ''
  const sig   = req.headers.get('x-wc-webhook-signature') || ''
  const src   = req.headers.get('x-wc-webhook-source') || ''

  // Only handle order events
  if (!['order.created', 'order.updated'].includes(topic)) {
    return NextResponse.json({ ok: true, skipped: topic })
  }

  let order: any
  try { order = JSON.parse(raw) } catch {
    // Invalid JSON — return 200, log silently
    console.warn('[webhook] Invalid JSON from', src)
    return NextResponse.json({ ok: true, skipped: 'invalid_json' })
  }

  try {
    const supabase = createAdminClient()

    // Find store by HMAC verification
    const { data: stores } = await supabase.from('stores')
      .select('id, user_id, store_url, webhook_secret, api_key, api_secret')
      .not('webhook_secret', 'is', null)

    let store: any = null
    if (stores?.length) {
      // Primary: HMAC match
      for (const s of stores) {
        if (s.webhook_secret && verifyHmac(raw, sig, s.webhook_secret)) { store = s; break }
      }
      // Fallback: URL match only when no signature present (dev / unsigned webhooks)
      if (!store && !sig && src) {
        store = stores.find((s: any) => s.store_url && src.replace(/\/$/, '')
          .includes(s.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')))
      }
    }

    if (!store) {
      // HMAC mismatch → log but return 200 to avoid WooCommerce pausing the webhook
      console.warn('[webhook] HMAC mismatch or store not found. src:', src, 'sig present:', !!sig)
      return NextResponse.json({ ok: true, skipped: 'store_not_matched' })
    }

    const storeId = store.id, userId = store.user_id
    const settings = await getSettings(supabase, storeId)

    // Extract order data
    const wcCustId = order.customer_id ? String(order.customer_id) : null
    const rawPhone = order.billing?.phone || ''
    const phone    = normalizePhone(rawPhone) || rawPhone.replace(/\s/g, '') || null
    const email    = (order.billing?.email || '').toLowerCase().trim() || null
    const name     = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || null
    const addr     = [(order.shipping || order.billing)?.address_1,
                      (order.shipping || order.billing)?.city,
                      (order.shipping || order.billing)?.country].filter(Boolean).join(', ')
    const pm       = (order.payment_method || '').toLowerCase()
    const pmType   = pm.includes('cod') || pm.includes('cash') ? 'cod' as const
                   : pm.includes('card') ? 'card' as const : 'bank_transfer' as const
    const value    = parseFloat(order.total || '0')
    const curr     = order.currency || 'RON'
    const ordAt    = order.date_created || new Date().toISOString()
    const extId    = String(order.id)
    const orderNr  = order.number ? String(order.number) : null
    const status   = mapStatus(order.status || 'pending')

    if (!phone && !email) {
      return NextResponse.json({ ok: true, skipped: 'no_contact' })
    }

    // Check if order already exists
    const { data: existing } = await supabase.from('risk_orders')
      .select('id, order_status, customer_id')
      .eq('store_id', storeId).eq('external_order_id', extId).single()

    // ── ORDER.UPDATED ────────────────────────────────────────────────────────
    if (topic === 'order.updated' && existing) {
      if (existing.order_status !== status) {
        await supabase.from('risk_orders')
          .update({ order_status: status, updated_at: new Date().toISOString(),
            ...(['collected','refused','returned','cancelled'].includes(status)
              ? { resolved_at: new Date().toISOString() } : {})
          }).eq('id', existing.id)

        if (existing.customer_id) {
          const result = await recalc(supabase, existing.customer_id, storeId, settings)

          // Alert on delivery failure
          if (['refused', 'returned', 'not_home'].includes(status) &&
              !['refused', 'returned', 'not_home'].includes(existing.order_status)) {
            await supabase.from('risk_alerts').insert({
              store_id: storeId, user_id: userId,
              customer_id: existing.customer_id, order_id: existing.id,
              alert_type: 'delivery_failed',
              severity: status === 'refused' ? 'warning' : 'info',
              title: `Delivery failed — ${name || phone || email}`,
              description: `#${orderNr || extId} → ${status}. Score: ${result.score}/100`,
            })
          }
        }
      }
      return NextResponse.json({ ok: true, action: 'updated', status })
    }

    // ── ORDER.CREATED (or order.updated for order not yet in DB) ────────────
    if (existing) return NextResponse.json({ ok: true, action: 'duplicate_skipped' })

    const { customer, isNew } = await resolveCustomer(
      supabase, storeId, userId, wcCustId, phone, email, name, ordAt
    )
    const cid = customer.id

    // Update contact info on customer
    const upd: any = { last_order_at: ordAt, updated_at: new Date().toISOString() }
    if (customer.is_guest) {
      if (name) upd.name = name
      if (phone) { upd.phone = phone; upd.phone_normalized = normalizePhone(phone) }
      if (email) upd.email = email
    } else {
      if (!customer.name && name) upd.name = name
      if (!customer.phone && phone) { upd.phone = phone; upd.phone_normalized = normalizePhone(phone) }
      if (!customer.email && email) upd.email = email
    }
    await supabase.from('risk_customers').update(upd).eq('id', cid)

    // Insert order
    const { data: riskOrder } = await supabase.from('risk_orders').insert({
      store_id: storeId, user_id: userId, customer_id: cid,
      external_order_id: extId, external_customer_id: wcCustId,
      order_number: orderNr, customer_phone: phone, customer_email: email, customer_name: name,
      shipping_address: addr, payment_method: pmType,
      total_value: value, currency: curr, order_status: status,
      risk_score_at_order: 0, risk_flags: [],
      ordered_at: ordAt, updated_at: new Date().toISOString(),
    }).select('id').single()

    const result = await recalc(supabase, cid, storeId, settings)

    if (riskOrder?.id) {
      await supabase.from('risk_orders').update({
        risk_score_at_order: result.score, risk_flags: result.flags,
      }).eq('id', riskOrder.id)
    }

    // Alerts
    const shouldAlert =
      (result.label === 'blocked'     && settings.alert_on_blocked     !== false) ||
      (result.label === 'problematic' && settings.alert_on_problematic !== false) ||
      (result.label === 'watch'       && settings.alert_on_watch       === true)

    if (shouldAlert) {
      const topFlags = result.flags.slice(0, 3).map((f: any) => f.label).join(', ')
      await supabase.from('risk_alerts').insert({
        store_id: storeId, user_id: userId, customer_id: cid, order_id: riskOrder?.id,
        alert_type: result.label === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
        severity: result.label === 'blocked' ? 'critical' : result.label === 'problematic' ? 'warning' : 'info',
        title: `New order — ${result.label} customer: ${name || phone || email}`,
        description: `Score: ${result.score}/100. ${topFlags ? 'Reasons: ' + topFlags : ''}`,
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

    // Background: cluster / duplicate detection
    void (async () => {
      try {
        const { data: pool } = await supabase.from('risk_customers')
          .select('id,name,phone,phone_normalized,email')
          .eq('store_id', storeId).eq('is_merged', false).neq('id', cid).limit(300)
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

    return NextResponse.json({
      ok: true, action: 'created', score: result.score, label: result.label,
      customer_id: cid, is_new_customer: isNew,
    })

  } catch (err: any) {
    // CRITICAL: always return 200 even on unexpected errors
    // Otherwise WooCommerce will pause the webhook
    console.error('[webhook] Unexpected error:', err?.message)
    return NextResponse.json({ ok: true, skipped: 'internal_error' })
  }
}
