import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai/client'

// GET - load brand kit
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data } = await supabase.from('brand_kits').select('*').eq('user_id', userId).maybeSingle()
    return NextResponse.json({ brand_kit: data || null })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// POST/PUT - save brand kit
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const body = await request.json()
    const { logo_url, primary_color, secondary_color, accent_color, brand_name, font_style, tone, logo_base64 } = body

    let finalLogoUrl = logo_url

    // Upload logo to Supabase Storage if base64 provided
    if (logo_base64 && !logo_url) {
      const base64Data = logo_base64.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      const ext = logo_base64.includes('png') ? 'png' : 'jpg'
      const fileName = `brand-kits/${userId}/logo-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(fileName, buffer, { contentType: `image/${ext}`, upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
        finalLogoUrl = urlData.publicUrl
      }
    }

    const payload = {
      user_id: userId,
      logo_url: finalLogoUrl,
      primary_color: primary_color || '#000000',
      secondary_color: secondary_color || '#ffffff',
      accent_color: accent_color || '#3b82f6',
      brand_name: brand_name || '',
      font_style: font_style || 'modern',
      tone: tone || 'professional',
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Eroare la salvare' }, { status: 500 })
    return NextResponse.json({ brand_kit: data, logo_url: finalLogoUrl })
  } catch (err: any) {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// PATCH - AI style detector: analyzes existing product images and detects brand style
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    // Get a sample of product images
    const { data: products } = await supabase
      .from('products')
      .select('original_images, category')
      .eq('user_id', userId)
      .not('original_images', 'is', null)
      .limit(20)

    // Get existing generated images
    const { data: genImages } = await supabase
      .from('generated_images')
      .select('style, rating')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50)

    // Analyze patterns
    const styleUsage: Record<string, number> = {}
    const styleRatings: Record<string, number[]> = {}
    for (const img of genImages || []) {
      styleUsage[img.style] = (styleUsage[img.style] || 0) + 1
      if (img.rating) {
        if (!styleRatings[img.style]) styleRatings[img.style] = []
        styleRatings[img.style].push(img.rating)
      }
    }

    const topStyle = Object.entries(styleUsage).sort(([, a], [, b]) => b - a)[0]?.[0] || 'white_bg'
    const avgRatings = Object.fromEntries(
      Object.entries(styleRatings).map(([s, rs]) => [s, rs.reduce((a, b) => a + b, 0) / rs.length])
    )
    const bestRatedStyle = Object.entries(avgRatings).sort(([, a], [, b]) => b - a)[0]?.[0]

    const categories = [...new Set((products || []).map(p => p.category).filter(Boolean))]
    const imageCount = products?.reduce((n, p) => n + (p.original_images?.length || 0), 0) || 0

    // AI analysis
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analizează un magazin eCommerce și recomandă stilul vizual optim.

Date magazin:
- Categorii produse: ${categories.join(', ') || 'general'}
- Imagini produse disponibile: ${imageCount}
- Stiluri folosite: ${JSON.stringify(styleUsage)}
- Cel mai bine evaluat stil: ${bestRatedStyle || 'nedeterminat'}
- Cel mai folosit stil: ${topStyle}

Răspunde STRICT JSON:
{
  "recommended_style": "white_bg|lifestyle|premium_dark|industrial|seasonal",
  "reason": "Motiv în 1-2 propoziții de ce e recomandat",
  "style_summary": "Descriere scurtă a stilului vizual al brandului în 1 propoziție",
  "font_suggestion": "modern|classic|bold|minimal",
  "tone_suggestion": "professional|friendly|luxury|playful",
  "color_suggestion": { "primary": "#hex", "secondary": "#hex", "accent": "#hex" }
}`,
      }],
      temperature: 0.3,
      max_tokens: 300,
    })

    const raw = completion.choices[0].message.content?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}'
    let detected: any
    try { detected = JSON.parse(raw) } catch { detected = { recommended_style: topStyle } }

    // Save detected style to brand kit
    await supabase
      .from('brand_kits')
      .upsert({
        user_id: userId,
        detected_style: detected,
        style_summary: detected.style_summary || '',
        font_style: detected.font_suggestion || 'modern',
        tone: detected.tone_suggestion || 'professional',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true, detected })
  } catch (err: any) {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}