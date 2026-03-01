import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { KieClient } from '@/lib/kie/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { canStartJob, markJobRunning, markJobDone } from '@/lib/security/ai-guard'

const PROMO_COST = 4



export const PROMO_STYLES = {
  modern_minimalist: {
    label: 'Modern Minimalist',
    description: 'Clean, white space, elegant typography, subtle shadows',
  },
  bold_dynamic: {
    label: 'Bold & Dynamic',
    description: 'Strong colors, diagonal elements, high energy, impactful',
  },
  elegant_luxury: {
    label: 'Elegant Luxury',
    description: 'Dark rich tones, gold accents, premium feel, serif fonts',
  },
  vibrant_sale: {
    label: 'Vibrant Sale',
    description: 'Bright colors, urgency elements, discount focused, eye-catching',
  },
  dark_premium: {
    label: 'Dark Premium',
    description: 'Deep dark background, neon/glowing accents, dramatic lighting',
  },
  gradient_pop: {
    label: 'Gradient Pop',
    description: 'Vivid gradient backgrounds, modern, social-media optimized',
  },
}

// ─── System prompt text generation ───────────────────────────────────────────
const TEXT_GENERATION_SYSTEM = [
  'You are an expert Romanian e-commerce copywriter and marketing specialist.',
  'Generate compelling promotional text for product advertisement images targeting Romanian consumers.',
  '',
  'Rules:',
  '- Write ALL text in Romanian language',
  '- Keep it concise and impactful',
  '- Title: maximum 6 words, punchy and benefit-focused',
  '- Subtitle: maximum 12 words, elaborates the main benefit',
  '- Benefits: exactly 3 bullet points, maximum 5 words each, start with action verb or strong adjective',
  '- CTA: maximum 4 words, action-oriented (ex: "Comanda Acum", "Descopera Oferta", "Cumpara Azi")',
  '- Price: if available, format as "Doar X RON" or "De la X RON"',
  '- Respond ONLY with valid JSON, no markdown, no backticks',
].join('\n')

async function generatePromoText(params: {
  productTitle: string
  productCategory: string | null
  productDescription: string | null
  price: number | null
  style: string
}): Promise<{
  headline: string
  subtitle: string
  benefits: string[]
  cta: string
  price_text: string | null
}> {

  const styleTone: Record<string, string> = {
    modern_minimalist: 'curat, sofisticat, minimalist — mai putin inseamna mai mult',
    bold_dynamic: 'energic, puternic, orientat spre actiune — bold si incitant',
    elegant_luxury: 'premium, exclusiv, aspirational — sentiment high-end',
    vibrant_sale: 'urgent, incitant, axat pe oferta — creeaza FOMO',
    dark_premium: 'misterios, exclusiv, dramatic — vibe premium de noapte',
    gradient_pop: 'modern, proaspat, vibrant — nativ social media',
  }

  const cleanDesc = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 400)
    : 'Nedisponibil'

  const priceJson = params.price ? '"Doar ' + params.price + ' RON"' : 'null'

  const prompt = [
    'Genereaza text promotional pentru acest produs:',
    '',
    'Produs: ' + params.productTitle,
    'Categorie: ' + (params.productCategory || 'Nespecificata'),
    'Descriere: ' + cleanDesc,
    'Pret: ' + (params.price ? params.price + ' RON' : 'Nespecificat'),
    'Ton stil reclama: ' + (styleTone[params.style] || 'modern si atractiv'),
    '',
    'Returneaza DOAR acest JSON (fara markdown, fara backticks):',
    '{',
    '  "headline": "Maximum 6 cuvinte, titlu roman impactant",',
    '  "subtitle": "Maximum 12 cuvinte subtitlu roman elaborand beneficiul",',
    '  "benefits": ["Beneficiu 1 max 5 cuvinte", "Beneficiu 2 max 5 cuvinte", "Beneficiu 3 max 5 cuvinte"],',
    '  "cta": "Maximum 4 cuvinte CTA roman",',
    '  "price_text": ' + priceJson,
    '}',
  ].join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: TEXT_GENERATION_SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
  })

  const content = response.choices[0].message.content?.trim() || ''
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('GPT text generation failed to return valid JSON')
  }
}

// ─── SISTEM PROMPT GPT — POSTER PROMOȚIONAL ──────────────────────────────────
const IMAGE_PROMPT_SYSTEM = `You are an expert AI image generation prompt writer specializing in commercial advertising visuals.

Your job is to write detailed text prompts for Flux-based image generation models. These prompts describe advertising poster compositions that include a product photo and promotional text elements as part of the visual design.

When writing prompts, you describe:
- The visual composition and layout of the poster
- How the product should appear (faithful to reference)
- The background, colors, and design elements
- Typography elements as visual components of the design (font style, size, placement, color)
- The overall mood and quality

Your prompts are descriptive and specific. You write them in the style of a detailed art direction brief.

Output only the prompt text itself — no preamble, no commentary.`

// ─── Style layout instructions ────────────────────────────────────────────────
function getPromoStyleLayout(style: string): string {
  const layouts: Record<string, string> = {

    modern_minimalist: [
      'STYLE: Modern Minimalist Premium — Apple / Scandinavian Design Language',
      '',
      'LAYOUT PHILOSOPHY: White space IS the design. Every element has purpose. Nothing is decorative.',
      '',
      'BACKGROUND AND STRUCTURE:',
      '- Background: Pure white #FFFFFF or ultra-light #F6F7F9 — infinite clean depth',
      '- SPLIT LAYOUT: Asymmetric vertical division',
      '  LEFT 38%: Pure white — ALL text elements — completely empty of graphics',
      '  RIGHT 62%: Product + one subtle design accent',
      '- BOTTOM STRIP: 17% height, light gray #EDEDEF, full width — CTA area',
      '- Thin 1.5px separator line in product\'s primary accent color at top of bottom strip',
      '',
      'PRODUCT PLACEMENT AND LIGHTING:',
      '- Product in right panel, vertically centered at 48%, horizontally centered in panel',
      '- Scale: 70-75% of right panel height — large, commanding',
      '- Slight 3-5° rotation for dynamism (only for asymmetric products)',
      '- Soft drop shadow: rgba(0,0,0,0.10), blur 45px, offset 0 22px',
      '- Studio lighting: large softbox upper-left 40°, clean diffused light',
      '- Optional: 12% opacity mirror reflection below product',
      '',
      'TYPOGRAPHY (left panel, all left-aligned, 40px left margin):',
      '- HEADLINE: Bold geometric sans-serif, 52-60px, #1A1A1A, tight 1.05 line-height',
      '- SUBTITLE: Light/regular weight, 21px, #555555, margin-top 18px',
      '- BENEFITS (3 lines): 17px, #333333, margin-top 22px, each preceded by thin 8px colored square or line in product accent color',
      '- All left text uses generous vertical breathing room',
      '',
      'CTA AREA (bottom gray strip):',
      '- CTA BUTTON: Centered, solid fill in product primary color, rounded 8px corners',
      '- Button size: ~250px × 52px',
      '- Button text: white bold 19px inside',
      '- PRICE: If available, bold #1A1A1A 26px, positioned right of center or right of button',
      '',
      'COLOR PHILOSOPHY: Maximum 3 colors — white, one product-derived accent, soft gray.',
      'Product\'s own colors are the only bold visual statement.',
      'ZERO gradients, ZERO decorative shapes, ZERO patterns.',
    ].join('\n'),

    bold_dynamic: [
      'STYLE: Bold Dynamic High-Energy — Nike / Adidas / Sports Campaign',
      '',
      'LAYOUT PHILOSOPHY: Strong, impactful, powerful. Every element has energy and intention.',
      '',
      'BACKGROUND — PRODUCT-RESPONSIVE COLOR SELECTION:',
      '- Choose the background color that creates MAXIMUM dramatic impact with THIS product:',
      '  Products with warm/red colors → deep navy #182744 or charcoal #1A1A1A (contrast)',
      '  Products with blue/cool colors → deep crimson #6B1320 or warm black #1A1008',
      '  Products with neutral/white colors → choose color from product\'s industry context',
      '  Products that are dark → use a background 40% lighter — same dark family but contrast',
      '',
      'DIAGONAL DESIGN ELEMENT (SIGNATURE):',
      '- Bold diagonal band at exactly 28° from bottom-left to top-right',
      '- Band width: 270-290px at widest point',
      '- Band color: 38% lighter than main background, same hue family',
      '- This diagonal creates visual energy and divides the composition naturally',
      '',
      'PRODUCT PLACEMENT:',
      '- Center-right, overlapping the diagonal band\'s right edge',
      '- Scale: 70-76% of frame height — dominant and powerful',
      '- Slight 5-8° tilt for products with appropriate shapes',
      '- DRAMATIC RIM LIGHT: strong bright rim from upper-right 70°, creates luminous edge — SIGNATURE',
      '- Hard directional shadow extending lower-left',
      '',
      'BOTTOM STRIP: Full width, bottom 20% height, 22% darker than main background — CTA zone',
      '',
      'TYPOGRAPHY:',
      '- HEADLINE: Massive bold condensed sans-serif, 64-74px, WHITE, ALL CAPS, upper-left (top 30%, left 42%)',
      '  Ultra-tight letter-spacing -0.02em, maximum 2 lines — this text SHOUTS',
      '- SUBTITLE: Medium weight, 23px, light gray #CCCCCC, below headline, same left alignment',
      '- BENEFITS: 3 lines, 15-16px white, left-aligned, each with → arrow prefix or small triangle',
      '  Positioned left-center along diagonal band area',
      '- All left text: 46px left margin from image edge',
      '',
      'CTA AREA (bottom dark strip):',
      '- CTA BUTTON: Bright electric accent color (yellow #FFE500, or bright product color), bold dark text, rounded 6px',
      '- Size: 270px × 54px, centered in strip',
      '- PRICE: Bold white 28px, positioned to right of button if available',
      '',
      'GRAPHIC ENERGY:',
      '- Abstract speed lines radiating behind product at 12% opacity',
      '- 3-4 small acute triangles or thin rectangles in accent color at 18-22% opacity in corners',
      '- All sharp angles, zero soft curves in graphic elements',
    ].join('\n'),

    elegant_luxury: [
      'STYLE: Elegant Luxury Editorial — Chanel / Rolex / Cartier Aesthetic',
      '',
      'LAYOUT PHILOSOPHY: Restraint is the ultimate luxury. Every element is precise, intentional, refined.',
      '',
      'BACKGROUND — PRODUCT-RESPONSIVE DARK TONE:',
      '- Base: near-black, choose the right undertone for this product:',
      '  Jewelry/watches/accessories → warm near-black #1A1208 (amber undertone)',
      '  Perfume/cosmetics/beauty → cool near-black #0E0E16 (subtle indigo depth)',
      '  Spirits/wine/gourmet → deep forest-black #0C1510 (green undertone)',
      '  Fashion/leather goods → rich walnut-black #140E09',
      '  Tech/universal → refined charcoal #111115',
      '- Imperceptible film grain at 4-5% opacity — adds analog warmth, prevents flat digital look',
      '',
      'GOLD FRAME ELEMENT:',
      '- Four ultra-thin #C9A84C lines forming inset rectangle',
      '- Line weight: 0.75px at 70% opacity — barely visible, supremely refined',
      '- Inset: 28px from each image edge',
      '- Four 4px diamond shapes at corner intersections in same gold',
      '',
      'PRODUCT PLACEMENT:',
      '- Centered horizontally, 45% from top (golden ratio zone)',
      '- Scale: 58-65% frame height — commanding with generous breathing room',
      '- THEATRICAL LIGHTING: primary from below-front 25°, warm 2800-3000K, soft beam',
      '- GOLD RIM LIGHT: #C9A84C warm gold from behind 140° — luminous golden halo (SIGNATURE)',
      '- Dark reflective surface: mirror reflection fading to black over 30% of product height',
      '',
      'TYPOGRAPHY (all centered):',
      '- TOP ZONE (inside gold frame, 10-12% from top): ALL CAPS thin sans-serif, 13px, wide 0.35em letter-spacing, #C9A84C gold — brand/category line',
      '- HEADLINE: Thin-weight elegant serif or light sans, 44-52px, cream #F5F0E8, centered, 0.04em letter-spacing',
      '  Thin gold separator line 0.75px below headline',
      '- SUBTITLE: 19px light weight, #AAAAAA, centered, below product',
      '  Thin gold separator line 0.75px above subtitle',
      '- BENEFITS: 3 items centered, 14px #888888, separated by small gold diamond symbols ◆',
      '- PRICE: 26px bold cream #F5F0E8, centered, below benefits',
      '- CTA BUTTON: Outlined style, 1px #C9A84C border, gold text inside, 220px × 44px',
      '  CTA text: 15px ALL CAPS, 0.2em letter-spacing',
      '',
      'COLOR: Background (near-black), gold #C9A84C (accents only), cream #F5F0E8 (headline), gray tones (body text)',
    ].join('\n'),

    vibrant_sale: [
      'STYLE: Vibrant Sale Promotion — High-Energy Commercial Advertising Poster',
      '',
      'LAYOUT PHILOSOPHY: Bold, loud, energetic. Split composition — product on the right, all text on the left. Everything is large and readable.',
      '',
      'BACKGROUND:',
      '- Choose a solid bold color OR a simple two-color gradient that maximizes contrast with the product:',
      '  Food/consumer goods → deep orange #E65C00 to golden yellow #F9D423',
      '  Beauty/fashion → deep magenta #8B0057 to vibrant pink #FF4081',
      '  Tech/electronics → deep navy #0A1628 to electric blue #1565C0',
      '  Sports/fitness → deep red #8B0000 to bright red #E53935',
      '  Home/garden → deep teal #004D40 to bright green #00897B',
      '  General/universal → deep purple #4A148C to vivid orange #E65100',
      '- The background is a clean smooth gradient — no textures, no patterns, no complex shapes',
      '',
      'LAYOUT — CLEAR VERTICAL SPLIT:',
      '- LEFT HALF (0-48% width): ALL text elements stacked vertically, left-aligned with 44px margin',
      '  This left zone has a darker or lighter tone of the background to create subtle contrast for text',
      '- RIGHT HALF (52-100% width): The product, centered in this zone',
      '- A thin bright accent line (2-3px) runs vertically at the split point, full image height',
      '',
      'PRODUCT (right half):',
      '- Centered in right half, vertically centered at 46%',
      '- Scale: fills 80% of right half height — large and dominant',
      '- Slightly warm front lighting, product appears vivid and appetizing',
      '- Subtle drop shadow outward at 20% opacity',
      '',
      'TYPOGRAPHY (left half, all left-aligned, stacked top to bottom with clear spacing):',
      '- HEADLINE: Extra bold rounded sans-serif, 56-64px, WHITE or bright yellow #FFD600',
      '  Tight line-height 1.05, maximum 2 lines, ALL CAPS for maximum energy',
      '- SUBTITLE: Medium weight 22px, light color #EEEEEE or #FFE082, below headline, margin-top 14px',
      '- BENEFITS: 3 lines stacked, 17px WHITE, each preceded by a bright ✓ or → in accent color',
      '  Margin-top 18px, line spacing 10px between each benefit',
      '- A bright horizontal divider line (1px, accent color, 55% width) between benefits and CTA area',
      '',
      'CTA AND PRICE (bottom of left half):',
      '- CTA BUTTON: Bright solid rectangle or rounded button, contrasting color (yellow #FFD600 or white)',
      '  Bold dark text inside, 20px, button width ~220px height ~50px',
      '- PRICE: Bold large text, 30-36px, bright white or yellow, positioned near or above CTA button',
      '',
      'OVERALL ENERGY: High contrast, punchy, commercial. Every element large and legible.',
    ].join('\n'),

    dark_premium: [
      'STYLE: Dark Premium Neon Glow — Gaming / Luxury Tech / Premium Nightclub',
      '',
      'LAYOUT PHILOSOPHY: Darkness is the canvas. What glows commands attention.',
      '',
      'BACKGROUND — PRODUCT-RESPONSIVE NEAR-BLACK:',
      '- Base near-black, choose variation matching product:',
      '  Tech/gaming/electronics → #05050F (blue undertone, digital feel)',
      '  Spirits/luxury/watches → #0A0A05 (very subtle warm undertone)',
      '  Beauty/fashion/cosmetics → #0A0508 (subtle burgundy depth)',
      '  Sports/energy → #050508 (almost pure black, electric feel)',
      '  Universal → #080808 (perfect near-black)',
      '- Subtle radial gradient: center 6-8% lighter than edges — creates depth and focus',
      '',
      'NEON ACCENT COLOR — PRODUCT-APPROPRIATE (use ONE only):',
      '  Tech/gaming/electronics → electric blue #00BFFF or neon green #39FF14',
      '  Premium spirits/luxury → amber gold #FFB300 or deep rose #FF4D7A',
      '  Beauty/cosmetics → neon purple #BF00FF or electric pink #FF00A8',
      '  Sports/energy → electric yellow #FFE500 or plasma orange #FF6A00',
      '  Universal premium → electric blue #00BFFF',
      '- This accent color appears ONLY in: rim light, glow effects, design lines, particles — used sparingly',
      '',
      'PRODUCT PLACEMENT AND DRAMATIC LIGHTING:',
      '- CENTERED horizontally, 44% from top',
      '- Scale: 60-65% frame height — deliberate breathing room around product',
      '- SPOTLIGHT: tight circular from directly above, 45° cone, 5000K neutral',
      '- NEON RIM LIGHT: chosen accent color, strong luminous edge on ALL product silhouette',
      '  Glow extends 8-12px at full opacity, fading to 0% at 40px — product EMITS light',
      '- VOLUMETRIC GLOW: soft radial in accent color behind product, 15% opacity 150px radius',
      '',
      'ATMOSPHERIC PARTICLES: 18-22 small circles (2-6px), accent color at 8-12% opacity, random distribution',
      '',
      'DESIGN LINES (CRITICAL — creates text zones):',
      '- TWO full-width horizontal lines in accent color:',
      '  LINE 1: at exactly 19% from top (1px + 2px glow)',
      '  LINE 2: at exactly 80% from top (1px + 2px glow)',
      '  These lines glow — they are visible structural design elements',
      '',
      'TYPOGRAPHY:',
      '- TOP ZONE (above line 1, 0-19%): pure near-black background',
      '  HEADLINE: Bold strong sans-serif, 52-58px, WHITE, centered',
      '  Subtle text glow in accent color at 25% opacity around letters',
      '  SUBTITLE: 20px light gray #AAAAAA, centered, just above line 1',
      '- MIDDLE ZONE (between lines): BENEFITS flanking the product',
      '  3 benefits, 14px, #777777, with glowing dot ● prefix in accent color',
      '  Positioned to the left of product if space allows',
      '- BOTTOM ZONE (below line 2, 80-100%): pure near-black',
      '  CTA BUTTON: outlined in accent color, accent text inside, 245px × 50px, centered',
      '  Optional: solid fill button in accent color with dark text',
      '  Neon glow on button border matching accent',
      '  PRICE: bold white or accent color, 26px, centered near CTA',
    ].join('\n'),

    gradient_pop: [
      'STYLE: Gradient Pop — Instagram DTC / Gen-Z Brand / Social-First Design',
      '',
      'LAYOUT PHILOSOPHY: Vibrant gradient background, product centered and large, all text arranged cleanly around the product. Modern, scroll-stopping, native to social media.',
      '',
      'BACKGROUND:',
      '- Rich smooth diagonal gradient covering the entire canvas, choose based on product personality:',
      '  Fashion/beauty/lifestyle → coral to violet: #FF6B6B top-left → #C084FC bottom-right',
      '  Tech/electronics/digital → sky blue to deep purple: #0EA5E9 top → #7C3AED bottom',
      '  Food/wellness/organic → warm orange to lime: #F97316 top-left → #84CC16 bottom-right',
      '  Sports/fitness/energy → emerald to blue: #10B981 top-left → #3B82F6 bottom-right',
      '  Home/family/lifestyle → pink to purple: #FB7185 top → #A78BFA bottom',
      '  Universal → deep blue to vivid pink: #1E40AF top-left → #DB2777 bottom-right',
      '- Smooth, rich, zero banding, fully saturated — the gradient IS the background',
      '',
      'LAYOUT — CENTERED PRODUCT WITH TEXT ABOVE AND BELOW:',
      '- Product: centered horizontally and vertically, large at 65-70% of frame height',
      '- TOP TEXT AREA (top 22% of image): headline and subtitle on white or very light semi-transparent panel',
      '  Panel: rounded rectangle, white at 85% opacity, full width minus 32px margins, height ~130px',
      '  This creates a clean readable zone for text against the gradient',
      '- BOTTOM TEXT AREA (bottom 26% of image): benefits, CTA, price on same style white panel',
      '  Panel: same white rounded rectangle at 85% opacity, full width minus 32px margins',
      '',
      'PRODUCT:',
      '- Centered, scale 65-70% frame height',
      '- Clean even studio lighting, upper-left 45°, 5500K',
      '- Drop shadow in gradient mid-tone at 30% opacity, 20px blur',
      '- Product appears to float over the gradient',
      '',
      'FLOATING DECORATIVE ELEMENTS (in gradient area, outside panels):',
      '- 4-6 simple geometric shapes: circles and squares at 20-30% white opacity, various sizes 20-80px',
      '- Softly blurred edges, scattered naturally in the visible gradient corners',
      '',
      'TYPOGRAPHY:',
      '- TOP PANEL: HEADLINE centered, bold rounded sans-serif, 46-52px, dark #1A1A1A, tight line-height',
      '  SUBTITLE centered, 19px #444444, below headline',
      '- BOTTOM PANEL: BENEFITS 3 items, 15px #222222, centered or left-aligned with 24px margin',
      '  Each benefit preceded by a small colored circle ● in gradient accent color',
      '  CTA BUTTON: centered, solid gradient-matching color, white bold text 18px, rounded 50px, 240px × 48px',
      '  PRICE: bold dark #1A1A1A, 24px, centered above CTA button',
      '',
      'OVERALL FEEL: Fresh, modern, social-media native. Clean white panels make text perfectly legible against the vibrant gradient.',
    ].join('\n'),
  }

  return layouts[style] || layouts.modern_minimalist
}

// ─── GPT: Build unique promo poster prompt ────────────────────────────────────
async function buildPromoImagePrompt(params: {
  productTitle: string
  productCategory: string | null
  productDescription: string | null
  style: string
  promoText: {
    headline: string
    subtitle: string
    benefits: string[]
    cta: string
    price_text: string | null
  }
}): Promise<string> {

  const cleanDescription = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 500)
    : 'Not available'

  const layout = getPromoStyleLayout(params.style)
  const b = params.promoText.benefits
  const priceDisplay = params.promoText.price_text || 'no price'

  // Variație controlată — garantează unicitate chiar pentru același produs și stil
  const variationSeed = Date.now() % 8
  const variationDirectives = [
    'Emphasize the product\'s most distinctive visual feature as the focal point of the entire composition.',
    'Design the color scheme to create the strongest possible contrast between the product and the background.',
    'Choose a slightly unconventional product angle that reveals its most interesting dimensional aspect.',
    'Let the product\'s dominant color inspire one unexpected design accent that ties the whole poster together.',
    'Design the typography scale so the headline size creates maximum visual hierarchy and impact.',
    'Position the product slightly off from the expected location to create dynamic tension and visual interest.',
    'Make the product appear to emerge from or interact with the design elements around it.',
    'Focus on making the product feel as large and powerful as possible within the poster frame.',
  ]
  const variationDirective = variationDirectives[variationSeed]

  const userMessage = [
    'Write a detailed image generation prompt for an advertising poster for this product.',
    '',
    'PRODUCT: ' + params.productTitle,
    'Category: ' + (params.productCategory || 'general consumer product'),
    'Description: ' + cleanDescription,
    '',
    'The poster should include these text elements as part of the visual design:',
    '- Main headline (large bold text): ' + params.promoText.headline,
    '- Subtitle (smaller text below headline): ' + params.promoText.subtitle,
    '- Three feature points: "' + (b[0] || '') + '" / "' + (b[1] || '') + '" / "' + (b[2] || '') + '"',
    '- Call-to-action button text: ' + params.promoText.cta,
    '- Price display: ' + priceDisplay,
    '',
    'POSTER STYLE AND LAYOUT:',
    layout,
    '',
    'CREATIVE DIRECTION: ' + variationDirective,
    '',
    'Write the prompt describing:',
    '1. The product appearance (faithful to the reference image — same shape, colors, labels, materials)',
    '2. Canvas: 1080x1080px square poster',
    '3. Background design with exact colors (hex values)',
    '4. Layout zones with measurements',
    '5. Product placement: position, scale, lighting angle (degrees), color temperature (Kelvin)',
    '6. Each text element as a visual component: the text content, font style, size in px, color hex, position',
    '   Include the actual text strings listed above in the prompt description',
    '7. Design elements: shapes, lines, decorative elements with sizes and colors',
    '8. Overall visual quality and finish',
    '',
    'Write 400-500 words. Be specific with measurements, colors, and positions.',
  ].join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: IMAGE_PROMPT_SYSTEM },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.5,
    max_tokens: 1200,
  })

  return response.choices[0].message.content?.trim() || ''
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { action } = body

    // ── Action: generate text preview ─────────────────────────────────────────
    if (action === 'generate_text') {
      const { product_id, style } = body

      const supabase = createAdminClient()
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .eq('user_id', userId)
        .single()

      if (!product) {
        return NextResponse.json({ error: 'Produs negasit' }, { status: 404 })
      }

      const promoText = await generatePromoText({
        productTitle: product.optimized_title || product.original_title,
        productCategory: product.category,
        productDescription: product.optimized_short_description || product.original_description,
        price: product.price,
        style,
      })

      return NextResponse.json({ promoText })
    }

    // ── Action: generate full promo image ─────────────────────────────────────
    const {
      product_id,
      style,
      reference_image_url,
      reference_image_base64,
      promo_text,
    } = body

    if (!style || !promo_text) {
      return NextResponse.json({ error: 'Stilul si textul sunt obligatorii' }, { status: 400 })
    }

    const limit = rateLimitExpensive(userId, 'promo')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe cereri. Asteapta un minut.' }, { status: 429 })
    }

    const jobCheck = canStartJob(userId)
    if (!jobCheck.allowed) {
      return NextResponse.json({ error: jobCheck.reason }, { status: 429 })
    }

    const supabase = createAdminClient()

    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < PROMO_COST) {
      return NextResponse.json(
        { error: 'Credite insuficiente. Ai nevoie de ' + PROMO_COST + ' credite.' },
        { status: 400 }
      )
    }

    let refImageUrl: string | null = null
    let productTitle = 'Product'
    let productCategory: string | null = null
    let productDescription: string | null = null
    let productDbId: string | null = null

    if (product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .eq('user_id', userId)
        .single()

      if (!product) {
        return NextResponse.json({ error: 'Produs negasit' }, { status: 404 })
      }

      productTitle = product.optimized_title || product.original_title
      productCategory = product.category
      productDescription = product.optimized_short_description || product.original_description
      productDbId = product.id
      refImageUrl = reference_image_url || product.original_images?.[0] || null

    } else if (reference_image_base64) {
      try {
        const base64Data = reference_image_base64.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const fileName = 'promo-uploads/' + userId + '/' + Date.now() + '.jpg'

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName)

        refImageUrl = urlData.publicUrl
        productTitle = 'Uploaded Product'
      } catch {
        return NextResponse.json({ error: 'Eroare la upload imaginii' }, { status: 500 })
      }
    }

    if (!refImageUrl) {
      return NextResponse.json({ error: 'Imaginea de referinta lipseste' }, { status: 400 })
    }

    const jobKey = userId + ':promo:' + (productDbId || 'upload')
    if (!markJobRunning(jobKey)) {
      return NextResponse.json(
        { error: 'O imagine promotionala este deja in curs de generare.' },
        { status: 409 }
      )
    }

    const insertData: Record<string, unknown> = {
      user_id: userId,
      style: 'promo_' + style,
      original_image_url: refImageUrl,
      status: 'processing',
      credits_used: PROMO_COST,
    }
    if (productDbId) insertData.product_id = productDbId

    const { data: imageRecord, error: insertError } = await supabase
      .from('generated_images')
      .insert(insertData)
      .select()
      .single()

    if (insertError || !imageRecord) {
      markJobDone(jobKey)
      return NextResponse.json(
        { error: 'Eroare la salvarea in baza de date: ' + insertError?.message },
        { status: 500 }
      )
    }

    const startTime = Date.now()
    let generatedUrl: string | null = null

    try {
      const detailedPrompt = await buildPromoImagePrompt({
        productTitle,
        productCategory,
        productDescription,
        style,
        promoText: promo_text,
      })

      console.log('[PromoGen] Prompt built (' + detailedPrompt.length + ' chars) style: ' + style)
      console.log('[PromoGen] Prompt preview:', detailedPrompt.substring(0, 600))

      await supabase
        .from('generated_images')
        .update({ prompt: detailedPrompt })
        .eq('id', imageRecord.id)

      const kie = new KieClient()
      const taskId = await kie.createImageTask(detailedPrompt, [refImageUrl], {
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
      })

      const resultUrls = await kie.waitForTask(taskId)
      if (!resultUrls || resultUrls.length === 0) throw new Error('Nu s-a generat nicio imagine')

      generatedUrl = resultUrls[0]
    } catch (err) {
      markJobDone(jobKey)
      await supabase.from('generated_images').update({ status: 'failed' }).eq('id', imageRecord.id)
      return NextResponse.json(
        { error: 'Eroare la generare: ' + (err as Error).message },
        { status: 500 }
      )
    }

    markJobDone(jobKey)
    const processingTime = Date.now() - startTime

    await supabase
      .from('generated_images')
      .update({
        generated_image_url: generatedUrl,
        status: 'completed',
        processing_time_ms: processingTime,
        quality_score: 85,
      })
      .eq('id', imageRecord.id)

    const newCredits = user.credits - PROMO_COST
    await supabase.from('users').update({ credits: newCredits }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -PROMO_COST,
      balance_after: newCredits,
      description: 'Imagine promotionala ' + style + ': ' + productTitle,
      reference_type: 'promo_generation',
      reference_id: imageRecord.id,
    })

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        generated_image_url: generatedUrl,
        style: 'promo_' + style,
        credits_used: PROMO_COST,
        status: 'completed',
        processing_time_ms: processingTime,
      },
      credits_remaining: newCredits,
    })
  } catch (err) {
    console.error('Promo generate error:', err)
    return NextResponse.json(
      { error: 'Eroare interna: ' + (err as Error).message },
      { status: 500 }
    )
  }
}