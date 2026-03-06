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
      seo_score: number
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
        .select('id, status, seo_score, original_title, optimized_title, original_description, original_images, parent_id')
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
      agentConfigRes,
      agentSessionsTodayRes,
    ] = await Promise.all([
      supabase.from('products').select('id, original_title, optimized_title, status, seo_score, original_images').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['completed', 'published']),
      supabase.from('users').select('credits, plan, name, avatar_url').eq('id', userId).single(),
      supabase.from('credit_transactions').select('description, amount, created_at, reference_type, type').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('stores').select('id, store_url, sync_status, last_sync_at, products_count, platform').eq('user_id', userId).maybeSingle(),
      supabase.from('agent_configs').select('is_active, agent_name').eq('user_id', userId).maybeSingle(),
      supabase.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).eq('user_id', userId).gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    const totalProducts = allProductStats.length
    const optimizedProducts = allProductStats.filter(p => p.status === 'optimized').length
    const publishedProducts = allProductStats.filter(p => p.status === 'published').length
    const draftProducts = allProductStats.filter(p => p.status === 'draft').length

    const productsWithScore = allProductStats.filter(p => p.seo_score > 0)
    const avgSeoScore = productsWithScore.length > 0
      ? Math.round(productsWithScore.reduce((sum, p) => sum + p.seo_score, 0) / productsWithScore.length)
      : 0

    // Scorul SEO e acum real si calculat din sync (initial) sau save (dupa optimizare)
    // Toate produsele au un scor real — inclusiv cele neoptimizate manual
    const seoGreen  = allProductStats.filter(p => p.seo_score >= 80).length
    const seoYellow = allProductStats.filter(p => p.seo_score >= 50 && p.seo_score < 80).length
    const seoRed    = allProductStats.filter(p => p.seo_score < 50).length

    const worstProduct = allProductStats
      .filter(p => p.seo_score < 60)
      .sort((a, b) => a.seo_score - b.seo_score)[0] || null

    const hasStore = !!storeRes.data
    const hasSyncedProducts = totalProducts > 0
    const hasOptimized = optimizedProducts + publishedProducts > 0
    const hasAgent = !!agentConfigRes.data

    const onboardingChecklist = [
      { id: 'account', label: 'Cont creat', done: true, href: '/settings' },
      { id: 'store', label: 'Magazin conectat', done: hasStore, href: '/settings' },
      { id: 'products', label: 'Produse sincronizate', done: hasSyncedProducts, href: '/products' },
      { id: 'optimized', label: 'Prima optimizare', done: hasOptimized, href: '/products' },
      { id: 'agent', label: 'AI Agent activat', done: hasAgent, href: '/agent' },
    ]
    const onboardingProgress = onboardingChecklist.filter(i => i.done).length
    const onboardingComplete = onboardingProgress === onboardingChecklist.length

    const insights: { type: string; priority: number; message: string; action: string; actionUrl: string; stat: string }[] = []

    const shortDescProducts = allProductStats.filter(p => {
      if (!p.original_description) return true
      const wordCount = p.original_description.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length
      return wordCount < 100
    })
    if (shortDescProducts.length > 0 && totalProducts > 0) {
      const pct = Math.round(shortDescProducts.length / totalProducts * 100)
      insights.push({ type: 'short_descriptions', priority: shortDescProducts.length > totalProducts * 0.5 ? 10 : 7, message: `${shortDescProducts.length} din ${totalProducts} produse au descrieri sub 100 de cuvinte — optimizarea lor poate crește vânzările cu până la 34%.`, action: 'Optimizează acum', actionUrl: '/products', stat: `${pct}% afectate` })
    }

    const noImageProducts = allProductStats.filter(p => !p.original_images || p.original_images.length === 0)
    if (noImageProducts.length > 0) {
      insights.push({ type: 'no_images', priority: 9, message: `${noImageProducts.length} produse nu au nicio imagine. Produsele cu imagini au rată de conversie cu 40% mai mare.`, action: 'Generează imagini', actionUrl: '/images', stat: `${noImageProducts.length} fără imagini` })
    }
    if (seoRed > 0) {
      insights.push({ type: 'low_seo', priority: 8, message: `${seoRed} produse au scor SEO sub 50/100. Îmbunătățirea lor crește traficul organic cu până la 53%.`, action: 'Analizează SEO', actionUrl: '/seo', stat: `${seoRed} scor slab` })
    }
    if (draftProducts > 0 && draftProducts >= totalProducts * 0.3) {
      insights.push({ type: 'unoptimized', priority: draftProducts === totalProducts ? 10 : 6, message: `${draftProducts} produse sunt încă neoptimizate. Fiecare produs optimizat crește șansele de vânzare cu 20%.`, action: 'Optimizează produse', actionUrl: '/products', stat: `${draftProducts} draft` })
    }
    if (totalProducts === 0) {
      insights.push({ type: 'no_products', priority: 10, message: 'Nu ai niciun produs sincronizat. Conectează magazinul pentru a începe optimizarea.', action: 'Conectează magazin', actionUrl: '/settings', stat: '0 produse' })
    }
    if (avgSeoScore >= 80 && totalProducts > 5) {
      insights.push({ type: 'great_score', priority: 3, message: `Scor SEO mediu de ${avgSeoScore}/100 — excelent! Publică produsele actualizate pentru impact maxim.`, action: 'Publică produse', actionUrl: '/products', stat: `${avgSeoScore}/100 SEO` })
    }
    insights.sort((a, b) => b.priority - a.priority)

    return NextResponse.json({
      totalProducts, optimizedProducts, publishedProducts, draftProducts,
      totalImages: imagesRes.count || 0,
      avgSeoScore,
      seoBreakdown: { green: seoGreen, yellow: seoYellow, red: seoRed },
      worstProduct: worstProduct ? { id: worstProduct.id, title: worstProduct.optimized_title || worstProduct.original_title, seo_score: worstProduct.seo_score, image: worstProduct.original_images?.[0] || null } : null,
      creditsRemaining: userRes.data?.credits || 0,
      recentProducts: (recentProductsRes.data || []).map(p => ({ id: p.id, original_title: p.original_title, optimized_title: p.optimized_title, status: p.status, seo_score: p.seo_score, original_images: p.original_images })),
      recentTransactions: (transactionsRes.data || []).slice(0, 6).map((t: any) => ({ description: t.description, amount: t.amount, created_at: t.created_at, reference_type: t.reference_type, type: t.type })),
      store: storeRes.data ? { id: storeRes.data.id, store_url: storeRes.data.store_url, store_name: storeRes.data.store_url, sync_status: storeRes.data.sync_status, last_sync_at: storeRes.data.last_sync_at, products_count: storeRes.data.products_count, platform: storeRes.data.platform } : null,
      agent: agentConfigRes.data ? { is_active: agentConfigRes.data.is_active, agent_name: agentConfigRes.data.agent_name, conversations_today: agentSessionsTodayRes.count || 0 } : null,
      onboardingChecklist, onboardingProgress, onboardingComplete,
      aiInsight: insights[0] || null,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}