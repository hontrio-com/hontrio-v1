import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

function phoneLast9(p: string): string {
  return p.replace(/\s/g,'').replace(/^\+40/,'0').slice(-9)
}

// Repara atribuirile gresite de comenzi — le muta la clientul corect bazat pe telefon/email
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    const storeId = store.id

    const { data: customers } = await supabase
      .from('risk_customers').select('id, name, phone, email').eq('store_id', storeId)
    const { data: orders } = await supabase
      .from('risk_orders').select('id, customer_id, customer_phone, customer_email').eq('store_id', storeId)

    if (!customers || !orders) return NextResponse.json({ fixed: 0 })

    // Map last9 si email -> customer_id
    const phoneMap = new Map<string, string>()
    const emailMap = new Map<string, string>()
    for (const c of customers) {
      if (c.phone) phoneMap.set(phoneLast9(c.phone), c.id)
      if (c.email) emailMap.set(c.email.toLowerCase(), c.id)
    }

    let fixed = 0
    for (const order of orders) {
      let correctId: string | null = null
      if (order.customer_phone) correctId = phoneMap.get(phoneLast9(order.customer_phone)) || null
      if (!correctId && order.customer_email) correctId = emailMap.get(order.customer_email.toLowerCase()) || null

      if (correctId && correctId !== order.customer_id) {
        await supabase.from('risk_orders')
          .update({ customer_id: correctId, updated_at: new Date().toISOString() })
          .eq('id', order.id)
        fixed++
      }
    }

    // Recalculeaza contoarele pentru toti clientii
    for (const customer of customers) {
      const { data: myOrders } = await supabase
        .from('risk_orders').select('order_status')
        .eq('customer_id', customer.id).eq('store_id', storeId)

      let tc=0, tr=0, tn=0, tcan=0
      for (const o of (myOrders||[])) {
        if (o.order_status==='collected') tc++
        else if (['refused','returned'].includes(o.order_status)) tr++
        else if (o.order_status==='not_home') tn++
        else if (o.order_status==='cancelled') tcan++
      }

      await supabase.from('risk_customers').update({
        total_orders: (myOrders||[]).length,
        orders_collected: tc, orders_refused: tr, orders_not_home: tn, orders_cancelled: tcan,
        updated_at: new Date().toISOString(),
      }).eq('id', customer.id)
    }

    return NextResponse.json({ ok: true, fixed, message: `${fixed} comenzi reatribuite corect` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}