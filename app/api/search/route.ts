import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) return NextResponse.json({ products: [], images: [] })

    const supabase = createAdminClient()

    const [productsRes, imagesRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, original_title, optimized_title, category, seo_score, status, original_images')
        .eq('user_id', userId)
        .or(`original_title.ilike.%${q}%,optimized_title.ilike.%${q}%,category.ilike.%${q}%`)
        .limit(6),

      supabase
        .from('generated_images')
        .select('id, product_id, image_url, style, created_at, products:product_id(original_title, optimized_title)')
        .eq('user_id', userId)
        .in('status', ['completed', 'published'])
        .limit(20),
    ])

    const products = (productsRes.data || []).map((p: any) => ({
      ...p,
      thumbnail_url: Array.isArray(p.original_images) && p.original_images.length > 0
        ? p.original_images[0]
        : null,
    }))

    const allImages = (imagesRes.data || []).map((img: any) => ({
      ...img,
      product_title: img.products?.optimized_title || img.products?.original_title || '',
    }))
    const matchedImages = allImages.filter((img: any) =>
      img.product_title.toLowerCase().includes(q.toLowerCase()) ||
      (img.style || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5)

    return NextResponse.json({ products, images: matchedImages })
  } catch (err) {
    console.error('[Search API]', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}