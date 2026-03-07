import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import {
  normalizePhone, normalizeEmail, mapWooStatus,
  findOrCreateCustomer, recalcCustomerFromDB,
  buildRiskOrderFromWoo,
} from '@/lib/risk/identity'

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

// ─── GET: SSE stream pentru sincronizare completă ─────────────────────────────
//
// Fluxul:
// 1. Ia TOATE comenzile din WooCommerce (paginat, câte 100)
// 2. Pentru fiecare comandă, extrage phone/email → findOrCreateCustomer
// 3. Inserează comenzile noi, skip duplicatele (pe external_order_id)
// 4. La final, recalculează scorul pentru fiecare client modificat
// 5. Trimite progresul prin SSE
//

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const supabase = createAdminClient()

  // Ia store-ul
  const { data: store } = await supabase
    .from('stores')
    .select('id, store_url, api_key, api_secret')
    .eq('user_id', userId)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Niciun magazin conectat' }, { status: 404 })
  }

  const ck = safeDecrypt(store.api_key)
  const cs = safeDecrypt(store.api_secret)
  if (!ck || !cs) {
    return NextResponse.json({ error: 'Credențiale API lipsă' }, { status: 400 })
  }

  const storeId = store.id
  const base = store.store_url.replace(/\/$/, '')
  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')

  // ── SSE Stream ──────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        // ETAPA 1: Descoperă câte comenzi sunt
        send({ stage: 'init', message: 'Se conectează la WooCommerce...' })

        const countUrl = new URL(`${base}/wp-json/wc/v3/orders`)
        countUrl.searchParams.set('per_page', '1')
        countUrl.searchParams.set('page', '1')
        const countRes = await fetch(countUrl.toString(), {
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(15000),
        })
        if (!countRes.ok) {
          send({ stage: 'error', message: `WooCommerce a răspuns cu ${countRes.status}` })
          controller.close(); return
        }

        const totalOrders = parseInt(countRes.headers.get('x-wp-total') || '0')
        const totalPages = parseInt(countRes.headers.get('x-wp-totalpages') || '1')

        send({ stage: 'counting', totalOrders, totalPages, message: `${totalOrders} comenzi găsite în WooCommerce` })

        // Ia comenzile existente din DB (pentru deduplicare rapidă)
        const { data: existingOrders } = await supabase
          .from('risk_orders').select('external_order_id').eq('store_id', storeId)
        const existingSet = new Set<string>((existingOrders || []).map((o: any) => String(o.external_order_id)))

        send({ stage: 'existing', existingCount: existingSet.size, message: `${existingSet.size} comenzi deja în Risk Shield` })

        // ETAPA 2: Procesează pagină cu pagină
        let totalProcessed = 0
        let totalInserted = 0
        let totalSkipped = 0
        let customersCreated = 0
        let customersUpdated = 0
        const touchedCustomerIds = new Set<string>()

        for (let page = 1; page <= totalPages; page++) {
          send({
            stage: 'fetching',
            page, totalPages,
            processed: totalProcessed, inserted: totalInserted, skipped: totalSkipped,
            customersCreated, customersUpdated,
            message: `Pagina ${page}/${totalPages}...`,
          })

          const url = new URL(`${base}/wp-json/wc/v3/orders`)
          url.searchParams.set('per_page', '100')
          url.searchParams.set('page', String(page))
          url.searchParams.set('orderby', 'date')
          url.searchParams.set('order', 'asc')

          let pageOrders: any[]
          try {
            const res = await fetch(url.toString(), {
              headers: { Authorization: auth },
              signal: AbortSignal.timeout(30000),
            })
            if (!res.ok) {
              send({ stage: 'page_error', page, message: `Eroare pagina ${page}: HTTP ${res.status}` })
              continue
            }
            pageOrders = await res.json()
          } catch (e: any) {
            send({ stage: 'page_error', page, message: `Timeout pagina ${page}: ${e.message}` })
            continue
          }

          if (!Array.isArray(pageOrders) || pageOrders.length === 0) break

          // Procesează comenzile din această pagină
          const toInsert: any[] = []

          for (const woo of pageOrders) {
            totalProcessed++
            const extId = String(woo.id)

            // Skip dacă există deja
            if (existingSet.has(extId)) {
              totalSkipped++
              continue
            }

            const phone = (woo.billing?.phone || '').replace(/\s/g, '') || null
            const email = (woo.billing?.email || '').toLowerCase().trim() || null
            const name = [woo.billing?.first_name, woo.billing?.last_name].filter(Boolean).join(' ') || null
            const ordAt = woo.date_created || new Date().toISOString()

            if (!phone && !email) {
              totalSkipped++
              continue
            }

            // Find or create customer
            try {
              const { customer, isNew } = await findOrCreateCustomer(
                supabase, storeId, userId, phone, email, name, ordAt
              )

              if (isNew) customersCreated++
              else customersUpdated++

              // Update customer info dacă lipsesc
              const updates: any = { updated_at: new Date().toISOString() }
              if (!customer.name && name) updates.name = name
              if (!customer.phone && phone) updates.phone = phone
              if (!customer.email && email) updates.email = normalizeEmail(email)

              // Update first_order_at dacă e mai veche
              if (ordAt && (!customer.first_order_at || new Date(ordAt) < new Date(customer.first_order_at))) {
                updates.first_order_at = ordAt
              }
              // Update last_order_at dacă e mai nouă
              if (ordAt && (!customer.last_order_at || new Date(ordAt) > new Date(customer.last_order_at))) {
                updates.last_order_at = ordAt
              }

              if (Object.keys(updates).length > 1) {
                await supabase.from('risk_customers').update(updates).eq('id', customer.id)
              }

              toInsert.push(buildRiskOrderFromWoo(woo, storeId, userId, customer.id, phone, email))
              touchedCustomerIds.add(customer.id)
              existingSet.add(extId) // Previne duplicate în aceeași sesiune
            } catch (e: any) {
              console.error(`[SyncAll] Error processing order ${extId}:`, e.message)
              totalSkipped++
            }
          }

          // Insert batch
          if (toInsert.length > 0) {
            for (let i = 0; i < toInsert.length; i += 50) {
              const batch = toInsert.slice(i, i + 50)
              const { error } = await supabase.from('risk_orders').insert(batch)
              if (error) {
                console.error(`[SyncAll] Batch insert error:`, error.message)
                // Încearcă individual pentru a nu pierde totul
                for (const order of batch) {
                  try { await supabase.from('risk_orders').insert(order) } catch {}
                }
              }
            }
            totalInserted += toInsert.length
          }
        }

        // ETAPA 3: Recalculează scorurile pentru toți clienții modificați
        const customerIds = Array.from(touchedCustomerIds)
        send({
          stage: 'recalculating',
          total: customerIds.length,
          processed: 0,
          message: `Recalculez scoruri pentru ${customerIds.length} clienți...`,
        })

        // Ia setările o singură dată
        const { data: rs } = await supabase
          .from('risk_store_settings').select('*').eq('store_id', storeId).single()
        const settings = {
          score_watch_threshold: rs?.score_watch_threshold ?? 41,
          score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
          score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
          ...(rs?.custom_rules || {}),
          ml_weights: rs?.ml_weights,
        }

        for (let i = 0; i < customerIds.length; i++) {
          try {
            await recalcCustomerFromDB(supabase, customerIds[i], storeId, settings)
          } catch (e: any) {
            console.error(`[SyncAll] Recalc error for ${customerIds[i]}:`, e.message)
          }

          // Trimite progres la fiecare 10 clienți
          if ((i + 1) % 10 === 0 || i === customerIds.length - 1) {
            send({
              stage: 'recalculating',
              total: customerIds.length,
              processed: i + 1,
              message: `Recalculat ${i + 1}/${customerIds.length} clienți`,
            })
          }
        }

        // ETAPA 4: Salvează timestamp-ul sincronizării
        await supabase.from('risk_store_settings').upsert({
          store_id: storeId,
          user_id: userId,
          last_full_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'store_id' })

        // Finalizare
        send({
          stage: 'done',
          totalOrders,
          totalProcessed,
          totalInserted,
          totalSkipped,
          customersCreated,
          customersUpdated,
          customersRecalculated: customerIds.length,
          message: `Sincronizare completă! ${totalInserted} comenzi importate, ${customersCreated} clienți noi.`,
        })

      } catch (e: any) {
        send({ stage: 'error', message: e.message || 'Eroare necunoscută' })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}