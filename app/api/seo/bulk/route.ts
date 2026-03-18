import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { calculateSeoScore } from '@/lib/seo/score'
import { getAILanguage } from '@/lib/i18n/ai-languages'

// Costul per produs la bulk (= 5 credite, acelasi ca "all" sections individual)
const CREDIT_COST_PER_PRODUCT = 5

function buildBulkSeoPrompt(lang: string): string {
  const L = getAILanguage(lang)
  return `${L.seoExpertRole}
You generate complete, quality SEO content for eCommerce products.
${L.seoLanguageInstruction}

STRICT REQUIREMENTS — follow exactly or the output is invalid:
- optimized_title: EXACTLY 50-70 characters (count carefully). Must contain the focus_keyword.
- meta_description: EXACTLY 120-155 characters (count carefully). Must contain the focus_keyword.
- optimized_short_description: plain text, minimum 80 characters, no HTML.
- optimized_long_description: HTML with h3/ul/li, minimum 200 words (count carefully).
- focus_keyword: 2-4 words, the main keyword phrase for this product.
- keyword density in short+long description: 0.5-2.5% (focus_keyword occurrences / total words).

Self-verify before responding:
1. Count characters in optimized_title — must be 50-70.
2. Count characters in meta_description — must be 120-155.
3. Count words in optimized_long_description — must be 200+.
4. Confirm focus_keyword appears in both title and meta_description.

ALWAYS respond STRICTLY with valid JSON, no markdown, no backticks, no text outside JSON.`
}

function buildBulkPrompt(product: any): string {
  const title = product.original_title || ''
  const description = (product.original_description || '').replace(/<[^>]*>/g, '').substring(0, 600)
  const shortDesc = (product.original_short_description || '').replace(/<[^>]*>/g, '').substring(0, 200)
  const category = product.category || 'Nespecificata'
  const price = product.price ? `${product.price} RON` : ''

  return `PRODUCT:
Title: "${title}"
Category: ${category}${price ? `\nPrice: ${price}` : ''}${shortDesc ? `\nShort description: ${shortDesc}` : ''}${description ? `\nDescription: ${description}` : ''}

Generate all SEO fields for this product. Self-verify character counts before responding. Return STRICT JSON only:
{
  "optimized_title": "title EXACTLY 50-70 chars, must contain focus_keyword",
  "meta_description": "meta EXACTLY 120-155 chars with CTA, must contain focus_keyword",
  "optimized_short_description": "plain text min 80 chars, 2-4 sentences that convince to buy",
  "optimized_long_description": "HTML with h3/ul/li, minimum 200 words",
  "focus_keyword": "2-4 main keyword words",
  "secondary_keywords": ["keyword1", "keyword2", "keyword3"],
  "seo_suggestions": ["practical suggestion 1", "practical suggestion 2"]
}`
}


// Post-procesare minimală: trim dacă depășesc limitele, fără adăugiri de text generic
function postProcessSeo(r: Record<string, any>): Record<string, any> {
  // Title: trim if over limit only
  if (r.optimized_title) {
    let t = r.optimized_title.trim()
    if (t.length > 70) t = t.substring(0, 67).replace(/\s+\S*$/, '') + '...'
    r.optimized_title = t
  }

  // Meta: trim if over limit only
  if (r.meta_description) {
    let m = r.meta_description.trim()
    if (m.length > 155) m = m.substring(0, 152).replace(/\s+\S*$/, '') + '...'
    r.meta_description = m
  }

  // Focus keyword: fallback only if completely missing
  if (!r.focus_keyword || r.focus_keyword.trim().length < 2) {
    r.focus_keyword = (r.optimized_title || '').split(/[\s—|–-]+/).filter((w: string) => w.length > 3).slice(0, 3).join(' ').toLowerCase()
  }

  return r
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const limit = await rateLimitExpensive(userId, 'seo-bulk')
    if (!limit.success) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
    }

    const { product_ids } = await request.json()

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'product_ids missing or empty' }, { status: 400 })
    }

    const ids = product_ids.slice(0, 20)
    const totalCost = ids.length * CREDIT_COST_PER_PRODUCT

    const supabase = createAdminClient()

    const { data: user } = await supabase
      .from('users')
      .select('credits, brand_language')
      .eq('id', userId)
      .single()

    if (!user || user.credits < totalCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Required: ${totalCost} (${ids.length} products x ${CREDIT_COST_PER_PRODUCT} cr.)` },
        { status: 400 }
      )
    }

    // Deducem creditele UPFRONT — refund la final pentru cele eșuate
    const upfrontBalance = user.credits - totalCost
    await supabase.from('users').update({ credits: upfrontBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -totalCost,
      balance_after: upfrontBalance,
      description: `SEO Bulk — ${ids.length} products (reservation)`,
      reference_type: 'seo_bulk',
    })

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .eq('user_id', userId)

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No valid products found' }, { status: 404 })
    }

    let succeeded = 0
    let failed = 0
    let creditsUsed = 0

    for (const product of products) {
      try {
        const prompt = buildBulkPrompt(product)

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: buildBulkSeoPrompt(user?.brand_language || 'ro') },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 2500,
        })

        const raw = completion.choices[0].message.content?.trim() || '{}'
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        let result: Record<string, any>
        try {
          result = JSON.parse(cleaned)
        } catch {
          console.error(`[SEO Bulk] JSON parse error for product ${product.id}:`, cleaned.substring(0, 200))
          failed++
          continue
        }

        result = postProcessSeo(result)

        const { score } = calculateSeoScore({
          title:            result.optimized_title || product.original_title || '',
          metaDescription:  result.meta_description || '',
          shortDescription: result.optimized_short_description || '',
          longDescription:  result.optimized_long_description || '',
          focusKeyword:     result.focus_keyword || '',
        })

        const { error: saveErr } = await supabase
          .from('products')
          .update({
            optimized_title:             result.optimized_title || null,
            meta_description:            result.meta_description || null,
            optimized_short_description: result.optimized_short_description || null,
            optimized_long_description:  result.optimized_long_description || null,
            focus_keyword:               result.focus_keyword || null,
            secondary_keywords:          result.secondary_keywords || null,
            seo_suggestions:             result.seo_suggestions || null,
            seo_score:                   score,
            status:                      'optimized',
          })
          .eq('id', product.id)
          .eq('user_id', userId)

        if (saveErr) {
          console.error(`[SEO Bulk] DB save error for ${product.id}:`, saveErr.message)
          failed++
          continue
        }

        succeeded++
        creditsUsed += CREDIT_COST_PER_PRODUCT

      } catch (err: any) {
        console.error(`[SEO Bulk] Error for product ${product.id}:`, err?.message)
        failed++
      }
    }

    // Creditele au fost deduse la început — refund pentru cele eșuate
    if (failed > 0) {
      const refundAmount = failed * CREDIT_COST_PER_PRODUCT
      const { data: currentUser } = await supabase.from('users').select('credits').eq('id', userId).single()
      if (currentUser) {
        const newBal = currentUser.credits + refundAmount
        await supabase.from('users').update({ credits: newBal }).eq('id', userId)
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'refund',
          amount: refundAmount,
          balance_after: newBal,
          description: `SEO Bulk refund — ${failed} failed products`,
          reference_type: 'seo_bulk_refund',
        })
      }
    }

    const { data: finalUser } = await supabase.from('users').select('credits').eq('id', userId).single()
    return NextResponse.json({
      success:           true,
      succeeded,
      failed,
      credits_used:      succeeded * CREDIT_COST_PER_PRODUCT,
      credits_remaining: finalUser?.credits ?? 0,
    })

  } catch (err: any) {
    console.error('[SEO Bulk] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}