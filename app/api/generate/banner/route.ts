import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { KieClient } from '@/lib/kie/client'

const BANNER_COST = 5

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { category, banner_style = 'modern', aspect_ratio = '16:9', reference_product_id } = await request.json()

    if (!category) return NextResponse.json({ error: 'Categoria este obligatorie' }, { status: 400 })

    // Check credits
    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single()
    if (!user || user.credits < BANNER_COST) {
      return NextResponse.json({ error: `Credite insuficiente (necesare: ${BANNER_COST})` }, { status: 400 })
    }

    // Get top products from this category
    const { data: products } = await supabase
      .from('products')
      .select('original_title, optimized_title, original_images, price')
      .eq('user_id', userId)
      .eq('category', category)
      .not('original_images', 'is', null)
      .limit(5)

    // Get brand kit for style context
    const { data: brandKit } = await supabase.from('brand_kits').select('*').eq('user_id', userId).single()

    // Get reference image (first product's image or specified product)
    let refImageUrl: string | null = null
    if (reference_product_id) {
      const { data: refProd } = await supabase
        .from('products')
        .select('original_images')
        .eq('id', reference_product_id)
        .eq('user_id', userId)
        .single()
      refImageUrl = refProd?.original_images?.[0] || null
    }
    if (!refImageUrl && products?.length) {
      refImageUrl = products[0].original_images?.[0] || null
    }

    if (!refImageUrl) {
      return NextResponse.json({ error: 'Niciun produs cu imagine în această categorie' }, { status: 400 })
    }

    const productNames = (products || []).map(p => p.optimized_title || p.original_title).slice(0, 3)
    const brandColors = brandKit ? `Primary: ${brandKit.primary_color}, Accent: ${brandKit.accent_color}` : 'neutral professional'

    const styleDescriptions: Record<string, string> = {
      modern: 'clean modern ecommerce banner, minimal design, professional, crisp typography space',
      bold: 'bold impactful banner, strong colors, dynamic composition, promotional energy',
      luxury: 'premium luxury banner, elegant dark tones, golden accents, sophisticated',
      seasonal: 'seasonal promotional banner, festive mood, warm inviting colors',
    }

    // Build banner prompt
    const prompt = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Create a detailed image generation prompt for an ecommerce CATEGORY BANNER (${aspect_ratio} format).

Category: "${category}"
Style: ${styleDescriptions[banner_style] || styleDescriptions.modern}
Featured products: ${productNames.join(', ')}
Brand colors: ${brandColors}
Brand tone: ${brandKit?.tone || 'professional'}

The banner should:
- Feature the products beautifully composed for ${aspect_ratio} format
- Have visual space for text overlay (left or bottom third)
- Feel like a professional ecommerce category page header
- NOT include any text or typography (text added separately)

Write a detailed 200-300 word prompt. Start with "Reproduce the EXACT products from the reference image".`,
      }],
      temperature: 0.5,
      max_tokens: 450,
    })

    const bannerPrompt = prompt.choices[0].message.content?.trim() || `Professional ecommerce banner for ${category} category`

    // Generate with KIE
    const kie = new KieClient()
    const taskId = await kie.createImageTask(bannerPrompt, [refImageUrl], {
      aspect_ratio,
      resolution: '1K',
      output_format: 'png',
    })

    // Create record
    const { data: imgRecord } = await supabase
      .from('generated_images')
      .insert({
        user_id: userId,
        product_id: null,
        style: `banner_${banner_style}`,
        original_image_url: refImageUrl,
        prompt: bannerPrompt,
        seed: taskId,
        status: 'processing',
        credits_used: BANNER_COST,
      })
      .select()
      .single()

    // Deduct credits immediately (banner generation is confirmed)
    const newBalance = user.credits - BANNER_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId, type: 'usage', amount: -BANNER_COST, balance_after: newBalance,
      description: `Banner categorie: ${category}`,
      reference_type: 'image_generation',
      reference_id: imgRecord?.id,
    })

    return NextResponse.json({
      success: true,
      task_id: taskId,
      image_record_id: imgRecord?.id,
      mode: 'async',
      credits_remaining: newBalance,
    })
  } catch (err: any) {
    console.error('[Banner]', err)
    return NextResponse.json({ error: 'Eroare internă: ' + err.message }, { status: 500 })
  }
}