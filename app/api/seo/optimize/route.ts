import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

// ─── CREDIT COSTS ─────────────────────────────────────────────────────────────
const CREDIT_COSTS: Record<string, number> = {
  all: 5,
  title: 1,
  meta_description: 1,
  short_description: 2,
  long_description: 2,
  focus_keyword: 1,
}

// ─── MASTER SEO SYSTEM PROMPT ─────────────────────────────────────────────────
// Based on Google Search Quality Guidelines, E-E-A-T principles, and eCommerce best practices
const SEO_SYSTEM_PROMPT = `Ești un expert SEO senior specializat în eCommerce pentru piața românească, cu cunoștințe avansate despre:
- Google Search Quality Guidelines și E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
- Google Merchant Center și structured data (Product, Offer, AggregateRating în JSON-LD)
- Core Web Vitals și optimizarea pentru mobile-first indexing
- Analiza intenției de căutare (search intent) pentru cumpărători online
- Prevenirea duplicate content și canonicalizare corectă
- WooCommerce/Shopify SEO best practices

PRINCIPII FUNDAMENTALE pe care le aplici mereu:
1. PEOPLE-FIRST: Conținutul trebuie să fie util pentru oameni, nu să manipuleze algoritmii
2. UNICITATE: Evită descrierile identice de la producător; adaugă "information gain" real
3. INTENȚIE: Răspunde complet la ce caută cumpărătorul (ce este, pentru cine, cum se folosește, diferențiatori)
4. KEYWORD STRATEGY: Un topic principal (tip produs + brand + atribut diferențiator) în title, H1, primele propoziții — natural, nu stuffing
5. HTML SAFETY: Dacă conținutul original are HTML/tabele, optimizezi conținutul TEXT dar PĂSTREZI structura HTML identică
6. LUNGIME: Nu există lungime "corectă" — calitatea și utilitatea sunt criteriile, nu numărul de cuvinte

Răspunzi ÎNTOTDEAUNA în română, STRICT cu JSON valid, fără markdown, fără backticks.`

// ─── SECTION-SPECIFIC PROMPTS ─────────────────────────────────────────────────
function buildSectionPrompt(section: string, product: any): string {
  const originalTitle = product.original_title || ''
  const currentTitle = product.optimized_title || product.original_title || ''
  const category = product.category || 'Nespecificată'
  const price = product.price ? `${product.price} RON` : 'Nespecificat'
  const originalDesc = (product.original_description || '').replace(/<[^>]*>/g, '').substring(0, 800)
  const shortDesc = product.optimized_short_description || product.original_short_description || ''
  const currentMeta = product.meta_description || ''

  const context = `CONTEXT PRODUS:
Titlu original: "${originalTitle}"
Titlu curent optimizat: "${currentTitle}"
Categorie: ${category}
Preț: ${price}
Descriere originală (text): ${originalDesc || 'Lipsă'}
Meta description curentă: "${currentMeta}"`

  switch (section) {
    case 'title':
      return `${context}

TASK: Generează un titlu SEO optimizat pentru această pagină de produs eCommerce.

REGULI STRICTE (conform Google Search Quality Guidelines):
- Lungime: 50-70 caractere (ideal 55-60) — mai mult este trunchiat în SERP
- Include: tip produs + atribut diferențiator principal + brand (dacă relevant)
- Folosește cuvintele pe care CUMPĂRĂTORII le folosesc în căutări, nu jargon tehnic
- NU include prețul sau stocul (se schimbă frecvent)
- NU repeta cuvinte inutil — fiecare cuvânt trebuie să aibă scop
- NU keyword stuffing — titlul trebuie să sune natural și persuasiv
- Structură recomandată: [Tip Produs] [Atribut Cheie] – [Beneficiu/Diferențiator] | [Brand dacă există]
- Variante acceptabile: cu sau fără „|", cu „–" sau „-" ca separator

Returnează DOAR JSON:
{"optimized_title": "titlul generat"}`

    case 'meta_description':
      return `${context}

TASK: Generează o meta description optimizată SEO pentru această pagină de produs.

REGULI STRICTE (conform Google Search Guidelines pentru snippets):
- Lungime: MAXIM 155 caractere (ideal 140-155) — va fi trunchiat după această limită
- NU este un factor direct de ranking, dar influențează CTR (click-through rate)
- Trebuie să descrie pagina MAI BINE decât textul vizibil — altfel Google o ignoră
- Include: beneficiul principal + un diferențiator unic + call-to-action clar
- Exemple de CTA bune: "Comandă acum", "Livrare rapidă", "Garanție inclus", "Vezi oferta"
- Evita: keyword stuffing, propoziții generice identice cu alte produse
- Trebuie să fie orientat pe INTENȚIA de căutare (cumpărătorul vrea să cumpere, nu să se informeze)
- Ideal să menționezi un element de încredere: garanție, livrare, retur, autenticitate

Returnează DOAR JSON:
{"meta_description": "meta description generată"}`

    case 'short_description':
      return `${context}

TASK: Generează o descriere scurtă optimizată pentru produs (apare sub titlu în WooCommerce, înainte de butonul "Adaugă în coș").

REGULI STRICTE:
- Lungime: 2-4 propoziții, 50-120 cuvinte
- Aceasta este descrierea care CONVINGE cumpărătorul să adauge în coș
- Structură ideală: (1) Ce este + beneficiul principal → (2) Pentru cine este ideal → (3) 1-2 caracteristici diferențiatoare → (4) CTA sau element de încredere
- Folosește vocea activă și limbajul direct ("Tu primești...", "Ideal dacă...")
- PĂSTREAZĂ HTML-ul dacă originalul are formatare — optimizează doar textul, nu structura
- Include cuvântul cheie principal natural în primele 1-2 propoziții
- Evita clișee: "Produsul perfect", "Calitate superioară" fără substanță

IMPORTANT DESPRE HTML: Dacă scurtă descriere originală conține HTML (bold, liste, etc.), returnează HTML valid optimizat.

Returnează DOAR JSON:
{"optimized_short_description": "descrierea generată (text sau HTML dacă originalul era HTML)"}`

    case 'long_description': {
      const originalHtml = product.original_description || ''
      const hasHtml = /<[a-z][\s\S]*>/i.test(originalHtml)
      const htmlNote = hasHtml
        ? `\nATENȚIE: Descrierea originală conține HTML. PĂSTREAZĂ toate tagurile HTML, tabelele, listele IDENTICE. Optimizează DOAR textul din interiorul tagurilor — nu schimba structura, nu elimina taguri, nu adăuga taguri noi în afara celor existente.\n\nHTML ORIGINAL:\n${originalHtml.substring(0, 2000)}`
        : `\nDescrierea originală este text simplu. Creează HTML structurat cu taguri semantice.`

      return `${context}
${htmlNote}

TASK: ${hasHtml ? 'Optimizează SEO textul din HTML-ul existent' : 'Generează descriere lungă HTML structurată'}.

REGULI STRICTE (conform Google E-E-A-T și People-First Content):
- Structură ideală pentru descriere lungă (dacă creezi de la zero):
  → <h3> sau <h2>: Introducere + ce este produsul + pentru cine
  → <h3>: Caracteristici principale (în <ul><li>)
  → <h3>: Beneficii pentru utilizator (din perspectiva clientului)
  → <h3>: Mod de utilizare / instrucțiuni (dacă relevant)
  → <p>: Element de încredere + CTA final
- Minimum 200 cuvinte, ideal 300-500 pentru produse complexe
- Include cuvântul cheie principal în primul paragraf natural
- Include sinonime și variații naturale (nu stuffing)
- Evita conținut duplicat de la producător — adaugă "information gain" real
- Fiecare secțiune H3 trebuie să răspundă la o întrebare reală a cumpărătorului
- NU include prețuri (se schimbă) și NU face promisiuni false

Returnează DOAR JSON:
{"optimized_long_description": "HTML-ul complet optimizat"}`
    }

    case 'focus_keyword':
      return `${context}

TASK: Identifică și sugerează cuvântul cheie principal (focus keyword) pentru această pagină de produs.

REGULI:
- Focus keyword-ul este query-ul principal pe care cumpărătorii îl folosesc pentru a găsi acest produs
- Structura ideală: [tip produs] + [atribut diferențiator] (ex: "mop spin inox", "tricou bumbac organic")
- NU brand name dacă brandul nu e cunoscut
- NU prea lung (2-4 cuvinte ideal)
- Trebuie să fie cuvântul care apare cel mai natural în titlu, H1, și descriere
- Sugerează și 3-5 cuvinte cheie secundare (variații, sinonime, long-tail)

Returnează DOAR JSON:
{"focus_keyword": "cuvântul cheie principal", "secondary_keywords": ["keyword1", "keyword2", "keyword3"]}`

    case 'all':
      return `${context}
Descriere lungă originală HTML: ${(product.original_description || '').substring(0, 1000)}

TASK: Generează TOATE secțiunile SEO optimizate pentru acest produs eCommerce.

REGULI STRICTE pentru fiecare câmp:

TITLU (optimized_title):
- 50-70 caractere, include tip produs + atribut cheie, natural și persuasiv
- Structură: [Tip Produs] [Atribut] – [Diferențiator] | [Brand dacă relevant]

META DESCRIPTION (meta_description):
- MAXIM 155 caractere, beneficiu + diferențiator + CTA, orientat pe intenția de cumpărare

DESCRIERE SCURTĂ (optimized_short_description):
- 2-4 propoziții, 50-120 cuvinte, convinge la adăugare în coș
- Dacă originalul are HTML, returnează HTML optimizat

DESCRIERE LUNGĂ (optimized_long_description):
- HTML structurat cu h3/p/ul/li
- DACĂ originalul are HTML: PĂSTREAZĂ structura identică, optimizează DOAR textul
- Minimum 200 cuvinte, include keyword natural, adaugă information gain

FOCUS KEYWORD (focus_keyword):
- 2-4 cuvinte, query-ul principal al cumpărătorilor

CUVINTE CHEIE SECUNDARE (secondary_keywords):
- Array de 3-5 variații și long-tail

SEO SCORE (seo_score): număr 0-100 estimat pentru calitatea SEO a conținutului generat

SEO SUGGESTIONS (seo_suggestions): array de 2-4 sugestii practice suplimentare

Returnează DOAR JSON valid:
{
  "optimized_title": "...",
  "meta_description": "...",
  "optimized_short_description": "...",
  "optimized_long_description": "...",
  "focus_keyword": "...",
  "secondary_keywords": ["...", "..."],
  "seo_score": 85,
  "seo_suggestions": ["...", "..."]
}`

    default:
      return ''
  }
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const limit = rateLimitExpensive(userId, 'seo-optimize')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe cereri. Așteaptă un minut.' }, { status: 429 })
    }

    const { product_id, section = 'all' } = await request.json()

    if (!product_id) {
      return NextResponse.json({ error: 'product_id lipsește' }, { status: 400 })
    }

    const validSections = Object.keys(CREDIT_COSTS)
    if (!validSections.includes(section)) {
      return NextResponse.json({ error: 'Secțiune invalidă' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check credits
    const creditCost = CREDIT_COSTS[section]
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < creditCost) {
      return NextResponse.json(
        { error: `Credite insuficiente. Necesare: ${creditCost} credite.` },
        { status: 400 }
      )
    }

    // Load product
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
    }

    // Build prompt
    const userPrompt = buildSectionPrompt(section, product)
    if (!userPrompt) {
      return NextResponse.json({ error: 'Secțiune invalidă' }, { status: 400 })
    }

    // Generate with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SEO_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: section === 'all' || section === 'long_description' ? 2500 : 600,
    })

    const raw = completion.choices[0].message.content?.trim() || '{}'
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let result: Record<string, any>
    try {
      result = JSON.parse(cleaned)
    } catch {
      console.error('[SEO Optimize] Parse error:', cleaned.substring(0, 300))
      return NextResponse.json({ error: 'Eroare la procesarea răspunsului AI' }, { status: 500 })
    }

    // Deduct credits
    const newBalance = user.credits - creditCost
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -creditCost,
      balance_after: newBalance,
      description: `SEO optimizare "${section}" — ${product.original_title?.substring(0, 40)}`,
      reference_type: 'seo_optimization',
      reference_id: product_id,
    })

    return NextResponse.json({ success: true, result, credits_remaining: newBalance })
  } catch (err) {
    console.error('[SEO Optimize] Error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}