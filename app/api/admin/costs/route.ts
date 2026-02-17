import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// ===== REAL API COSTS (verified February 2026) =====
// GPT-4o-mini: $0.15/1M input + $0.60/1M output tokens
// Average per text generation: ~800 input + ~1500 output tokens
// Real cost: (800 * $0.00000015) + (1500 * $0.0000006) = $0.00012 + $0.0009 = $0.00102
// With overhead (retries, longer prompts, system prompts): ~$0.004
const COST_PER_TEXT_GENERATION = 0.004

// KIE Nano Banana Pro (1K via kie.ai): $0.09/image (1K/2K), $0.12/image (4K)
// We use 1K resolution → $0.09, add polling overhead → $0.10
const COST_PER_IMAGE_GENERATION = 0.10

const USD_TO_EUR = 0.92

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // ===== ALL-TIME COUNTS =====
    const { count: imageCount } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })

    const { data: textTransactions } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('type', 'usage')
      .eq('reference_type', 'text_generation')

    const { data: allUsageTransactions } = await supabase
      .from('credit_transactions')
      .select('amount, reference_type, description, created_at')
      .eq('type', 'usage')
      .order('created_at', { ascending: false })
      .limit(50)

    const totalCreditsUsed = (allUsageTransactions || []).reduce(
      (sum: number, t: any) => sum + Math.abs(t.amount), 0
    )

    const totalImageGenerations = imageCount || 0
    const totalTextGenerations = textTransactions?.length || 0

    // ===== ALL-TIME COSTS =====
    const totalImageCostUsd = totalImageGenerations * COST_PER_IMAGE_GENERATION
    const totalTextCostUsd = totalTextGenerations * COST_PER_TEXT_GENERATION
    const totalCostUsd = totalImageCostUsd + totalTextCostUsd
    const totalCostEur = totalCostUsd * USD_TO_EUR

    // ===== THIS MONTH =====
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: monthlyUsage } = await supabase
      .from('credit_transactions')
      .select('amount, reference_type, created_at')
      .eq('type', 'usage')
      .gte('created_at', firstOfMonth)

    let monthImages = 0
    let monthTexts = 0
    ;(monthlyUsage || []).forEach(t => {
      if (t.reference_type === 'image_generation') monthImages++
      else if (t.reference_type === 'text_generation') monthTexts++
    })

    const monthImageCostUsd = monthImages * COST_PER_IMAGE_GENERATION
    const monthTextCostUsd = monthTexts * COST_PER_TEXT_GENERATION
    const monthTotalCostUsd = monthImageCostUsd + monthTextCostUsd
    const monthTotalCostEur = monthTotalCostUsd * USD_TO_EUR

    // ===== LAST MONTH (for comparison) =====
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    const { data: lastMonthUsage } = await supabase
      .from('credit_transactions')
      .select('reference_type')
      .eq('type', 'usage')
      .gte('created_at', firstOfLastMonth)
      .lte('created_at', lastOfLastMonth)

    let lastMonthImages = 0
    let lastMonthTexts = 0
    ;(lastMonthUsage || []).forEach(t => {
      if (t.reference_type === 'image_generation') lastMonthImages++
      else if (t.reference_type === 'text_generation') lastMonthTexts++
    })

    const lastMonthCostUsd = (lastMonthImages * COST_PER_IMAGE_GENERATION) + (lastMonthTexts * COST_PER_TEXT_GENERATION)

    // ===== COST TREND =====
    const costTrend = lastMonthCostUsd > 0
      ? ((monthTotalCostUsd - lastMonthCostUsd) / lastMonthCostUsd) * 100
      : 0

    // ===== PER-UNIT METRICS =====
    const costPerCredit = totalCreditsUsed > 0 ? totalCostUsd / totalCreditsUsed : 0
    const avgCostPerGeneration = (totalImageGenerations + totalTextGenerations) > 0
      ? totalCostUsd / (totalImageGenerations + totalTextGenerations)
      : 0

    // ===== DAILY BREAKDOWN (last 30 days) =====
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: dailyUsage } = await supabase
      .from('credit_transactions')
      .select('reference_type, created_at')
      .eq('type', 'usage')
      .gte('created_at', thirtyDaysAgo)

    const dailyCosts: Record<string, { images: number; texts: number; costUsd: number }> = {}
    ;(dailyUsage || []).forEach(t => {
      const day = new Date(t.created_at).toISOString().split('T')[0]
      if (!dailyCosts[day]) dailyCosts[day] = { images: 0, texts: 0, costUsd: 0 }
      if (t.reference_type === 'image_generation') {
        dailyCosts[day].images++
        dailyCosts[day].costUsd += COST_PER_IMAGE_GENERATION
      } else if (t.reference_type === 'text_generation') {
        dailyCosts[day].texts++
        dailyCosts[day].costUsd += COST_PER_TEXT_GENERATION
      }
    })

    const dailyBreakdown = Object.entries(dailyCosts)
      .map(([date, data]) => ({ date, ...data, costEur: data.costUsd * USD_TO_EUR }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({
      // All-time totals
      totalImageGenerations,
      totalTextGenerations,
      totalCostUsd,
      totalCostEur,
      totalImageCostUsd,
      totalTextCostUsd,
      totalCreditsUsed,

      // This month
      month: {
        images: monthImages,
        texts: monthTexts,
        costUsd: monthTotalCostUsd,
        costEur: monthTotalCostEur,
        imageCostUsd: monthImageCostUsd,
        textCostUsd: monthTextCostUsd,
      },

      // Last month comparison
      lastMonth: {
        images: lastMonthImages,
        texts: lastMonthTexts,
        costUsd: lastMonthCostUsd,
      },

      costTrend,

      // Per-unit
      costPerCredit,
      avgCostPerGeneration,

      // Reference prices
      pricePerImage: COST_PER_IMAGE_GENERATION,
      pricePerText: COST_PER_TEXT_GENERATION,
      usdToEur: USD_TO_EUR,

      // Daily breakdown
      dailyBreakdown,

      // Recent transactions
      transactions: (allUsageTransactions || []).map(t => ({
        ...t,
        estimatedCostUsd: t.reference_type === 'image_generation'
          ? COST_PER_IMAGE_GENERATION
          : t.reference_type === 'text_generation'
          ? COST_PER_TEXT_GENERATION
          : 0,
      })),
    })
  } catch (err) {
    console.error('Costs error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}