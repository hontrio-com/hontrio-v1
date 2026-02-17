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

    // Fetch all data in parallel
    const [productsCountRes, productsRes, imagesRes, userRes, transactionsRes] = await Promise.all([
      supabase.from('products').select('id, status, seo_score', { count: 'exact' }).eq('user_id', userId).range(0, 49999),
      supabase.from('products').select('id, original_title, optimized_title, status, seo_score, original_images').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('generated_images').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['completed', 'published']),
      supabase.from('users').select('credits').eq('id', userId).single(),
      supabase.from('credit_transactions').select('*').eq('user_id', userId).eq('type', 'usage').order('created_at', { ascending: false }).limit(10),
    ])

    const allProductStats = productsCountRes.data || []
    const totalProducts = productsCountRes.count || allProductStats.length
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

    return NextResponse.json({
      totalProducts,
      optimizedProducts,
      publishedProducts,
      draftProducts,
      totalImages: imagesRes.count || 0,
      avgSeoScore,
      creditsUsed,
      creditsRemaining: userRes.data?.credits || 0,
      recentProducts: (productsRes.data || []).map(p => ({
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
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}