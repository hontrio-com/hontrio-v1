import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/woocommerce/client'
import { decrypt } from '@/lib/security/encryption'
import { rateLimitSync } from '@/lib/security/rate-limit'

import { stripHtml } from '@/lib/security/sanitize'
import { calculateInitialSeoScore } from '@/lib/seo/score'

function sanitize(str: string | null | undefined, maxLength: number = 50000): string {
  if (!str) return ''
  return stripHtml(str).substring(0, maxLength)
}

// Extrage meta description din câmpul meta_data al unui produs WooCommerce
// Suportă Yoast SEO, Rank Math, și All in One SEO
function extractYoastMeta(metaData: any[]): { metaDescription: string | null; focusKeyword: string | null } {
  if (!Array.isArray(metaData)) return { metaDescription: null, focusKeyword: null }
  const find = (keys: string[]) => {
    for (const key of keys) {
      const entry = metaData.find((m: any) => m.key === key)
      if (entry?.value && typeof entry.value === 'string' && entry.value.trim()) {
        return entry.value.trim()
      }
    }
    return null
  }
  return {
    metaDescription: find([
      '_yoast_wpseo_metadesc',
      'rank_math_description',
      '_aioseo_description',
      '_seopress_titles_desc',
    ]),
    focusKeyword: find([
      '_yoast_wpseo_focuskw',
      'rank_math_focus_keyword',
      '_aioseo_keywords',
    ]),
  }
}

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

    // Decrypt stored API keys
    let apiKey = store.api_key
    let apiSecret = store.api_secret
    try {
      // Try to decrypt — if keys are already plain text (old data), use as-is
      if (apiKey.includes(':')) apiKey = decrypt(apiKey)
      if (apiSecret.includes(':')) apiSecret = decrypt(apiSecret)
    } catch {
      // Keys might be stored in plain text (pre-encryption migration)
    }

    const woo = new WooCommerceClient({
      store_url: store.store_url,
      consumer_key: apiKey,
      consumer_secret: apiSecret,
    })

    // ===== PHASE 1: DOWNLOAD PRODUCTS =====
    await supabase
      .from('stores')
      .update({
        sync_status: 'syncing',
        sync_started_at: new Date().toISOString(),
        sync_progress: 0,
        sync_total: 0,
      })
      .eq('id', store.id)

    console.log('Starting sync for store:', store.store_url)

    const firstResult = await woo.getProducts(1, 10)
    const totalProducts = firstResult.total
    const totalPages = firstResult.totalPages

    await supabase
      .from('stores')
      .update({ sync_total: totalProducts, sync_progress: firstResult.data.length })
      .eq('id', store.id)

    let allProducts: any[] = [...firstResult.data]
    let page = 2

    console.log(`Total products: ${totalProducts}, pages: ${totalPages}`)

    while (page <= totalPages) {
      const result = await woo.getProducts(page, 10)
      allProducts = [...allProducts, ...result.data]

      if (page % 5 === 0 || page === totalPages) {
        await supabase
          .from('stores')
          .update({ sync_progress: allProducts.length })
          .eq('id', store.id)
      }

      console.log(`Page ${page}/${totalPages} (${allProducts.length}/${totalProducts})`)
      page++
    }

    // Deduplicate products
    const seenIds = new Set<string>()
    const uniqueProducts: any[] = []

    for (const product of allProducts) {
      const pid = String(product.id)
      if (seenIds.has(pid)) continue
      seenIds.add(pid)
      uniqueProducts.push(product)
    }

    console.log(`Download done: ${allProducts.length} entries, ${uniqueProducts.length} unique products`)

    // ===== PHASE 1.5: DOWNLOAD VARIATIONS =====
    const variableProducts = uniqueProducts.filter(p => p.type === 'variable')
    console.log(`Variable products (with variations): ${variableProducts.length}`)

    // Collect all variations: { parentProduct, variation }
    const allVariations: { parent: any; variation: any }[] = []

    if (variableProducts.length > 0) {
      await supabase
        .from('stores')
        .update({ sync_total: uniqueProducts.length + variableProducts.length * 5 }) // estimate
        .eq('id', store.id)

      let varProgress = 0
      for (const parent of variableProducts) {
        try {
          let varPage = 1
          let varTotalPages = 1

          while (varPage <= varTotalPages) {
            const varResult = await woo.getVariations(String(parent.id), varPage, 50)
            varTotalPages = varResult.totalPages

            for (const variation of varResult.data) {
              allVariations.push({ parent, variation })
            }

            varPage++
          }

          varProgress++
          if (varProgress % 10 === 0) {
            console.log(`Variations: ${varProgress}/${variableProducts.length} parents processed (${allVariations.length} variations found)`)
          }
        } catch (err: any) {
          console.error(`Failed to get variations for product ${parent.id}: ${err?.message}`)
        }
      }

      console.log(`Total variations downloaded: ${allVariations.length} from ${variableProducts.length} variable products`)
    }

    // ===== PHASE 2: SAVE PRODUCTS =====
    const totalToSave = uniqueProducts.length + allVariations.length

    await supabase
      .from('stores')
      .update({
        sync_status: 'saving',
        sync_progress: 0,
        sync_total: totalToSave,
      })
      .eq('id', store.id)

    let syncedCount = 0
    let errorCount = 0
    const errorDetails: string[] = []

    // Map to track parent product DB IDs (external_id -> supabase uuid)
    const parentDbIds: Record<string, string> = {}

    // Save parent products first
    for (let i = 0; i < uniqueProducts.length; i++) {
      const product = uniqueProducts[i]

      try {
        const rawPrice = parseFloat(product.price)
        const safePrice = isNaN(rawPrice) ? null : rawPrice

        const title = sanitize(product.name, 500) || `Product ${product.id}`
        const description = product.description || ''
        const shortDescription = product.short_description || ''
        const images = Array.isArray(product.images)
          ? product.images.filter((img: any) => img && img.src).map((img: any) => String(img.src))
          : []
        const category = product.categories?.[0]?.name
          ? sanitize(product.categories[0].name, 200)
          : null

        // Extrage meta SEO deja existenta (Yoast / Rank Math / AIOSEO)
        const { metaDescription: yoastMeta, focusKeyword: yoastKw } = extractYoastMeta(product.meta_data)

        // Calculeaza scorul SEO initial real pe baza continutului din WooCommerce
        const initialSeoScore = calculateInitialSeoScore({
          original_title:             title,
          original_description:       description,
          original_short_description: shortDescription,
          meta_description:           yoastMeta,
          focus_keyword:              yoastKw,
        })

        const productData = {
          store_id: store.id,
          user_id: userId,
          external_id: String(product.id),
          original_title: title,
          original_description: description,
          original_short_description: shortDescription || null,
          original_images: images,
          category,
          price: safePrice,
          status: 'draft' as const,
          parent_id: null,
          variant_name: null,
          // Câmpuri SEO — incluse la insert; la update nu suprascrie optimizarile Hontrio
          meta_description: yoastMeta,
          focus_keyword: yoastKw,
          seo_score: initialSeoScore,
        }

        const { data: existing } = await supabaseRetry(() =>
          supabase
            .from('products')
            .select('id')
            .eq('store_id', store.id)
            .eq('external_id', String(product.id))
            .maybeSingle()
        )

        if (existing) {
          // La re-sync: actualizeaza campurile originale din WooCommerce
          // dar NU suprascrie optimizarile Hontrio (titlu optimizat, meta, etc.)
          // Recalculeaza scorul SEO numai daca produsul nu a fost inca optimizat (status=draft)
          const { data: existingProduct } = await supabaseRetry(() =>
            supabase.from('products').select('status, seo_score').eq('id', existing.id).single()
          )
          const isUnoptimized = !existingProduct || existingProduct.status === 'draft'

          const updatePayload: Record<string, any> = {
            original_title: productData.original_title,
            original_description: productData.original_description,
            original_short_description: productData.original_short_description,
            original_images: productData.original_images,
            category: productData.category,
            price: productData.price,
            parent_id: null,
            variant_name: null,
          }

          // Daca produsul e neoptimizat, actualizeaza si campurile SEO initiale
          if (isUnoptimized) {
            updatePayload.seo_score = productData.seo_score
            // Seteaza meta si keyword din Yoast DOAR daca nu sunt deja setate manual
            if (productData.meta_description) updatePayload.meta_description = productData.meta_description
            if (productData.focus_keyword) updatePayload.focus_keyword = productData.focus_keyword
          }

          const { error: updErr } = await supabaseRetry(() =>
            supabase
              .from('products')
              .update(updatePayload)
              .eq('id', existing.id)
          )

          if (updErr) {
            console.error(`UPDATE ERR WC#${product.id}: ${updErr.message}`)
            errorCount++
            errorDetails.push(`WC#${product.id}: update - ${updErr.message}`)
          } else {
            parentDbIds[String(product.id)] = existing.id
            syncedCount++
          }
        } else {
          const { data: inserted, error: err } = await supabaseRetry(() =>
            supabase
              .from('products')
              .insert(productData)
              .select('id')
              .single()
          )

          if (err) {
            console.error(`INSERT ERR WC#${product.id}: ${err.message}`)
            errorCount++
            errorDetails.push(`WC#${product.id}: ${err.message}`)
          } else {
            if (inserted) parentDbIds[String(product.id)] = inserted.id
            syncedCount++
          }
        }
      } catch (err: any) {
        console.error(`EXCEPTION WC#${product.id}: ${err?.message}`)
        errorCount++
      }

      if ((i + 1) % 50 === 0 || i === uniqueProducts.length - 1) {
        await supabase
          .from('stores')
          .update({ sync_progress: i + 1 })
          .eq('id', store.id)
        console.log(`Products: ${i + 1}/${uniqueProducts.length} (${syncedCount} ok, ${errorCount} errors)`)
      }
    }

    console.log(`Products saved. Now saving ${allVariations.length} variations...`)

    // Save variations
    for (let i = 0; i < allVariations.length; i++) {
      const { parent, variation } = allVariations[i]

      try {
        const parentDbId = parentDbIds[String(parent.id)]
        if (!parentDbId) {
          console.error(`No parent DB ID for WC#${parent.id}, skipping variation ${variation.id}`)
          errorCount++
          continue
        }

        const rawPrice = parseFloat(variation.price)
        const safePrice = isNaN(rawPrice) ? null : rawPrice

        // Build variant name from attributes: "Culoare: Roșu, Mărime: XL"
        const variantName = Array.isArray(variation.attributes)
          ? variation.attributes
              .map((a: any) => `${a.name || a.option}: ${a.option}`)
              .join(', ')
          : `Variație ${variation.id}`

        const varImages = Array.isArray(variation.image) 
          ? [variation.image].filter((img: any) => img && img.src).map((img: any) => String(img.src))
          : variation.image?.src 
            ? [String(variation.image.src)]
            : []

        // Use parent images if variation has none
        const images = varImages.length > 0 
          ? varImages
          : (Array.isArray(parent.images) 
              ? parent.images.filter((img: any) => img && img.src).map((img: any) => String(img.src))
              : [])

        const varExternalId = `${parent.id}_var_${variation.id}`

        const varTitle = `${sanitize(parent.name, 400)} — ${variantName}`
        const varDescription = variation.description || parent.description || ''
        const varShortDesc = variation.short_description || parent.short_description || ''
        const { metaDescription: varYoastMeta, focusKeyword: varYoastKw } = extractYoastMeta(variation.meta_data || parent.meta_data)

        const varInitialSeoScore = calculateInitialSeoScore({
          original_title:             varTitle,
          original_description:       varDescription,
          original_short_description: varShortDesc,
          meta_description:           varYoastMeta,
          focus_keyword:              varYoastKw,
        })

        const varData = {
          store_id: store.id,
          user_id: userId,
          external_id: varExternalId,
          original_title: varTitle,
          original_description: varDescription,
          original_short_description: varShortDesc || null,
          original_images: images,
          category: parent.categories?.[0]?.name
            ? sanitize(parent.categories[0].name, 200)
            : null,
          price: safePrice,
          status: 'draft' as const,
          parent_id: parentDbId,
          variant_name: variantName,
          meta_description: varYoastMeta,
          focus_keyword: varYoastKw,
          seo_score: varInitialSeoScore,
        }

        const { data: existing } = await supabaseRetry(() =>
          supabase
            .from('products')
            .select('id')
            .eq('store_id', store.id)
            .eq('external_id', varExternalId)
            .maybeSingle()
        )

        if (existing) {
          const { data: existingVar } = await supabaseRetry(() =>
            supabase.from('products').select('status').eq('id', existing.id).single()
          )
          const varIsUnoptimized = !existingVar || existingVar.status === 'draft'
          const varUpdatePayload: Record<string, any> = {
            original_title: varData.original_title,
            original_description: varData.original_description,
            original_short_description: varData.original_short_description,
            original_images: varData.original_images,
            category: varData.category,
            price: varData.price,
            parent_id: parentDbId,
            variant_name: variantName,
          }
          if (varIsUnoptimized) {
            varUpdatePayload.seo_score = varData.seo_score
            if (varData.meta_description) varUpdatePayload.meta_description = varData.meta_description
            if (varData.focus_keyword) varUpdatePayload.focus_keyword = varData.focus_keyword
          }
          await supabaseRetry(() =>
            supabase.from('products').update(varUpdatePayload).eq('id', existing.id)
          )
          syncedCount++
        } else {
          const { error: err } = await supabaseRetry(() =>
            supabase
              .from('products')
              .insert(varData)
          )

          if (err) {
            console.error(`VAR INSERT ERR WC#${parent.id}_var_${variation.id}: ${err.message}`)
            errorCount++
            errorDetails.push(`VAR WC#${parent.id}_${variation.id}: ${err.message}`)
          } else {
            syncedCount++
          }
        }
      } catch (err: any) {
        console.error(`VAR EXCEPTION: ${err?.message}`)
        errorCount++
      }

      if ((i + 1) % 50 === 0 || i === allVariations.length - 1) {
        await supabase
          .from('stores')
          .update({ sync_progress: uniqueProducts.length + i + 1 })
          .eq('id', store.id)
        console.log(`Variations: ${i + 1}/${allVariations.length} (${syncedCount} total ok)`)
      }
    }

    // ===== PHASE 3: COMPLETE =====
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
        sync_progress: totalToSave,
        sync_total: totalToSave,
      })
      .eq('id', store.id)

    console.log(`===== SYNC COMPLETE =====`)
    console.log(`Products from WooCommerce: ${uniqueProducts.length}`)
    console.log(`Variations downloaded: ${allVariations.length}`)
    console.log(`Total in DB: ${realCount}`)
    console.log(`Errors: ${errorCount}`)
    if (errorDetails.length > 0) {
      console.log(`Error details:`)
      errorDetails.forEach(e => console.log(`  - ${e}`))
    }

    return NextResponse.json({
      message: 'Sincronizare completă',
      synced: realCount,
      products: uniqueProducts.length,
      variations: allVariations.length,
      errors: errorCount,
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Eroare la sincronizare' }, { status: 500 })
  }
}