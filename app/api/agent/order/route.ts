import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/woocommerce/client'
import { decrypt } from '@/lib/security/encryption'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'În așteptare plată',
  processing: 'În procesare',
  'on-hold':  'În așteptare',
  completed:  'Finalizată',
  cancelled:  'Anulată',
  refunded:   'Rambursată',
  failed:     'Eșuată',
  shipped:    'Expediată',
}

function formatOrder(order: any) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    status_label: STATUS_LABELS[order.status] || order.status,
    date: new Date(order.date_created).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }),
    total: `${order.total} ${order.currency}`,
    items: (order.line_items || []).slice(0, 5).map((i: any) => ({
      name: i.name,
      quantity: i.quantity,
      total: `${i.total} ${order.currency}`,
    })),
    shipping: order.shipping_lines?.[0]?.method_title || null,
    tracking_number: order.meta_data?.find((m: any) =>
      ['_tracking_number', 'tracking_number', 'awb', '_awb'].includes(m.key)
    )?.value || null,
    billing_email: order.billing?.email || null,
    billing_name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
  }
}

// POST /api/agent/order
// Body: { userId, query: string, type: 'id' | 'email' | 'search' }
export async function POST(request: Request) {
  try {
    const { userId, query, type = 'search' } = await request.json()
    if (!userId || !query) {
      return NextResponse.json({ orders: [], error: 'Parametri lipsă' }, { status: 400, headers: CORS })
    }

    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores')
      .select('store_url, api_key, api_secret')
      .eq('user_id', userId)
      .single()

    if (!store?.api_key || !store?.api_secret) {
      return NextResponse.json({ orders: [], error: 'Magazin neconectat' }, { headers: CORS })
    }

    let consumerKey: string
    let consumerSecret: string
    try {
      consumerKey = decrypt(store.api_key)
      consumerSecret = decrypt(store.api_secret)
    } catch {
      return NextResponse.json({ orders: [], error: 'Credențiale invalide' }, { headers: CORS })
    }

    const woo = new WooCommerceClient({
      store_url: store.store_url,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    })

    let orders: any[] = []

    if (type === 'id') {
      try {
        const order = await woo.getOrder(query)
        orders = [order]
      } catch {
        orders = []
      }
    } else if (type === 'email') {
      orders = await woo.getOrdersByEmail(query, 3)
    } else {
      // Încearcă mai întâi ca ID numeric, apoi ca search general
      if (/^\d+$/.test(query)) {
        try {
          const order = await woo.getOrder(query)
          orders = [order]
        } catch {}
      }
      if (orders.length === 0) {
        orders = await woo.searchOrders(query, 3)
      }
    }

    return NextResponse.json({
      orders: orders.map(formatOrder)
    }, { headers: CORS })

  } catch (err) {
    console.error('[Order API]', err)
    return NextResponse.json({ orders: [], error: 'Eroare internă' }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}