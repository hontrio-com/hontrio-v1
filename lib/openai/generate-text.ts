import { openai } from './client'

type ProductInput = {
  title: string
  description: string
  category: string | null
  price: number | null
  brand?: {
    businessName?: string | null
    tone?: string | null
    language?: string | null
    niche?: string | null
  }
}

type GeneratedText = {
  optimized_title: string
  meta_description: string
  optimized_short_description: string
  optimized_long_description: string
  benefits: string[]
  seo_score: number
  seo_suggestions: string[]
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: 'profesional și de încredere — limbaj serios, faptic, orientat pe calitate și expertiză',
  friendly:     'prietenos și cald — limbaj accesibil, ton conversațional, aproape de client',
  luxury:       'premium și sofisticat — limbaj elegant, exclusivist, orientat pe experiență și rafinament',
  casual:       'relaxat și informal — limbaj direct, simplu, fără formalisme',
}

export async function generateProductText(product: ProductInput): Promise<GeneratedText> {
  const tone = product.brand?.tone || 'professional'
  const language = product.brand?.language || 'ro'
  const niche = product.brand?.niche
  const businessName = product.brand?.businessName

  const brandContext = [
    businessName && `Magazin: ${businessName}`,
    niche && `Nișă/Industrie: ${niche}`,
    `Tonul comunicării: ${TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.professional}`,
    language === 'en' ? 'Limba: Engleză' : 'Limba: Română',
  ].filter(Boolean).join('\n')

  const langInstruction = language === 'en'
    ? 'Write ALL content in English.'
    : 'Scrie TOT conținutul în limba română.'

  const prompt = `Ești un expert în eCommerce, SEO și copywriting pentru magazine online.

IDENTITATE BRAND:
${brandContext}

${langInstruction}

PRODUS:
- Titlu: ${product.title}
- Categorie: ${product.category || 'Nespecificată'}
- Preț: ${product.price ? product.price + ' RON' : 'Nespecificat'}
- Descriere originală: ${product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 1500) : 'Lipsă'}

CERINȚE:
Răspunde STRICT în format JSON valid, fără markdown, fără backticks, exact în acest format:

{
  "optimized_title": "Titlu optimizat SEO (50-70 caractere, include cuvinte cheie relevante)",
  "meta_description": "Meta description optimizată (maxim 155 caractere, include call-to-action)",
  "optimized_short_description": "Descriere scurtă orientată pe conversie (2-3 propoziții, cu beneficiul principal și call-to-action)",
  "optimized_long_description": "Descriere lungă HTML structurată cu secțiuni. Folosește taguri <h3>, <p>, <ul>, <li>. Minimum 200 cuvinte.",
  "benefits": ["Beneficiu 1 clar formulat din perspectiva clientului", "Beneficiu 2", "Beneficiu 3", "Beneficiu 4", "Beneficiu 5"],
  "seo_score": 85,
  "seo_suggestions": ["Sugestie 1 pentru îmbunătățire SEO", "Sugestie 2"]
}

IMPORTANT:
- Respectă STRICT tonul brandului specificat mai sus
- Titlul trebuie să conțină cuvinte cheie relevante pentru căutări
- Descrierea scurtă trebuie să convingă clientul să cumpere
- Beneficiile trebuie formulate din perspectiva clientului (ce câștigă el)
- Răspunde DOAR cu JSON valid, nimic altceva`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  })

  const content = response.choices[0].message.content || ''
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned) as GeneratedText
  } catch (err) {
    console.error('Failed to parse OpenAI response:', content)
    throw new Error('Răspunsul AI nu a putut fi procesat')
  }
}