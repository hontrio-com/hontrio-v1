import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { phoneNorm, emailNorm, recalc, getStoreAndSettings } from '@/lib/risk/identity'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: store } = await supabase.from('stores')
      .select('id').eq('user_id', (session.user as any).id).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    const storeId = store.id
    const { data: customers } = await supabase.from('risk_customers')
      .select('id, phone, email').eq('store_id', storeId)
    const { data: orders } = await supabase.from('risk_orders')
      .select('id, customer_id, customer_phone, customer_email').eq('store_id', storeId)
    if (!customers || !orders) return NextResponse.json({ fixed: 0 })

    const phoneMap = new Map<string, string>()
    const emailMap = new Map<string, string>()
    for (const c of customers) {
      if (c.phone) { const n = phoneNorm(c.phone); if (n.length === 9) phoneMap.set(n, c.id) }
      if (c.email) emailMap.set(emailNorm(c.email), c.id)
    }

    const affected = new Set<string>()
    let fixed = 0

    for (const o of orders) {
      let correct: string | null = null
      if (o.customer_phone) { const n = phoneNorm(o.customer_phone); if (n.length === 9) correct = phoneMap.get(n) || null }
      if (!correct && o.customer_email) correct = emailMap.get(emailNorm(o.customer_email)) || null

      if (correct && correct !== o.customer_id) {
        await supabase.from('risk_orders')
          .update({ customer_id: correct, updated_at: new Date().toISOString() }).eq('id', o.id)
        affected.add(correct)
        if (o.customer_id) affected.add(o.customer_id)
        fixed++
      }
    }

    const settings = await getStoreAndSettings(supabase, storeId)
    for (const id of affected) {
      try { await recalc(supabase, id, storeId, settings) } catch {}
    }

    return NextResponse.json({ ok: true, fixed, recalculated: affected.size })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}