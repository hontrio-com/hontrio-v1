import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError, logWarn } from '@/lib/logger'
import { storedMessage } from '@/lib/i18n/stored'
import { isShopDomain, verifyWebhookHmac } from '@/lib/shopify/hmac'

// =============================================
// POST /api/shopify/webhooks
// Dezinstalarea aplicației și webhook-urile obligatorii de confidențialitate.
// Catalogul și comenzile vin prin sincronizare (cronul), nu de aici.
//
// Semnătura (HMAC) acoperă doar corpul, deci magazinul se ia din corpul semnat
// (`shop_domain`, la dezinstalare `myshopify_domain`), nu din antete.
// Răspunde 200 și la erori interne (altfel Shopify retrimite); 401 la HMAC invalid.
// =============================================

const ROUTE = '/api/shopify/webhooks'

type Body = {
  shop_domain?: unknown
  myshopify_domain?: unknown
  orders_requested?: unknown
  orders_to_redact?: unknown
  data_request?: { id?: unknown } | null
}

/** Id-urile comenzilor din corp (numere sau șiruri), ca în commerce_orders.external_id. */
function orderIds(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return [...new Set(list.map(String).filter(id => /^\d{1,20}$/.test(id)))].slice(0, 1000)
}

export async function POST(request: Request) {
  // Corpul se citește o singură dată, ca text: semnătura e peste octeții primiți
  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const topic = request.headers.get('x-shopify-topic') || ''
  if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256'), process.env.SHOPIFY_CLIENT_SECRET)) {
    logApiError(ROUTE, 401, 'HMAC webhook Shopify invalid', { topic: topic.slice(0, 60) })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore: răspuns pentru serverele Shopify, nu pentru om
  }

  try {
    let body: Body
    try {
      body = JSON.parse(rawBody) as Body
    } catch {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    const shop = typeof body.shop_domain === 'string' ? body.shop_domain.toLowerCase()
      : typeof body.myshopify_domain === 'string' ? body.myshopify_domain.toLowerCase() : ''
    if (!isShopDomain(shop)) return NextResponse.json({ ok: true }, { status: 200 })

    const supabase = createAdminClient()
    const { data: store } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', shop)
      .eq('platform', 'shopify')
      .maybeSingle()

    // Magazin necunoscut — nu avem nimic al lui
    if (!store) return NextResponse.json({ ok: true }, { status: 200 })

    switch (topic) {
      case 'app/uninstalled': {
        // Tokenul nu mai e bun: sincronizările se opresc până la reconectare
        await supabase.from('stores').update({
          connection_status: 'revoked',
          sync_status: 'active',
          last_error: storedMessage('sync.shopify_uninstalled'),
        }).eq('id', store.id)
        logWarn(ROUTE, 'Aplicația a fost dezinstalată din Shopify', { storeId: store.id })
        break
      }

      case 'customers/data_request': {
        // Despre un cumpărător, Hontrio ține doar comenzile lui, fără nume, email, telefon sau
        // adresă (doar țara). Comerciantul le găsește în exportul datelor din Setări; îl anunțăm.
        const ids = orderIds(body.orders_requested)
        const { count } = ids.length
          ? await supabase.from('commerce_orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id).in('external_id', ids)
          : { count: 0 }
        await supabase.from('notifications').insert({
          user_id: store.user_id,
          title: storedMessage('sync.shopify_data_request_title'),
          message: storedMessage('sync.shopify_data_request_body', { orders: count ?? 0 }),
          type: 'info',
          is_read: false,
        })
        logWarn(ROUTE, 'Cerere de date a unui cumpărător (Shopify)', {
          storeId: store.id, requestId: String(body.data_request?.id ?? ''), orders: count ?? 0,
        })
        break
      }

      case 'customers/redact': {
        // Comenzile cumpărătorului rămân doar ca sume: fără țară, sursă, cod de reducere
        const ids = orderIds(body.orders_to_redact)
        if (ids.length) {
          const { error } = await supabase.from('commerce_orders').update({
            country: null, attribution: {}, gclid: null, utm_source: null, utm_medium: null, utm_campaign: null, discount_code: null,
          }).eq('store_id', store.id).in('external_id', ids)
          if (error) logApiError(ROUTE, 500, 'Anonimizarea comenzilor a eșuat', { storeId: store.id, error: error.message })
        }
        logWarn(ROUTE, 'Datele unui cumpărător au fost anonimizate la cererea Shopify', { storeId: store.id, orders: ids.length })
        break
      }

      case 'shop/redact': {
        // La 48 de ore după dezinstalare, Shopify cere ștergerea datelor magazinului:
        // magazinul, cu ofertele și comenzile lui (în cascadă)
        await supabase.from('stores').delete().eq('id', store.id)
        logWarn(ROUTE, 'Datele magazinului Shopify au fost șterse la cererea Shopify', { storeId: store.id })
        break
      }

      default:
        break
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    // Eroare internă — logăm dar returnăm 200 ca Shopify să nu retrimită
    logApiError(ROUTE, 500, 'Eroare internă webhook Shopify', { topic, error: (err as Error).message })
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
