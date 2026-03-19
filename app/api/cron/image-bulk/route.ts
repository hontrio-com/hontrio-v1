import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { KieClient } from '@/lib/kie/client'
import { decrypt } from '@/lib/security/encryption'

const STYLE_COSTS: Record<string, number> = {
  white_bg: 2, lifestyle: 3, premium_dark: 3, industrial: 3, seasonal: 4, manual: 3,
}

// Processes up to 3 bulk items per cron run (stays within Vercel timeout)
// Schedule: every 5 minutes via vercel.json
export async function GET(request: Request) {
  // Vercel cron authentication — skip if CRON_SECRET not configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  let processed = 0
  let failed = 0

  try {
    // Find active bulk jobs first, then get their queued items
    const { data: activeJobs } = await supabase
      .from('image_bulk_jobs')
      .select('id')
      .in('status', ['queued', 'processing'])
      .limit(10)

    if (!activeJobs?.length) {
      return NextResponse.json({ message: 'No active jobs', processed: 0 })
    }

    const activeJobIds = activeJobs.map((j: any) => j.id)

    const { data: items } = await supabase
      .from('image_bulk_items')
      .select(`
        *,
        image_bulk_jobs(style, auto_publish, status, user_id),
        products(id, original_title, optimized_title, category, original_images, original_description, optimized_short_description, external_id)
      `)
      .eq('status', 'queued')
      .in('job_id', activeJobIds)
      .order('created_at', { ascending: true })
      .limit(3) // Process max 3 per run

    if (!items?.length) {
      return NextResponse.json({ message: 'No items to process', processed: 0 })
    }

    for (const item of items) {
      const job = item.image_bulk_jobs as any
      const product = item.products as any

      if (!job || !product) {
        await supabase.from('image_bulk_items').update({ status: 'skipped' }).eq('id', item.id)
        continue
      }

      try {
        // Mark item as generating
        await supabase
          .from('image_bulk_items')
          .update({ status: 'generating', started_at: new Date().toISOString(), attempt_count: (item.attempt_count || 0) + 1 })
          .eq('id', item.id)

        // Mark job as processing if not already
        await supabase
          .from('image_bulk_jobs')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', item.job_id)
          .eq('status', 'queued')

        const userId = item.user_id
        const style = job.style
        const creditCost = STYLE_COSTS[style] || 3

        // Check credits
        const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single()
        if (!user || user.credits < creditCost) {
          await supabase.from('image_bulk_items').update({ status: 'failed', error_message: 'Insufficient credits' }).eq('id', item.id)
          await supabase.from('image_bulk_jobs').update({ status: 'failed' }).eq('id', item.job_id)
          failed++
          continue
        }

        // Get reference image
        const refImageUrl = product.original_images?.[0]
        if (!refImageUrl) {
          await supabase.from('image_bulk_items').update({ status: 'skipped', error_message: 'No reference image found' }).eq('id', item.id)
          await incrementJobCounters(supabase, item.job_id, 'completed')
          continue
        }

        // Build GPT prompt
        const productTitle = product.optimized_title || product.original_title || 'Product'
        const detailedPrompt = await buildPromptForBulk(productTitle, product.category, product.optimized_short_description || product.original_description, style)

        // Create image record
        const { data: imgRecord } = await supabase
          .from('generated_images')
          .insert({
            user_id: userId,
            product_id: product.id,
            style,
            original_image_url: refImageUrl,
            prompt: detailedPrompt,
            status: 'processing',
            credits_used: creditCost,
          })
          .select()
          .single()

        if (!imgRecord) throw new Error('Failed to create image record')

        // Generate with KIE
        const kie = new KieClient()
        const taskId = await kie.createImageTask(detailedPrompt, [refImageUrl], {
          aspect_ratio: '1:1', resolution: '1K', output_format: 'png',
        })

        // Wait for result (cron has up to 60s per item budget)
        const resultUrls = await kie.waitForTask(taskId, 55000)
        if (!resultUrls?.length) throw new Error('No image generated')

        const generatedUrl = resultUrls[0]

        // Update image record
        await supabase.from('generated_images').update({
          generated_image_url: generatedUrl,
          status: 'completed',
          seed: taskId,
        }).eq('id', imgRecord.id)

        // Update bulk item
        await supabase.from('image_bulk_items').update({
          status: 'completed',
          generated_image_id: imgRecord.id,
          completed_at: new Date().toISOString(),
        }).eq('id', item.id)

        // Deduct credits
        const newBalance = user.credits - creditCost
        await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
        await supabase.from('credit_transactions').insert({
          user_id: userId, type: 'usage', amount: -creditCost, balance_after: newBalance,
          description: `Bulk imagine ${style}: ${productTitle}`,
          reference_type: 'image_generation', reference_id: imgRecord.id,
        })
        await supabase.rpc('increment_bulk_credits', { job_id: item.job_id, amount: creditCost })

        // Auto-publish to WooCommerce if enabled
        if (job.auto_publish && product.external_id) {
          await autoPublishToWoo(supabase, userId, product, generatedUrl, imgRecord.id)
        }

        await incrementJobCounters(supabase, item.job_id, 'completed')
        processed++
      } catch (err: any) {
        console.error(`[BulkCron] Item ${item.id} failed:`, err)
        await supabase.from('image_bulk_items').update({
          status: 'failed',
          error_message: err.message?.substring(0, 200),
        }).eq('id', item.id)
        await incrementJobCounters(supabase, item.job_id, 'failed')
        failed++
      }
    }

    // Check and finalize any completed jobs
    await finalizeCompletedJobs(supabase)

    return NextResponse.json({ success: true, processed, failed })
  } catch (err: any) {
    console.error('[BulkCron] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function incrementJobCounters(supabase: any, jobId: string, type: 'completed' | 'failed') {
  const field = type === 'completed' ? 'completed_items' : 'failed_items'
  // Use raw SQL increment to avoid race conditions
  await supabase.rpc('increment_job_counter', { job_id: jobId, counter_name: field })
}

async function finalizeCompletedJobs(supabase: any) {
  const { data: jobs } = await supabase
    .from('image_bulk_jobs')
    .select('id, total_items, completed_items, failed_items')
    .eq('status', 'processing')

  for (const job of jobs || []) {
    const done = (job.completed_items || 0) + (job.failed_items || 0)
    if (done >= job.total_items) {
      await supabase.from('image_bulk_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }
  }
}

async function autoPublishToWoo(supabase: any, userId: string, product: any, imageUrl: string, imageId: string) {
  try {
    const { data: store } = await supabase.from('stores').select('store_url, api_key, api_secret').eq('user_id', userId).single()
    if (!store || !product.external_id) return

    const wooUrl = store.store_url.replace(/\/$/, '')

    let ck: string
    try { ck = decrypt(store.api_key) } catch { ck = store.api_key }
    ck = (ck || '').trim()

    let cs: string
    try { cs = decrypt(store.api_secret) } catch { cs = store.api_secret }
    cs = (cs || '').trim()

    const authParams = `consumer_key=${encodeURIComponent(ck)}&consumer_secret=${encodeURIComponent(cs)}`

    await fetch(`${wooUrl}/wp-json/wc/v3/products/${product.external_id}?${authParams}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [{ src: imageUrl, name: product.optimized_title || product.original_title, alt: product.optimized_title }] }),
      signal: AbortSignal.timeout(15000),
    })

    await supabase.from('generated_images').update({ status: 'published', wc_published_at: new Date().toISOString() }).eq('id', imageId)
  } catch(e) { console.error('[image-bulk] autoPublishToWoo error:', e) }
}

async function buildPromptForBulk(title: string, category: string | null, description: string | null, style: string): Promise<string> {
  const cleanDesc = description?.replace(/<[^>]*>/g, '').substring(0, 500) || 'Not available'
  const styleMap: Record<string, string> = {
    white_bg: 'pure white seamless background, professional e-commerce studio photography, three-point lighting',
    lifestyle: 'aspirational lifestyle photography in natural real-world context',
    premium_dark: 'high-end dark premium luxury advertising, dramatic lighting, deep dark background',
    industrial: 'raw industrial artisan authenticity, natural materials, directional lighting',
    seasonal: 'festive seasonal holiday photography, warm lighting, seasonal props',
    manual: 'professional product photography',
  }

  const prompt = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Write a detailed product photography prompt for: "${title}" (${category || 'general'}).
Description: ${cleanDesc}
Style: ${styleMap[style] || styleMap.white_bg}
Start with: "Reproduce the EXACT product from the reference image with absolute fidelity"
Be specific about lighting, camera angle, materials. 200-300 words only.`,
    }],
    temperature: 0.5,
    max_tokens: 400,
  })

  return prompt.choices[0].message.content?.trim() || `Professional product photo of ${title}`
}