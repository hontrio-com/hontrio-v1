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

    // Ia datele magazinului
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })
    }

    // Conecteaza-te la WooCommerce
    const woo = new WooCommerceClient({
      store_url: store.store_url,
      consumer_key: store.api_key,
      consumer_secret: store.api_secret,
    })

    // Trage toate produsele (pagina cu pagina)
    let allProducts: any[] = []
    let page = 1
    let totalPages = 1

    console.log('Starting sync for store:', store.store_url)

    while (page <= totalPages) {
      const result = await woo.getProducts(page, 50)
      allProducts = [...allProducts, ...result.data]
      totalPages = result.totalPages
      console.log(`Synced page ${page}/${totalPages} (${result.data.length} products)`)
      page++
    }

    console.log(`Total products from WooCommerce: ${allProducts.length}`)

    // Salveaza fiecare produs in Supabase
    let syncedCount = 0

    for (const product of allProducts) {
      // Verifica daca produsul exista deja
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', store.id)
        .eq('external_id', product.id.toString())
        .single()

      const productData = {
        store_id: store.id,
        user_id: userId,
        external_id: product.id.toString(),
        original_title: product.name || '',
        original_description: product.description || '',
        original_images: product.images?.map((img: any) => img.src) || [],
        category: product.categories?.[0]?.name || null,
        price: parseFloat(product.price) || null,
        status: 'draft' as const,
      }

      if (existing) {
        // Actualizeaza produsul existent
        await supabase
          .from('products')
          .update({
            original_title: productData.original_title,
            original_description: productData.original_description,
            original_images: productData.original_images,
            category: productData.category,
            price: productData.price,
          })
          .eq('id', existing.id)
      } else {
        // Creeaza produs nou
        await supabase.from('products').insert(productData)
      }

      syncedCount++
    }

    // Actualizeaza statusul magazinului
    await supabase
      .from('stores')
      .update({
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        products_count: allProducts.length,
      })
      .eq('id', store.id)

    console.log(`Sync complete: ${syncedCount} products`)

    return NextResponse.json({
      message: 'Sincronizare completă',
      synced: syncedCount,
      total: allProducts.length,
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json(
      { error: 'Eroare la sincronizare' },
      { status: 500 }
    )
  }
}