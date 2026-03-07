import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  phoneNorm, emailNorm, safeDecrypt, wooFetch, buildOrder, recalc,
} from '@/lib/risk/identity'

function belongs(woo: any, phone: string | null, email: string | null): boolean {
  const bp = (woo.billing?.phone || '').replace(/\s/g, '')
  const be = (woo.billing?.email || '').toLowerCase().trim()
  const phOk = phone && bp && phoneNorm(bp) === phoneNorm(phone)
  const emOk = email && be && emailNorm(be) === emailNorm(email)
  return !!(phOk || emOk)
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { customer_id } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: customer } = await supabase.from('risk_customers')
      .select('*').eq('id', customer_id).eq('user_id', session.user.id).single()
    if (!customer) return NextResponse.json({ error: 'Client negăsit' }, { status: 404 })

    const { data: store } = await supabase.from('stores')
      .select('id, store_url, api_key, api_secret, user_id').eq('id', customer.store_id).single()
    if (!store) return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })

    const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
    if (!ck || !cs) return NextResponse.json({ error: 'Credențiale API lipsă' }, { status: 400 })

    const seen = new Set<number>()
    const wooOrders: any[] = []

    if (customer.email) {
      try {
        const orders = await wooFetch(store.store_url, ck, cs, { billing_email: customer.email, orderby: 'date', order: 'desc' }, 10)
        for (const o of orders) { if (!seen.has(o.id) && belongs(o, null, customer.email)) { seen.add(o.id); wooOrders.push(o) } }
      } catch {}
    }
    if (customer.phone) {
      try {
        const orders = await wooFetch(store.store_url, ck, cs, { search: customer.phone.replace(/\s/g, ''), orderby: 'date', order: 'desc' }, 10)
        for (const o of orders) { if (!seen.has(o.id) && belongs(o, customer.phone, null)) { seen.add(o.id); wooOrders.push(o) } }
      } catch {}
    }

    if (!wooOrders.length) {
      return NextResponse.json({ ok: true, imported: 0, total_in_db: customer.total_orders || 0, new_score: customer.risk_score, new_label: customer.risk_label })
    }

    const { data: allExisting } = await supabase.from('risk_orders')
      .select('external_order_id, customer_id').eq('store_id', store.id)
    const existMap = new Map((allExisting || []).map((o: any) => [String(o.external_order_id), o.customer_id]))

    const toInsert: any[] = []
    let reassigned = 0

    for (const woo of wooOrders) {
      const extId = String(woo.id)
      const owner = existMap.get(extId)

      if (owner) {
        if (owner !== customer_id) {
          // Check if same person (phone/email match)
          const { data: other } = await supabase.from('risk_customers')
            .select('phone, email').eq('id', owner).single()
          const samePhone = customer.phone && other?.phone && phoneNorm(customer.phone) === phoneNorm(other.phone)
          const sameEmail = customer.email && other?.email && emailNorm(customer.email) === emailNorm(other.email)
          if (samePhone || sameEmail) {
            await supabase.from('risk_orders')
              .update({ customer_id, updated_at: new Date().toISOString() })
              .eq('store_id', store.id).eq('external_order_id', extId)
            reassigned++
          }
        }
        continue
      }
      toInsert.push(buildOrder(woo, store.id, store.user_id, customer_id))
    }

    for (let i = 0; i < toInsert.length; i += 50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i + 50))
    }

    const result = await recalc(supabase, customer_id, store.id)

    return NextResponse.json({
      ok: true, imported: toInsert.length, reassigned,
      total_in_woocommerce: wooOrders.length,
      new_score: result.score, new_label: result.label,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}