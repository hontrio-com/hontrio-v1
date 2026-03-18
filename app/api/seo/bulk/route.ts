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
ALWAYS respond STRICTLY with valid JSON, no markdown, no backticks, no text outside JSON.`
}
const SEO_BULK_SYSTEM_PROMPT = buildBulkSeoPrompt('ro')

function buildBulkPrompt(product: any): string {
  const title = product.original_title || ''
  const description = (product.original_description || '').replace(/<[^>]*>/g, '').substring(0, 600)
  const shortDesc = (product.original_short_description || '').replace(/<[^>]*>/g, '').substring(0, 200)
  const category = product.category || 'Nespecificata'
  const price = product.price ? `${product.price} RON` : ''

  return `PRODUS:\nTitlu: "${title}"\nCategorie: ${category}${price ? `\nPret: ${price}` : ''}\n${shortDesc ? `Descriere scurta: ${shortDesc}` : ''}\n${description ? `Descriere: ${description}` : ''}\n\nGenereaza toate campurile SEO pentru acest produs. Returneaza STRICT JSON:\n{\n  "optimized_title": "titlu 50-70 caractere, natural si persuasiv",\n  "meta_description": "meta max 155 caractere cu CTA",\n  "optimized_short_description": "2-4 propozitii care conving la cumparare",\n  "optimized_long_description": "HTML structurat cu h3/ul/li, min 200 cuvinte",\n  "focus_keyword": "2-4 cuvinte cheie principale",\n  "secondary_keywords": ["keyword1", "keyword2", "keyword3"],\n  "seo_suggestions": ["sugestie practica 1", "sugestie practica 2"]\n}`
}


// Post-procesare: ajustează dimensiuni pentru scor maxim
function postProcessSeo(r: Record<string, any>): Record<string, any> {
  const kw = (r.focus_keyword || '').trim().toLowerCase()
  
  // Title: 50-70 chars + keyword
  if (r.optimized_title) {
    let t = r.optimized_title.trim()
    if (kw && !t.toLowerCase().includes(kw)) t = kw.charAt(0).toUpperCase() + kw.slice(1) + ' — ' + t
    if (t.length > 70) t = t.substring(0, 67).replace(/\s+\S*$/, '') + '...'
    if (t.length < 50) t += ' | Calitate Premium Online'
    if (t.length > 70) t = t.substring(0, 70)
    r.optimized_title = t
  }
  
  // Meta: 120-155 chars + keyword
  if (r.meta_description) {
    let m = r.meta_description.trim()
    if (kw && !m.toLowerCase().includes(kw)) m = kw.charAt(0).toUpperCase() + kw.slice(1) + ' — ' + m
    if (m.length > 155) m = m.substring(0, 152).replace(/\s+\S*$/, '') + '...'
    if (m.length < 120) { if (!m.endsWith('.')) m += '.'; m += ' Comandă acum! Livrare rapidă.' }
    if (m.length > 155) m = m.substring(0, 155)
    r.meta_description = m
  }
  
  // Short desc: >= 80 chars
  if (r.optimized_short_description) {
    const plain = r.optimized_short_description.replace(/<[^>]*>/g, ' ').trim()
    if (plain.length < 80) r.optimized_short_description += ' Produs de calitate, ideal pentru nevoile tale.'
  }
  
  // Focus keyword: ensure set
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
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: buildBulkSeoPrompt(user?.brand_language || 'ro') },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 2000,
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