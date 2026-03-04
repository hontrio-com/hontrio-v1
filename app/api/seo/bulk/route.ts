import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

const CREDIT_COST = 3

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const limit = rateLimitExpensive(userId, 'competitor')
    if (!limit.success) return NextResponse.json({ error: 'Prea multe cereri.' }, { status: 429 })

    const { competitor_url, product_id } = await request.json()
    if (!competitor_url) return NextResponse.json({ error: 'URL competitor lipsește' }, { status: 400 })

    // Validate URL
    let parsed: URL
    try { parsed = new URL(competitor_url) } catch {
      return NextResponse.json({ error: 'URL invalid' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check credits
    const { data: user } = await supabase
      .from('users').select('credits').eq('id', userId).single()

    if (!user || user.credits < CREDIT_COST) {
      return NextResponse.json({ error: `Credite insuficiente. Necesare: ${CREDIT_COST}` }, { status: 400 })
    }

    // Fetch competitor page
    let html = ''
    try {
      const res = await fetch(competitor_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return NextResponse.json({ error: `Pagina competitorului returnează ${res.status}` }, { status: 400 })
      html = await res.text()
    } catch {
      return NextResponse.json({ error: 'Nu se poate accesa URL-ul competitorului' }, { status: 400 })
    }

    // Extract key SEO elements from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const h2Matches = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1]).slice(0, 5)
    const h3Matches = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)].map(m => m[1]).slice(0, 8)

    // Strip HTML tags and get body text
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000)

    const competitorData = {
      title: titleMatch?.[1]?.trim() || '',
      meta_description: metaDescMatch?.[1]?.trim() || '',
      h1: h1Match?.[1]?.trim() || '',
      h2s: h2Matches,
      h3s: h3Matches,
      body_preview: bodyText,
    }

    // Use AI to extract insights
    const prompt = `Analizează aceste date extrase de pe pagina unui competitor eCommerce și extrage insight-uri SEO valoroase.

DATE COMPETITOR:
Titlu: "${competitorData.title}"
Meta Description: "${competitorData.meta_description}"
H1: "${competitorData.h1}"
H2-uri: ${JSON.stringify(competitorData.h2s)}
H3-uri: ${JSON.stringify(competitorData.h3s)}
Text preview: "${competitorData.body_preview.substring(0, 1500)}"

Răspunde STRICT în JSON valid:
{
  "title": "${competitorData.title}",
  "meta_description": "${competitorData.meta_description}",
  "h1": "${competitorData.h1}",
  "headings": ${JSON.stringify([...competitorData.h2s, ...competitorData.h3s])},
  "focus_keywords": ["keyword1", "keyword2", "keyword3"],
  "keyword_density": {"keyword1": 2.3, "keyword2": 1.1},
  "content_length_estimate": 450,
  "strengths": ["Punct forte 1", "Punct forte 2", "Punct forte 3"],
  "weaknesses": ["Punct slab 1", "Punct slab 2"],
  "opportunities": ["Ce poți face mai bine 1", "Ce poți face mai bine 2", "Ce poți face mai bine 3"]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    })

    const raw = completion.choices[0].message.content?.trim() || '{}'
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let analysis: any
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      // Return raw data even if AI parse fails
      analysis = competitorData
    }

    // Deduct credits
    const newBalance = user.credits - CREDIT_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId, type: 'usage', amount: -CREDIT_COST, balance_after: newBalance,
      description: `Analiză competitor: ${parsed.hostname}`,
      reference_type: 'competitor_analysis',
      reference_id: product_id || null,
    })

    return NextResponse.json({
      success: true,
      competitor_url,
      analysis,
      credits_remaining: newBalance,
    })
  } catch (err) {
    console.error('[Competitor]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}