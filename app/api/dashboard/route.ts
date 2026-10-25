import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    // Products (paginated, only parent)
    let allProductStats: {
      id: string
      status: string
      original_title: string | null
      optimized_title: string | null
      original_description: string | null
      original_images: string[] | null
      parent_id: string | null
    }[] = []
    let from = 0
    const batchSize = 1000
    while (true) {
      const { data } = await supabase
        .from('products')
        .select('id, status, original_title, optimized_title, original_description, original_images, parent_id')
        .eq('user_id', userId)
        .is('parent_id', null)
        .range(from, from + batchSize - 1)
      if (!data || data.length === 0) break
      allProductStats = [...allProductStats, ...data]
      if (data.length < batchSize) break
      from += batchSize
    }

    const [
      recentProductsRes,
      imagesRes,
      userRes,
      transactionsRes,
      storeRes,
    ] = await Promise.all([
      supabase.from('products').select('id, original_title, optimized_title, status, original_images').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['completed', 'published']),
      supabase.from('users').select('credits, plan, name, avatar_url').eq('id', userId).single(),
      supabase.from('credit_transactions').select('description, amount, created_at, reference_type, type').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('stores').select('id, store_url, sync_status, last_sync_at, products_count, platform').eq('user_id', userId).maybeSingle(),
    ])

    const totalProducts = allProductStats.length
    const optimizedProducts = allProductStats.filter(p => p.status === 'optimized').length
    const publishedProducts = allProductStats.filter(p => p.status === 'published').length
    const draftProducts = allProductStats.filter(p => p.status === 'draft').length

    const hasStore = !!storeRes.data
    const hasSyncedProducts = totalProducts > 0
    const hasOptimized = optimizedProducts + publishedProducts > 0

    const onboardingChecklist = [
      { id: 'account', label: 'checklist_account', done: true, href: '/settings' },
      { id: 'store', label: 'checklist_store', done: hasStore, href: '/settings' },
      { id: 'products', label: 'checklist_products', done: hasSyncedProducts, href: '/products' },
      { id: 'optimized', label: 'checklist_optimized', done: hasOptimized, href: '/products' },
    ]
    const onboardingProgress = onboardingChecklist.filter(i => i.done).length
    const onboardingComplete = onboardingProgress === onboardingChecklist.length

    const insights: { type: string; priority: number; message: string; action: string; actionUrl: string; stat: string; params?: Record<string, any> }[] = []

    const shortDescProducts = allProductStats.filter(p => {
      if (!p.original_description) return true
      const wordCount = p.original_description.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length
      return wordCount < 100
    })
    if (shortDescProducts.length > 0 && totalProducts > 0) {
      const pct = Math.round(shortDescProducts.length / totalProducts * 100)
      insights.push({ type: 'short_descriptions', priority: shortDescProducts.length > totalProducts * 0.5 ? 10 : 7, message: `insight_short_desc`, action: 'insight_short_desc_action', actionUrl: '/products', stat: 'insight_short_desc_stat', params: { count: shortDescProducts.length, total: totalProducts, pct } })
    }

    const noImageProducts = allProductStats.filter(p => !p.original_images || p.original_images.length === 0)
    if (noImageProducts.length > 0) {
      insights.push({ type: 'no_images', priority: 9, message: 'insight_no_images', action: 'insight_no_images_action', actionUrl: '/images', stat: 'insight_no_images_stat', params: { count: noImageProducts.length } })
    }
    if (draftProducts > 0 && draftProducts >= totalProducts * 0.3) {
      insights.push({ type: 'unoptimized', priority: draftProducts === totalProducts ? 10 : 6, message: 'insight_unoptimized', action: 'insight_unoptimized_action', actionUrl: '/products', stat: 'insight_unoptimized_stat', params: { count: draftProducts } })
    }
    if (totalProducts === 0) {
      insights.push({ type: 'no_products', priority: 10, message: 'insight_no_products', action: 'insight_no_products_action', actionUrl: '/settings', stat: 'insight_no_products_stat', params: {} })
    }
    insights.sort((a, b) => b.priority - a.priority)

    return NextResponse.json({
      totalProducts, optimizedProducts, publishedProducts, draftProducts,
      totalImages: imagesRes.count || 0,
      creditsRemaining: userRes.data?.credits || 0,
      recentProducts: (recentProductsRes.data || []).map(p => ({ id: p.id, original_title: p.original_title, optimized_title: p.optimized_title, status: p.status, original_images: p.original_images })),
      recentTransactions: (transactionsRes.data || []).slice(0, 6).map((t: any) => ({ description: t.description, amount: t.amount, created_at: t.created_at, reference_type: t.reference_type, type: t.type })),
      store: storeRes.data ? { id: storeRes.data.id, store_url: storeRes.data.store_url, store_name: storeRes.data.store_url, sync_status: storeRes.data.sync_status, last_sync_at: storeRes.data.last_sync_at, products_count: storeRes.data.products_count, platform: storeRes.data.platform } : null,
      onboardingChecklist, onboardingProgress, onboardingComplete,
      aiInsight: insights[0] || null,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}