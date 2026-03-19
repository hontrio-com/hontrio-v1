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

  const prompt = `You are an expert in eCommerce, SEO and copywriting for online stores.

BRAND IDENTITY:
${brandContext}

${langInstruction}

PRODUCT:
- Title: ${product.title}
- Category: ${product.category || 'Unspecified'}
- Price: ${product.price ? product.price + ' RON' : 'Unspecified'}
- Original description: ${product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 1500) : 'None'}

REQUIREMENTS:
Respond STRICTLY in valid JSON format, no markdown, no backticks, exactly in this format:

{
  "optimized_title": "SEO-optimized title (50-70 characters, include relevant keywords)",
  "meta_description": "Optimized meta description (max 155 characters, include call-to-action)",
  "optimized_short_description": "Short conversion-focused description (2-3 sentences, main benefit and call-to-action)",
  "optimized_long_description": "Long structured HTML description with sections. Use <h3>, <p>, <ul>, <li> tags. Minimum 200 words.",
  "benefits": ["Benefit 1 clearly stated from the customer's perspective", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "seo_score": 85,
  "seo_suggestions": ["SEO improvement suggestion 1", "Suggestion 2"]
}

IMPORTANT:
- Strictly follow the brand tone specified above
- The title must include relevant search keywords
- The short description must convince the customer to buy
- Benefits must be stated from the customer's perspective (what they gain)
- Respond ONLY with valid JSON, nothing else`

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