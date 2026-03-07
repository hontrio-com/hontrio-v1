import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  phoneNorm, emailNorm, safeDecrypt, mapStatus,
  findOrCreate, recalc, buildOrder,
} from '@/lib/risk/identity'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const userId = (session.user as any).id
  const supabase = createAdminClient()

  const { data: store } = await supabase.from('stores')
    .select('id, store_url, api_key, api_secret').eq('user_id', userId).single()
  if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

  const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
  if (!ck || !cs) return NextResponse.json({ error: 'Credențiale API lipsă' }, { status: 400 })

  const base = store.store_url.replace(/\/$/, '')
  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
  const storeId = store.id

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: any) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)) } catch {}
      }

      try {
        send({ stage: 'init', message: 'Conectare la WooCommerce...' })

        // Count orders
        const cUrl = new URL(`${base}/wp-json/wc/v3/orders`)
        cUrl.searchParams.set('per_page', '1')
        const cRes = await fetch(cUrl.toString(), {
          headers: { Authorization: auth }, signal: AbortSignal.timeout(15000),
        })
        if (!cRes.ok) { send({ stage: 'error', message: `WooCommerce ${cRes.status}` }); controller.close(); return }

        const totalOrders = parseInt(cRes.headers.get('x-wp-total') || '0')
        const totalPages = parseInt(cRes.headers.get('x-wp-totalpages') || '1')
        send({ stage: 'counting', totalOrders, totalPages })

        // Existing orders for dedup
        const { data: existDb } = await supabase.from('risk_orders')
          .select('external_order_id').eq('store_id', storeId)
        const existSet = new Set((existDb || []).map((o: any) => String(o.external_order_id)))
        send({ stage: 'ready', existing: existSet.size })

        let inserted = 0, skipped = 0, customersNew = 0
        const touchedIds = new Set<string>()

        for (let page = 1; page <= totalPages; page++) {
          send({ stage: 'page', page, totalPages, inserted, skipped, customersNew })

          const url = new URL(`${base}/wp-json/wc/v3/orders`)
          url.searchParams.set('per_page', '100')
          url.searchParams.set('page', String(page))
          url.searchParams.set('orderby', 'date')
          url.searchParams.set('order', 'asc')

          let pageData: any[]
          try {
            const res = await fetch(url.toString(), {
              headers: { Authorization: auth }, signal: AbortSignal.timeout(30000),
            })
            if (!res.ok) { send({ stage: 'page_error', page }); continue }
            pageData = await res.json()
          } catch { send({ stage: 'page_error', page }); continue }

          if (!Array.isArray(pageData) || !pageData.length) break

          const batch: any[] = []

          for (const woo of pageData) {
            const extId = String(woo.id)
            if (existSet.has(extId)) { skipped++; continue }

            const phone = (woo.billing?.phone || '').replace(/\s/g, '') || null
            const email = (woo.billing?.email || '').toLowerCase().trim() || null
            const name = [woo.billing?.first_name, woo.billing?.last_name].filter(Boolean).join(' ') || null
            const ordAt = woo.date_created || new Date().toISOString()

            if (!phone && !email) { skipped++; continue }

            try {
              const { customer, isNew } = await findOrCreate(supabase, storeId, userId, phone, email, name, ordAt)
              if (isNew) customersNew++

              // Update first/last order dates
              const upd: any = { updated_at: new Date().toISOString() }
              if (!customer.name && name) upd.name = name
              if (!customer.phone && phone) upd.phone = phone
              if (!customer.email && email) upd.email = emailNorm(email)
              if (ordAt && (!customer.first_order_at || new Date(ordAt) < new Date(customer.first_order_at)))
                upd.first_order_at = ordAt
              if (ordAt && (!customer.last_order_at || new Date(ordAt) > new Date(customer.last_order_at)))
                upd.last_order_at = ordAt
              await supabase.from('risk_customers').update(upd).eq('id', customer.id)

              batch.push(buildOrder(woo, storeId, userId, customer.id))
              touchedIds.add(customer.id)
              existSet.add(extId)
            } catch { skipped++ }
          }

          // Insert batch
          if (batch.length) {
            for (let i = 0; i < batch.length; i += 50) {
              try {
                await supabase.from('risk_orders').insert(batch.slice(i, i + 50))
              } catch {
                for (const o of batch.slice(i, i + 50)) {
                  try { await supabase.from('risk_orders').insert(o) } catch {}
                }
              }
            }
            inserted += batch.length
          }
        }

        // Recalc all touched customers
        const ids = Array.from(touchedIds)
        send({ stage: 'recalc', total: ids.length, done: 0, inserted, customersNew })

        const { data: rs } = await supabase.from('risk_store_settings')
          .select('*').eq('store_id', storeId).single()
        const settings = {
          score_watch_threshold: rs?.score_watch_threshold ?? 41,
          score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
          score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
          ...(rs?.custom_rules || {}), ml_weights: rs?.ml_weights,
        }

        for (let i = 0; i < ids.length; i++) {
          try { await recalc(supabase, ids[i], storeId, settings) } catch {}
          if ((i + 1) % 20 === 0 || i === ids.length - 1) {
            send({ stage: 'recalc', total: ids.length, done: i + 1, inserted, customersNew })
          }
        }

        send({
          stage: 'done', totalOrders, inserted, skipped, customersNew,
          recalculated: ids.length,
          message: `${inserted} comenzi importate, ${customersNew} clienți noi, ${ids.length} scoruri recalculate.`,
        })
      } catch (e: any) {
        send({ stage: 'error', message: e.message || 'Eroare necunoscută' })
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}