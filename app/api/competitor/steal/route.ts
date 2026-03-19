import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

const CREDIT_COST = 1

const FIELD_RULES: Record<string, { label: string; minLen: number; maxLen: number; instruction: string }> = {
  title: {
    label: 'SEO Title',
    minLen: 50,
    maxLen: 70,
    instruction: 'The title must be 50-70 characters, contain the main keyword, be persuasive and natural. Do NOT use quotes in the output.',
  },
  meta_description: {
    label: 'Meta Description',
    minLen: 120,
    maxLen: 155,
    instruction: 'The meta description must be 120-155 characters, contain a clear benefit and an implicit CTA. Do NOT use quotes in the output.',
  },
  focus_keyword: {
    label: 'Focus Keyword',
    minLen: 10,
    maxLen: 60,
    instruction: 'The focus keyword must be 2-4 words, natural, specific for purchase intent. Do NOT use quotes in the output.',
  },
}

// POST — generates an improved variant compared to the competitor's version
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const limit = await rateLimitExpensive(userId, 'steal')
    if (!limit.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

    const { product_id, field, my_current, competitor_value, competitor_url, apply } = await request.json()

    if (!field || !competitor_value) {
      return NextResponse.json({ error: 'Fields field and competitor_value are required' }, { status: 400 })
    }

    const rule = FIELD_RULES[field]
    if (!rule) {
      return NextResponse.json({ error: `Field "${field}" is not supported` }, { status: 400 })
    }

    const safeValue = (competitor_value || '').toString().substring(0, 1000)

    const supabase = createAdminClient()

    // Check credits
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < CREDIT_COST) {
      return NextResponse.json(
        { error: `Insufficient credits (required: ${CREDIT_COST})` },
        { status: 400 }
      )
    }

    // Get product context if available
    let productContext = ''
    if (product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('original_title, optimized_title, category, focus_keyword')
        .eq('id', product_id)
        .eq('user_id', userId)
        .single()

      if (product) {
        productContext = `
Product: "${product.optimized_title || product.original_title}"
Category: ${product.category || 'unspecified'}
Current focus keyword: ${product.focus_keyword || 'not set'}`
      }
    }

    const prompt = `You are a senior SEO expert for eCommerce.
Generate a variant that is superior to both my current version and the competitor's version.

FIELD: ${rule.label}
RULE: ${rule.instruction}
${productContext ? `\nPRODUCT CONTEXT:${productContext}` : ''}

MY CURRENT VERSION: "${my_current || 'not filled'}"
COMPETITOR VERSION: "${safeValue}"
COMPETITOR URL: ${competitor_url || '—'}

Generate a variant that is better than both.
Respond STRICT valid JSON only, no other text:
{
  "improved_value": "generated variant without quotes in the text",
  "explanation": "Why it is better in max 15 words",
  "char_count": ${0}
}

important: char_count must be the real length of improved_value in characters.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 400,
    })

    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    let result: any
    try {
      result = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Generation error. Please try again.' }, { status: 500 })
    }

    // Calculate real char_count (not the one provided by GPT)
    const improvedValue = (result.improved_value || '').trim()
    result.improved_value = improvedValue
    result.char_count = improvedValue.length

    // If apply=true and product_id exists, save directly to product
    if (apply && product_id && improvedValue) {
      const fieldMap: Record<string, string> = {
        title: 'optimized_title',
        meta_description: 'meta_description',
        focus_keyword: 'focus_keyword',
      }
      const dbField = fieldMap[field]
      if (dbField) {
        await supabase
          .from('products')
          .update({ [dbField]: improvedValue })
          .eq('id', product_id)
          .eq('user_id', userId)
      }
    }

    // Deduct credit
    const newBalance = user.credits - CREDIT_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -CREDIT_COST,
      balance_after: newBalance,
      description: `Steal This — ${rule.label}`,
      reference_type: 'competitor_steal',
      reference_id: product_id || null,
    })

    return NextResponse.json({
      success: true,
      improved_value: result.improved_value,
      explanation: result.explanation || '',
      char_count: result.char_count,
      credits_remaining: newBalance,
    })

  } catch (err) {
    console.error('[Steal]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
