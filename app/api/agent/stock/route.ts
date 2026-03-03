import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/woocommerce/client'
import { decrypt } from '@/lib/security/encryption'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// POST /api/agent/stock
// Body: { userId, productIds: string[] }
export async function POST(request: Request) {
  try {
    const { userId, productIds } = await request.json()
    if (!userId || !productIds?.length) {
      return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400, headers: CORS })
    }

    const supabase = createAdminClient()

    // Obține credențialele magazinului
    const { data: store } = await supabase
      .from('stores')
      .select('store_url, api_key, api_secret')
      .eq('user_id', userId)
      .single()

    if (!store?.api_key || !store?.api_secret) {
      return NextResponse.json({ stock: {}, error: 'Magazin neconectat' }, { headers: CORS })
    }

    let consumerKey: string
    let consumerSecret: string
    try {
      consumerKey = decrypt(store.api_key)
      consumerSecret = decrypt(store.api_secret)
    } catch {
      return NextResponse.json({ stock: {}, error: 'Credențiale invalide' }, { headers: CORS })
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
    for (const r of results) {
      stock[r.id] = {
        available: r.stock_status === 'instock',
        status: r.stock_status,
        quantity: r.stock_quantity,
        label: r.stock_status === 'instock'
          ? (r.stock_quantity != null ? `${r.stock_quantity} în stoc` : 'În stoc')
          : r.stock_status === 'onbackorder'
          ? 'Disponibil la comandă'
          : 'Stoc epuizat',
      }
    }

    return NextResponse.json({ stock }, { headers: CORS })
  } catch (err) {
    console.error('[Stock API]', err)
    return NextResponse.json({ stock: {}, error: 'Eroare internă' }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS })
}