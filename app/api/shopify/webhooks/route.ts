import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError, logWarn } from '@/lib/logger'
import { storedMessage } from '@/lib/i18n/stored'
import crypto from 'crypto'

// =============================================
// POST /api/shopify/webhooks
// Dezinstalarea aplicației și webhook-urile obligatorii de confidențialitate.
// Catalogul și comenzile vin prin sincronizare (cronul), nu de aici.
// Returnează 200 și la erori interne (altfel Shopify retrimite); 401 la HMAC invalid.
// =============================================

const ROUTE = '/api/shopify/webhooks'

function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  // Shopify semnează TOATE webhook-urile cu CLIENT_SECRET (nu cu webhook secret separat)
  const secret = process.env.SHOPIFY_CLIENT_SECRET
  if (!secret || !hmacHeader) return false

  const calculated = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated),
      Buffer.from(hmacHeader)
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  // Citim body-ul o singură dată ca text — necesar pentru verificarea HMAC
  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256') || ''
    const topic = request.headers.get('x-shopify-topic') || ''
    const shopDomain = request.headers.get('x-shopify-shop-domain') || ''

    // Verifică HMAC — Shopify cere 401 pentru HMAC invalid (cerință compliance)
    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      logApiError(ROUTE, 401, 'HMAC webhook Shopify invalid', { shop: shopDomain, topic })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) // i18n-ignore: răspuns pentru serverele Shopify, nu pentru om
    }

    const supabase = createAdminClient()
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('store_url', shopDomain)
      .eq('platform', 'shopify')
      .maybeSingle()

    // Shop necunoscut — ignorăm
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

      case 'shop/redact': {
        // La 48 de ore după dezinstalare, Shopify cere ștergerea datelor magazinului:
        // magazinul, cu ofertele și comenzile lui (în cascadă)
        await supabase.from('stores').delete().eq('id', store.id)
        logWarn(ROUTE, 'Datele magazinului Shopify au fost șterse la cererea Shopify', { storeId: store.id })
        break
      }

      // customers/data_request, customers/redact: Hontrio nu ține date despre clienți
      // (din comenzi păstrează doar țara), deci nu e nimic de trimis sau de șters
      default:
        break
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    // Eroare internă — logăm dar returnăm 200 ca Shopify să nu retrimită
    logApiError(ROUTE, 200, 'Eroare internă webhook Shopify (non-fatal)', { error: (err as Error).message })
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
