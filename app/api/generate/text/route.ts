import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProductText } from '@/lib/openai/generate-text'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { validateAiInput, canStartJob, markJobRunning, markJobDone } from '@/lib/security/ai-guard'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: max 10 text generations per minute
    const limit = await rateLimitExpensive(userId, 'text')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe cereri. Așteaptă un minut.' }, { status: 429 })
    }

    // Concurrent job limit
    const jobCheck = canStartJob(userId)
    if (!jobCheck.allowed) {
      return NextResponse.json({ error: jobCheck.reason }, { status: 429 })
    }

    const { product_id } = await request.json()
    const supabase = createAdminClient()

    // Verifica creditele + ia setarile de brand
    const { data: user } = await supabase
      .from('users')
      .select('credits, business_name, brand_tone, brand_language, niche')
      .eq('id', userId)
      .single()

    if (!user || user.credits < 5) {
      return NextResponse.json(
        { error: 'Credite insuficiente. Ai nevoie de 5 credite.' },
        { status: 400 }
      )
    }

    // Ia produsul
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
    }

    // Cost guard: validate input sizes
    const inputCheck = validateAiInput({
      title: product.original_title,
      description: product.original_description,
    })
    if (!inputCheck.valid) {
      return NextResponse.json({ error: inputCheck.error }, { status: 400 })
    }

    // Track this job
    const jobKey = `${userId}:text:${product_id}`
    if (!markJobRunning(jobKey)) {
      return NextResponse.json({ error: 'Acest produs este deja în curs de procesare.' }, { status: 409 })
    }

    let generated
    try {
      // Genereaza textul cu OpenAI
      generated = await generateProductText({
        title: product.original_title,
        description: product.original_description,
        category: product.category,
        price: product.price,
        brand: {
          businessName: user.business_name,
          tone: user.brand_tone,
          language: user.brand_language,
          niche: user.niche,
        },
      })
    } finally {
      markJobDone(jobKey)
    }
    // Actualizeaza produsul
    const { error: updateError } = await supabase
      .from('products')
      .update({
        optimized_title: generated.optimized_title,
        meta_description: generated.meta_description,
        optimized_short_description: generated.optimized_short_description,
        optimized_long_description: generated.optimized_long_description,
        benefits: generated.benefits,
        seo_score: generated.seo_score,
        seo_suggestions: generated.seo_suggestions,
        status: 'optimized',
      })
      .eq('id', product_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Eroare la salvarea textului' }, { status: 500 })
    }

    // Scade creditele atomic — previne race conditions
    const { data: newBalance } = await supabase.rpc('deduct_credits', { p_user_id: userId, p_amount: 5 })
    if (!newBalance || newBalance === -1) {
      // Credits were consumed between our check and now — rare but possible
      console.warn('[generate/text] Credit race condition detected for user', userId)
      // Still return success since work is done — log for reconciliation
    }
    const creditsRemaining = typeof newBalance === 'number' && newBalance >= 0 ? newBalance : (user.credits - 5)

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -5,
      balance_after: creditsRemaining,
      description: `Generare text: ${product.original_title}`,
      reference_type: 'text_generation',
      reference_id: product_id,
    })

    return NextResponse.json({
      message: 'Text generat cu succes',
      generated,
      credits_remaining: creditsRemaining,
    })
  } catch (err) {
    console.error('Generate text error:', err)
    return NextResponse.json(
      { error: 'Eroare la generarea textului' },
      { status: 500 }
    )
  }
}