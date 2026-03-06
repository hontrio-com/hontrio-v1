import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .single()

    const { data: customers, count: custCount } = await supabase
      .from('risk_customers')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .limit(3)

    const { data: orders, count: ordCount } = await supabase
      .from('risk_orders')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .limit(3)

    const { count: alertCount } = await supabase
      .from('risk_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Verifica coloanele disponibile in stores
    const storeColumns = store ? Object.keys(store) : []

    return NextResponse.json({
      userId,
      store: store ? {
        id: store.id,
        url: store.store_url,
        has_webhook_secret: !!store.webhook_secret,
        has_api_key: !!store.api_key,
        has_api_secret: !!store.api_secret,
        columns: storeColumns,
      } : null,
      risk_customers: { count: custCount, sample: customers },
      risk_orders: { count: ordCount, sample: orders },
      risk_alerts: { count: alertCount },
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'}/api/risk/webhook`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Simuleaza un webhook order.created pentru test
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores')
      .select('id, store_url, webhook_secret')
      .eq('user_id', userId)
      .single()

    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat' }, { status: 404 })

    const fakeOrder = {
      id: Math.floor(Math.random() * 900000) + 100000,
      number: String(Math.floor(Math.random() * 9000) + 1000),
      status: 'processing',
      date_created: new Date().toISOString(),
      total: '250.00',
      currency: 'RON',
      payment_method: 'cod',
      billing: {
        first_name: 'Ion',
        last_name: 'Popescu',
        phone: '0740123456',
        email: `test${Date.now()}@example.com`,
        address_1: 'Str. Exemplu 1',
        city: 'București',
        state: 'B',
        country: 'RO',
      },
      shipping: {
        address_1: 'Str. Exemplu 1',
        city: 'București',
        state: 'B',
        country: 'RO',
      },
    }

    const body = JSON.stringify(fakeOrder)
    const crypto = await import('crypto')
    const sig = crypto.createHmac('sha256', store.webhook_secret).update(body).digest('base64')

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'}/api/risk/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wc-webhook-topic': 'order.created',
        'x-wc-webhook-signature': sig,
        'x-wc-webhook-source': store.store_url,
      },
      body,
    })

    const result = await res.json()
    return NextResponse.json({ ok: true, webhook_result: result, order_id: fakeOrder.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}