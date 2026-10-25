import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAdapter } from '@/lib/integrations/types'
import { decrypt } from '@/lib/security/encryption'
import { rateLimitSync } from '@/lib/security/rate-limit'
import { isCommercePlatform, syncCommerceStore } from '@/lib/commerce/sync'

import { stripHtml } from '@/lib/security/sanitize'

function sanitize(str: string | null | undefined, maxLength: number = 50000): string {
  if (!str) return ''
  return stripHtml(str).substring(0, maxLength)
}

// Vercel: permite până la 5 minute pentru sincronizare
export const maxDuration = 300

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry a Supabase operation up to 3 times with exponential backoff
async function supabaseRetry<T>(fn: () => PromiseLike<{ data: T; error: any }>): Promise<{ data: T; error: any }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fn()
    if (!result.error) return result
    const errMsg = typeof result.error === 'string' ? result.error : result.error?.message || ''
    // Retry on 500, rate limit, or timeout errors
    if (errMsg.includes('500') || errMsg.includes('rate') || errMsg.includes('timeout') || errMsg.includes('Internal') || errMsg.includes('<!DOCTYPE')) {
      console.log(`Supabase retry ${attempt + 1}/3: ${errMsg.substring(0, 80)}`)
      await delay(1000 * (attempt + 1)) // 1s, 2s, 3s
      continue
    }
    return result // Non-retryable error
  }
  return await fn() // Final attempt
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id

    // Rate limit: max 2 syncs per 10 minutes
    const limit = await rateLimitSync(userId)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Sincronizare prea frecventă. Așteaptă câteva minute.' },
        { status: 429 }
      )
    }

    const supabase = createAdminClient()

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })
    }

    // ===== EDINIO, WOOCOMMERCE: ofertele și comenzile, în modelul comun de reclame =====
    if (isCommercePlatform(store.platform)) {
      const name = store.platform === 'edinio' ? 'Edinio' : 'WooCommerce'
      // Un magazin WooCommerce mare continuă la sincronizările următoare (`complete: false`)
      const result = await syncCommerceStore(store.id, store.platform, 'full', { deadline: Date.now() + 240_000 })
      if (!result.ok) {
        const error = result.reason === 'locked' ? 'O sincronizare e deja în curs. Revino peste câteva minute.'
          : result.reason === 'revoked' ? (store.platform === 'edinio'
            ? 'Accesul la Edinio a fost revocat. Reconectează magazinul.'
            : 'WooCommerce nu mai acceptă cheia API. Deconectează magazinul și conectează-l cu o cheie nouă.')
          : `Sincronizarea cu ${name} a eșuat. Încearcă din nou.`
        return NextResponse.json({ error }, { status: result.reason === 'locked' ? 409 : result.reason === 'revoked' ? 401 : 502 })
      }
      return NextResponse.json({ synced: result.offersTotal, total: result.offersTotal, orders: result.ordersTotal, complete: result.complete })
    }

    // Decrypt stored API keys
    let apiKey = store.api_key
    try {
      // Try to decrypt — if keys are already plain text (old data), use as-is
      if (apiKey.includes(':')) apiKey = decrypt(apiKey)
    } catch {
      // Keys might be stored in plain text (pre-encryption migration)
    }

    // ===== SHOPIFY: ramură separată de sync =====
    if (store.platform === 'shopify') {
      return await syncShopifyProducts({ store, userId, supabase, accessToken: apiKey })
    }

    return NextResponse.json({ error: 'Platformă nesuportată' }, { status: 400 })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Eroare la sincronizare' }, { status: 500 })
  }
}

// ─── Sync Shopify via adapter generic ─────────────────────────────────────────
async function syncShopifyProducts({
  store, userId, supabase, accessToken,
}: {
  store: any
  userId: string
  supabase: any
  accessToken: string
}) {
  try {
    const adapter = createAdapter('shopify', {
      store_url: store.store_url,
      access_token: accessToken.trim(),
    })

    // FAZA 1: Descarcă produsele
    await supabase
      .from('stores')
      .update({
        sync_status: 'syncing',
        sync_started_at: new Date().toISOString(),
        sync_progress: 0,
        sync_total: 0,
      })
      .eq('id', store.id)

    const totalProducts = await adapter.getProductCount()
    const perPage = 100
    const totalPages = Math.ceil(totalProducts / perPage)

    await supabase
      .from('stores')
      .update({ sync_total: totalProducts })
      .eq('id', store.id)

    console.log(`[Shopify Sync] Total produse: ${totalProducts}, pagini: ${totalPages}`)

    let allProducts: any[] = []

    for (let page = 1; page <= totalPages; page++) {
      const batch = await adapter.getProducts(page, perPage)
      allProducts = [...allProducts, ...batch]

      await supabase
        .from('stores')
        .update({ sync_progress: allProducts.length })
        .eq('id', store.id)

      console.log(`[Shopify Sync] Pagina ${page}/${totalPages} (${allProducts.length} produse)`)
    }

    // Deduplicare după id
    const seenIds = new Set<string>()
    const uniqueProducts = allProducts.filter(p => {
      if (seenIds.has(p.id)) return false
      seenIds.add(p.id)
      return true
    })

    // FAZA 2: Salvează în DB
    await supabase
      .from('stores')
      .update({
        sync_status: 'saving',
        sync_progress: 0,
        sync_total: uniqueProducts.length,
      })
      .eq('id', store.id)

    let syncedCount = 0
    let errorCount = 0

    for (let i = 0; i < uniqueProducts.length; i++) {
      const product = uniqueProducts[i]

      try {
        const rawPrice = parseFloat(product.price)
        const safePrice = isNaN(rawPrice) ? null : rawPrice
        const title = sanitize(product.name, 500) || `Product ${product.id}`
        const description = product.description || ''
        const images = Array.isArray(product.images)
          ? product.images.filter((img: any) => img?.src).map((img: any) => String(img.src))
          : []
        const category = product.categories?.[0]?.name
          ? sanitize(product.categories[0].name, 200)
          : null

        const productData = {
          store_id: store.id,
          user_id: userId,
          external_id: product.id,
          original_title: title,
          original_description: description,
          original_short_description: null,
          original_images: images,
          category,
          price: safePrice,
          status: 'draft' as const,
          parent_id: null,
          variant_name: null,
        }

        const { data: existing } = await supabaseRetry(() =>
          supabase
            .from('products')
            .select('id, status')
            .eq('store_id', store.id)
            .eq('external_id', product.id)
            .maybeSingle()
        ) as { data: { id: string; status: string } | null; error: any }

        if (existing) {
          const updatePayload: Record<string, any> = {
            original_title: title,
            original_description: description,
            original_images: images,
            category,
            price: safePrice,
          }
          await supabaseRetry(() =>
            supabase.from('products').update(updatePayload).eq('id', existing.id)
          )
          syncedCount++
        } else {
          const { error: insertErr } = await supabaseRetry(() =>
            supabase.from('products').insert(productData)
          )
          if (insertErr) {
            console.error(`[Shopify Sync] INSERT ERR ${product.id}: ${insertErr.message}`)
            errorCount++
          } else {
            syncedCount++
          }
        }
      } catch (err: any) {
        console.error(`[Shopify Sync] EXCEPTION ${product.id}: ${err?.message}`)
        errorCount++
      }

      if ((i + 1) % 50 === 0 || i === uniqueProducts.length - 1) {
        await supabase
          .from('stores')
          .update({ sync_progress: i + 1 })
          .eq('id', store.id)
      }
    }

    // FAZA 3: Finalizare
    const { count: actualCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)

    const realCount = actualCount || syncedCount

    await supabase
      .from('stores')
      .update({
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        products_count: realCount,
        sync_progress: uniqueProducts.length,
        sync_total: uniqueProducts.length,
      })
      .eq('id', store.id)

    console.log(`[Shopify Sync] Complet: ${realCount} produse, ${errorCount} erori`)

    return NextResponse.json({
      message: 'Sincronizare Shopify completă',
      synced: realCount,
      products: uniqueProducts.length,
      variations: 0,
      errors: errorCount,
    })
  } catch (err: any) {
    console.error('[Shopify Sync] Eroare:', err)
    return NextResponse.json({ error: 'Eroare sincronizare Shopify: ' + err.message }, { status: 500 })
  }
}