import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = await params
    const supabase = createAdminClient()

    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Produsul nu a fost găsit' }, { status: 404 })
    }

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!store) {
      return NextResponse.json({ error: 'Niciun magazin conectat.' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < 1) {
      return NextResponse.json({ error: 'Credite insuficiente' }, { status: 400 })
    }

    const wooUrl = store.store_url.replace(/\/$/, '')
    const ck = encodeURIComponent(store.api_key)
    const cs = encodeURIComponent(store.api_secret)

    const wooProduct: Record<string, any> = {
      name: product.optimized_title || product.original_title,
      description: product.optimized_long_description || product.original_description || '',
      short_description: product.optimized_short_description || '',
      meta_data: [],
    }

    if (product.price) {
      wooProduct.regular_price = String(product.price)
    }

    if (product.meta_description) {
      wooProduct.meta_data.push(
        { key: '_yoast_wpseo_metadesc', value: product.meta_description },
        { key: 'rank_math_description', value: product.meta_description }
      )
    }

    if (product.category) {
      wooProduct.categories = [{ name: product.category }]
    }

    const { data: generatedImages } = await supabase
      .from('generated_images')
      .select('generated_image_url, style')
      .eq('product_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    let wooRes: Response

    if (product.external_id) {
      wooRes = await fetch(
        `${wooUrl}/wp-json/wc/v3/products/${product.external_id}?consumer_key=${ck}&consumer_secret=${cs}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wooProduct),
        }
      )
    } else {
      const images: { src: string; name: string; alt: string }[] = []

      if (product.original_images && product.original_images.length > 0) {
        product.original_images.forEach((img: string, i: number) => {
          images.push({
            src: img,
            name: `${product.original_title} - Original ${i + 1}`,
            alt: product.optimized_title || product.original_title,
          })
        })
      }

      if (generatedImages && generatedImages.length > 0) {
        generatedImages.forEach((img: any) => {
          images.push({
            src: img.generated_image_url,
            name: `${product.original_title} - AI ${img.style}`,
            alt: product.optimized_title || product.original_title,
          })
        })
      }

      if (images.length > 0) {
        wooProduct.images = images
      }

      wooRes = await fetch(
        `${wooUrl}/wp-json/wc/v3/products?consumer_key=${ck}&consumer_secret=${cs}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wooProduct),
        }
      )
    }

    if (!wooRes.ok) {
      const errData = await wooRes.json().catch(() => ({}))
      console.error('WooCommerce error:', errData)
      return NextResponse.json({
        error: `Eroare WooCommerce: ${errData.message || 'Verifică conexiunea magazinului'}`
      }, { status: 500 })
    }

    const wooData = await wooRes.json()

    await supabase
      .from('products')
      .update({ external_id: String(wooData.id), status: 'published' })
      .eq('id', id)

    const newBalance = user.credits - 1
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -1,
      balance_after: newBalance,
      description: `Publicare: ${product.optimized_title || product.original_title}`,
      reference_type: 'publish',
    })

    return NextResponse.json({ success: true, external_id: wooData.id })
  } catch (error: any) {
    console.error('Publish error:', error)
    return NextResponse.json({ error: 'Eroare la publicare' }, { status: 500 })
  }
}