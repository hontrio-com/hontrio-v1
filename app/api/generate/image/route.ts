import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { KieClient } from '@/lib/kie/client'
import { buildImagePrompt } from '@/lib/kie/prompts'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { canStartJob, markJobRunning, markJobDone } from '@/lib/security/ai-guard'

// Costul per stil
const STYLE_COSTS: Record<string, number> = {
  white_bg: 2,
  lifestyle: 3,
  premium_dark: 3,
  industrial: 3,
  seasonal: 4,
  auto: 3,
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: max 10 image generations per minute
    const limit = rateLimitExpensive(userId, 'image')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe cereri. Așteaptă un minut.' }, { status: 429 })
    }

    const { product_id, style, reference_image_url } = await request.json()

    // Concurrent job limit
    const jobCheck = canStartJob(userId)
    if (!jobCheck.allowed) {
      return NextResponse.json({ error: jobCheck.reason }, { status: 429 })
    }

    const supabase = createAdminClient()

    const creditCost = STYLE_COSTS[style] || 3

    // Verifica creditele
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < creditCost) {
      return NextResponse.json(
        { error: `Credite insuficiente. Ai nevoie de ${creditCost} credite.` },
        { status: 400 }
      )
    }

    // Ia produsul
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
    }

    // Colecteaza imaginea de referinta - prioritate: parametrul direct > DB
    let refImageUrl: string | null = null

    // 1. Din request (trimis direct din frontend)
    if (reference_image_url && typeof reference_image_url === 'string') {
      refImageUrl = reference_image_url
    }
    // 2. Din produs (salvat in DB)
    else if (product.original_images && Array.isArray(product.original_images) && product.original_images.length > 0) {
      refImageUrl = product.original_images[0]
    }

    // BLOCAM daca nu avem imagine de referinta
    if (!refImageUrl) {
      return NextResponse.json(
        { error: 'Imaginea de referință lipsește. Încarcă o imagine a produsului înainte de a genera.' },
        { status: 400 }
      )
    }

    const referenceImages = [refImageUrl]

    // Construieste promptul
    const prompt = buildImagePrompt({
      title: product.optimized_title || product.original_title,
      category: product.category,
      style,
      description: product.optimized_short_description || product.original_description,
      hasReferenceImage: true,
    })

    // Trimite la KIE    // Creaza inregistrarea in DB
    const { data: imageRecord } = await supabase
      .from('generated_images')
      .insert({
        product_id,
        user_id: userId,
        style,
        prompt,
        original_image_url: refImageUrl,
        status: 'processing',
        credits_used: creditCost,
      })
      .select()
      .single()

    // Trimite catre KIE API
    const jobKey = `${userId}:image:${product_id}`
    if (!markJobRunning(jobKey)) {
      return NextResponse.json({ error: 'O imagine este deja în curs de generare pentru acest produs.' }, { status: 409 })
    }

    const kie = new KieClient()
    const startTime = Date.now()

    let resultUrls: string[] | null
    try {
      const taskId = await kie.createImageTask(prompt, referenceImages, {
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
      })

      // Asteapta rezultatul (polling)
      resultUrls = await kie.waitForTask(taskId)
    } catch (err) {
      markJobDone(jobKey)
      throw err
    }
    markJobDone(jobKey)

    if (!resultUrls || resultUrls.length === 0) {
      await supabase
        .from('generated_images')
        .update({ status: 'failed' })
        .eq('id', imageRecord!.id)

      return NextResponse.json({ error: 'Nu s-a generat nicio imagine' }, { status: 500 })
    }

    const processingTime = Date.now() - startTime
    const generatedUrl = resultUrls[0]

    // Actualizeaza inregistrarea
    await supabase
      .from('generated_images')
      .update({
        generated_image_url: generatedUrl,
        status: 'completed',
        processing_time_ms: processingTime,
        quality_score: 85,
      })
      .eq('id', imageRecord!.id)

    // Scade creditele
    const newCredits = user.credits - creditCost
    await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId)

    // Salveaza tranzactia
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -creditCost,
      balance_after: newCredits,
      description: `Generare imagine ${style}: ${product.optimized_title || product.original_title}`,
      reference_type: 'image_generation',
      reference_id: imageRecord!.id,
    })

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord!.id,
        generated_image_url: generatedUrl,
        style,
        status: 'completed',
        processing_time_ms: processingTime,
      },
      credits_remaining: newCredits,
    })
  } catch (err) {
    console.error('Generate image error:', err)
    return NextResponse.json(
      { error: 'Eroare la generarea imaginii: ' + (err as Error).message },
      { status: 500 }
    )
  }
}