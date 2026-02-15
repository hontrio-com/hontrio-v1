type PromptInput = {
  title: string
  category: string | null
  style: string
  description?: string | null
  hasReferenceImage: boolean
}

export function buildImagePrompt(input: PromptInput): string {
  const productName = input.title || 'product'
  const cat = input.category ? input.category.toLowerCase() : ''

  // Context from description if available
  const descHint = input.description
    ? ` The product is described as: ${input.description.substring(0, 200)}.`
    : ''

  // When we have a reference image, tell the model to use it
  const refPrefix = input.hasReferenceImage
    ? `Look at the provided reference image carefully. This is the EXACT product you must reproduce. Maintain the product's exact shape, proportions, colors, labels, text, logos, and all visual details from the reference image. Do NOT invent, alter, or omit any detail of the product itself. Only change the background and environment as described below.\n\n`
    : ''

  const stylePrompts: Record<string, string> = {

    white_bg: `${refPrefix}Create a professional e-commerce product photograph of "${productName}".${descHint}

BACKGROUND: Pure clean white (#FFFFFF) seamless studio background with no visible edges, gradients, or textures.
LIGHTING: Three-point studio lighting setup — key light at 45° from front-left, fill light at 30° from front-right, subtle rim light from behind to separate the product from the background. Soft diffused light, no harsh shadows.
COMPOSITION: Product centered in frame, occupying 70-80% of the image area. Shot from a slightly elevated angle (about 15-20° above eye level) to show both the front face and a hint of the top.
SHADOW: Soft, natural drop shadow directly beneath the product, subtle reflection on the surface. No floating effect.
FOCUS: Tack-sharp across the entire product. Shallow depth of field is NOT desired — everything must be in crisp focus.
QUALITY: 8K render quality, no noise, no artifacts, no distortion. Colors must be accurate and vibrant. This image must be ready for Amazon, eMag, or any major marketplace listing.
ABSOLUTELY AVOID: Any props, decorations, hands, text overlays, watermarks, or background elements. The product must stand alone.`,

    lifestyle: `${refPrefix}Create a realistic lifestyle photograph showing "${productName}" in a natural, aspirational setting.${descHint}

SCENE: ${getLifestyleScene(cat)} The product is the clear hero of the image but feels naturally placed in the environment — not awkwardly staged.
LIGHTING: Warm, natural golden-hour light (color temperature ~3500K). Soft directional light from a window or open space. Subtle lens flare or light rays are acceptable if they add warmth.
COMPOSITION: Product positioned using the rule of thirds (lower-left or lower-right). The scene extends behind and around it with contextual props that complement but never overpower.${cat ? ` Props should be relevant to the ${cat} category.` : ''}
DEPTH: Medium depth of field — product is tack-sharp, background elements are softly blurred (f/2.8–f/4 equivalent). This draws the eye to the product.
MOOD: Inviting, warm, aspirational. The viewer should imagine themselves using or owning this product.
COLOR PALETTE: Warm, harmonious tones that complement the product's own colors. No clashing elements.
QUALITY: Professional editorial photography quality. Shot on a Canon EOS R5 equivalent. No artifacts, no AI distortions, photorealistic.
ABSOLUTELY AVOID: Hands holding the product (unless it's a wearable), visible brand logos of other products, cluttered scenes, artificial-looking arrangements.`,

    premium_dark: `${refPrefix}Create a luxury advertising photograph of "${productName}" with a premium dark aesthetic.${descHint}

BACKGROUND: Deep matte black to dark charcoal gradient background. Can include subtle texture — brushed metal, dark marble, or dark fabric — but it must remain understated and elegant.
LIGHTING: Dramatic studio lighting with strong rim/edge lighting that creates a luminous outline around the product. Key light from above-left at 60° angle, narrow beam. Secondary accent light from below-right creating subtle reflections. The product should appear to glow against the darkness.
COMPOSITION: Product centered or slightly off-center, occupying 60-70% of frame. Slight low-angle perspective (5-10° below eye level) to make the product appear powerful and imposing.
SURFACE: Product sits on a dark reflective surface (black glass or polished stone) creating a mirror-like reflection beneath it. The reflection should be partial and fade naturally.
HIGHLIGHTS: Specular highlights on product edges and surfaces to emphasize texture, material quality, and craftsmanship.
MOOD: Luxurious, exclusive, high-end. Think Apple product launch or premium watch advertising.
QUALITY: Magazine advertisement quality. Ultra-sharp, rich contrast, deep blacks, no noise.
ABSOLUTELY AVOID: Any color that competes with the product, bright elements, cluttered compositions, visible light sources.`,

    industrial: `${refPrefix}Create a rugged industrial-style product photograph of "${productName}".${descHint}

BACKGROUND: ${getIndustrialScene(cat)} Raw, textured environment with character and authenticity.
SURFACE: Product placed on a weathered wood plank, raw concrete block, rusted metal sheet, or natural stone slab. The surface should have visible grain, patina, or texture.
LIGHTING: Strong directional side lighting from the left, creating dramatic shadows and texture emphasis. Natural light quality — as if coming through an industrial window. Warm undertones (late afternoon sun).
COMPOSITION: Product positioned off-center (rule of thirds). Some negative space to let the environment breathe. Slight wide-angle perspective to include environmental context.
TEXTURE: Emphasize material contrasts — the product's finish against the raw background textures. Every surface should have tactile quality.
MOOD: Authentic, honest, artisanal. The product feels real, reliable, and well-crafted.
COLOR PALETTE: Muted earth tones, warm browns, grays, and blacks. Desaturated background, natural product colors.
QUALITY: Editorial photography quality. Sharp focus on product, background can have subtle softness.
ABSOLUTELY AVOID: Clean or sterile environments, plastic surfaces, bright colors, modern or minimal aesthetics.`,

    seasonal: `${refPrefix}Create a festive, seasonal product photograph of "${productName}" perfect for holiday marketing.${descHint}

SCENE: ${getSeasonalScene()} The product is the hero, surrounded by carefully arranged seasonal decorations that frame it without covering it.
LIGHTING: Warm ambient lighting with golden bokeh points in the background (fairy lights or candles). Key light is warm (3000K). Subtle sparkle and glow effects on metallic or reflective decorations.
COMPOSITION: Product centered with seasonal elements arranged in a crescent or frame around it. Foreground elements slightly out of focus, product tack-sharp, background bokeh.
DECORATIONS: Pine branches, cinnamon sticks, dried orange slices, small ornaments, ribbon, burlap fabric, pine cones, berries, snowflakes, or similar seasonal props. Maximum 5-7 props, arranged organically.
MOOD: Warm, cozy, celebratory, gift-worthy. The viewer should think "this would make a perfect gift."
COLOR PALETTE: Rich reds, deep greens, warm golds, cream whites, and natural wood tones. Traditional holiday palette.
QUALITY: High-end catalog photography. Clean, professional, festive without being kitschy.
ABSOLUTELY AVOID: Santa Claus, cartoon characters, text or slogans, plastic decorations, cheap-looking props, over-the-top arrangements.`,

    auto: `${refPrefix}Create the ideal professional product photograph of "${productName}".${descHint}

Analyze the product type${cat ? ` (category: ${cat})` : ''} and automatically choose the most commercially effective presentation:
- For food/beverages: warm lifestyle setting with natural props
- For electronics/tech: clean minimal white or dark premium background
- For fashion/beauty: lifestyle or editorial style with soft lighting
- For home/garden: lifestyle context showing the product in use
- For industrial/tools: rugged industrial setting
- For gifts/seasonal items: festive seasonal presentation

Apply professional e-commerce photography standards: sharp focus on product, complementary background, appropriate lighting for the product material (matte vs glossy vs transparent), accurate color reproduction, and commercial-grade composition.

QUALITY: Professional photography, 8K quality, no AI artifacts, no text distortion, accurate product representation.`,
  }

  return stylePrompts[input.style] || stylePrompts.auto
}

function getLifestyleScene(category: string): string {
  if (category.match(/aliment|food|mancare|dulciuri|miere|cafea|ceai|bautur/i))
    return 'A warm kitchen counter or rustic wooden breakfast table with morning light streaming through a window. Subtle props like a ceramic mug, fresh fruit, or a linen napkin.'
  if (category.match(/cosmet|beauty|ingrijire|skin|cream|sampon|parfum/i))
    return 'A bright, airy bathroom vanity or spa-like setting with marble surfaces. Subtle props like a small plant, white towels, or natural elements.'
  if (category.match(/electron|tech|gadget|telefon|laptop|audio/i))
    return 'A clean modern desk setup with a minimalist aesthetic. Subtle props like a notebook, plant, or coffee cup.'
  if (category.match(/fashion|haine|imbracaminte|incaltaminte|accesor/i))
    return 'A stylish flat-lay arrangement or a clean modern interior with natural textures. Subtle props that complement the clothing style.'
  if (category.match(/casa|home|gradina|garden|decor|mobil/i))
    return 'A beautifully styled living room corner or garden setting with natural light. The space feels lived-in but curated.'
  if (category.match(/copii|baby|jucari|toys/i))
    return 'A bright, cheerful playroom or nursery setting with soft natural light. Clean, safe environment with pastel or warm colors.'
  return 'A clean, modern, and inviting interior space with natural light. The setting complements the product naturally and feels aspirational.'
}

function getIndustrialScene(category: string): string {
  if (category.match(/aliment|food|mancare|miere|cafea|vin/i))
    return 'A rustic workshop table or aged wooden cellar shelf. Background shows brick walls, wooden beams, or vintage storage.'
  if (category.match(/tools|unelte|industrial|auto|tehnic/i))
    return 'An authentic workshop or garage environment. Metal workbench, tool wall in soft focus behind, concrete floor.'
  return 'An industrial loft space with exposed brick walls, concrete floor, and steel beam structures. Raw, authentic atmosphere.'
}

function getSeasonalScene(): string {
  return 'A cozy, festive holiday tabletop setting. The scene evokes warmth and celebration — a fireplace glow in the background or frost-kissed window behind.'
}