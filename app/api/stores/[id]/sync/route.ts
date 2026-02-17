import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { WooCommerceClient } from '@/lib/woocommerce/client'

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

    const woo = new WooCommerceClient({
      store_url: store.store_url,
      consumer_key: store.api_key,
      consumer_secret: store.api_secret,
    })

    // ===== PHASE 1: DOWNLOAD =====
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

    console.log(`Download done: ${allProducts.length}. Saving to DB...`)

    // ===== PHASE 2: SAVE (sequential, one by one, with retry) =====
    await supabase
      .from('stores')
      .update({
        sync_status: 'saving',
        sync_progress: allProducts.length,
        sync_total: allProducts.length,
      })
      .eq('id', store.id)

    let syncedCount = 0
    let errorCount = 0

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i]

      try {
        const rawPrice = parseFloat(product.price)
        const safePrice = isNaN(rawPrice) ? null : rawPrice

        const productData = {
          store_id: store.id,
          user_id: userId,
          external_id: product.id.toString(),
          original_title: (product.name || '').substring(0, 500),
          original_description: product.description || '',
          original_images: product.images?.map((img: any) => img.src) || [],
          category: product.categories?.[0]?.name || null,
          price: safePrice,
          status: 'draft' as const,
        }

        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('store_id', store.id)
          .eq('external_id', product.id.toString())
          .single()

        if (existing) {
          const { error: err } = await supabase
            .from('products')
            .update({
              original_title: productData.original_title,
              original_description: productData.original_description,
              original_images: productData.original_images,
              category: productData.category,
              price: productData.price,
            })
            .eq('id', existing.id)

          if (err) {
            console.error(`Update err product ${product.id}:`, err.message)
            errorCount++
          } else {
            syncedCount++
          }
        } else {
          const { error: err } = await supabase
            .from('products')
            .insert(productData)

          if (err) {
            // Retry once - maybe it was a temporary error
            console.error(`Insert err product ${product.id}: ${err.message} — retrying...`)
            const { error: retryErr } = await supabase
              .from('products')
              .insert(productData)

            if (retryErr) {
              console.error(`Retry failed product ${product.id}: ${retryErr.message}`)
              errorCount++
            } else {
              syncedCount++
            }
          } else {
            syncedCount++
          }
        }
      } catch (err: any) {
        console.error(`Exception product ${product.id}: ${err?.message}`)
        errorCount++
      }

      // Update progress every 100 products
      if ((i + 1) % 100 === 0 || i === allProducts.length - 1) {
        await supabase
          .from('stores')
          .update({ sync_progress: syncedCount })
          .eq('id', store.id)
        console.log(`Saved ${syncedCount}/${allProducts.length} (${errorCount} errors)`)
      }
    }

    // ===== PHASE 3: COMPLETE =====
    await supabase
      .from('stores')
      .update({
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        products_count: syncedCount,
        sync_progress: syncedCount,
        sync_total: allProducts.length,
      })
      .eq('id', store.id)

    console.log(`SYNC COMPLETE: ${syncedCount} saved, ${errorCount} errors, ${allProducts.length} total from WooCommerce`)

    return NextResponse.json({
      message: 'Sincronizare completă',
      synced: syncedCount,
      errors: errorCount,
      total: allProducts.length,
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Eroare la sincronizare' }, { status: 500 })
  }
}