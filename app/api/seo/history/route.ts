import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - fetch version history for a product
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'product_id lipsește' }, { status: 400 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('seo_history')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      // Table might not exist yet — return empty gracefully
      return NextResponse.json({ history: [] })
    }

    return NextResponse.json({ history: data || [] })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}

// POST - save a snapshot before overwriting
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const body = await request.json()
    const { product_id, snapshot, label } = body

    if (!product_id || !snapshot) return NextResponse.json({ error: 'Date lipsă' }, { status: 400 })

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('seo_history')
      .insert({
        product_id,
        user_id: userId,
        label: label || 'Versiune salvată',
        optimized_title: snapshot.optimized_title || null,
        meta_description: snapshot.meta_description || null,
        optimized_short_description: snapshot.optimized_short_description || null,
        optimized_long_description: snapshot.optimized_long_description || null,
        focus_keyword: snapshot.focus_keyword || null,
        secondary_keywords: snapshot.secondary_keywords || null,
        seo_score: snapshot.seo_score || 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[SEO History] Insert error:', error)
      // Non-fatal — history is a nice-to-have
      return NextResponse.json({ success: true, skipped: true })
    }

    // Keep max 10 versions per product
    const { data: allVersions } = await supabase
      .from('seo_history')
      .select('id, created_at')
      .eq('product_id', product_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (allVersions && allVersions.length > 10) {
      const toDelete = allVersions.slice(10).map((v: any) => v.id)
      await supabase.from('seo_history').delete().in('id', toDelete)
    }

    return NextResponse.json({ success: true, version: data })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}