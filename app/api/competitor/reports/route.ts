import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { normalizeUrl, calcCompetitorScore } from '@/lib/competitor/url-utils'

const CREDIT_COST = 3

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { competitor_url, my_analysis, competitor_analysis } = await request.json()
    if (!competitor_url) return NextResponse.json({ error: 'URL competitor lipsește' }, { status: 400 })

    // Check credits
    const { data: user } = await supabase.from('users').select('credits, name, email').eq('id', userId).single()
    if (!user || user.credits < CREDIT_COST) {
      return NextResponse.json({ error: `Credite insuficiente (necesare: ${CREDIT_COST})` }, { status: 400 })
    }

    // Get store info
    const { data: store } = await supabase
      .from('stores').select('store_url').eq('user_id', userId).single()

    const myScore = my_analysis ? calcCompetitorScore(my_analysis) : 0
    const theirScore = competitor_analysis ? calcCompetitorScore(competitor_analysis) : 0

    const prompt = `Generează un raport SEO Battle complet și profesional în română.

MAGAZIN MEU (${store?.store_url || 'necunoscut'}):
- Scor SEO: ${myScore}/100
- Titlu: "${my_analysis?.title || 'necompletat'}"
- Meta: "${my_analysis?.meta_description || 'necompletat'}"
- Keywords: ${JSON.stringify(my_analysis?.focus_keywords || [])}
- Puncte forte: ${JSON.stringify(my_analysis?.strengths || [])}

COMPETITOR (${competitor_url}):
- Scor SEO: ${theirScore}/100
- Titlu: "${competitor_analysis?.title || 'nedetectat'}"
- Meta: "${competitor_analysis?.meta_description || 'nedetectat'}"
- Keywords: ${JSON.stringify(competitor_analysis?.focus_keywords || [])}
- Puncte forte: ${JSON.stringify(competitor_analysis?.strengths || [])}

Răspunde STRICT JSON valid cu raportul complet:
{
  "executive_summary": "Paragraf executiv de 3-4 propoziții cu concluziile principale",
  "overall_winner": "tu | competitor | egal",
  "score_breakdown": {
    "title_seo": { "you": 0, "them": 0, "max": 25, "winner": "tu|competitor|egal" },
    "meta_seo": { "you": 0, "them": 0, "max": 25, "winner": "tu|competitor|egal" },
    "keywords": { "you": 0, "them": 0, "max": 20, "winner": "tu|competitor|egal" },
    "structure": { "you": 0, "them": 0, "max": 15, "winner": "tu|competitor|egal" },
    "content": { "you": 0, "them": 0, "max": 15, "winner": "tu|competitor|egal" }
  },
  "strengths_mine": ["S1", "S2", "S3"],
  "weaknesses_mine": ["W1", "W2", "W3"],
  "strengths_competitor": ["S1", "S2"],
  "immediate_actions": [
    { "priority": 1, "action": "Acțiune concretă", "impact": "mare|mediu|mic", "effort": "mic|mediu|mare" },
    { "priority": 2, "action": "...", "impact": "mare", "effort": "mic" },
    { "priority": 3, "action": "...", "impact": "mediu", "effort": "mediu" },
    { "priority": 4, "action": "...", "impact": "mediu", "effort": "mic" }
  ],
  "long_term_strategy": "Strategie pe termen lung în 2-3 propoziții"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    })

    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    let reportData: any
    try { reportData = JSON.parse(raw) } catch { reportData = {} }

    // Build full report object
    const report = {
      generated_at: new Date().toISOString(),
      user_name: user.name,
      my_store_url: store?.store_url || '',
      competitor_url,
      my_score: myScore,
      competitor_score: theirScore,
      my_analysis,
      competitor_analysis,
      ...reportData,
    }

    // Save report
    const { data: savedReport } = await supabase
      .from('competitor_reports')
      .insert({ user_id: userId, competitor_url, report_data: report })
      .select('id')
      .single()

    // Deduct credits
    const newBalance = user.credits - CREDIT_COST
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId, type: 'usage', amount: -CREDIT_COST, balance_after: newBalance,
      description: `Raport SEO Battle: ${competitor_url}`,
      reference_type: 'competitor_report',
    })

    return NextResponse.json({
      success: true,
      report_id: savedReport?.id,
      report,
      credits_remaining: newBalance,
    })
  } catch (err) {
    console.error('[Reports]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// GET - list past reports
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('competitor_reports')
      .select('id, competitor_url, generated_at, report_data->overall_winner, report_data->my_score, report_data->competitor_score')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ reports: [] })
    return NextResponse.json({ reports: data || [] })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}