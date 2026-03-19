import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/woocommerce/client'
import { decrypt } from '@/lib/security/encryption'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function isValidWidgetOrigin(request: Request, userId: string, supabase: any): Promise<boolean> {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  if (!origin) return true // same-origin or server-to-server

  const { data: store } = await supabase.from('stores').select('store_url').eq('user_id', userId).single()
  if (!store?.store_url) return true // no store configured yet — allow

  try {
    const storeHost = new URL(store.store_url).hostname
    const reqHost = new URL(origin).hostname
    return reqHost === storeHost || origin.includes('hontrio.com') || origin.includes('localhost')
  } catch { return true }
}

// POST /api/agent/stock
// Body: { userId, productIds: string[] }
export async function POST(request: Request) {
  try {
    const { userId, productIds } = await request.json()
    if (!userId || !productIds?.length) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400, headers: CORS })
    }

    const supabase = createAdminClient()

    const valid = await isValidWidgetOrigin(request, userId, supabase)
    if (!valid) return NextResponse.json({ stock: {}, error: 'Forbidden' }, { status: 403, headers: CORS })

    // Obține credențialele magazinului
    const { data: store } = await supabase
      .from('stores')
      .select('store_url, api_key, api_secret')
      .eq('user_id', userId)
      .single()

    if (!store?.api_key || !store?.api_secret) {
      return NextResponse.json({ stock: {}, error: 'Store not connected' }, { headers: CORS })
    }

    let consumerKey: string
    let consumerSecret: string
    try {
      consumerKey = decrypt(store.api_key)
      consumerSecret = decrypt(store.api_secret)
    } catch {
      return NextResponse.json({ stock: {}, error: 'Invalid credentials' }, { headers: CORS })
    }

    const woo = new WooCommerceClient({
      store_url: store.store_url,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    })

    // Verifică stocul pentru toate produsele cerute (max 10)
    const ids = productIds.slice(0, 10)
    const results = await woo.getStockBatch(ids)

    // Map: external_id -> stock info
    const stock: Record<string, any> = {}
    for (const r of results as any[]) {
      stock[r.id] = {
        available: r.stock_status === 'instock',
        status: r.stock_status,
        quantity: r.stock_quantity ?? null,
        label: r.stock_status === 'instock'
          ? (r.stock_quantity != null ? `${r.stock_quantity} in stock` : 'In stock')
          : r.stock_status === 'onbackorder'
          ? 'Available on backorder'
          : 'Out of stock',
      }
    }

    return NextResponse.json({ stock }, { headers: CORS })
  } catch (err) {
    console.error('[Stock API]', err)
    return NextResponse.json({ stock: {}, error: 'Internal error' }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}
