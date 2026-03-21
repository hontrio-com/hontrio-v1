import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'
import { KieClient } from '@/lib/kie/client'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
// Note: rateLimitExpensive is now async but has sync fallback for backward compat
import { canStartJob, markJobRunning, markJobDone } from '@/lib/security/ai-guard'

// ─── Cost per style ───────────────────────────────────────────────────────────
const STYLE_COSTS: Record<string, number> = {
  white_bg: 6,
  lifestyle: 7,
  premium_dark: 7,
  industrial: 7,
  seasonal: 8,
  manual: 7,
}

// ─── GPT system prompt — product photography ──────────────────────────────────
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
  '- Colors: ABSOLUTELY pixel-perfect — every shade, gradient, color zone MUST BE reproduced EXACTLY as in the reference. This is the #1 most critical requirement. ANY color shift = total failure.',
  '- COLOR WARNING: The AI model tends to shift product colors based on the environment lighting. EXPLICITLY state in the prompt that product colors must NOT be affected by scene lighting. Specify the EXACT product colors and mandate they remain unchanged.',
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

// ─── Instructions per style ───────────────────────────────────────────────────
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
  brandKit?: { primary_color: string; secondary_color: string; accent_color: string; brand_name: string; tone: string }
  topRatedPrompts?: { prompt: string | null; rating: number }[]
}): Promise<string> {
  const cleanDescription = params.productDescription
    ? params.productDescription.replace(/<[^>]*>/g, '').substring(0, 700)
    : 'Not available'

  // Variation seed based on timestamp — guarantees uniqueness even for the same product
  // True random variation — different every generation, even for the same product
  const variationHints = [
    'LIGHTING MOOD — GOLDEN HOUR: Bathe the entire scene in 2700K amber-gold directional light as if late-afternoon sun is streaming from camera-left at 15° above horizontal. The scene surface catches this warm glow and the product casts a long, dramatic shadow stretching right. Add a subtle secondary warm fill from below at 10% power. Composition: rule of thirds, product placed on the left intersection point with rich negative space opening to the right.',
    'LIGHTING MOOD — BLUE HOUR: Envelop the scene in cool 5500-6000K ambient light simulating outdoor dusk. Deep blue-gray shadows fill the scene, making the product the brightest, warmest element in the frame. Add a subtle warm rim light from directly behind the product at 3000K to give it a luminous edge that separates it from the cool background. Composition: product centered, deep moody negative space recedes behind it.',
    'LIGHTING MOOD — DRAMATIC STUDIO: Single large 120cm octabox at 55° upper-left as key light, a tight strip reflector at 30° camera-right as fill at 40% power, zero ambient. Clinical precision. Every material surface — matte, glossy, metallic, transparent — should be rendered with absolute clarity. No mystery, only exactness. Composition: off-center hero, product placed at right third of frame, strong left negative space.',
    'LIGHTING MOOD — NEON ACCENT: Primary scene illumination from a narrow LED strip light in a hue complementary to the product\'s dominant color, casting a colored rim along the product\'s right edge. Front fill is neutral soft 5000K at low power. The background retains a moody, near-dark atmosphere. Composition: close macro angle, product fills 80% of frame, colored light streak adds drama.',
    'LIGHTING MOOD — NATURAL SOFT DIFFUSED: Soft, diffused overcast daylight from a large imaginary north-facing window camera-left, 5000K neutral white, perfectly even. Gentle gradual shadows on the right side of the product. The overall mood is organic, calm, and authentic — zero studio artifice. Composition: elevated 3/4 angle at 25° above horizontal, showing the product\'s top surface and front face simultaneously.',
    'LIGHTING MOOD — HARD DIRECTIONAL: A single bare-bulb spotlight or narrow snoot at 90° side angle, creating crisp hard-edged shadows that fall dramatically across the scene surface. The shadow itself becomes a strong graphic design element. No fill light — full dramatic contrast. Composition: wide establishing shot, product at rule-of-thirds intersection, shadow extends across visible surface.',
    'LIGHTING MOOD — CINEMATIC BACKLIGHT: Place the primary light source directly behind the product, slightly above, creating a powerful rim halo that separates the product from the background. The product\'s front face is lit only by a very soft 15% fill from front. This creates an otherworldly, luminous quality. Background is 3 stops darker than the product rim. Composition: product dead center, symmetrical.',
    'LIGHTING MOOD — UNDERWATER/AQUATIC: Cool 4200K ambient with subtle caustic light patterns (light refracting through water) on the surface beneath the product. The light creates gentle moving ripple patterns on background and surface. Ultra-clean, refreshing, modern feel. Composition: product at 2/3 height of frame, lower third shows rippling surface.',
    'COMPOSITION — CLOSE MACRO: Position the camera extremely close to the product, filling the frame with just the most visually compelling portion. Show textures, materials, label details, and surface finish at near 1:1 scale. Background dissolves into pure smooth bokeh. Lighting: very soft even illumination from above to reveal texture without harsh reflections.',
    'COMPOSITION — WIDE ENVIRONMENTAL STORYTELLING: Pull back to show the product within its complete, rich natural environment. The product occupies 35-40% of the frame — the remainder tells a vivid story of where and how it is used. Background fully in focus at f/8, clearly readable. Choose the environment that most powerfully communicates the product\'s real-world purpose.',
    'COMPOSITION — DYNAMIC EDGE TENSION: Place the product at an extreme edge of frame — either far left 20% or far right 20% of the canvas — with vast, dramatically lit negative space on the opposite side. The negative space is a deep, rich, perfectly graduated tone. Camera angle is 10-12° below the product\'s center, making it appear powerful and monumental.',
    'COMPOSITION — ELEVATED BIRD\'S EYE: Camera positioned directly above the product at 90° (flat lay). Product surrounded by a carefully curated arrangement of contextually relevant props forming a radial composition. All elements on a single flat surface — marble, wood, or linen. Lighting: even, soft, shadowless from directly above. Clean editorial magazine feel.',
    'COMPOSITION — MIRROR REFLECTION: Product placed on an ultra-glossy black or dark surface that creates a perfect mirror reflection. Camera is at a very low 8-12° angle, capturing both the product and its inverted reflection in one seamless image. Lighting: tight controlled to avoid reflection blow-outs. Deep dark background, product is the brightest element.',
    'SCENE STORY — MORNING RITUAL: Design the scene to evoke the precise moment of a morning routine where this product plays a starring role. Warm early morning light (3200K) streams in from the side. The surface is natural wood or white marble. One or two subtle morning context props frame the product without competing with it. The mood is fresh, optimistic, purposeful.',
    'SCENE STORY — GIFT PRESENTATION: Style the product as the hero of a premium gift-reveal moment. The product sits perfectly centered on dark velvet or brushed premium surface. Subtle gift context in background: a partially open elegant box, a curl of satin ribbon, premium tissue paper folds. Lighting is warm and celebratory (3000K from above).',
    'SCENE STORY — PROFESSIONAL MASTERY: Show the product in the context of expert, professional use. The environment signals skill and quality: a craftsman\'s workshop bench, a professional chef\'s kitchen, a well-organized designer\'s studio. Two to three professional-grade props validate the product\'s quality. Lighting: cool 4500K side window light.',
    'SCENE STORY — OUTDOOR ADVENTURE: The product is photographed in a dramatic natural outdoor environment — a rocky mountain overlook, a misty forest clearing, or a coastal cliff edge. Natural light is powerful and directional (overcast diffused or golden hour). The product sits on a natural surface (rock, weathered wood, mossy stone). Background is the breathtaking landscape.',
    'SCENE STORY — URBAN MINIMAL: The product is photographed on a clean urban surface — polished concrete, brushed steel, or sealed stone. The environment hints at a modern city context through background architectural elements (soft bokeh of glass and steel). Cool 5000K artificial urban light, crisp and precise. The product looks at home in a contemporary professional context.',
    'SURFACE — FLOATING ELEVATION: The product appears to float 3-5cm above the surface, creating a perfect shadow below from strategic lighting. The surface itself is empty, perfectly lit, and the product is the only element. This "floating product" effect gives a premium, otherworldly quality. The floating shadow must look physically accurate and beautiful.',
    'ATMOSPHERE — MISTY DEPTH: Introduce a very subtle atmospheric haze or mist at 8% opacity in the background, progressively denser away from the product. The product is crystal clear and sharp; the environment recedes softly into the haze. Adds cinematic depth and a mysterious, evocative quality. Works best with warm or cool monochromatic color schemes.',
    'ATMOSPHERE — PETRICHOR/RAIN: The surface appears wet with a thin film of water, creating subtle reflections and a fresh, earthy atmosphere. The product remains perfectly dry and pristine — only the surface around it shows the wet effect. Overhead soft daylight at 5500K. The wet surface reflection adds beauty and uniqueness to the composition.',
    'TEXTURE FOCUS — EXTREME MATERIAL DETAIL: Choose the surface material that creates the maximum interesting texture contrast with the product\'s own material. Render the surface texture with extreme detail — every fiber, grain, crystalline structure, or pore visible at macro level. The surface texture itself becomes a visual supporting character. Lighting designed to skim across the surface and reveal maximum texture depth.',
    'MOOD — ULTRA MINIMAL: Reduce the composition to its most essential elements. The product on a single colored background — the background color chosen to be the exact complementary color that makes the product\'s dominant hue vibrate with maximum chromatic intensity. Zero props. Zero surface texture. Perfect lighting from one direction. Absolute economy of elements.',
    'MOOD — TONAL HARMONY: The entire composition uses a strict monochromatic color scheme derived from the product\'s own dominant color. Background, surface, and any props are all different values (light-dark) of the same hue family. The product appears to emerge from its environment as a unified tonal poem. Lighting must create enough value contrast to separate the product from the background.',
  ]
  const variationHint = variationHints[Math.floor(Math.random() * variationHints.length)]

  // Add brand context if available
  const brandContext = params.brandKit ? [
    '',
    '═══════════════════════════════════════════',
    'BRAND IDENTITY (incorporate subtly into scene):',
    '═══════════════════════════════════════════',
    params.brandKit.brand_name ? `Brand: ${params.brandKit.brand_name}` : '',
    params.brandKit.primary_color ? `Primary brand color: ${params.brandKit.primary_color} — use as accent in scene elements (NOT on the product)` : '',
    params.brandKit.tone ? `Brand tone: ${params.brandKit.tone} — let this influence the mood and atmosphere` : '',
    'IMPORTANT: Brand colors should appear in scene elements (background accents, props, lighting tint) but NEVER alter the product itself.',
  ].filter(Boolean) : []

  // Add top-rated prompts feedback context if available
  const feedbackContext = (params.topRatedPrompts && params.topRatedPrompts.length > 0) ? [
    '',
    '═══════════════════════════════════════════════════════════════════',
    'PROVEN SUCCESSFUL APPROACHES (learn from these — adapt, don\'t copy):',
    'Style patterns that this user rated highly (4-5 stars):',
    params.topRatedPrompts.map((p, i) => `Example ${i + 1} (${p.rating}★): ${p.prompt?.slice(0, 300)}...`).join('\n\n'),
    'Apply similar composition thinking, lighting approach, and atmosphere — but create something NEW and UNIQUE for this specific product.',
    '═══════════════════════════════════════════════════════════════════',
  ] : []

  const userMessage = [
    'Write a complete, ultra-detailed, UNIQUE product photography prompt for Nano Banana Pro.',
    ...brandContext,
    ...feedbackContext,
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
    '"Reproduce the EXACT product from the reference image with absolute fidelity — identical shape, proportions, colors (CRITICALLY IMPORTANT: product colors must remain EXACTLY as in the reference — no color shifting from environment lighting, no desaturation, no tinting), labels, text, logos, packaging details, material finishes, and every physical characteristic — zero alterations permitted to the product itself. The product\'s color palette is SACRED and must be preserved pixel-perfectly regardless of scene lighting or background."',
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
    '',
    '════════════════════════════════════════',
    'MANDATORY FINAL PARAGRAPH (include at the very end of every prompt):',
    '════════════════════════════════════════',
    '"ABSOLUTE FINAL REQUIREMENT: The product rendered in this image must be PHOTOGRAPHICALLY IDENTICAL to the product shown in the reference image — same exact shape, same exact proportions, same exact colors (not shifted, not tinted, not desaturated — EXACTLY as in the reference), same exact labels/logos/text, same exact materials and finishes. This is a PHOTOGRAPH reproduction, not a stylized reimagining. Do NOT create a generic version of this product category. Do NOT simplify, do NOT redesign, do NOT stylize the product itself. Only the environment, lighting, and setting are creative — the product is SACRED and reproduced with zero alterations."',
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit (async with Redis)
    const limit = await rateLimitExpensive(userId, 'image')
    if (!limit.success) {
      return NextResponse.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 })
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
      return NextResponse.json({ error: 'Style is required' }, { status: 400 })
    }
    if (style === 'manual' && !manual_description?.trim()) {
      return NextResponse.json({ error: 'Manual description is required for manual style' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const creditCost = STYLE_COSTS[style] || 3

    // Check credits
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    if (!user || user.credits < creditCost) {
      return NextResponse.json(
        { error: `Insufficient credits. You need ${creditCost} credits.` },
        { status: 402 }
      )
    }

    // Atomically deduct credits via RPC — prevents race conditions
    const { data: newCreditsUpfront, error: deductError } = await supabase.rpc('deduct_credits', { p_user_id: userId, p_amount: creditCost })
    if (deductError || newCreditsUpfront === null) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: -creditCost,
      balance_after: newCreditsUpfront,
      description: `AI Image Generation (reservation)`,
      reference_type: 'image_generation',
    })

    // ── Determine reference image and product details ─────────────────────
    let refImageUrl: string | null = null
    let productTitle = 'Product'
    let productCategory: string | null = null
    let productDescription: string | null = null
    let productDbId: string | null = null

    if (product_id) {
      // Product from DB
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .eq('user_id', userId)
        .single()

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      productTitle = product.optimized_title || product.original_title || 'Product'
      productCategory = product.category
      productDescription = product.optimized_short_description || product.original_description
      productDbId = product.id

      // Reference image: from request > first product image
      if (reference_image_url) {
        refImageUrl = reference_image_url
      } else if (product.original_images?.length > 0) {
        refImageUrl = product.original_images[0]
      }
    } else if (reference_image_base64) {
      // Manual upload — extract URL after uploading to Supabase Storage
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
        return NextResponse.json({ error: 'Error uploading image' }, { status: 500 })
      }
    }

    if (!refImageUrl) {
      return NextResponse.json(
        { error: 'Reference image is missing. Select or upload an image.' },
        { status: 400 }
      )
    }

    // Load brand kit for color/style context in prompts
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('primary_color, secondary_color, accent_color, brand_name, tone')
      .eq('user_id', userId)
      .maybeSingle()

    // Fetch top-rated image prompts for feedback loop
    const { data: topRatedPrompts } = await supabase
      .from('generated_images')
      .select('prompt, rating')
      .eq('user_id', userId)
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)

    // ── Concurrent job guard ───────────────────────────────────────────────
    const jobKey = `${userId}:image:${productDbId || 'upload'}`
    if (!markJobRunning(jobKey)) {
      return NextResponse.json(
        { error: 'An image is already being generated.' },
        { status: 409 }
      )
    }

    // ── Create the DB record ───────────────────────────────────────────────
    const insertData: Record<string, unknown> = {
      user_id: userId,
      style,
      original_image_url: refImageUrl,
      status: 'processing',
      credits_used: creditCost,
    }

    // product_id is optional — only if a product was selected
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
        { error: 'Error saving to the database: ' + (insertError?.message || 'unknown') },
        { status: 500 }
      )
    }

    const startTime = Date.now()
    try {
      // ── STEP 1: GPT builds the ultra-detailed prompt ────────────────────
      const detailedPrompt = await buildPromptWithGPT({
        productTitle,
        productCategory,
        productDescription,
        style,
        manualDescription: manual_description,
        brandKit: brandKit || undefined,
        topRatedPrompts: topRatedPrompts || undefined,
      })

      console.log(`[ImageGen] GPT prompt built (${detailedPrompt.length} chars) for style: ${style}`)
      console.log('[ImageGen] Prompt preview:', detailedPrompt.substring(0, 600))

      // Save the prompt to DB
      await supabase
        .from('generated_images')
        .update({ prompt: detailedPrompt })
        .eq('id', imageRecord!.id)

      // ── STEP 2: Nano Banana Pro generates the image ──────────────────────
      const kie = new KieClient()

      const numVariants = body.num_variants || 1
      const taskId = await kie.createImageTask(detailedPrompt, [refImageUrl], {
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
        negative_prompt: 'different product, redesigned product, generic product, wrong colors, wrong shape, wrong proportions, changed packaging, different labels, stylized product, cartoon, illustration, painting, wrong material finish, product alteration, product modification',
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
        { error: 'Error generating image: ' + (err as Error).message },
        { status: 500 }
      )
    }

    // Synchronous code removed — credits are deducted upfront, generation is 100% async via SSE
  } catch (err) {
    console.error('Generate image route error:', err)
    return NextResponse.json(
      { error: 'Internal error: ' + (err as Error).message },
      { status: 500 }
    )
  }
}