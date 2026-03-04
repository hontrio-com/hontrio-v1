import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const { product_id } = await request.json()

    if (!product_id) return NextResponse.json({ error: 'product_id lipsește' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (!product) return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })

    const { data: store } = await supabase
      .from('stores')
      .select('store_url, store_name')
      .eq('user_id', userId)
      .single()

    const title = product.optimized_title || product.original_title || ''
    const description = (product.meta_description || product.optimized_short_description || product.original_description || '')
      .replace(/<[^>]*>/g, '').substring(0, 500)
    const images = product.original_images || []
    const storeUrl = store?.store_url?.replace(/\/$/, '') || 'https://magazin.ro'
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')

    const schema: any = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: title,
      description: description,
      image: images.length > 0 ? images : undefined,
      sku: product.external_id ? String(product.external_id) : undefined,
      brand: store?.store_name ? {
        '@type': 'Brand',
        name: store.store_name,
      } : undefined,
      offers: {
        '@type': 'Offer',
        url: `${storeUrl}/product/${slug}`,
        priceCurrency: 'RON',
        price: product.price ? String(product.price) : undefined,
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'Organization',
          name: store?.store_name || 'Magazin Online',
        },
      },
    }

    // Remove undefined values
    const cleanSchema = JSON.parse(JSON.stringify(schema, (_, v) => v === undefined ? undefined : v))
    const jsonLd = `<script type="application/ld+json">\n${JSON.stringify(cleanSchema, null, 2)}\n</script>`

    return NextResponse.json({ success: true, schema: cleanSchema, json_ld: jsonLd })
  } catch (err) {
    console.error('[Schema]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}