import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'

async function isValidWidgetOrigin(request: Request, userId: string, supabase: any): Promise<boolean> {
  const origin = request.headers.get('origin') || request.headers.get('referer') || ''
  if (!origin) return true // same-origin or server-to-server

  const { data: store } = await supabase.from('stores').select('store_url').eq('user_id', userId).single()
  if (!store?.store_url) return true // no store configured yet — allow

  try {
    const storeHost = new URL(store.store_url).hostname
    const reqHost = new URL(origin).hostname
    return reqHost === storeHost || origin.includes('hontrio.com') || origin.includes('localhost')
  } catch { return true }
}

// GET /api/agent/memory?userId=X&visitorId=Y
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const visitorId = searchParams.get('visitorId')

  if (!userId || !visitorId) {
    return NextResponse.json({ memory: null }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }

  try {
    const supabase = createAdminClient()

    const valid = await isValidWidgetOrigin(request, userId, supabase)
    if (!valid) return NextResponse.json({ memory: null }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } })

    const { data: memory } = await supabase
      .from('visitor_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('visitor_id', visitorId)
      .single()

    return NextResponse.json({ memory: memory || null }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch {
    return NextResponse.json({ memory: null }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
}

// POST /api/agent/memory — actualizare după sesiune
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId, visitorId, sessionId,
      messages,      // [{role, content}] — conversația completă
      searchQueries, // string[]
      productsShown, // string[] — product ids
      cartedProducts, // string[]
      intent,
    } = body

    if (!userId || !visitorId) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = createAdminClient()

    const valid = await isValidWidgetOrigin(request, userId, supabase)
    if (!valid) return NextResponse.json({ ok: false }, { status: 403 })

    // Cap messages to prevent cost abuse
    const safeMsgs = (messages || []).slice(0, 20)

    // 1. Obține memoria existentă
    const { data: existing } = await supabase
      .from('visitor_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('visitor_id', visitorId)
      .single()

    // 2. Generează rezumat AI dacă avem suficiente mesaje
    let newSummary = existing?.conversation_summary || null
    let newKeyFacts: any[] = existing?.key_facts || []

    if (safeMsgs.length >= 4) {
      try {
        const summaryRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Ești un sistem de memorie intern pentru un chatbot de magazin.
Analizează conversația și extrage context INTERN pentru viitoare conversații.

IMPORTANT: Rezumatul e folosit INTERN de AI ca context, NU e afișat clientului.
Scrie rezumatul ca note interne, la persoana 1 din perspectiva clientului.

Răspunde DOAR JSON:
{
  "summary": "Caut tigăi ceramice non-aderente, buget ~150 RON. Mă interesează branduri premium și livrare rapidă.",
  "facts": [
    "caută tigăi ceramice non-aderente",
    "buget aproximativ 150 RON",
    "preferă branduri premium",
    "interesat de livrare rapidă"
  ]
}`
            },
            {
              role: 'user',
              content: `Conversație:\n${safeMsgs.map((m: any) => `${m.role}: ${m.content}`).join('\n')}`
            }
          ],
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        })

        const parsed = JSON.parse(summaryRes.choices[0].message.content || '{}')
        if (parsed.summary) newSummary = parsed.summary
        if (parsed.facts?.length > 0) {
          const timestamp = new Date().toISOString()
          const newFacts = parsed.facts.map((f: string) => ({ fact: f, at: timestamp }))
          // Păstrăm max 20 de fapte, cele mai recente
          newKeyFacts = [...newFacts, ...(existing?.key_facts || [])].slice(0, 20)
        }
      } catch { /* continuă fără rezumat */ }
    }

    // 3. Actualizează categoriile preferate
    const updatedCategories = updateFrequencyList(
      existing?.preferred_categories || [],
      searchQueries || [],
      5
    )

    // 4. Merge produse văzute (max 50 cele mai recente)
    const updatedViewed = [
      ...(productsShown || []),
      ...(existing?.viewed_product_ids || [])
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 50)

    const updatedCarted = [
      ...(cartedProducts || []),
      ...(existing?.carted_product_ids || [])
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 50)

    // 5. Upsert memorie
    const isReturn = existing ? true : false
    const { error } = await supabase
      .from('visitor_memory')
      .upsert({
        user_id: userId,
        visitor_id: visitorId,
        total_sessions: (existing?.total_sessions || 0) + 1,
        total_messages: (existing?.total_messages || 0) + safeMsgs.length,
        last_seen_at: new Date().toISOString(),
        first_seen_at: existing?.first_seen_at || new Date().toISOString(),
        preferred_categories: updatedCategories,
        viewed_product_ids: updatedViewed,
        carted_product_ids: updatedCarted,
        conversation_summary: newSummary,
        key_facts: newKeyFacts,
        last_intent: intent || existing?.last_intent,
        return_count: isReturn ? (existing?.return_count || 0) + 1 : 0,
      }, { onConflict: 'user_id,visitor_id' })

    if (error) throw error

    // 6. Salvează sesiunea
    if (sessionId) {
      await supabase.from('visitor_sessions').upsert({
        user_id: userId,
        visitor_id: visitorId,
        session_id: sessionId,
        messages_count: safeMsgs.length,
        intents: intent ? [intent] : [],
        products_shown: productsShown || [],
        search_queries: searchQueries || [],
        messages_log: safeMsgs,
        ended_at: new Date().toISOString(),
      }, { onConflict: 'session_id' })
    }

    return NextResponse.json({ ok: true }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    console.error('[Memory]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

// Actualizează lista de frecvență (sortată după apariții)
function updateFrequencyList(existing: string[], newItems: string[], max: number): string[] {
  const freq: Record<string, number> = {}
  for (const item of existing) freq[item] = (freq[item] || 0) + 2  // boost existing
  for (const item of newItems) {
    const clean = item.toLowerCase().trim()
    if (clean.length > 2) freq[clean] = (freq[clean] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k)
}
