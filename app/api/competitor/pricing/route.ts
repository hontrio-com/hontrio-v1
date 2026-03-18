import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { normalizeUrl } from '@/lib/competitor/url-utils'

const CREDIT_COST = 2

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { competitor_url, my_url } = await request.json()
    if (!competitor_url || !my_url) return NextResponse.json({ error: 'URLs are required' }, { status: 400 })

    // Check credits
    const { data: user } = await supabase.from('users').select('credits').eq('id', userId).single()
    if (!user || user.credits < CREDIT_COST) {
      return NextResponse.json({ error: `Insufficient credits (required: ${CREDIT_COST})` }, { status: 400 })
    }

    const [myHtml, theirHtml] = await Promise.all([
      fetchHtml(normalizeUrl(my_url)),
      fetchHtml(normalizeUrl(competitor_url)),
    ])

    const myText = stripHtml(myHtml || '').substring(0, 3000)
    const theirText = stripHtml(theirHtml || '').substring(0, 3000)

    // Extract prices from HTML directly
    const myPrices = extractPrices(myHtml || '')
    const theirPrices = extractPrices(theirHtml || '')

    // Get user's product prices from DB
    const { data: products } = await supabase
      .from('products')
      .select('optimized_title, price')
      .eq('user_id', userId)
      .not('price', 'is', null)
      .order('price', { ascending: false })
      .limit(20)

    const myProductPrices = (products || []).map((p: any) => `${p.optimized_title}: ${p.price} RON`)

    const prompt = `Ești expert în eCommerce România. Analizează comparativ două magazine.

MAGAZIN MEU:
Text: "${myText.substring(0, 1500)}"
Prețuri detectate HTML: ${JSON.stringify(myPrices.slice(0, 10))}
Produse din catalog: ${myProductPrices.slice(0, 10).join('; ')}

COMPETITOR:
Text: "${theirText.substring(0, 1500)}"
Prețuri detectate HTML: ${JSON.stringify(theirPrices.slice(0, 10))}

Analizează și răspunde STRICT JSON valid:
{
  "my_usps": ["USP 1", "USP 2", "USP 3"],
  "competitor_usps": ["USP 1", "USP 2", "USP 3"],
  "missing_usps": ["Ce promite competitorul și eu nu menționez nicăieri"],
  "my_ctas": ["CTA 1 identificat", "CTA 2"],
  "competitor_ctas": ["CTA 1", "CTA 2"],
  "cta_recommendations": ["Îmbunătățire CTA 1", "Îmbunătățire CTA 2"],
  "price_positioning": "mai_ieftin | similar | mai_scump | necunoscut",
  "price_insight": "Text cu insight despre poziționarea de preț",
  "my_detected_prices": ${JSON.stringify(myPrices.slice(0, 5))},
  "their_detected_prices": ${JSON.stringify(theirPrices.slice(0, 5))},
  "pricing_recommendations": ["Recomandare 1 concretă", "Recomandare 2"]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 800,
    })

    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    let result: any
    try { result = JSON.parse(raw) }
    catch {
      result = {
        my_usps: [], competitor_usps: [], missing_usps: [],
        my_ctas: [], competitor_ctas: [], cta_recommendations: [],
        price_positioning: 'necunoscut', price_insight: '',
        my_detected_prices: myPrices.slice(0, 5),
        their_detected_prices: theirPrices.slice(0, 5),
        pricing_recommendations: [],
      }
    }

    // Deduct credits
    const newBalance = user.credits - CREDIT_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId, type: 'usage', amount: -CREDIT_COST, balance_after: newBalance,
      description: 'Competitor pricing & USP analysis',
      reference_type: 'competitor_pricing',
    })

    return NextResponse.json({ success: true, result, credits_remaining: newBalance })
  } catch (err) {
    console.error('[Pricing]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function extractPrices(html: string): number[] {
  const patterns = [
    /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?(\d[\d.,]+)\s*(lei|ron|RON)/gi,
    /(\d[\d.,]+)\s*(?:lei|ron|RON)/gi,
    /"price"\s*:\s*"?(\d[\d.,]+)"?/gi,
    /itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi,
  ]
  const prices: number[] = []
  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)]
    for (const m of matches) {
      const val = parseFloat(m[1].replace(',', '.'))
      if (!isNaN(val) && val > 0 && val < 100000) prices.push(val)
    }
    if (prices.length >= 10) break
  }
  return [...new Set(prices)].sort((a, b) => a - b).slice(0, 15)
}

function fetchHtml(url: string): Promise<string | null> {
  return fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    signal: AbortSignal.timeout(8000),
  }).then(r => r.ok ? r.text() : null).catch(() => null)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}