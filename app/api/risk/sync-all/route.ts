import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  safeDecrypt, mapStatus, resolveCustomer, recalc, buildOrder, getSettings, wcGet,
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
        // ═══════════════════════════════════════════════════════════════
        // ETAPA 1: Importă CLIENȚI din /wc/v3/customers?role=all
        // Fiecare WooCommerce customer → un risk_customer bazat pe customer.id
        // ═══════════════════════════════════════════════════════════════
        send({ stage: 'customers_start', message: 'Se importă clienții din WooCommerce...' })
        let custCreated = 0, custUpdated = 0

        try {
          const first = await wcGet(base, auth, 'customers', {
            per_page: '100', page: '1', role: 'all',
          })
          const custPages = first.totalPages

          const processCustomers = async (custs: any[]) => {
            for (const wc of custs) {
              const wcId = String(wc.id)
              if (wcId === '0') continue // skip guest placeholder

              const phone = (wc.billing?.phone || '').replace(/\s/g, '') || null
              const email = (wc.email || wc.billing?.email || '').toLowerCase().trim() || null
              const name = [wc.first_name, wc.last_name].filter(Boolean).join(' ') || null
              const regDate = wc.date_created || new Date().toISOString()

              try {
                const { customer, isNew } = await resolveCustomer(
                  supabase, storeId, userId, wcId, phone, email, name, regDate
                )
                if (isNew) custCreated++
                else {
                  custUpdated++
                  // Update contact info dacă lipsește
                  const upd: any = { updated_at: new Date().toISOString() }
                  let need = false
                  if (!customer.name && name) { upd.name = name; need = true }
                  if (!customer.phone && phone) { upd.phone = phone; need = true }
                  if (!customer.email && email) { upd.email = email.toLowerCase().trim(); need = true }
                  if (need) await supabase.from('risk_customers').update(upd).eq('id', customer.id)
                }
              } catch (e: any) {
                console.error(`[SyncAll] Customer ${wcId} error:`, e.message)
              }
            }
          }

          await processCustomers(first.data)
          send({ stage: 'customers', page: 1, totalPages: custPages, custCreated, custUpdated })

          for (let p = 2; p <= custPages; p++) {
            try {
              const { data } = await wcGet(base, auth, 'customers', {
                per_page: '100', page: String(p), role: 'all',
              })
              await processCustomers(data)
              send({ stage: 'customers', page: p, totalPages: custPages, custCreated, custUpdated })
            } catch (e: any) {
              send({ stage: 'warn', message: `Customer page ${p} error: ${e.message}` })
            }
          }
        } catch (e: any) {
          send({ stage: 'warn', message: `Customers endpoint error: ${e.message}. Continuăm cu comenzile.` })
        }

        send({ stage: 'customers_done', custCreated, custUpdated,
          message: `${custCreated} clienți noi, ${custUpdated} existenți.` })

        // ═══════════════════════════════════════════════════════════════
        // ETAPA 2: Importă COMENZI din /wc/v3/orders
        // Fiecare order se leagă de customer prin order.customer_id
        // ═══════════════════════════════════════════════════════════════
        send({ stage: 'orders_start', message: 'Se importă comenzile...' })

        const { data: existDb } = await supabase.from('risk_orders')
          .select('external_order_id').eq('store_id', storeId)
        const existSet = new Set((existDb || []).map((o: any) => String(o.external_order_id)))

        let ordInserted = 0, ordSkipped = 0
        const touchedIds = new Set<string>()

        try {
          const first = await wcGet(base, auth, 'orders', {
            per_page: '100', page: '1', orderby: 'date', order: 'asc',
          })
          const ordPages = first.totalPages
          const ordTotal = first.total

          const processOrders = async (orders: any[]) => {
            const batch: any[] = []
            for (const woo of orders) {
              const extId = String(woo.id)
              if (existSet.has(extId)) { ordSkipped++; continue }

              // WooCommerce customer_id — SURSA DE ADEVĂR
              const wcCustId = woo.customer_id ? String(woo.customer_id) : null
              const phone = (woo.billing?.phone || '').replace(/\s/g, '') || null
              const email = (woo.billing?.email || '').toLowerCase().trim() || null
              const name = [woo.billing?.first_name, woo.billing?.last_name].filter(Boolean).join(' ') || null
              const ordAt = woo.date_created || new Date().toISOString()

              try {
                const { customer } = await resolveCustomer(
                  supabase, storeId, userId, wcCustId, phone, email, name, ordAt
                )

                // Update customer contact info
                // For guests: always update name/phone to latest order (WooCommerce shows latest)
                // For registered: only fill missing fields
                const upd: any = { updated_at: new Date().toISOString() }
                let need = false
                if (customer.is_guest) {
                  // Guest: always update to latest data
                  if (name) { upd.name = name; need = true }
                  if (phone) { upd.phone = phone; need = true }
                  if (email) { upd.email = email; need = true }
                } else {
                  // Registered: only fill missing
                  if (!customer.name && name) { upd.name = name; need = true }
                  if (!customer.phone && phone) { upd.phone = phone; need = true }
                  if (!customer.email && email) { upd.email = email; need = true }
                }
                if (ordAt && (!customer.first_order_at || new Date(ordAt) < new Date(customer.first_order_at))) {
                  upd.first_order_at = ordAt; need = true
                }
                if (ordAt && (!customer.last_order_at || new Date(ordAt) > new Date(customer.last_order_at))) {
                  upd.last_order_at = ordAt; need = true
                }
                if (need) await supabase.from('risk_customers').update(upd).eq('id', customer.id)

                batch.push(buildOrder(woo, storeId, userId, customer.id))
                touchedIds.add(customer.id)
                existSet.add(extId)
              } catch (e: any) {
                console.error(`[SyncAll] Order ${extId} error:`, e.message)
                ordSkipped++
              }
            }

            if (batch.length) {
              for (let i = 0; i < batch.length; i += 50) {
                try { await supabase.from('risk_orders').insert(batch.slice(i, i + 50)) }
                catch { for (const o of batch.slice(i, i + 50)) { try { await supabase.from('risk_orders').insert(o) } catch {} } }
              }
              ordInserted += batch.length
            }
          }

          await processOrders(first.data)
          send({ stage: 'orders', page: 1, totalPages: ordPages, ordInserted, ordSkipped, total: ordTotal })

          for (let p = 2; p <= ordPages; p++) {
            try {
              const { data } = await wcGet(base, auth, 'orders', {
                per_page: '100', page: String(p), orderby: 'date', order: 'asc',
              })
              if (!data.length) break
              await processOrders(data)
              send({ stage: 'orders', page: p, totalPages: ordPages, ordInserted, ordSkipped, total: ordTotal })
            } catch (e: any) {
              send({ stage: 'warn', message: `Order page ${p}: ${e.message}` })
            }
          }
        } catch (e: any) {
          send({ stage: 'error', message: `Orders error: ${e.message}` })
        }

        send({ stage: 'orders_done', ordInserted, ordSkipped })

        // ═══════════════════════════════════════════════════════════════
        // ETAPA 3: Recalculare scoruri
        // ═══════════════════════════════════════════════════════════════
        const ids = Array.from(touchedIds)
        if (ids.length) {
          send({ stage: 'recalc', total: ids.length, done: 0 })
          const settings = await getSettings(supabase, storeId)
          for (let i = 0; i < ids.length; i++) {
            try { await recalc(supabase, ids[i], storeId, settings) } catch {}
            if ((i + 1) % 10 === 0 || i === ids.length - 1) {
              send({ stage: 'recalc', total: ids.length, done: i + 1 })
            }
          }
        }

        send({
          stage: 'done', custCreated, custUpdated, ordInserted, ordSkipped,
          recalculated: ids.length,
          message: `${custCreated} clienți noi, ${ordInserted} comenzi importate, ${ids.length} scoruri recalculate.`,
        })
      } catch (e: any) {
        send({ stage: 'error', message: e.message })
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}