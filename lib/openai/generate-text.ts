import { openai } from './client'

type ProductInput = {
  title: string
  description: string
  category: string | null
  price: number | null
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

export async function generateProductText(product: ProductInput): Promise<GeneratedText> {
  const prompt = `Ești un expert în eCommerce, SEO și copywriting pentru magazine online din România.

Analizează produsul de mai jos și generează conținut optimizat pentru conversie și SEO.

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
  "optimized_long_description": "Descriere lungă HTML structurată cu secțiuni: prezentare produs, mod de utilizare, de ce să alegi acest produs. Folosește taguri <h3>, <p>, <ul>, <li>. Minimum 200 cuvinte.",
  "benefits": ["Beneficiu 1 clar formulat din perspectiva clientului", "Beneficiu 2", "Beneficiu 3", "Beneficiu 4", "Beneficiu 5"],
  "seo_score": 85,
  "seo_suggestions": ["Sugestie 1 pentru îmbunătățire SEO", "Sugestie 2"]
}

IMPORTANT:
- Scrie totul în limba română
- Titlul trebuie să conțină cuvinte cheie relevante pentru căutări
- Descrierea scurtă trebuie să convingă clientul să cumpere
- Descrierea lungă trebuie să fie HTML valid și profesional
- Beneficiile trebuie formulate din perspectiva clientului (ce câștigă el)
- Scorul SEO trebuie să reflecte calitatea conținutului generat (0-100)
- Răspunde DOAR cu JSON valid, nimic altceva`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  })

  const content = response.choices[0].message.content || ''

  // Curata raspunsul de eventuale backticks
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as GeneratedText
    return parsed
  } catch (err) {
    console.error('Failed to parse OpenAI response:', content)
    throw new Error('Răspunsul AI nu a putut fi procesat')
  }
}