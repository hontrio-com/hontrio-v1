import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '50'), 500)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const category = searchParams.get('category') || ''
    const parentOnly = searchParams.get('parent_only') === 'true'

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    // Build query
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    // Only show parent products (not variations) by default
    if (parentOnly) {
      query = query.is('parent_id', null)
    }

    // Filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (search) {
      query = query.or(`original_title.ilike.%${search}%,optimized_title.ilike.%${search}%,category.ilike.%${search}%`)
    }

    // Paginate
    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data: products, error, count } = await query

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json({ error: 'Eroare la încărcarea produselor' }, { status: 500 })
    }

    // Get generated images for these products
    const productIds = (products || []).map(p => p.id)
    let genImagesMap: Record<string, string> = {}

    if (productIds.length > 0) {
      const { data: genImages } = await supabase
        .from('generated_images')
        .select('product_id, generated_image_url')
        .in('product_id', productIds)
        .in('status', ['completed', 'published'])
        .order('created_at', { ascending: false })

      if (genImages) {
        for (const img of genImages) {
          if (!genImagesMap[img.product_id]) {
            genImagesMap[img.product_id] = img.generated_image_url
          }
        }
      }
    }

    // Get variation count per parent product
    let variationCounts: Record<string, number> = {}
    if (parentOnly && productIds.length > 0) {
      // Batch query in chunks of 200 to avoid too large IN clause
      for (let i = 0; i < productIds.length; i += 200) {
        const batch = productIds.slice(i, i + 200)
        const { data: variations } = await supabase
          .from('products')
          .select('parent_id')
          .in('parent_id', batch)

        if (variations) {
          for (const v of variations) {
            variationCounts[v.parent_id] = (variationCounts[v.parent_id] || 0) + 1
          }
        }
      }
    }

    // Enrich products
    const enriched = (products || []).map(p => ({
      ...p,
      thumbnail_url:
        genImagesMap[p.id] ||
        (p.original_images && p.original_images.length > 0 ? p.original_images[0] : null),
      variations_count: variationCounts[p.id] || 0,
    }))

    // Get all categories for filter dropdown (from all user products)
    const { data: catData } = await supabase
      .from('products')
      .select('category')
      .eq('user_id', userId)
      .not('category', 'is', null)

    const categories = [...new Set((catData || []).map(c => c.category).filter(Boolean))]

    // Get status counts (for all products, not just current page)
    let countQuery = supabase
      .from('products')
      .select('status', { count: 'exact' })
      .eq('user_id', userId)

    if (parentOnly) {
      countQuery = countQuery.is('parent_id', null)
    }

    const { data: allStatuses } = await countQuery.range(0, 49999)
    const statusCounts = {
      all: allStatuses?.length || 0,
      draft: allStatuses?.filter(p => p.status === 'draft').length || 0,
      optimized: allStatuses?.filter(p => p.status === 'optimized').length || 0,
      published: allStatuses?.filter(p => p.status === 'published').length || 0,
    }

    return NextResponse.json({
      products: enriched,
      total: count || 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count || 0) / perPage),
      categories,
      status_counts: statusCounts,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}