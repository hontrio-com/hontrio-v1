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

    // Paginate products to get accurate counts and insight data
    let allProductStats: { status: string; seo_score: number; original_description: string | null; original_images: string[] | null; optimized_title: string | null; parent_id: string | null }[] = []
    let from = 0
    const batchSize = 1000

    while (true) {
      const { data } = await supabase
        .from('products')
        .select('status, seo_score, original_description, original_images, optimized_title, parent_id')
        .eq('user_id', userId)
        .is('parent_id', null) // Only parent products
        .range(from, from + batchSize - 1)

      if (!data || data.length === 0) break
      allProductStats = [...allProductStats, ...data]
      if (data.length < batchSize) break
      from += batchSize
    }

    // Recent 5 products (separate query, no pagination needed)
    const { data: recentProducts } = await supabase
      .from('products')
      .select('id, original_title, optimized_title, status, seo_score, original_images')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Other data in parallel
    const [imagesRes, userRes, transactionsRes] = await Promise.all([
      supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['completed', 'published']),
      supabase.from('users').select('credits').eq('id', userId).single(),
      supabase.from('credit_transactions').select('*').eq('user_id', userId).eq('type', 'usage').order('created_at', { ascending: false }).limit(10),
    ])

    const totalProducts = allProductStats.length
    const optimizedProducts = allProductStats.filter(p => p.status === 'optimized').length
    const publishedProducts = allProductStats.filter(p => p.status === 'published').length
    const draftProducts = allProductStats.filter(p => p.status === 'draft').length

    const productsWithScore = allProductStats.filter(p => p.seo_score > 0)
    const avgSeoScore = productsWithScore.length > 0
      ? Math.round(productsWithScore.reduce((sum, p) => sum + p.seo_score, 0) / productsWithScore.length)
      : 0

    const creditsUsed = (transactionsRes.data || []).reduce(
      (sum: number, t: any) => sum + Math.abs(t.amount), 0
    )

    // ===== AI INSIGHT ANALYSIS =====
    const insights: { type: string; priority: number; message: string; action: string; actionUrl: string; stat: string }[] = []

    // 1. Products with short descriptions (under 100 words)
    const shortDescProducts = allProductStats.filter(p => {
      if (!p.original_description) return true
      const wordCount = p.original_description.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length
      return wordCount < 100
    })
    if (shortDescProducts.length > 0 && totalProducts > 0) {
      const pct = Math.round(shortDescProducts.length / totalProducts * 100)
      insights.push({
        type: 'short_descriptions',
        priority: shortDescProducts.length > totalProducts * 0.5 ? 10 : 7,
        message: `${shortDescProducts.length} din ${totalProducts} produse au descrieri sub 100 de cuvinte — optimizarea lor poate crește vânzările cu până la 34%.`,
        action: 'Optimizează acum',
        actionUrl: '/products',
        stat: `${pct}% afectate`,
      })
    }

    // 2. Products without images
    const noImageProducts = allProductStats.filter(p => !p.original_images || p.original_images.length === 0)
    if (noImageProducts.length > 0) {
      insights.push({
        type: 'no_images',
        priority: 9,
        message: `${noImageProducts.length} produse nu au nicio imagine. Produsele cu imagini au rată de conversie cu 40% mai mare.`,
        action: 'Generează imagini',
        actionUrl: '/images',
        stat: `${noImageProducts.length} fără imagini`,
      })
    }

    // 3. Low SEO score products
    const lowSeoProducts = allProductStats.filter(p => p.seo_score > 0 && p.seo_score < 50)
    if (lowSeoProducts.length > 0) {
      insights.push({
        type: 'low_seo',
        priority: 8,
        message: `${lowSeoProducts.length} produse au scor SEO sub 50/100. Îmbunătățirea SEO-ului crește traficul organic cu până la 53%.`,
        action: 'Analizează SEO',
        actionUrl: '/seo',
        stat: `${lowSeoProducts.length} scor slab`,
      })
    }

    // 4. Draft products (not optimized yet)
    if (draftProducts > 0 && draftProducts >= totalProducts * 0.3) {
      insights.push({
        type: 'unoptimized',
        priority: draftProducts === totalProducts ? 10 : 6,
        message: `${draftProducts} produse sunt încă neoptimizate. Fiecare produs optimizat crește șansele de vânzare cu 20%.`,
        action: 'Optimizează produse',
        actionUrl: '/products',
        stat: `${draftProducts} draft`,
      })
    }

    // 5. No products yet
    if (totalProducts === 0) {
      insights.push({
        type: 'no_products',
        priority: 10,
        message: 'Nu ai niciun produs sincronizat. Conectează magazinul și sincronizează produsele pentru a începe optimizarea.',
        action: 'Conectează magazin',
        actionUrl: '/settings',
        stat: '0 produse',
      })
    }

    // 6. Great score — positive reinforcement
    if (avgSeoScore >= 80 && totalProducts > 5) {
      insights.push({
        type: 'great_score',
        priority: 3,
        message: `Magazinul tău are un scor SEO mediu de ${avgSeoScore}/100 — excelent! Continuă să optimizezi și publică produsele actualizate.`,
        action: 'Publică produse',
        actionUrl: '/products',
        stat: `${avgSeoScore}/100 SEO`,
      })
    }

    // Sort by priority (highest first), pick top insight
    insights.sort((a, b) => b.priority - a.priority)

    return NextResponse.json({
      totalProducts,
      optimizedProducts,
      publishedProducts,
      draftProducts,
      totalImages: imagesRes.count || 0,
      avgSeoScore,
      creditsUsed,
      creditsRemaining: userRes.data?.credits || 0,
      recentProducts: (recentProducts || []).map(p => ({
        id: p.id,
        original_title: p.original_title,
        optimized_title: p.optimized_title,
        status: p.status,
        seo_score: p.seo_score,
        original_images: p.original_images,
      })),
      recentTransactions: (transactionsRes.data || []).slice(0, 5).map((t: any) => ({
        description: t.description,
        amount: t.amount,
        created_at: t.created_at,
        reference_type: t.reference_type,
      })),
      aiInsight: insights[0] || null,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}