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
  retro_vintage: {
    label: 'Retro Vintage',
    description: 'Aged nostalgic aesthetic, warm sepia tones, distressed texture, vintage typography',
  },
  editorial_magazine: {
    label: 'Editorial Magazine',
    description: 'High-fashion editorial look, bold headline, dramatic off-center product placement',
  },
  social_story: {
    label: 'Social Story',
    description: 'Instagram/TikTok story style, sticker elements, Gen-Z colors, fun and authentic',
  },
}

// ─── Language detection heuristic ────────────────────────────────────────────
function detectLanguage(title: string, description: string | null): string {
  const text = (title + ' ' + (description || '')).toLowerCase()
  // Romanian diacritics
  if (/[ăâîșțĂÂÎȘȚ]/.test(text)) return 'Romanian'
  // Common Romanian words
  if (/\b(si|sau|pentru|cu|de|la|un|o|cel|cea|ale|din|pe|este|sunt|care|acest|aceasta)\b/.test(text)) return 'Romanian'
  // Common French words
  if (/\b(et|ou|pour|avec|de|le|la|les|un|une|du|au|ce|cette|est|sont)\b/.test(text)) return 'French'
  // Common Spanish words
  if (/\b(y|o|para|con|de|el|la|los|las|un|una|del|al|este|esta|es|son)\b/.test(text)) return 'Spanish'
  // Common German words
  if (/\b(und|oder|für|mit|der|die|das|ein|eine|des|dem|den|ist|sind|dieser|diese)\b/.test(text)) return 'German'
  // Default to English
  return 'English'
}

// ─── System prompt text generation ───────────────────────────────────────────
function buildTextGenerationSystem(language: string): string {
  return [
    `You are an expert e-commerce copywriter and marketing specialist writing for ${language}-speaking consumers.`,
    `Generate compelling promotional text for product advertisement images.`,
    '',
    'Rules:',
    `- Write ALL text in ${language} language`,
    '- Keep it concise and impactful',
    '- CRITICAL: Count EVERY character (letters, spaces, punctuation). These are HARD limits — if you exceed them, shorten until it fits. This is a hard constraint, not a suggestion.',
    '- Headline: maximum 30 characters TOTAL (count every letter, space, punctuation) — punchy and benefit-focused',
    '- Subtitle: maximum 55 characters TOTAL — elaborates the main benefit',
    '- Benefits: exactly 3 bullet points, maximum 35 characters TOTAL each — start with action verb or strong adjective',
    '- CTA: maximum 22 characters TOTAL — action-oriented',
    '- Price: maximum 20 characters TOTAL — if available, format naturally for the language',
    '- Respond ONLY with valid JSON, no markdown, no backticks',
  ].join('\n')
}

async function generatePromoText(params: {
  productTitle: string
  productCategory: string | null
  productDescription: string | null
  price: number | null
  style: string
  language?: string
}): Promise<{
  headline: string
  subtitle: string
  benefits: string[]
  cta: string
  price_text: string | null
}> {

  const language = params.language || detectLanguage(params.productTitle, params.productDescription)

  const styleTone: Record<string, string> = {
    modern_minimalist: 'clean, sophisticated, minimalist — less is more',
    bold_dynamic: 'energetic, powerful, action-oriented — bold and exciting',
    elegant_luxury: 'premium, exclusive, aspirational — high-end feel',
    vibrant_sale: 'urgent, exciting, offer-focused — creates FOMO',
    dark_premium: 'mysterious, exclusive, dramatic — premium night vibe',
    gradient_pop: 'modern, fresh, vibrant — social media native',
    retro_vintage: 'nostalgic, warm, artisanal — timeless quality and heritage',
    editorial_magazine: 'bold, exclusive, fashion-forward — editorial prestige',
    social_story: 'fun, authentic, relatable — Gen-Z energy, not corporate',
  }

  const cleanDesc = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 400)
    : 'Not available'

  const priceJson = params.price ? '"' + params.price + '"' : 'null'

  const prompt = [
    'Generate promotional text for this product. Write EVERYTHING in ' + language + '.',
    '',
    'Product: ' + params.productTitle,
    'Category: ' + (params.productCategory || 'Not specified'),
    'Description: ' + cleanDesc,
    'Price: ' + (params.price ? String(params.price) : 'Not specified'),
    'Ad style tone: ' + (styleTone[params.style] || 'modern and attractive'),
    '',
    'HARD CHARACTER LIMITS — count every character including spaces and punctuation:',
    '  headline: max 30 characters',
    '  subtitle: max 55 characters',
    '  each benefit: max 35 characters',
    '  cta: max 22 characters',
    '  price_text: max 20 characters',
    '',
    'Return ONLY this JSON (no markdown, no backticks):',
    '{',
    '  "headline": "short impactful headline in ' + language + '",',
    '  "subtitle": "subtitle elaborating the main benefit in ' + language + '",',
    '  "benefits": ["benefit 1 in ' + language + '", "benefit 2 in ' + language + '", "benefit 3 in ' + language + '"],',
    '  "cta": "action CTA in ' + language + '",',
    '  "price_text": ' + priceJson,
    '}',
  ].join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: buildTextGenerationSystem(language) },
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

    retro_vintage: [
      'STYLE: Retro Vintage — Aged Americana / Artisan Heritage / Nostalgic Poster',
      '',
      'LAYOUT PHILOSOPHY: Every element looks hand-crafted and time-worn. The design feels like it was made decades ago and has been lovingly preserved.',
      '',
      'BACKGROUND AND TEXTURE:',
      '- Base background: warm kraft paper tone #F5E6C8 or aged cream #EDD9A3',
      '- MANDATORY TEXTURE OVERLAY: distressed noise/grain texture at 10% opacity across entire canvas — simulates aged paper or worn print',
      '- Subtle vignette: dark brown #2D1810 at 25% opacity fading inward from all four edges (60px feather)',
      '- Optional: faint horizontal scan lines at 3% opacity to simulate old print registration',
      '',
      'STAMP/BADGE ELEMENT (SIGNATURE):',
      '- Circular or rectangular border stamp design, centered top or bottom zone',
      '- Stamp border: 2px dashed or double-line in rust orange #C45C26 or dark brown #2D1810',
      '- Stamp text curves along the inside of the border (category or brand phrase)',
      '- Star or diamond ornamental marks at compass points on the stamp ring',
      '',
      'PRODUCT PLACEMENT:',
      '- Centered horizontally, 44% from top (classic centered composition)',
      '- Scale: 58-65% of frame height',
      '- WARM COLOR TREATMENT: product lighting has a warm sepia cast — 3000-3200K, single directional source upper-left at 45°',
      '- Aged photo edge: soft vignette specifically around the product at 15% dark brown opacity — looks like an old photograph',
      '- Optional: subtle vertical scratches or dust marks at 4% opacity over the product zone',
      '',
      'ORNAMENTAL DIVIDERS:',
      '- Between headline and subtitle: thin ornamental line with central diamond or leaf motif, #C45C26, full width minus 60px margins',
      '- Between benefits and CTA: same ornamental divider style',
      '- Decorative corner flourishes: 4 symmetrical ornamental corner pieces, dark brown #2D1810, 40x40px each, inset 24px from edges',
      '',
      'TYPOGRAPHY (all centered):',
      '- HEADLINE: Bold condensed slab serif or condensed serif, 56-64px, dark brown #2D1810, centered, ALL CAPS',
      '  Slight letter-press effect: subtle shadow offset 1px down-right at 30% opacity',
      '- SUBTITLE: Italic serif or script, 20px, rust orange #C45C26, centered, normal case',
      '- BENEFITS: 3 items, 15px, dark brown #2D1810, centered, separated by small star ★ or bullet in muted gold #B8860B',
      '- PRICE TAG: Starburst or banner shape behind price text — rust orange fill, white or cream price text bold 28px',
      '- CTA BUTTON: Rectangle with ornamental border (double line, 1px inner + 2px outer), dark brown text on cream background, 220px × 46px',
      '',
      'COLOR PALETTE: Warm cream #F5E6C8, rust orange #C45C26, dark brown #2D1810, muted gold #B8860B — ZERO modern colors, zero gradients.',
    ].join('\n'),

    editorial_magazine: [
      'STYLE: Editorial Magazine — Vogue / Elle / High-Fashion Spread',
      '',
      'LAYOUT PHILOSOPHY: Fashion photography meets advertising. Asymmetric, bold, dramatic. Text and product coexist in unexpected ways.',
      '',
      'BACKGROUND:',
      '- Choose based on product type for maximum editorial impact:',
      '  Light/pastel/neutral product → stark white #FFFFFF (creates graphic tension)',
      '  Dark/rich/jewel-toned product → deep black #0A0A0A (creates mystery)',
      '  Colorful/vibrant product → choose the MORE DRAMATIC option (usually black)',
      '- The background is a pure flat field — no gradients, no textures, maximum graphic impact',
      '',
      'HEADLINE DOMINANCE (SIGNATURE):',
      '- LARGE EDITORIAL HEADLINE takes up 32-38% of the total canvas height',
      '- Positioned in upper zone, may bleed slightly off the left edge',
      '- Font: ultra-bold condensed serif (like Bodoni or Didot style), massive scale 80-96px',
      '- Color: opposite of background — white on black, black on white',
      '- ALL CAPS, very tight tracking -0.03em, slightly compressed letter-forms',
      '- The headline is a GRAPHIC ELEMENT as much as text — it IS part of the composition',
      '',
      'PRODUCT PLACEMENT — DRAMATIC OFF-CENTER:',
      '- TILTED 8-12° clockwise or counter-clockwise (choose based on product shape)',
      '- Positioned right-center or left-center, offset from canvas middle by 15-20%',
      '- Scale: 65-72% of frame height — hero placement',
      '- Text BLEEDS OVER product: subtitle or category label overlaps the product corners at 2-3 edges',
      '- Dramatic directional studio lighting: single large softbox at 55° upper-left, deep shadows right side',
      '  For white background: light from above creating strong drop shadow on white',
      '  For black background: rim light from behind in ONE accent color only',
      '',
      'ACCENT COLOR — ONE ONLY:',
      '- Choose ONE accent color derived from the product itself (its dominant color)',
      '- This accent appears ONLY in: category label text, one thin rule line, price numeral',
      '- Everything else: pure black and white',
      '',
      'TYPOGRAPHY:',
      '- CATEGORY LABEL: ALL CAPS thin sans-serif, 11px, wide 0.4em tracking, accent color — top zone',
      '- HEADLINE: See above — massive condensed serif, dominant graphic element',
      '- SUBTITLE: Hairline-thin sans-serif, 15-16px, body text color, maximum 1 line below headline',
      '  If on black: #888888. If on white: #333333.',
      '- BENEFITS: 3 items, very small 12px, same thin sans-serif, subtle weight — de-emphasized',
      '- PRICE: Small elegant type, 14-16px, accent color, barely prominent — exclusivity over urgency',
      '  Format: simple numeral and currency, no decoration',
      '- CTA: Minimal text-only (no button shape), 13px ALL CAPS, thin weight, accent color',
      '',
      'COLOR RULE: Monochrome (black + white) + exactly ONE accent color. Nothing else.',
    ].join('\n'),

    social_story: [
      'STYLE: Social Story — Instagram / TikTok Gen-Z Aesthetic',
      '',
      'LAYOUT PHILOSOPHY: Looks like it was designed by a creative Gen-Z user, not a corporate studio. Fun, expressive, layered with personality. Sticker energy.',
      '',
      'BACKGROUND:',
      '- Choose one of two Gen-Z palettes based on product:',
      '  Bright pastels: soft lavender #E8D5FF, bubblegum pink #FFD6E7, mint #C8F7E4, sky #C5E8FF',
      '  Electric neons: hot pink #FF2D78, electric blue #0095FF, acid yellow #F9F500, neon green #39FF14',
      '- Solid color or two-tone diagonal split — not gradient, feels more graphic and intentional',
      '- Small doodle-style decorations scattered in background: stars ✦, small hearts ♥, tiny sparkles, wavy lines — hand-drawn feel, 20-30% opacity',
      '',
      'PRODUCT STICKER (SIGNATURE):',
      '- Product sits on a solid color rounded-rectangle "sticker" shape',
      '- Sticker background: white #FFFFFF solid fill',
      '- WHITE BORDER: 8px thick white stroke around the sticker shape — classic sticker look',
      '- Slight drop shadow below sticker: rgba(0,0,0,0.20), 12px blur, 4px down offset',
      '- Product centered in sticker, fills 75% of sticker area',
      '- Sticker centered on canvas, sticker fills approximately 55% of canvas width',
      '',
      'DOODLE DECORATIONS AROUND STICKER:',
      '- 4-6 small hand-drawn style elements near sticker edges: tiny arrows pointing at product, small star clusters, mini hearts, zigzag underlines',
      '- These are in accent colors from the palette — NOT on the product itself',
      '- Size: 16-32px, irregular placement, slight rotation each',
      '',
      'TYPOGRAPHY:',
      '- HEADLINE: Bold rounded bubble font (like Nunito Black or Fredoka One), 52-60px, dark #1A1A1A or deep version of palette color',
      '  Position: above sticker or below, centered',
      '  May have slight rotation ±2°',
      '- SUBTITLE: Rounded medium font, 18px, slightly lighter color or accent, centered',
      '- BENEFITS: 3 items, 14px rounded font, each on a small pill/tag shape background in pale accent color',
      '  Pill tags have 6px rounded corners, stacked vertically with 8px gap',
      '- PRICE BADGE: Fun shape — star, blob, or sunburst — in accent color, white bold price text centered inside',
      '  Price badge positioned near CTA or corner of sticker, slight rotation 3-5°',
      '- CTA: Rounded rectangle, 48px height, 200px width, bold 16px rounded font',
      '  Bold filled button in accent color with white or dark text — energetic, inviting',
      '',
      'OVERALL FEEL: Maximum fun, zero corporate. Feels hand-assembled, sticker-art style, scroll-stopping authenticity.',
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
  brandKit?: {
    brand_name: string | null
    primary_color: string | null
    tone: string | null
  } | null
}): Promise<string> {

  const cleanDescription = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 500)
    : 'Not available'

  const layout = getPromoStyleLayout(params.style)
  const b = params.promoText.benefits
  const priceDisplay = params.promoText.price_text || 'no price'

  // Controlled variation — guarantees uniqueness even for the same product and style
  const variationSeed = Date.now() % 20
  const variationDirectives = [
    // Composition & focal point
    'Emphasize the product\'s most distinctive visual feature as the undeniable focal point of the entire composition.',
    'Position the product slightly off-center using the rule of thirds — create dynamic tension and visual interest with intentional asymmetry.',
    'Make the product appear to emerge from or actively interact with the design elements surrounding it, blurring the line between product and poster.',
    'Compose the poster so the product is seen from a slightly unconventional angle that reveals its most interesting three-dimensional aspect.',
    'Design the layout so the eye travels a deliberate path — from headline, past the product, to the CTA — guiding the viewer with precision.',
    // Color & lighting
    'Design the color scheme to create the strongest possible contrast between product and background, making it impossible to look away.',
    'Let the product\'s dominant color inspire one unexpected bold accent that appears in the typography and one geometric element, tying everything together.',
    'Use a dramatically low-angle warm key light on the product (20° from the surface) to create long shadows and intense depth.',
    'Apply a cinematic golden-hour rim light from the upper rear — the product glows against the background as if lit by the setting sun.',
    'Choose a cool-temperature background (blue or deep teal tones) to make a warm-colored product pop with maximum chromatic contrast.',
    // Seasonal & contextual mood
    'Evoke a winter holiday premium feel — deep rich tones, subtle snowflake scatter at very low opacity, warm soft lighting on the product.',
    'Convey a bright summer energy — high-key lighting, airy whites or vivid tropical tones, the product looking fresh and inviting.',
    'Suggest a cozy autumn harvest mood — warm amber and burnt orange tones, soft diffused light, a grounded and inviting composition.',
    'Project a sleek spring-renewal freshness — clean pastels or soft greens, crisp lighting, a sense of optimism and new beginnings.',
    // Urgency & commercial energy
    'Maximize urgency: make the price display and CTA the second-most prominent element after the product — viewers should feel compelled to act now.',
    'Design around scarcity and exclusivity — the layout should feel like a limited-edition collector\'s announcement, with deliberate restraint and refinement.',
    'Create a "hero launch" energy — the product is treated like the star of a major reveal event, with dramatic lighting and announcement-style typography.',
    // Typography-led & graphic experiments
    'Design the typography scale so the headline commands maximum visual hierarchy — the text itself becomes a graphic element competing with the product.',
    'Use a bold geometric pattern or repeated motif (very subtle, 8% opacity) in the background to add texture depth without distracting from the product.',
    'Make the product feel as large and powerful as physically possible — push the scale to its limits while keeping all text elements perfectly readable.',
  ]
  const variationDirective = variationDirectives[variationSeed]

  // Brand identity section — only injected when brand kit data is available
  const brandSection = params.brandKit
    ? [
        '',
        'BRAND IDENTITY:',
        'Brand: ' + (params.brandKit.brand_name || 'Not specified'),
        'Primary color: ' + (params.brandKit.primary_color || 'Not specified') + ' — use as accent in design elements',
        'Brand tone: ' + (params.brandKit.tone || 'Not specified'),
      ].join('\n')
    : ''

  const userMessage = [
    'Write a detailed image generation prompt for an advertising poster for this product.',
    '',
    'PRODUCT: ' + params.productTitle,
    'Category: ' + (params.productCategory || 'general consumer product'),
    'Description: ' + cleanDescription,
    brandSection,
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
      const { product_id, style, language } = body

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

      // Prefer sale_price when available and non-zero
      const effectivePrice: number | null =
        (product.sale_price != null && product.sale_price > 0)
          ? product.sale_price
          : (product.price ?? null)

      const promoText = await generatePromoText({
        productTitle: product.optimized_title || product.original_title,
        productCategory: product.category,
        productDescription: product.optimized_short_description || product.original_description,
        price: effectivePrice,
        style,
        language: language || undefined,
      })

      return NextResponse.json({ promoText })
    }

    // ── Action: generate full promo image ─────────────────────────────────────
    const {
      product_id,
      style,
      language,
      reference_image_url,
      reference_image_base64,
      promo_text,
    } = body

    if (!style || !promo_text) {
      return NextResponse.json({ error: 'Stilul si textul sunt obligatorii' }, { status: 400 })
    }

    const limit = await rateLimitExpensive(userId, 'promo')
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
    let brandKit: { brand_name: string | null; primary_color: string | null; tone: string | null } | null = null

    // Fetch brand kit for the user (best-effort, does not block generation)
    const { data: brandKitData } = await supabase
      .from('brand_kits')
      .select('brand_name, primary_color, tone')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (brandKitData) brandKit = brandKitData

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
        brandKit,
      })

      console.log('[PromoGen] Prompt built (' + detailedPrompt.length + ' chars) style: ' + style + ' language: ' + (language || 'auto'))
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