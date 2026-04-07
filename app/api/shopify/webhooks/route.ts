import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import crypto from 'crypto'

// =============================================
// POST /api/shopify/webhooks
// Receptor webhooks Shopify (comandă, produs, dezinstalare)
// Returnează ÎNTOTDEAUNA 200 — chiar și la erori interne
// =============================================

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
    const hmacHeader  = request.headers.get('x-shopify-hmac-sha256') || ''
    const topic       = request.headers.get('x-shopify-topic') || ''
    const shopDomain  = request.headers.get('x-shopify-shop-domain') || ''

    // Verifică HMAC — fără secret valid ignorăm webhook-ul
    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
      logApiError('/api/shopify/webhooks', 401, 'HMAC webhook Shopify invalid', {
        shop: shopDomain, topic,
      })
      // Returnăm 200 ca să nu retrimită Shopify
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const supabase = createAdminClient()

    // Găsim magazinul în baza de date
    const { data: store } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('store_url', shopDomain)
      .eq('platform', 'shopify')
      .maybeSingle()

    if (!store) {
      // Shop necunoscut — ignorăm
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // ─── Gestionare topics ────────────────────────────────────────────────────

    switch (topic) {
      case 'orders/create':
      case 'orders/updated': {
        // Trimitem comanda spre Risk Shield (fire-and-forget)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
        void fetch(`${appUrl}/api/risk/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Platform': 'shopify',
            'X-Store-Id': store.id,
          },
          body: JSON.stringify({
            ...payload,
            _store_id: store.id,
            _platform: 'shopify',
          }),
          signal: AbortSignal.timeout(10000),
        }).catch(e =>
          console.warn('[ShopifyWebhook] Risk Shield forward eșuat (non-fatal):', e.message)
        )
        break
      }

      case 'products/create':
      case 'products/update': {
        // Actualizăm produsul în DB dacă există și nu a fost optimizat
        if (payload.id) {
          const externalId = String(payload.id)
          const updateData: Record<string, any> = {}

          if (payload.title) updateData.original_title = payload.title
          if (payload.body_html !== undefined) updateData.original_description = payload.body_html
          if (payload.variants?.[0]?.price) {
            const price = parseFloat(payload.variants[0].price)
            if (!isNaN(price)) updateData.price = price
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('products')
              .update(updateData)
              .eq('store_id', store.id)
              .eq('external_id', externalId)
              .eq('status', 'draft') // Nu suprascrie optimizările deja publicate
          }
        }
        break
      }

      case 'app/uninstalled': {
        // Magazin dezinstalat — marcăm cu eroare
        await supabase
          .from('stores')
          .update({ sync_status: 'error' })
          .eq('id', store.id)

        console.warn(
          `[ShopifyWebhook] App dezinstalată din shop: ${shopDomain}, store_id: ${store.id}`
        )
        break
      }

      default:
        // Topic necunoscut — ignorăm fără eroare
        break
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    // Eroare internă — logăm dar returnăm 200 ca Shopify să nu retrimită
    logApiError('/api/shopify/webhooks', 200, 'Eroare internă webhook Shopify (non-fatal)', {
      error: (err as Error).message,
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
