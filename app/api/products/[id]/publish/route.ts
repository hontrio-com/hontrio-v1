import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!store) {
      return NextResponse.json({ error: 'No store connected.' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    const wooUrl = store.store_url.replace(/\/$/, '')
    // Cheile sunt criptate in DB — decripteaza daca e nevoie (contine ':' ca separator iv:tag:cipher)
    const ck = (store.api_key?.includes(':') ? decrypt(store.api_key) : store.api_key).trim()
    const cs = (store.api_secret?.includes(':') ? decrypt(store.api_secret) : store.api_secret).trim()
    // encodeURIComponent e obligatoriu — cheile WooCommerce pot contine caractere speciale
    const authParams = `consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`
    const wooHeaders = { 'Content-Type': 'application/json' }

    const wooProduct: Record<string, any> = {
      name: product.optimized_title || product.original_title,
      description: product.optimized_long_description || product.original_description || '',
      short_description: product.optimized_short_description || '',
      meta_data: [],
    }

    if (product.price) {
      wooProduct.regular_price = String(product.price)
    }

    // Meta description — Yoast SEO + Rank Math + AIOSEO
    if (product.meta_description) {
      wooProduct.meta_data.push(
        { key: '_yoast_wpseo_metadesc',   value: product.meta_description },
        { key: 'rank_math_description',   value: product.meta_description },
        { key: '_aioseo_description',     value: product.meta_description },
        { key: '_seopress_titles_desc',   value: product.meta_description },
      )
    }

    // Titlu SEO (Yoast / Rank Math) — separat de titlul produsului
    if (product.optimized_title) {
      wooProduct.meta_data.push(
        { key: '_yoast_wpseo_title',      value: product.optimized_title },
        { key: 'rank_math_title',         value: product.optimized_title },
        { key: '_aioseo_title',           value: product.optimized_title },
        { key: '_seopress_titles_title',  value: product.optimized_title },
      )
    }

    // Focus keyword (Yoast / Rank Math)
    if (product.focus_keyword) {
      wooProduct.meta_data.push(
        { key: '_yoast_wpseo_focuskw',    value: product.focus_keyword },
        { key: 'rank_math_focus_keyword', value: product.focus_keyword },
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
        `${wooUrl}/wp-json/wc/v3/products/${product.external_id}?${authParams}`,
        {
          method: 'PUT',
          headers: wooHeaders,
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
        `${wooUrl}/wp-json/wc/v3/products?${authParams}`,
        {
          method: 'POST',
          headers: wooHeaders,
          body: JSON.stringify(wooProduct),
        }
      )
    }

    if (!wooRes.ok) {
      const errData = await wooRes.json().catch(() => ({}))
      const method = product.external_id ? 'PUT' : 'POST'
      const targetId = product.external_id || 'nou'
      console.error('[Publish] WooCommerce error:', JSON.stringify(errData))
      console.error('[Publish] Status:', wooRes.status, '| Method:', method, '| external_id:', targetId)

      // Daca PUT esueaza cu 401/403 (produs sters sau inexistent in WooCommerce), incearca POST ca produs nou
      if ((wooRes.status === 401 || wooRes.status === 403) && product.external_id) {
        console.log('[Publish] PUT 403 — incercam POST ca produs nou')
        const images: { src: string; name: string; alt: string }[] = []
        if (product.original_images?.length) {
          product.original_images.forEach((img: string, i: number) => {
            images.push({ src: img, name: `${product.original_title} - ${i+1}`, alt: product.optimized_title || product.original_title })
          })
        }
        if (images.length > 0) wooProduct.images = images

        const postRes = await fetch(
          `${wooUrl}/wp-json/wc/v3/products?${authParams}`,
          { method: 'POST', headers: wooHeaders, body: JSON.stringify(wooProduct) }
        )
        if (postRes.ok) {
          const postData = await postRes.json()
          await supabase.from('products').update({ external_id: String(postData.id), status: 'published' }).eq('id', id)
          const newBalance = user.credits - 1
          await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
          await supabase.from('credit_transactions').insert({
            user_id: userId, type: 'usage', amount: -1, balance_after: newBalance,
            description: `Publish (new): ${product.optimized_title || product.original_title}`,
            reference_type: 'publish',
          })
          return NextResponse.json({ success: true, external_id: postData.id })
        }
        const postErr = await postRes.json().catch(() => ({}))
        return NextResponse.json({
          error: `WooCommerce error (PUT 403 + POST ${postRes.status}): ${postErr.message || errData.message || 'Check API key permissions'}`
        }, { status: 500 })
      }

      return NextResponse.json({
        error: `WooCommerce error ${wooRes.status}: ${errData.message || errData.code || 'Check connection'} — ${method} id=${targetId}`
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
      description: `Publish: ${product.optimized_title || product.original_title}`,
      reference_type: 'publish',
    })

    return NextResponse.json({ success: true, external_id: wooData.id })
  } catch (error: any) {
    console.error('Publish error:', error)
    return NextResponse.json({ error: 'Publish error' }, { status: 500 })
  }
}