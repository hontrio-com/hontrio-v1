import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import {
  normalizePhone, normalizeEmail, mapWooStatus,
  recalcCustomerFromDB, fetchWooOrders, buildRiskOrderFromWoo,
} from '@/lib/risk/identity'
import { calculateRiskScore, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

// Comanda aparține clientului dacă telefon (ultimele 9 cifre) SAU email se potrivește
function belongs(wooOrder: any, phone: string | null, email: string | null): boolean {
  const bPhone = (wooOrder.billing?.phone || '').replace(/\s/g, '')
  const bEmail = (wooOrder.billing?.email || '').toLowerCase().trim()
  const phoneNorm = phone ? normalizePhone(phone) : null
  const phoneOk = phoneNorm && bPhone && normalizePhone(bPhone) === phoneNorm
  const emailOk = email && bEmail && normalizeEmail(bEmail) === normalizeEmail(email)
  return !!(phoneOk || emailOk)
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { customer_id } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: customer } = await supabase.from('risk_customers').select('*')
      .eq('id', customer_id).eq('user_id', session.user.id).single()
    if (!customer) return NextResponse.json({ error: 'Client negăsit' }, { status: 404 })

    const { data: store } = await supabase.from('stores')
      .select('id, store_url, api_key, api_secret, user_id').eq('id', customer.store_id).single()
    if (!store) return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })

    const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
    if (!ck || !cs) return NextResponse.json({ error: 'Credențiale API lipsă. Reconectează magazinul.' }, { status: 400 })

    const seen = new Set<number>()
    const wooOrders: any[] = []

    console.log('[ImportHistory] start for customer:', customer_id, 'phone:', customer.phone, 'email:', customer.email)

    // Caută după email
    if (customer.email) {
      try {
        const { orders } = await fetchWooOrders(store.store_url, ck, cs, {
          billing_email: customer.email, orderby: 'date', order: 'desc',
        }, 10)
        for (const o of orders) {
          if (!seen.has(o.id) && belongs(o, null, customer.email)) {
            seen.add(o.id); wooOrders.push(o)
          }
        }
      } catch (e: any) { console.error('[ImportHistory] email fetch error:', e.message) }
    }

    // Caută după telefon
    if (customer.phone) {
      const clean = customer.phone.replace(/\s/g, '')
      try {
        const { orders } = await fetchWooOrders(store.store_url, ck, cs, {
          search: clean, orderby: 'date', order: 'desc',
        }, 10)
        for (const o of orders) {
          if (!seen.has(o.id) && belongs(o, customer.phone, null)) {
            seen.add(o.id); wooOrders.push(o)
          }
        }
      } catch (e: any) { console.error('[ImportHistory] phone fetch error:', e.message) }
    }

    console.log('[ImportHistory] total found in WooCommerce:', wooOrders.length)

    if (wooOrders.length === 0) {
      return NextResponse.json({
        ok: true, imported: 0, updated: 0, reassigned: 0,
        total_in_woocommerce: 0, total_in_db: customer.total_orders || 0,
        new_score: customer.risk_score, new_label: customer.risk_label,
        message: 'Nicio comandă găsită în WooCommerce pentru acest client.',
      })
    }

    // Ia toate comenzile existente în tot store-ul
    const { data: allExisting } = await supabase.from('risk_orders')
      .select('external_order_id, customer_id').eq('store_id', store.id)
    const existMap = new Map<string, string>((allExisting || []).map((o: any) => [String(o.external_order_id), o.customer_id]))

    const toInsert: any[] = []
    let updated = 0, reassigned = 0

    for (const woo of wooOrders) {
      const extId = String(woo.id)
      const status = mapWooStatus(woo.status || 'pending')
      const owner = existMap.get(extId)

      if (owner) {
        if (owner === customer_id) {
          // Comanda noastră — actualizează status
          await supabase.from('risk_orders')
            .update({ order_status: status, updated_at: new Date().toISOString() })
            .eq('store_id', store.id).eq('external_order_id', extId)
          updated++
        } else {
          // Comanda la alt customer_id — verifică dacă e același om (normalizare phone/email)
          const { data: other } = await supabase.from('risk_customers')
            .select('phone, email').eq('id', owner).single()
          const samePhone = customer.phone && other?.phone &&
            normalizePhone(customer.phone) === normalizePhone(other.phone)
          const sameEmail = customer.email && other?.email &&
            normalizeEmail(customer.email) === normalizeEmail(other.email)
          if (samePhone || sameEmail) {
            // Același om — reatribuim
            await supabase.from('risk_orders')
              .update({ customer_id, order_status: status, updated_at: new Date().toISOString() })
              .eq('store_id', store.id).eq('external_order_id', extId)
            reassigned++
          }
        }
        continue
      }

      // Comandă nouă
      toInsert.push(buildRiskOrderFromWoo(woo, store.id, store.user_id, customer_id, customer.phone, customer.email))
    }

    // Inserează comenzile noi în batch
    for (let i = 0; i < toInsert.length; i += 50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i + 50))
    }

    // Recalculează din DB (sursa de adevăr)
    const result = await recalcCustomerFromDB(supabase, customer_id, store.id, {})

    // Ia total final
    const { count: totalInDB } = await supabase.from('risk_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer_id).eq('store_id', store.id)

    return NextResponse.json({
      ok: true,
      imported: toInsert.length,
      updated,
      reassigned,
      total_in_woocommerce: wooOrders.length,
      total_in_db: totalInDB || 0,
      new_score: result.score,
      new_label: result.label,
    })
  } catch (err: any) {
    console.error('[ImportHistory] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}