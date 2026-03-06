import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { normalizeUrl } from '@/lib/competitor/url-utils'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

const CREDIT_COST = 2

// ─── POST — Keyword Gap Analysis ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const limit = rateLimitExpensive(userId, 'keywords-gap')
    if (!limit.success) return NextResponse.json({ error: 'Prea multe cereri. Așteaptă un minut.' }, { status: 429 })

    const { my_url, competitor_url } = await request.json()
    if (!my_url || !competitor_url) {
      return NextResponse.json({ error: 'URL-urile lipsesc' }, { status: 400 })
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

    // Descarcă ambele pagini simultan
    const [myHtml, theirHtml] = await Promise.all([
      fetchHtml(normalizeUrl(my_url)),
      fetchHtml(normalizeUrl(competitor_url)),
    ])

    // Extrage text vizibil din HTML
    const myText  = extractText(myHtml  || '').substring(0, 2500)
    const theirText = extractText(theirHtml || '').substring(0, 2500)

    // Extrage headings pentru context suplimentar
    const myHeadings    = extractHeadings(myHtml    || '')
    const theirHeadings = extractHeadings(theirHtml || '')

    // Ia și keywordurile existente din produsele userului din DB
    const { data: products } = await supabase
      .from('products')
      .select('focus_keyword, secondary_keywords, optimized_title, original_title')
      .eq('user_id', userId)
      .not('focus_keyword', 'is', null)
      .limit(30)

    const myDbKeywords = [
      ...(products || []).map(p => p.focus_keyword).filter(Boolean),
      ...(products || []).flatMap(p => p.secondary_keywords || []),
    ].slice(0, 20)

    const prompt = `Ești expert SEO pentru eCommerce România. Analizează gap-ul de keywords dintre două magazine.

MAGAZINUL MEU:
URL: ${normalizeUrl(my_url)}
Headings: ${JSON.stringify(myHeadings.slice(0, 8))}
Text: "${myText.substring(0, 1200)}"
Keywords din catalog: ${JSON.stringify(myDbKeywords)}

COMPETITOR:
URL: ${normalizeUrl(competitor_url)}
Headings: ${JSON.stringify(theirHeadings.slice(0, 8))}
Text: "${theirText.substring(0, 1200)}"

Analizează și identifică:
- Ce keywords folosește competitorul și eu NU
- Ce keywords am eu și competitorul NU
- Keywords comune
- Oportunități noi pe care nici unul nu le exploatează

Răspunde STRICT JSON valid, fără alte cuvinte:
{
  "gap_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "my_advantages": ["kw1", "kw2", "kw3"],
  "common_keywords": ["kw1", "kw2", "kw3"],
  "opportunities": ["kw nisa 1", "kw nisa 2", "kw nisa 3"],
  "analysis_summary": "Rezumat scurt al gap-ului SEO in 2-3 propozitii",
  "top_priority": "cel mai important keyword de adaugat imediat"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 700,
    })

    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    let result: any
    try {
      result = JSON.parse(raw)
    } catch {
      result = {
        gap_keywords: [],
        my_advantages: [],
        common_keywords: [],
        opportunities: [],
        analysis_summary: 'Analiza nu a putut fi procesată. Încearcă din nou.',
        top_priority: '',
      }
    }

    // Deduce credite
    const newBalance = user.credits - CREDIT_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -CREDIT_COST,
      balance_after: newBalance,
      description: `Keyword gap analysis: ${new URL(normalizeUrl(competitor_url)).hostname}`,
      reference_type: 'competitor_keywords',
    })

    return NextResponse.json({
      success: true,
      result,
      credits_remaining: newBalance,
    })

  } catch (err) {
    console.error('[Keywords Gap]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// ─── GET — Alertele existente (fostul conținut al acestui fișier, mutat corect) ──
// Alertele sunt acum la /api/competitor/alerts — această rută e doar pentru keywords

function fetchHtml(url: string): Promise<string | null> {
  return fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    signal: AbortSignal.timeout(8000),
  }).then(r => r.ok ? r.text() : null).catch(() => null)
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHeadings(html: string): string[] {
  const h1 = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map(m => m[1].trim())
  const h2 = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1].trim())
  const h3 = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)].map(m => m[1].trim())
  return [...h1, ...h2.slice(0, 5), ...h3.slice(0, 5)]
}