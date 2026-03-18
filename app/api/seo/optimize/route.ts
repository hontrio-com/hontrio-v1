import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { calculateSeoScore } from '@/lib/seo/score'
import { getAILanguage } from '@/lib/i18n/ai-languages'

// ─── CREDIT COSTS ─────────────────────────────────────────────────────────────
const CREDIT_COSTS: Record<string, number> = {
  all: 5,
  title: 1,
  meta_description: 1,
  short_description: 2,
  long_description: 2,
  focus_keyword: 1,
}

// ─── TONE DESCRIPTIONS ───────────────────────────────────────────────────────
const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: 'profesional și de încredere — limbaj serios, faptic, orientat pe calitate și expertiză',
  friendly:     'prietenos și cald — limbaj accesibil, ton conversațional, aproape de client',
  luxury:       'premium și sofisticat — limbaj elegant, exclusivist, orientat pe experiență și rafinament',
  casual:       'relaxat și informal — limbaj direct, simplu, fără formalisme',
}

function buildBrandContext(user: any): string {
  const lines: string[] = []
  if (user?.business_name) lines.push(`Magazin: ${user.business_name}`)
  if (user?.niche) lines.push(`Nișă/Industrie: ${user.niche}`)
  if (user?.brand_tone) lines.push(`Ton comunicare: ${TONE_DESCRIPTIONS[user.brand_tone] || user.brand_tone}`)
  if (user?.brand_language && user.brand_language !== 'ro') {
    const L = getAILanguage(user.brand_language)
    lines.push(`Language: ${L.nativeName} — ${L.seoLanguageInstruction}`)
  }
  return lines.length > 0 ? `\n\nIDENTITATEA BRANDULUI:\n${lines.join('\n')}` : ''
}

// ─── MASTER SEO SYSTEM PROMPT ─────────────────────────────────────────────────
// Based on Google Search Quality Guidelines, E-E-A-T principles, and eCommerce best practices
function buildSeoSystemPrompt(lang: string): string {
  const L = getAILanguage(lang)
  return `${L.seoExpertRole}
Advanced knowledge of:
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

${L.seoLanguageInstruction}
ALWAYS respond with valid JSON only, no markdown, no backticks.`
}

// Default for backward compat
const SEO_SYSTEM_PROMPT = buildSeoSystemPrompt('ro')

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
- Lungime OBLIGATORIE: EXACT 50-70 caractere (numără fiecare caracter inclusiv spațiile). Sub 50 sau peste 70 este INACCEPTABIL. VERIFICĂ numărul de caractere înainte de a răspunde.
- TREBUIE să conțină focus_keyword-ul ales
- Include: tip produs + atribut diferențiator principal + brand (dacă relevant)
- Folosește cuvintele pe care CUMPĂRĂTORII le folosesc în căutări, nu jargon tehnic
- NU include prețul sau stocul (se schimbă frecvent)
- NU repeta cuvinte inutil — fiecare cuvânt trebuie să aibă scop
- NU keyword stuffing — titlul trebuie să sune natural și persuasiv
- Structură recomandată: [Focus Keyword] [Diferențiator] – [Brand/Beneficiu]
- VERIFICĂ: numără caracterele înainte de a răspunde

Returnează DOAR JSON:
{"optimized_title": "titlul generat"}`

    case 'meta_description':
      return `${context}

TASK: Generează o meta description optimizată SEO pentru această pagină de produs.

REGULI STRICTE (conform Google Search Guidelines pentru snippets):
- Lungime OBLIGATORIE: EXACT 120-155 caractere (numără fiecare caracter). Sub 120 sau peste 155 este INACCEPTABIL. VERIFICĂ numărul de caractere înainte de a răspunde.
- TREBUIE să conțină focus_keyword-ul ales în mod natural
- NU este un factor direct de ranking, dar influențează CTR (click-through rate)
- Trebuie să descrie pagina MAI BINE decât textul vizibil — altfel Google o ignoră
- Include: beneficiul principal + un diferențiator unic + call-to-action clar relevant pentru produs
- Evita: keyword stuffing, propoziții generice identice cu alte produse
- Trebuie să fie orientat pe INTENȚIA de căutare (cumpărătorul vrea să cumpere, nu să se informeze)
- Ideal să menționezi un element de încredere: garanție, livrare, retur, autenticitate
- VERIFICĂ: numără caracterele înainte de a răspunde

Returnează DOAR JSON:
{"meta_description": "meta description generată"}`

    case 'short_description':
      return `${context}

TASK: Generează o descriere scurtă optimizată pentru produs (apare sub titlu în WooCommerce, înainte de butonul "Adaugă în coș").

REGULI STRICTE:
- Lungime OBLIGATORIE: minimum 80 caractere text simplu (excluzând tagurile HTML). VERIFICĂ lungimea textului plain (fără HTML) înainte de a răspunde.
- Aceasta este descrierea care CONVINGE cumpărătorul să adauge în coș
- Structură ideală: (1) Ce este + beneficiul principal → (2) Pentru cine este ideal → (3) 1-2 caracteristici diferențiatoare → (4) CTA sau element de încredere
- Folosește vocea activă și limbajul direct ("Tu primești...", "Ideal dacă...")
- PĂSTREAZĂ HTML-ul dacă originalul are formatare — optimizează doar textul, nu structura
- Include focus_keyword natural în primele 1-2 propoziții
- Focus_keyword-ul TREBUIE să apară în această descriere (1-2 ocurențe naturale)
- Densitatea combinată a focus_keyword în (short + long description) trebuie să fie 0.5-2.5%
- Evita clișee: "Produsul perfect", "Calitate superioară" fără substanță
- VERIFICĂ: lungimea textului plain (fără HTML) trebuie să fie ≥ 80 caractere

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
- Lungime OBLIGATORIE: minimum 200 cuvinte text simplu (excluzând tagurile HTML). VERIFICĂ numărul de cuvinte înainte de a răspunde.
- Structură ideală pentru descriere lungă (dacă creezi de la zero):
  → <h3> sau <h2>: Introducere + ce este produsul + pentru cine
  → <h3>: Caracteristici principale (în <ul><li>)
  → <h3>: Beneficii pentru utilizator (din perspectiva clientului)
  → <h3>: Mod de utilizare / instrucțiuni (dacă relevant)
  → <p>: Element de încredere + CTA final
- Include focus_keyword natural în primul paragraf și de 3-4 ori total în text
- Focus_keyword-ul TREBUIE să apară în această descriere (3-4 ocurențe naturale)
- Densitatea combinată a focus_keyword în (short + long description) trebuie să fie 0.5-2.5%
- Include sinonime și variații naturale (nu stuffing)
- Evita conținut duplicat de la producător — adaugă "information gain" real
- Fiecare secțiune H3 trebuie să răspundă la o întrebare reală a cumpărătorului
- NU include prețuri (se schimbă) și NU face promisiuni false
- VERIFICĂ: numărul de cuvinte plain text (fără HTML) trebuie să fie ≥ 200

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

SCORING ALGORITHM — YOUR CONTENT MUST ACHIEVE 100/100:

FIELD 1 — optimized_title (25 POINTS):
• Length: EXACTLY 50-70 characters (count every char including spaces)
• Must contain: the focus_keyword you choose
• Formula: [Focus Keyword] [Differentiator] – [Brand/Benefit]
• VERIFY: count characters before responding

FIELD 2 — meta_description (25 POINTS):
• Length: EXACTLY 120-155 characters (count every char)
• Must contain: the focus_keyword naturally
• Must end with a clear CTA relevant to the product
• VERIFY: count characters before responding

FIELD 3 — optimized_short_description (15 POINTS):
• Minimum 80 characters of PLAIN TEXT (excluding HTML tags)
• 2-4 convincing sentences that convert visitors to buyers
• Include focus_keyword naturally in first sentence

FIELD 4 — optimized_long_description (20 POINTS):
• Minimum 200 WORDS of plain text (count words excluding HTML)
• Format: <h3> sections + <ul><li> features + <p> paragraphs
• Include focus_keyword naturally 3-5 times across the text

FIELD 5 — focus_keyword (8 POINTS):
• 2-4 words, the primary search query buyers use
• Must appear in title, meta, short description, and long description

FIELD 6 — keyword_density (7 POINTS):
• focus_keyword density in combined (short_description + long_description): 0.5% to 2.5%
• Calculate: (keyword occurrences / total words) × 100
• Target ~1.5% density
• focus_keyword MUST appear in BOTH short description AND long description
• Approximately 1-2 occurrences in short description and 3-4 in long description

SELF-VERIFY before responding:
□ Title length: ___ chars (must be 50-70)
□ Meta length: ___ chars (must be 120-155)
□ Short desc plain text length: ___ chars (must be ≥80)
□ Long desc word count: ___ words (must be ≥200)
□ Focus keyword appears in all 4 fields: YES/NO
□ Keyword density: ___% (must be 0.5-2.5%)

Return ONLY valid JSON:
{
  "optimized_title": "...",
  "meta_description": "...",
  "optimized_short_description": "...",
  "optimized_long_description": "...",
  "focus_keyword": "...",
  "secondary_keywords": ["...", "..."],
  "seo_suggestions": ["...", "..."]
}`

    default:
      return ''
  }
}


// ─── POST-PROCESS: Minimal — only trims if AI exceeded limits, never pads ────
function postProcessSeoResult(result: Record<string, any>, focusKeyword: string): Record<string, any> {
  // 1. TITLE: Trim to 70 chars only if AI went over — no keyword prepending
  if (result.optimized_title) {
    let title = result.optimized_title.trim()
    if (title.length > 70) {
      title = title.substring(0, 67).replace(/\s+\S*$/, '') + '...'
      if (title.length > 70) title = title.substring(0, 70)
    }
    result.optimized_title = title
  }

  // 2. META DESCRIPTION: Trim to 155 chars only if AI went over — no padding
  if (result.meta_description) {
    let meta = result.meta_description.trim()
    if (meta.length > 155) {
      meta = meta.substring(0, 152).replace(/\s+\S*$/, '') + '...'
      if (meta.length > 155) meta = meta.substring(0, 155)
    }
    result.meta_description = meta
  }

  // 3. FOCUS KEYWORD: If empty, extract from title as fallback
  if (!result.focus_keyword || result.focus_keyword.trim().length < 2) {
    const titleWords = (result.optimized_title || '').split(/[\s—|–-]+/).filter((w: string) => w.length > 3)
    result.focus_keyword = titleWords.slice(0, 3).join(' ').toLowerCase()
  }

  return result
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const limit = await rateLimitExpensive(userId, 'seo-optimize')
    if (!limit.success) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
    }

    const { product_id, section = 'all' } = await request.json()

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    const validSections = Object.keys(CREDIT_COSTS)
    if (!validSections.includes(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
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
        { error: `Insufficient credits. Required: ${creditCost} credits.` },
        { status: 400 }
      )
    }

    // Load product + brand settings
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', userId)
      .single()

    const { data: userProfile } = await supabase
      .from('users')
      .select('business_name, brand_tone, brand_language, niche')
      .eq('id', userId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Build prompt
    const userPrompt = buildSectionPrompt(section, product)
    if (!userPrompt) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }

    // Inject brand context + language into system prompt
    const brandCtx = buildBrandContext(userProfile)
    const userLang = userProfile?.brand_language || 'ro'
    const baseSeoPrompt = buildSeoSystemPrompt(userLang)
    const systemPrompt = brandCtx
      ? baseSeoPrompt + brandCtx + '\n\nStrictly respect the tone and language specified for the brand in all generated content.'
      : baseSeoPrompt

    // Generate with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
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
      return NextResponse.json({ error: 'Error processing AI response' }, { status: 500 })
    }

    // Deduct credits
    const newBalance = user.credits - creditCost
    await supabase.from('users').update({ credits: newBalance }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -creditCost,
      balance_after: newBalance,
      description: `SEO optimization "${section}" — ${product.original_title?.substring(0, 40)}`,
      reference_type: 'seo_optimization',
      reference_id: product_id,
    })

    // Post-procesare: ajustează dimensiunile pentru scor maxim
    if (result) {
      const kwForProcess = result.focus_keyword || product.focus_keyword || ''
      Object.assign(result, postProcessSeoResult(result, kwForProcess))
    }

    // Daca sectiunea e 'all', suprascrie seo_score cu calculul nostru real
    // (nu cel estimat de GPT care poate fi incorect/exagerat)
    if (section === 'all' && result) {
      const { score: realScore } = calculateSeoScore({
        title:            result.optimized_title || product.original_title || '',
        metaDescription:  result.meta_description || '',
        shortDescription: result.optimized_short_description || '',
        longDescription:  result.optimized_long_description || '',
        focusKeyword:     result.focus_keyword || '',
      })
      result.seo_score = realScore
    }

    return NextResponse.json({ success: true, result, credits_remaining: newBalance })
  } catch (err) {
    console.error('[SEO Optimize] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}