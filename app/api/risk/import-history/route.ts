import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeDecrypt, wcGet, buildOrder, recalc } from '@/lib/risk/identity'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { customer_id } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })
    const supabase = createAdminClient()
    const { data: customer } = await supabase.from('risk_customers')
      .select('*').eq('id', customer_id).eq('user_id', (session.user as any).id).single()
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    const { data: store } = await supabase.from('stores')
      .select('id, store_url, api_key, api_secret, user_id').eq('id', customer.store_id).single()
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const ck = safeDecrypt(store.api_key), cs = safeDecrypt(store.api_secret)
    if (!ck || !cs) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    const base = store.store_url.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')

    // Dacă are external_customer_id, caută comenzile după customer= param
    const wooOrders: any[] = []
    const seen = new Set<number>()

    if (customer.external_customer_id) {
      try {
        const res = await wcGet(base, auth, 'orders', {
          customer: customer.external_customer_id, orderby: 'date', order: 'desc', per_page: '100',
        })
        for (const o of res.data) { if (!seen.has(o.id)) { seen.add(o.id); wooOrders.push(o) } }
      } catch {}
    }

    // Fallback: search by email
    if (customer.email) {
      try {
        const res = await wcGet(base, auth, 'orders', {
          search: customer.email, orderby: 'date', order: 'desc', per_page: '100',
        })
        for (const o of res.data) { if (!seen.has(o.id)) { seen.add(o.id); wooOrders.push(o) } }
      } catch {}
    }

    if (!wooOrders.length) {
      return NextResponse.json({ ok: true, imported: 0, new_score: customer.risk_score, new_label: customer.risk_label })
    }

    const { data: existDb } = await supabase.from('risk_orders')
      .select('external_order_id').eq('store_id', store.id)
    const existSet = new Set((existDb || []).map((o: any) => String(o.external_order_id)))

    const toInsert = wooOrders
      .filter(w => !existSet.has(String(w.id)))
      .map(w => buildOrder(w, store.id, store.user_id, customer_id))

    for (let i = 0; i < toInsert.length; i += 50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i + 50))
    }

    const result = await recalc(supabase, customer_id, store.id)
    return NextResponse.json({ ok: true, imported: toInsert.length, new_score: result.score, new_label: result.label })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}