import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { KieClient } from '@/lib/kie/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
// Note: rateLimitExpensive is now async but has sync fallback for backward compat
import { canStartJob, markJobRunning, markJobDone } from '@/lib/security/ai-guard'

// ─── Costuri per stil ─────────────────────────────────────────────────────────

// ─── Costuri per stil ─────────────────────────────────────────────────────────
const STYLE_COSTS: Record<string, number> = {
  white_bg: 2,
  lifestyle: 3,
  premium_dark: 3,
  industrial: 3,
  seasonal: 4,
  manual: 3,
}

// ─── SISTEM PROMPT GPT — PRODUS ───────────────────────────────────────────────
const PROMPT_BUILDER_SYSTEM = [
  'You are a world-class AI image prompt engineer specialized in commercial product photography for Flux-based models (Nano Banana Pro).',
  'Your prompts are legendary for two things: ABSOLUTE product fidelity and UNIQUE, surprising compositions that feel custom-made for each product.',
  '',
  '══════════════════════════════════════════════════════════════════',
  'CORE PHILOSOPHY — READ THIS FIRST',
  '══════════════════════════════════════════════════════════════════',
  '',
  'Every product deserves a unique visual story. You are NOT filling a template.',
  'You are a creative director who analyzes THIS specific product and designs the PERFECT photograph for IT.',
  'Two products should never produce the same prompt structure, same colors, same angle, or same mood.',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #1 — PRODUCT IDENTITY PRESERVATION (SACRED, NON-NEGOTIABLE)',
  '══════════════════════════════════════════════════════════════════',
  '',
  'The product from the reference image must be reproduced with 100% fidelity:',
  '- Shape and silhouette: EXACT — zero distortion, zero morphing, zero simplification',
  '- Proportions: exactly as reference — no stretching, no compression of any part',
  '- Colors: pixel-perfect — every shade, gradient, color zone reproduced exactly',
  '- Labels/text/logos ON the product: every character perfectly reproduced — no blurring, no invention',
  '- Packaging: if box/bottle/can/bag — the EXACT packaging artwork is reproduced',
  '- Materials: matte stays matte, glossy stays glossy, metallic stays metallic, transparent stays transparent',
  '- Physical details: buttons, seams, caps, handles, lids, knobs, embossing, stitching — all exact',
  '- NEVER add details that are not in the reference. NEVER remove details that are.',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #2 — UNIQUENESS REQUIREMENTS (MANDATORY)',
  '══════════════════════════════════════════════════════════════════',
  '',
  'Every prompt must be unique based on the product. To achieve this:',
  '',
  'A) PRODUCT COLOR RESPONSE: The scene colors and materials REACT to the product\'s dominant colors.',
  '   - Light product (white/cream/pastel) → use darker, richer environment to create contrast',
  '   - Dark product (black/navy/dark) → use lighter or dramatically lit environment',
  '   - Colorful product → use muted, neutral environment so product pops',
  '   - Monochrome product → allow one accent color from product in environment',
  '',
  'B) SHAPE-BASED ANGLE SELECTION: Product shape dictates the camera angle.',
  '   - Tall/vertical products (bottles, cans) → eye-level or slightly low angle',
  '   - Flat/horizontal products (packaging boxes, phones) → elevated 3/4 angle',
  '   - Round/cylindrical products → 3/4 front view showing depth',
  '   - Complex 3D shape (equipment, appliances) → 45° 3/4 angle showing maximum detail',
  '   - Small intricate products (jewelry, connectors) → close macro elevation',
  '',
  'C) MATERIAL CONTRAST PRINCIPLE: Surface material should contrast with product material.',
  '   - Metal product → wood or stone surface',
  '   - Plastic product → fabric, marble, or concrete surface',
  '   - Glass product → dark polished or matte stone surface',
  '   - Paper/cardboard product → wooden surface or clean fabric',
  '   - Fabric/soft product → hard surface (marble, metal, glass)',
  '',
  'D) CATEGORY-SPECIFIC MOOD: Product category dictates the emotional tone.',
  '   - Food/beverage → warm, appetizing, inviting',
  '   - Tech/electronics → clean, precise, modern',
  '   - Beauty/cosmetics → soft, aspirational, luxurious',
  '   - Industrial/tools → raw, strong, authentic',
  '   - Children/toys → playful, bright, safe',
  '   - Health/medical → clinical, clean, trustworthy',
  '   - Luxury items → dramatic, exclusive, editorial',
  '   - Sports/fitness → dynamic, energetic, motivational',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #3 — SCENE LOGIC (MANDATORY)',
  '══════════════════════════════════════════════════════════════════',
  '',
  'NEVER place a product in an illogical environment. Scene must make real-world sense:',
  '→ Automotive/tires/car parts → garage, workshop, asphalt, concrete',
  '→ Kitchen appliances/cookware → kitchen counter, dining surface, wooden board',
  '→ Cosmetics/skincare/beauty → bathroom vanity, marble, spa, dressing table',
  '→ Electronics/gadgets/tech → desk, office, clean modern surface, studio',
  '→ Tools/hardware/industrial → workshop bench, concrete, metal surfaces',
  '→ Beverages/spirits/coffee → bar counter, café table, rustic wood, kitchen',
  '→ Baby/children products → nursery, soft pastel environment, safe clean space',
  '→ Sports/fitness equipment → gym, outdoor athletic environment, sports facility',
  '→ Garden/outdoor tools → garden, patio, natural outdoor setting',
  '→ Fashion/clothing/accessories → lifestyle setting, clean surface, editorial context',
  '→ Medical/pharmacy/health → clean clinical white, pharmacy aesthetic',
  '→ Pet products → home environment, pet-friendly setting',
  '→ Food products/snacks → kitchen, dining table, food styling surface',
  '→ Cleaning products → clean bathroom, kitchen counter, utility space',
  '→ Books/stationery → desk, library, study environment',
  '→ Jewelry/luxury → dark velvet, marble, luxury editorial setting',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #4 — LIGHTING MUST MATCH PRODUCT AND STYLE',
  '══════════════════════════════════════════════════════════════════',
  '',
  'Lighting is not generic — it is engineered for THIS product:',
  '- Transparent/glass products → side or back lighting to reveal translucency',
  '- Reflective/metallic products → controlled specular highlights, avoid blown-out reflections',
  '- Matte products → diffused even lighting to show texture without harsh reflections',
  '- Dark products → rim lighting to define edges against dark background',
  '- Food products → warm front-side lighting for appetizing look',
  '- Small intricate products → close focused lighting for detail revelation',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #5 — PROMPT STRUCTURE (MANDATORY)',
  '══════════════════════════════════════════════════════════════════',
  '',
  'Structure your prompt in this order:',
  '1. Product fidelity opening statement (mandatory first sentence)',
  '2. Precise product description (what the model must reproduce)',
  '3. Scene and environment (specific, logical, with materials and textures)',
  '4. Lighting setup (technically precise: angles in degrees, color temp in Kelvin, equipment)',
  '5. Camera specifications (angle, lens mm equivalent, aperture, depth of field)',
  '6. Surface and materials in scene',
  '7. Atmosphere and mood',
  '8. Scene color palette (product colors are FIXED — only scene colors described here)',
  '9. Quality specifications (resolution, sharpness, camera equipment equivalent)',
  '10. Explicit prohibitions (specific to this product and style)',
  '',
  '══════════════════════════════════════════════════════════════════',
  'RULE #6 — TECHNICAL REQUIREMENTS',
  '══════════════════════════════════════════════════════════════════',
  '',
  '- Minimum 380 words, maximum 520 words',
  '- Every element hyper-specific — no vague terms like "nice lighting" or "good background"',
  '- Use precise photography terminology and measurements',
  '- Specify exact color values where critical (hex codes, Kelvin temperatures)',
  '- Name specific camera equipment equivalents (Hasselblad H6D, Canon EOS R5, Sony A7R IV)',
  '- Return ONLY the prompt text — no headers, no explanations, no markdown',
].join('\n')

// ─── Instrucțiuni per stil ────────────────────────────────────────────────────
function getStyleInstruction(style: string, manualDescription?: string): string {

  const styles: Record<string, string> = {

    white_bg: [
      'REQUESTED STYLE: Pure Professional E-Commerce Studio — White Background',
      '',
      'This is the commercial standard for marketplaces (Amazon, eMAG, Shopify).',
      '',
      'ENVIRONMENT:',
      '- Background: Pure seamless white #FFFFFF, infinite depth, zero horizon line, no gradients, no vignetting',
      '- The white must be perfectly neutral — not warm, not cool, pure white',
      '- No studio walls, floor edges, or seams visible anywhere',
      '',
      'LIGHTING — THREE-POINT STUDIO (adapt intensity and angle to product materials):',
      '- Key light: Large softbox at 40-50° camera-left, 50-70cm above product eye level, soft diffused illumination',
      '  → For matte products: larger softbox, more diffused',
      '  → For glossy/metallic: smaller, more controlled to avoid blown-out reflections',
      '- Fill light: Reflector or secondary softbox at 30° camera-right, 60-75% power of key, reduces shadow density',
      '- Rim/separation light: Narrow strip light directly behind-above product, separates silhouette from white',
      '- ADAPT: for transparent/glass products → add backlight through white plexi for glow effect',
      '',
      'CAMERA:',
      '- Hasselblad H6D or Canon EOS R5 equivalent, 85-100mm lens',
      '- Angle: chosen based on product shape (front-facing for labels, 3/4 for 3D objects, top-down for flat items)',
      '- Product fills 70-80% of frame, perfectly centered',
      '- f/8 to f/11 for maximum sharpness across entire product',
      '- ISO 100, zero noise, 8K resolution',
      '',
      'SURFACE:',
      '- Pure white seamless — product appears to float',
      '- Soft contact shadow below: low opacity, fading outward, indicates weight',
      '- Optional for premium products: very subtle glossy white surface reflection at 10-15% opacity',
      '',
      'PROHIBITIONS:',
      '- NO props, NO hands, NO humans, NO decorative elements',
      '- NO colored shadows, NO colored light spill',
      '- NO background patterns, textures, or gradients',
      '- NO lens flare, NO bokeh, NO atmospheric effects',
      '- NO alterations to the product — zero',
    ].join('\n'),

    lifestyle: [
      'REQUESTED STYLE: Aspirational Lifestyle Photography — Natural Real-World Context',
      '',
      'Show the product in its authentic natural environment, creating emotional connection and demonstrating real value.',
      '',
      'SCENE SELECTION — CRITICAL AND PRODUCT-SPECIFIC:',
      'Analyze the product deeply. Where does a REAL person actually USE or DISPLAY this product?',
      'Choose that exact environment. The scene must be 100% logical and authentic for this product type.',
      'The scene should tell a story about the product\'s actual purpose and the lifestyle of its user.',
      '',
      'ENVIRONMENT CONSTRUCTION:',
      '- Choose one specific, detailed environment (kitchen, bathroom, office, garage, garden, etc.)',
      '- Environment feels lived-in but aspirational — not sterile, not cluttered',
      '- 2-4 contextually appropriate props that suggest the product\'s use case',
      '- Props must be subordinate — they FRAME the product, never compete with it',
      '- Background details hint at a lifestyle without distracting from the product',
      '',
      'LIGHTING:',
      '- Natural light primary: soft directional light from window or open space',
      '- Color temperature: 3200-4000K warm natural for cozy interiors, 5500K daylight for outdoor/bright spaces',
      '- Quality: diffused, soft-edged shadows adding depth without harshness',
      '- Optional: subtle bounce light from reflector to soften shadows',
      '',
      'CAMERA:',
      '- Canon EOS R5 with 50mm f/1.8 or 85mm f/1.4 equivalent',
      '- Rule of thirds composition — product at strong intersection point',
      '- f/2.8 to f/4 — product tack-sharp, background progressively blurred',
      '- Background blur reveals context without distracting',
      '',
      'COLOR AND MOOD:',
      '- Scene colors harmonize with and enhance the product\'s own colors — never clash',
      '- Environment palette should make the product\'s colors feel more vibrant or more premium',
      '- Overall mood: inviting, aspirational — viewer wants to be in this scene',
      '',
      'PROHIBITIONS:',
      '- NO illogical prop placement',
      '- NO props that obscure the product',
      '- NO alterations to the product itself',
    ].join('\n'),

    premium_dark: [
      'REQUESTED STYLE: High-End Dark Premium — Luxury Advertising Editorial',
      '',
      'The aesthetic of Apple launches, premium watch ads, luxury perfume campaigns.',
      '',
      'BACKGROUND:',
      '- Deep rich near-black — NOT pure #000000 but refined: #0A0A0F to #1A1A2E based on product color response',
      '  → Light product → darker near-black background for maximum contrast',
      '  → Product with warm colors → background with very subtle warm undertone #1A1208',
      '  → Product with cool colors → background with subtle blue depth #0D0D1A',
      '- Background texture: barely visible at 5-8% opacity, chosen for product category:',
      '  → Tech/electronics: very faint brushed metal grain',
      '  → Cosmetics/luxury: subtle dark marble veining',
      '  → Fashion/accessories: subtle dark fabric weave',
      '  → Spirits/beverages: dark polished wood grain suggestion',
      '  → Industrial/tools: dark concrete micro-texture',
      '',
      'LIGHTING — DRAMATIC STUDIO:',
      '- Primary key: narrow beam from above-left at 55-65°, dramatic directional, sculpts product form',
      '- Rim light: strong edge light from behind-right, luminous halo on product edges — SIGNATURE ELEMENT',
      '  → For metallic products: cooler rim light (5000K) for crisp metallic sheen',
      '  → For organic/cosmetic products: warmer rim (3000K) for softness',
      '- Subtle under-fill: 10-15% power from front-below, reveals shadow detail without killing drama',
      '- Result: product appears to glow against darkness',
      '',
      'SURFACE:',
      '- Dark reflective surface: black tempered glass, polished dark granite, or brushed dark metal',
      '- Perfect mirror reflection fading to black over 30-40% of product height',
      '',
      'CAMERA:',
      '- Hasselblad or Phase One equivalent, 100mm lens',
      '- Slight low angle: camera 5-10° below product center — product appears powerful and monumental',
      '- Product fills 55-65% of frame, breathing room all sides',
      '',
      'PROHIBITIONS:',
      '- NO bright or colorful backgrounds',
      '- NO natural light or warm lifestyle feel',
      '- NO clutter or props other than surface reflection',
      '- NO alterations to product',
    ].join('\n'),

    industrial: [
      'REQUESTED STYLE: Raw Industrial / Artisan Authenticity',
      '',
      'Honest materials, real environments, authentic craftsmanship. The product belongs here.',
      '',
      'CRITICAL STYLE ADAPTATION PER PRODUCT TYPE:',
      '- Tools/hardware/automotive/machinery → full raw industrial: workshop, concrete, metal, worn surfaces',
      '- Food/spirits/artisan goods → artisan cellar/workshop: aged wood, stone, natural textures',
      '- Outdoor/adventure products → rugged natural environments: rock, earth, weathered wood',
      '- Other products → rustic artisan version: natural worn materials (wood, stone, linen)',
      '',
      'ENVIRONMENT:',
      '- Character: visible wear, patina, history, authenticity — NOT new or sterile',
      '- Surface options (choose what contrasts best with the product\'s own material):',
      '  → Weathered reclaimed wood: visible grain, knots, nail holes, natural color variation',
      '  → Rough raw concrete: aggregate visible, slight surface variation, matte',
      '  → Oxidized metal sheet: patina patterns, texture variation, raw authenticity',
      '  → Natural stone slab: unfinished edges, natural grain, organic texture',
      '',
      'LIGHTING — DIRECTIONAL AND DRAMATIC:',
      '- Single strong directional source: late-afternoon sun through industrial window at 90-120° side angle',
      '- Quality: hard-to-medium edge — defined shadows with slight softness, deep texture-revealing shadows',
      '- Color temperature: 3500-4000K, warm golden-hour quality',
      '- Secondary: subtle ambient fill from opposite side at 20-25% power',
      '- The lighting must make EVERY TEXTURE POP',
      '',
      'CAMERA:',
      '- 35mm or 50mm lens equivalent, slight environmental context visible',
      '- Off-center composition: product on rule-of-thirds intersection',
      '- f/5.6 to f/8: product sharp, background recognizable but soft',
      '',
      'COLOR AND MOOD:',
      '- Environment: desaturated, muted — warm grays, earth browns, aged greens',
      '- Product colors preserved exactly but enhanced by muted environment contrast',
      '- Overall: warm, rich, honest — analog editorial feeling',
      '',
      'PROHIBITIONS:',
      '- NO sterile or new-looking surfaces',
      '- NO bright colorful backgrounds',
      '- NO alterations to product',
    ].join('\n'),

    seasonal: [
      'REQUESTED STYLE: Festive Seasonal / Holiday Gift Photography',
      '',
      'Warmth, celebration, the desire to give and receive. The product becomes a perfect gift.',
      '',
      'CRITICAL SCENE ADAPTATION PER PRODUCT TYPE:',
      '- Food/beverages/gourmet → festive dining table, holiday feast setting',
      '- Beauty/cosmetics/personal care → holiday gift set presentation, elegant wrapping context',
      '- Toys/children\'s products → bright cheerful holiday morning, colorful seasonal setting',
      '- Technology/electronics → modern minimal holiday setting, subtle seasonal accents',
      '- Fashion/accessories → gift-box presentation, elegant holiday styling',
      '- Home products → beautifully decorated holiday interior',
      '- Tools/practical items → tasteful minimal seasonal accents, not forced',
      '',
      'SCENE CONSTRUCTION:',
      '- Primary surface: warm-toned wood, velvet, or stone with warm color temperature',
      '- Product is the clear hero — centered or prominently featured',
      '- Seasonal props FRAME the product, never cover it (maximum 6-7 props):',
      '  → Natural: pine branches, pine cones, dried orange slices, cinnamon sticks, eucalyptus',
      '  → Decorative: small glass ornaments, gold/red ribbon, gift tags, holly berries',
      '  → Atmospheric: small candles (subtle glow), fairy lights bokeh in background',
      '  → Props must be proportionally appropriate to the product size',
      '',
      'LIGHTING — WARM AND MAGICAL:',
      '- Primary: warm ambient simulating candlelight or fireplace glow, 2700-3000K',
      '- Quality: soft, enveloping, low-contrast — no harsh shadows, everything bathed in warmth',
      '- Background bokeh: out-of-focus fairy lights creating golden bokeh circles (f/1.8-f/2.8 effect)',
      '- Product must be the brightest, most clearly lit element in the composition',
      '',
      'CAMERA:',
      '- 85mm f/1.8 or 50mm f/1.4 equivalent',
      '- Slightly elevated angle (15-20°) to show table arrangement',
      '- Product tack-sharp, foreground props slightly soft, background bokeh',
      '',
      'COLOR PALETTE:',
      '- Environment: deep forest green, burgundy red, warm gold, cream white, rich walnut brown',
      '- Everything warm — no cold colors, no blue tones, no modern minimalism',
      '',
      'PROHIBITIONS:',
      '- NO cold or blue lighting',
      '- NO props that block the product',
      '- NO alterations to product',
    ].join('\n'),

    manual: [
      'REQUESTED STYLE: Custom User-Defined Creative Direction',
      '',
      'Execute the user\'s creative vision with maximum technical detail:',
      '1. Fully realize the user\'s vision — do not water it down',
      '2. Ensure the scene makes logical sense for this specific product type',
      '3. Maintain ALL product fidelity rules — only the environment changes',
      '4. Fill in all technical details the user didn\'t specify, making intelligent choices',
      '5. If the user\'s description would create an illogical product placement, adapt to the nearest logical version while preserving the creative spirit',
    ].join('\n'),
  }

  if (style === 'manual' && manualDescription) {
    return styles.manual + '\n\nUSER\'S CREATIVE BRIEF: "' + manualDescription + '"\n\nExecute this vision with full technical precision while maintaining product fidelity and scene logic.'
  }

  return styles[style] || styles.white_bg
}

// ─── GPT prompt builder ───────────────────────────────────────────────────────
async function buildPromptWithGPT(params: {
  productTitle: string
  productCategory: string | null
  productDescription: string | null
  style: string
  manualDescription?: string
}): Promise<string> {
  const cleanDescription = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 700)
    : 'Not available'

  // Seed de variație bazat pe timestamp — garantează unicitate chiar pentru același produs
  const variationSeed = Date.now() % 10000
  const variationHints = [
    'Choose an unexpected but logical camera angle that best reveals this product\'s unique shape.',
    'Focus on creating maximum contrast between the product\'s dominant color and the scene.',
    'Emphasize the product\'s most distinctive physical feature through lighting and composition.',
    'Design the scene around the emotional feeling this product evokes in its target customer.',
    'Create depth and layers in the scene while keeping the product as the undisputed hero.',
  ]
  const variationHint = variationHints[variationSeed % variationHints.length]

  const userMessage = [
    'Write a complete, ultra-detailed, UNIQUE product photography prompt for Nano Banana Pro.',
    '',
    '═══════════════════════════════════════════',
    'PRODUCT:',
    '═══════════════════════════════════════════',
    'Title: ' + params.productTitle,
    'Category: ' + (params.productCategory || 'Not specified — infer from title and description'),
    'Description: ' + cleanDescription,
    '',
    '═══════════════════════════════════════════',
    'STYLE DIRECTION:',
    '═══════════════════════════════════════════',
    getStyleInstruction(params.style, params.manualDescription),
    '',
    '═══════════════════════════════════════════',
    'CREATIVE DIRECTION FOR THIS SPECIFIC GENERATION:',
    '═══════════════════════════════════════════',
    variationHint,
    '',
    '═══════════════════════════════════════════',
    'YOUR TASK — THREE STEPS:',
    '═══════════════════════════════════════════',
    '',
    'STEP 1 — DEEP PRODUCT ANALYSIS (internal reasoning, do NOT include in output):',
    '- What is this product exactly? What is its function?',
    '- What materials compose it? (glass, brushed metal, matte plastic, fabric, cardboard, food, etc.)',
    '- What are its dominant colors? Secondary colors? Any accent colors?',
    '- What is its shape profile? (cylindrical, rectangular box, flat, irregular, complex 3D)',
    '- What physical details make it uniquely identifiable? (label design, logo position, cap style, texture)',
    '- Who is the real target customer? What lifestyle do they have?',
    '- What SIZE is this product relative to common objects?',
    '',
    'STEP 2 — UNIQUE DESIGN DECISIONS (internal reasoning, do NOT include in output):',
    'Apply the uniqueness principles from your system instructions:',
    '- What background color/material creates the BEST contrast with this product\'s dominant color?',
    '- What camera angle reveals the most interesting and informative view of this specific product\'s shape?',
    '- What surface material contrasts best with the product\'s own material?',
    '- What lighting type best serves this specific product\'s materials (matte, glossy, transparent, metallic)?',
    '- What specific unique element will make this image feel custom-designed for this exact product?',
    '',
    'STEP 3 — WRITE THE PROMPT:',
    '',
    'MANDATORY FIRST SENTENCE (copy exactly):',
    '"Reproduce the EXACT product from the reference image with absolute fidelity — identical shape, proportions, colors, labels, text, logos, packaging details, material finishes, and every physical characteristic — zero alterations permitted to the product itself."',
    '',
    'Then continue describing in full technical detail:',
    '1. The product: what the model must reproduce exactly (physical details, materials, finish)',
    '2. Scene and environment: specific setting, surfaces, textures with exact material descriptions',
    '3. Lighting: exact angles in degrees, color temperatures in Kelvin, equipment equivalents, quality',
    '4. Camera: specific angle, lens mm equivalent, aperture f-stop, depth of field effect',
    '5. Surface: exact material, texture description, finish',
    '6. Atmosphere: mood, color grading of environment, emotional quality',
    '7. Scene color palette: exact hex values or precise color descriptions (NEVER change product colors)',
    '8. Quality: camera equipment equivalent, resolution, sharpness requirements',
    '9. Prohibitions: explicit list of what must NOT appear (specific to this product and style)',
    '',
    'BE HYPER-SPECIFIC. Use exact measurements, exact color values, exact angles.',
    'Write 380-520 words. Make every word earn its place.',
  ].join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPT_BUILDER_SYSTEM },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.6,
    max_tokens: 950,
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

    // Rate limit (async cu Redis)
    const limit = await rateLimitExpensive(userId, 'image')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe cereri. Așteaptă un minut.' }, { status: 429 })
    }

    // Concurrent job limit
    const jobCheck = canStartJob(userId)
    if (!jobCheck.allowed) {
      return NextResponse.json({ error: jobCheck.reason }, { status: 429 })
    }

    const body = await request.json()
    const {
      product_id,
      style,
      manual_description,
      reference_image_url,
      reference_image_base64,
    } = body

    if (!style) {
      return NextResponse.json({ error: 'Stilul este obligatoriu' }, { status: 400 })
    }
    if (style === 'manual' && !manual_description?.trim()) {
      return NextResponse.json({ error: 'Descrierea manuală este obligatorie pentru stilul manual' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const creditCost = STYLE_COSTS[style] || 3

    // Verifică creditele
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < creditCost) {
      return NextResponse.json(
        { error: `Credite insuficiente. Ai nevoie de ${creditCost} credite.` },
        { status: 400 }
      )
    }

   
    const newCreditsUpfront = user.credits - creditCost
    await supabase.from('users').update({ credits: newCreditsUpfront }).eq('id', userId)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -creditCost,
      balance_after: newCreditsUpfront,
      description: `Generare imagine AI (rezervare)`,
      reference_type: 'image_generation',
    })

    // ── Determină imaginea de referință și detaliile produsului ────────────
    let refImageUrl: string | null = null
    let productTitle = 'Product'
    let productCategory: string | null = null
    let productDescription: string | null = null
    let productDbId: string | null = null

    if (product_id) {
      // Produs din DB
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .eq('user_id', userId)
        .single()

      if (!product) {
        return NextResponse.json({ error: 'Produs negăsit' }, { status: 404 })
      }

      productTitle = product.optimized_title || product.original_title || 'Product'
      productCategory = product.category
      productDescription = product.optimized_short_description || product.original_description
      productDbId = product.id

      // Imaginea de referință: din request > prima imagine din produs
      if (reference_image_url) {
        refImageUrl = reference_image_url
      } else if (product.original_images?.length > 0) {
        refImageUrl = product.original_images[0]
      }
    } else if (reference_image_base64) {
      // Upload manual — extragem URL-ul după upload în Supabase Storage
      try {
        const base64Data = reference_image_base64.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const fileName = `uploads/${userId}/${Date.now()}.jpg`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName)

        refImageUrl = urlData.publicUrl
        productTitle = 'Uploaded Product'
      } catch (err) {
        console.error('Upload error:', err)
        return NextResponse.json({ error: 'Eroare la upload-ul imaginii' }, { status: 500 })
      }
    }

    if (!refImageUrl) {
      return NextResponse.json(
        { error: 'Imaginea de referință lipsește. Selectează sau încarcă o imagine.' },
        { status: 400 }
      )
    }

    // ── Concurrent job guard ───────────────────────────────────────────────
    const jobKey = `${userId}:image:${productDbId || 'upload'}`
    if (!markJobRunning(jobKey)) {
      return NextResponse.json(
        { error: 'O imagine este deja în curs de generare.' },
        { status: 409 }
      )
    }

    // ── Creează înregistrarea în DB ────────────────────────────────────────
    const insertData: Record<string, unknown> = {
      user_id: userId,
      style,
      original_image_url: refImageUrl,
      status: 'processing',
      credits_used: creditCost,
    }

    // product_id e opțional — doar dacă avem un produs selectat
    if (productDbId) {
      insertData.product_id = productDbId
    }

    const { data: imageRecord, error: insertError } = await supabase
      .from('generated_images')
      .insert(insertData)
      .select()
      .single()

    if (insertError || !imageRecord) {
      markJobDone(jobKey)
      console.error('DB insert error:', insertError)
      return NextResponse.json(
        { error: 'Eroare la salvarea în baza de date: ' + (insertError?.message || 'unknown') },
        { status: 500 }
      )
    }

    const startTime = Date.now()
    try {
      // ── PASUL 1: GPT construiește promptul ultra-detaliat ────────────────
      const detailedPrompt = await buildPromptWithGPT({
        productTitle,
        productCategory,
        productDescription,
        style,
        manualDescription: manual_description,
      })

      console.log(`[ImageGen] GPT prompt built (${detailedPrompt.length} chars) for style: ${style}`)
      console.log('[ImageGen] Prompt preview:', detailedPrompt.substring(0, 600))

      // Salvăm promptul în DB
      await supabase
        .from('generated_images')
        .update({ prompt: detailedPrompt })
        .eq('id', imageRecord!.id)

      // ── PASUL 2: Nano Banana Pro generează imaginea ──────────────────────
      const kie = new KieClient()

      const numVariants = body.num_variants || 1
      const taskId = await kie.createImageTask(detailedPrompt, [refImageUrl], {
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
      })

      // Save task_id so SSE progress endpoint can poll it
      await supabase
        .from('generated_images')
        .update({ seed: taskId })
        .eq('id', imageRecord!.id)

      markJobDone(jobKey)

      // Return task_id immediately — client uses SSE /api/generate/progress to track
      return NextResponse.json({
        success: true,
        task_id: taskId,
        image_record_id: imageRecord!.id,
        mode: 'async', // client should open SSE stream
        image: {
          id: imageRecord!.id,
          style,
          credits_used: creditCost,
          status: 'processing',
        },
        credits_remaining: newCreditsUpfront,
      })

    } catch (err) {
      markJobDone(jobKey)

      await supabase
        .from('generated_images')
        .update({ status: 'failed' })
        .eq('id', imageRecord!.id)

      console.error('Image generation error:', err)
      return NextResponse.json(
        { error: 'Eroare la generarea imaginii: ' + (err as Error).message },
        { status: 500 }
      )
    }

    // Cod sincron eliminat — creditele se deduc upfront, generarea e 100% async via SSE
  } catch (err) {
    console.error('Generate image route error:', err)
    return NextResponse.json(
      { error: 'Eroare internă: ' + (err as Error).message },
      { status: 500 }
    )
  }
}