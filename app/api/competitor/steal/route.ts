import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

const CREDIT_COST = 1

const FIELD_RULES: Record<string, { label: string; minLen: number; maxLen: number; instruction: string }> = {
  title: {
    label: 'Titlu SEO',
    minLen: 50,
    maxLen: 70,
    instruction: 'Titlul trebuie să aibă 50-70 caractere, să conțină keyword-ul principal, să fie persuasiv și natural. NU folosi ghilimele în output.',
  },
  meta_description: {
    label: 'Meta Description',
    minLen: 120,
    maxLen: 155,
    instruction: 'Meta description trebuie să aibă 120-155 caractere, să conțină un beneficiu clar și un CTA implicit. NU folosi ghilimele în output.',
  },
  focus_keyword: {
    label: 'Focus Keyword',
    minLen: 10,
    maxLen: 60,
    instruction: 'Focus keyword trebuie să fie 2-4 cuvinte, natural, specific pentru intenție de cumpărare. NU folosi ghilimele în output.',
  },
}

// POST — generează o variantă îmbunătățită față de versiunea competitorului
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const limit = rateLimitExpensive(userId, 'steal')
    if (!limit.success) return NextResponse.json({ error: 'Prea multe cereri.' }, { status: 429 })

    const { product_id, field, my_current, competitor_value, competitor_url, apply } = await request.json()

    if (!field || !competitor_value) {
      return NextResponse.json({ error: 'Câmpurile field și competitor_value sunt obligatorii' }, { status: 400 })
    }

    const rule = FIELD_RULES[field]
    if (!rule) {
      return NextResponse.json({ error: `Câmpul "${field}" nu este suportat` }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verifică credite
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < CREDIT_COST) {
      return NextResponse.json(
        { error: `Credite insuficiente (necesare: ${CREDIT_COST})` },
        { status: 400 }
      )
    }

    // Ia contextul produsului dacă e disponibil
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
Produs: "${product.optimized_title || product.original_title}"
Categorie: ${product.category || 'nespecificată'}
Focus keyword actual: ${product.focus_keyword || 'nesetat'}`
      }
    }

    const prompt = `Ești expert SEO senior pentru eCommerce România.
Trebuie să generezi o variantă superioară atât față de varianta mea cât și față de a competitorului.

CÂMP: ${rule.label}
REGULĂ: ${rule.instruction}
${productContext ? `\nCONTEXT PRODUS:${productContext}` : ''}

VARIANTA MEA ACTUALĂ: "${my_current || 'necompletat'}"
VARIANTA COMPETITORULUI: "${competitor_value}"
URL COMPETITOR: ${competitor_url || '—'}

Generează o variantă care să fie mai bună decât ambele.
Răspunde STRICT JSON valid, fără alte cuvinte:
{
  "improved_value": "varianta generată fără ghilimele în text",
  "explanation": "De ce e mai bună în max 15 cuvinte",
  "char_count": ${0}
}

important: char_count trebuie să fie lungimea reală a improved_value în caractere.`

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
      return NextResponse.json({ error: 'Eroare la generare. Încearcă din nou.' }, { status: 500 })
    }

    // Calculează char_count real (nu cel dat de GPT)
    const improvedValue = (result.improved_value || '').trim()
    result.improved_value = improvedValue
    result.char_count = improvedValue.length

    // Dacă apply=true și există product_id, salvează direct în produs
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

    // Deduce credit
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
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}