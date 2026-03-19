import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — returnează datele SEO ale magazinului propriu direct din DB
// Gratuit — nu foloseste AI, nu deduce credite
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores')
      .select('store_url')
      .eq('user_id', userId)
      .single()

    const { data: products } = await supabase
      .from('products')
      .select('optimized_title, original_title, meta_description, focus_keyword, secondary_keywords, seo_score, category')
      .eq('user_id', userId)
      .is('parent_id', null)
      .order('seo_score', { ascending: false })
      .limit(50)

    if (!products || products.length === 0) {
      return NextResponse.json({
        analysis: {
          title: '', meta_description: '', h1: '', headings: [],
          focus_keywords: [], keyword_density: {}, content_length_estimate: 0,
          strengths: ['New store — add products for a complete analysis'],
          weaknesses: ['No optimized products yet'],
          opportunities: ['Optimize products with AI to increase your SEO score'],
        },
        store_url: store?.store_url || '',
      })
    }

    const allKeywords: string[] = []
    const allTitles: string[] = []
    let totalSeoScore = 0
    const categories = new Set<string>()

    for (const p of products) {
      const title = p.optimized_title || p.original_title || ''
      if (title) allTitles.push(title)
      if (p.focus_keyword) allKeywords.push(p.focus_keyword)
      if (p.secondary_keywords) allKeywords.push(...(p.secondary_keywords as string[]))
      if (p.category) categories.add(p.category)
      totalSeoScore += p.seo_score || 0
    }

    const avgScore      = Math.round(totalSeoScore / products.length)
    const optimizedCount = products.filter(p => p.seo_score >= 80).length
    const withMeta      = products.filter(p => p.meta_description).length
    const withKeyword   = products.filter(p => p.focus_keyword).length
    const uniqueKeywords = [...new Set(allKeywords.filter(Boolean))].slice(0, 15)

    const bestProduct = products[0]
    const strengths: string[] = []
    const weaknesses: string[] = []
    const opportunities: string[] = []

    if (optimizedCount > products.length * 0.5) strengths.push(`${optimizedCount}/${products.length} products well optimized for SEO`)
    if (uniqueKeywords.length >= 5) strengths.push(`Diverse SEO vocabulary — ${uniqueKeywords.length} unique keywords`)
    if (withMeta > products.length * 0.7) strengths.push(`${withMeta} products have a complete meta description`)
    if (categories.size > 0) strengths.push(`Catalog structured across ${categories.size} categories`)
    if (avgScore >= 70) strengths.push(`Good average SEO score: ${avgScore}/100`)

    if (optimizedCount < products.length * 0.5) weaknesses.push(`${products.length - optimizedCount} unoptimized products`)
    if (withMeta < products.length * 0.5) weaknesses.push(`${products.length - withMeta} products missing meta description`)
    if (withKeyword < products.length * 0.5) weaknesses.push(`${products.length - withKeyword} products missing focus keyword`)
    if (avgScore < 60) weaknesses.push(`Low average SEO score: ${avgScore}/100`)

    if (weaknesses.length === 0) {
      opportunities.push('Keep publishing new content regularly')
      opportunities.push('Add schema markup for products')
    } else {
      opportunities.push('Use bulk optimization to quickly optimize all products')
      opportunities.push('Add a focus keyword to each product')
    }

    return NextResponse.json({
      analysis: {
        title: bestProduct?.optimized_title || bestProduct?.original_title || '',
        meta_description: bestProduct?.meta_description || '',
        h1: bestProduct?.optimized_title || bestProduct?.original_title || '',
        headings: allTitles.slice(0, 8),
        focus_keywords: uniqueKeywords,
        keyword_density: {},
        content_length_estimate: products.length * 150,
        strengths: strengths.slice(0, 4),
        weaknesses: weaknesses.slice(0, 3),
        opportunities: opportunities.slice(0, 3),
        _meta: {
          total_products: products.length,
          optimized_count: optimizedCount,
          avg_seo_score: avgScore,
          categories: [...categories],
        },
      },
      store_url: store?.store_url || '',
    })

  } catch (err) {
    console.error('[My Store Analysis]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}