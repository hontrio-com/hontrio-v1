import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  phoneNorm, emailNorm, safeDecrypt, mapStatus,
  findOrCreate, recalc, buildOrder, getStoreAndSettings,
} from '@/lib/risk/identity'

/**
 * GET /api/risk/sync-all
 *
 * Sincronizare completă WooCommerce → Risk Shield via SSE.
 *
 * ETAPA 1: Ia TOȚI clienții din /wp-json/wc/v3/customers?role=all&per_page=100
 *          → Pentru fiecare, findOrCreate în risk_customers
 *          → Sursa datelor: id, email, first_name, last_name, billing.phone, billing.email
 *
 * ETAPA 2: Ia TOATE comenzile din /wp-json/wc/v3/orders?per_page=100
 *          → Pentru fiecare, findOrCreate customer + insert risk_order
 *          → Skip comenzile deja existente (dedup pe external_order_id)
 *
 * ETAPA 3: Recalculează scorurile tuturor clienților modificați
 *
 * Headers WooCommerce folosite:
 *   X-WP-Total — total items
 *   X-WP-TotalPages — total pages
 */

async function wcGet(
  base: string, auth: string, endpoint: string, params: Record<string, string>
): Promise<{ data: any[]; total: number; totalPages: number }> {
  const url = new URL(`${base}/wp-json/wc/v3/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WC ${endpoint} HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return {
    data: Array.isArray(data) ? data : [],
    total: parseInt(res.headers.get('x-wp-total') || '0'),
    totalPages: parseInt(res.headers.get('x-wp-totalpages') || '1'),
  }
}

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
        // ═══════════════════════════════════════════════════════════════
        // ETAPA 1: CLIENȚI din /wc/v3/customers
        // ═══════════════════════════════════════════════════════════════
        send({ stage: 'customers_start', message: 'Se importă clienții din WooCommerce...' })

        let custCreated = 0, custUpdated = 0, custSkipped = 0

        // Prima cerere — aflăm total pages
        let custTotalPages = 1
        try {
          const first = await wcGet(base, auth, 'customers', {
            per_page: '100', page: '1', role: 'all', orderby: 'registered_date', order: 'asc',
          })
          custTotalPages = first.totalPages

          send({ stage: 'customers', page: 1, totalPages: custTotalPages, total: first.total })

          // Procesează prima pagină
          for (const wc of first.data) {
            const phone = (wc.billing?.phone || '').replace(/\s/g, '') || null
            const email = (wc.email || wc.billing?.email || '').toLowerCase().trim() || null
            const name = [wc.first_name, wc.last_name].filter(Boolean).join(' ') || null
            const regDate = wc.date_created || new Date().toISOString()

            if (!phone && !email) { custSkipped++; continue }

            try {
              const { customer, isNew } = await findOrCreate(supabase, storeId, userId, phone, email, name, regDate)
              if (isNew) custCreated++
              else custUpdated++

              // Completează datele lipsă
              const upd: any = { updated_at: new Date().toISOString() }
              let needsUpdate = false
              if (!customer.name && name) { upd.name = name; needsUpdate = true }
              if (!customer.phone && phone) { upd.phone = phone; needsUpdate = true }
              if (!customer.email && email) { upd.email = emailNorm(email); needsUpdate = true }
              if (needsUpdate) await supabase.from('risk_customers').update(upd).eq('id', customer.id)
            } catch (e: any) {
              console.error(`[SyncAll] Customer error:`, e.message)
              custSkipped++
            }
          }

          // Restul paginilor
          for (let page = 2; page <= custTotalPages; page++) {
            send({ stage: 'customers', page, totalPages: custTotalPages, custCreated, custUpdated })

            try {
              const { data: custs } = await wcGet(base, auth, 'customers', {
                per_page: '100', page: String(page), role: 'all', orderby: 'registered_date', order: 'asc',
              })

              for (const wc of custs) {
                const phone = (wc.billing?.phone || '').replace(/\s/g, '') || null
                const email = (wc.email || wc.billing?.email || '').toLowerCase().trim() || null
                const name = [wc.first_name, wc.last_name].filter(Boolean).join(' ') || null
                const regDate = wc.date_created || new Date().toISOString()

                if (!phone && !email) { custSkipped++; continue }

                try {
                  const { customer, isNew } = await findOrCreate(supabase, storeId, userId, phone, email, name, regDate)
                  if (isNew) custCreated++
                  else custUpdated++

                  const upd: any = { updated_at: new Date().toISOString() }
                  let needsUpdate = false
                  if (!customer.name && name) { upd.name = name; needsUpdate = true }
                  if (!customer.phone && phone) { upd.phone = phone; needsUpdate = true }
                  if (!customer.email && email) { upd.email = emailNorm(email); needsUpdate = true }
                  if (needsUpdate) await supabase.from('risk_customers').update(upd).eq('id', customer.id)
                } catch { custSkipped++ }
              }
            } catch (e: any) {
              send({ stage: 'customers_page_error', page, error: e.message })
            }
          }
        } catch (e: any) {
          // Dacă endpoint-ul /customers nu e accesibil (permisiuni, versiune veche, etc.)
          // continuăm cu orders — clienții se vor crea automat din comenzi
          send({ stage: 'customers_error', message: `Avertisment: ${e.message}. Se continuă cu comenzile.` })
        }

        send({
          stage: 'customers_done', custCreated, custUpdated, custSkipped,
          message: `Clienți: ${custCreated} noi, ${custUpdated} existenți, ${custSkipped} fără date contact.`,
        })

        // ═══════════════════════════════════════════════════════════════
        // ETAPA 2: COMENZI din /wc/v3/orders
        // ═══════════════════════════════════════════════════════════════
        send({ stage: 'orders_start', message: 'Se importă comenzile...' })

        // Existing orders for dedup
        const { data: existDb } = await supabase.from('risk_orders')
          .select('external_order_id').eq('store_id', storeId)
        const existSet = new Set((existDb || []).map((o: any) => String(o.external_order_id)))

        let ordInserted = 0, ordSkipped = 0, ordTotalPages = 1, ordTotal = 0
        const touchedIds = new Set<string>()

        // Prima cerere orders
        try {
          const first = await wcGet(base, auth, 'orders', {
            per_page: '100', page: '1', orderby: 'date', order: 'asc',
          })
          ordTotalPages = first.totalPages
          ordTotal = first.total

          send({ stage: 'orders', page: 1, totalPages: ordTotalPages, total: ordTotal })

          // Funcție pentru procesarea unei pagini de orders
          const processOrders = async (orders: any[]) => {
            const batch: any[] = []

            for (const woo of orders) {
              const extId = String(woo.id)
              if (existSet.has(extId)) { ordSkipped++; continue }

              const phone = (woo.billing?.phone || '').replace(/\s/g, '') || null
              const email = (woo.billing?.email || '').toLowerCase().trim() || null
              const name = [woo.billing?.first_name, woo.billing?.last_name].filter(Boolean).join(' ') || null
              const ordAt = woo.date_created || new Date().toISOString()

              if (!phone && !email) { ordSkipped++; continue }

              try {
                const { customer, isNew } = await findOrCreate(supabase, storeId, userId, phone, email, name, ordAt)
                if (isNew) custCreated++

                // Update first/last order dates
                const upd: any = { updated_at: new Date().toISOString() }
                let needsUpdate = false
                if (!customer.name && name) { upd.name = name; needsUpdate = true }
                if (!customer.phone && phone) { upd.phone = phone; needsUpdate = true }
                if (!customer.email && email) { upd.email = emailNorm(email); needsUpdate = true }
                if (ordAt && (!customer.first_order_at || new Date(ordAt) < new Date(customer.first_order_at))) {
                  upd.first_order_at = ordAt; needsUpdate = true
                }
                if (ordAt && (!customer.last_order_at || new Date(ordAt) > new Date(customer.last_order_at))) {
                  upd.last_order_at = ordAt; needsUpdate = true
                }
                if (needsUpdate) await supabase.from('risk_customers').update(upd).eq('id', customer.id)

                batch.push(buildOrder(woo, storeId, userId, customer.id))
                touchedIds.add(customer.id)
                existSet.add(extId)
              } catch { ordSkipped++ }
            }

            // Insert batch
            if (batch.length) {
              for (let i = 0; i < batch.length; i += 50) {
                try {
                  await supabase.from('risk_orders').insert(batch.slice(i, i + 50))
                } catch {
                  // Fallback individual
                  for (const o of batch.slice(i, i + 50)) {
                    try { await supabase.from('risk_orders').insert(o) } catch {}
                  }
                }
              }
              ordInserted += batch.length
            }
          }

          await processOrders(first.data)

          // Restul paginilor
          for (let page = 2; page <= ordTotalPages; page++) {
            send({ stage: 'orders', page, totalPages: ordTotalPages, ordInserted, ordSkipped, total: ordTotal })

            try {
              const { data: orders } = await wcGet(base, auth, 'orders', {
                per_page: '100', page: String(page), orderby: 'date', order: 'asc',
              })
              if (!orders.length) break
              await processOrders(orders)
            } catch (e: any) {
              send({ stage: 'orders_page_error', page, error: e.message })
            }
          }
        } catch (e: any) {
          send({ stage: 'orders_error', message: e.message })
        }

        send({
          stage: 'orders_done', ordInserted, ordSkipped, ordTotal,
          message: `Comenzi: ${ordInserted} importate, ${ordSkipped} existente/skip.`,
        })

        // ═══════════════════════════════════════════════════════════════
        // ETAPA 3: RECALCULARE SCORURI
        // ═══════════════════════════════════════════════════════════════
        const ids = Array.from(touchedIds)
        if (ids.length > 0) {
          send({ stage: 'recalc', total: ids.length, done: 0 })

          const settings = await getStoreAndSettings(supabase, storeId)

          for (let i = 0; i < ids.length; i++) {
            try { await recalc(supabase, ids[i], storeId, settings) } catch {}
            if ((i + 1) % 10 === 0 || i === ids.length - 1) {
              send({ stage: 'recalc', total: ids.length, done: i + 1 })
            }
          }
        }

        // ═══════════════════════════════════════════════════════════════
        // FINALIZARE
        // ═══════════════════════════════════════════════════════════════
        send({
          stage: 'done',
          custCreated, custUpdated, custSkipped,
          ordInserted, ordSkipped, ordTotal,
          recalculated: ids.length,
          message: `Sincronizare completă: ${custCreated} clienți noi, ${ordInserted} comenzi importate, ${ids.length} scoruri recalculate.`,
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