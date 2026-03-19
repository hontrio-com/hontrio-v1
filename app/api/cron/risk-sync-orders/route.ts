/**
 * Cron: risk-sync-orders
 * Runs every 15 minutes via Vercel Cron.
 *
 * PURPOSE: Fallback / reconciliation for missed webhooks.
 * - Fetches orders modified in the last 20 minutes from WooCommerce
 * - Updates status of existing orders
 * - Creates NEW orders that were missed by webhooks (primary fix for real-time sync)
 * - Recalculates risk scores for affected customers
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeDecrypt, mapStatus, resolveCustomer, recalc, buildOrder, getSettings } from '@/lib/risk/identity'
import { normalizePhone } from '@/lib/risk/utils'

export async function GET(req: Request) {
  const authH  = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authH !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // How far back to look (default 20 min, override with ?minutes=N)
  const minutes = Math.min(parseInt(new URL(req.url).searchParams.get('minutes') || '20'), 1440)
  const since   = new Date(Date.now() - minutes * 60 * 1000).toISOString()

  const supabase = createAdminClient()
  const results: any[] = []

  try {
    const { data: stores } = await supabase.from('stores')
      .select('id, user_id, store_url, api_key, api_secret')
      .not('api_key', 'is', null)

    for (const store of (stores || [])) {
      const ck = safeDecrypt(store.api_key)
      const cs = safeDecrypt(store.api_secret)
      if (!ck || !cs) continue

      const base    = store.store_url.replace(/\/$/, '')
      const auth    = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
      const storeId = store.id
      const userId  = store.user_id

      let updated  = 0
      let created  = 0
      let skipped  = 0
      const touched = new Set<string>()

      try {
        const settings = await getSettings(supabase, storeId)

        for (let p = 1; p <= 10; p++) {
          const url = new URL(`${base}/wp-json/wc/v3/orders`)
          url.searchParams.set('per_page', '100')
          url.searchParams.set('page', String(p))
          url.searchParams.set('modified_after', since)

          const res = await fetch(url.toString(), {
            headers: { Authorization: auth }, signal: AbortSignal.timeout(25000),
          })
          if (!res.ok) break

          const orders = await res.json()
          const pages  = parseInt(res.headers.get('x-wp-totalpages') || '1')
          if (!Array.isArray(orders) || !orders.length) break

          // Batch-fetch all existing orders for this page in one query
          const pageExtIds = orders.map((woo: Record<string, unknown>) => String(woo.id))
          const { data: existingOrders } = await supabase.from('risk_orders')
            .select('id, order_status, customer_id, external_order_id')
            .eq('store_id', storeId).in('external_order_id', pageExtIds)
          const existingMap = new Map(
            (existingOrders || []).map((o: { id: string; order_status: string; customer_id: string; external_order_id: string }) =>
              [o.external_order_id, o]
            )
          )

          for (const woo of orders) {
            const extId  = String(woo.id)
            const newSt  = mapStatus(woo.status || 'pending')

            const existing = existingMap.get(extId)

            if (existing) {
              // Update status if changed
              if (existing.order_status !== newSt) {
                await supabase.from('risk_orders').update({
                  order_status: newSt,
                  updated_at: new Date().toISOString(),
                  ...(['collected','refused','returned','cancelled'].includes(newSt)
                    ? { resolved_at: new Date().toISOString() } : {}),
                }).eq('id', existing.id)
                if (existing.customer_id) touched.add(existing.customer_id)
                updated++
              } else {
                skipped++
              }
              continue
            }

            // Order not in DB — create it (missed webhook)
            try {
              const rawPhone = woo.billing?.phone || ''
              const phone    = normalizePhone(rawPhone) || rawPhone.replace(/\s/g, '') || null
              const email    = (woo.billing?.email || '').toLowerCase().trim() || null
              const name     = [woo.billing?.first_name, woo.billing?.last_name].filter(Boolean).join(' ') || null
              const wcCustId = woo.customer_id ? String(woo.customer_id) : null
              const ordAt    = woo.date_created || new Date().toISOString()

              if (!phone && !email) { skipped++; continue }

              const { customer } = await resolveCustomer(
                supabase, storeId, userId, wcCustId, phone, email, name, ordAt
              )

              // Update customer contact info
              const upd: any = { updated_at: new Date().toISOString() }
              if (!customer.phone && phone) { upd.phone = phone; upd.phone_normalized = normalizePhone(phone) }
              if (!customer.email && email) upd.email = email
              if (!customer.name  && name)  upd.name  = name
              if ((!customer.last_order_at || new Date(ordAt) > new Date(customer.last_order_at)))
                upd.last_order_at = ordAt
              await supabase.from('risk_customers').update(upd).eq('id', customer.id)

              const orderRow = buildOrder(woo, storeId, userId, customer.id)
              await supabase.from('risk_orders').insert(orderRow)
              touched.add(customer.id)
              created++
            } catch (e: any) {
              console.warn(`[cron/risk] Failed to create order ${extId}:`, e.message)
              skipped++
            }
          }

          if (p >= pages) break
        }

        // Recalculate risk scores for all affected customers
        if (touched.size > 0) {
          for (const id of touched) {
            try { await recalc(supabase, id, storeId, settings) } catch {}
          }
        }

        results.push({ store_id: storeId, updated, created, skipped, recalculated: touched.size })
      } catch (e: any) {
        results.push({ store_id: storeId, error: e.message })
      }
    }

    return NextResponse.json({ ok: true, since, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
