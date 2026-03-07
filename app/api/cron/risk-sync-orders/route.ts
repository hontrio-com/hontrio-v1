import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { mapWooStatus, recalcCustomerFromDB } from '@/lib/risk/identity'

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

/**
 * GET /api/cron/risk-sync-orders
 *
 * Cron job care rulează periodic (o dată pe oră sau pe zi).
 * Verifică comenzile din ultimele 7 zile din WooCommerce și actualizează
 * statusurile în Risk Shield. Rezolvă problema cu statusurile care se
 * schimbă fără a trigera un webhook (ex: curier exterior).
 *
 * Poate fi apelat și manual din frontend cu butonul "Re-sincronizează statusuri".
 */
export async function GET(req: Request) {
  // Verificare cron secret (Vercel Cron trimite CRON_SECRET)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isManual = new URL(req.url).searchParams.get('manual') === 'true'

  // Permite apelul manual fără CRON_SECRET (va fi protejat de session în frontend)
  if (!isManual && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results: any[] = []

  try {
    // Ia toate store-urile active
    const { data: stores } = await supabase
      .from('stores')
      .select('id, user_id, store_url, api_key, api_secret')
      .not('api_key', 'is', null)

    if (!stores?.length) {
      return NextResponse.json({ ok: true, message: 'No stores', results: [] })
    }

    for (const store of stores) {
      const ck = safeDecrypt(store.api_key)
      const cs = safeDecrypt(store.api_secret)
      if (!ck || !cs) continue

      try {
        const base = store.store_url.replace(/\/$/, '')
        const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')

        // Ia comenzile modificate în ultimele 7 zile
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        let updated = 0
        const touchedCustomerIds = new Set<string>()

        for (let page = 1; page <= 20; page++) {
          const url = new URL(`${base}/wp-json/wc/v3/orders`)
          url.searchParams.set('per_page', '100')
          url.searchParams.set('page', String(page))
          url.searchParams.set('modified_after', sevenDaysAgo)
          url.searchParams.set('orderby', 'modified')
          url.searchParams.set('order', 'desc')

          const res = await fetch(url.toString(), {
            headers: { Authorization: auth },
            signal: AbortSignal.timeout(20000),
          })

          if (!res.ok) break

          const orders = await res.json()
          const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')
          if (!Array.isArray(orders) || orders.length === 0) break

          for (const woo of orders) {
            const extId = String(woo.id)
            const newStatus = mapWooStatus(woo.status || 'pending')

            // Caută comanda în DB
            const { data: existing } = await supabase
              .from('risk_orders')
              .select('id, order_status, customer_id')
              .eq('store_id', store.id)
              .eq('external_order_id', extId)
              .single()

            if (!existing) continue // Comanda nu e în Risk Shield
            if (existing.order_status === newStatus) continue // Fără schimbare

            // Update status
            await supabase.from('risk_orders')
              .update({
                order_status: newStatus,
                updated_at: new Date().toISOString(),
                ...((['collected', 'refused', 'returned', 'cancelled'].includes(newStatus))
                  ? { resolved_at: new Date().toISOString() }
                  : {}),
              })
              .eq('id', existing.id)

            if (existing.customer_id) {
              touchedCustomerIds.add(existing.customer_id)
            }
            updated++
          }

          if (page >= totalPages) break
        }

        // Recalculează clienții afectați
        if (touchedCustomerIds.size > 0) {
          const { data: rs } = await supabase
            .from('risk_store_settings').select('*').eq('store_id', store.id).single()
          const settings = {
            score_watch_threshold: rs?.score_watch_threshold ?? 41,
            score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
            score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
            ...(rs?.custom_rules || {}),
            ml_weights: rs?.ml_weights,
          }

          for (const custId of touchedCustomerIds) {
            try {
              await recalcCustomerFromDB(supabase, custId, store.id, settings)
            } catch {}
          }
        }

        results.push({
          store_id: store.id,
          store_url: store.store_url,
          ordersUpdated: updated,
          customersRecalculated: touchedCustomerIds.size,
        })
      } catch (e: any) {
        results.push({
          store_id: store.id,
          store_url: store.store_url,
          error: e.message,
        })
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}