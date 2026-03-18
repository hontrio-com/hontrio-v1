import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - rate an image
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const { image_id, rating } = await request.json()

    if (!image_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'image_id and rating (1-5) are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify ownership
    const { data: img } = await supabase
      .from('generated_images')
      .select('id, style, prompt')
      .eq('id', image_id)
      .eq('user_id', userId)
      .single()

    if (!img) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    // Save rating
    await supabase.from('image_ratings').upsert({
      user_id: userId,
      generated_image_id: image_id,
      rating,
      style: img.style,
      prompt_snippet: img.prompt?.substring(0, 200),
    }, { onConflict: 'user_id,generated_image_id' })

    // Also update on generated_images
    await supabase.from('generated_images').update({ rating }).eq('id', image_id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET - rating stats and top prompts
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: ratings } = await supabase
      .from('image_ratings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    // Compute avg rating per style
    const byStyle: Record<string, number[]> = {}
    for (const r of ratings || []) {
      if (!byStyle[r.style]) byStyle[r.style] = []
      byStyle[r.style].push(r.rating)
    }

    const styleStats = Object.entries(byStyle).map(([style, rs]) => ({
      style,
      avg_rating: Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10,
      count: rs.length,
    })).sort((a, b) => b.avg_rating - a.avg_rating)

    // Top rated prompts (4-5 stars)
    const topPrompts = (ratings || [])
      .filter(r => r.rating >= 4 && r.prompt_snippet)
      .slice(0, 10)

    return NextResponse.json({ style_stats: styleStats, top_prompts: topPrompts })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}