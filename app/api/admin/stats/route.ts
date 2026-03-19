import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

// ===== REAL API COSTS =====
// GPT-4o-mini: $0.15/1M input tokens + $0.60/1M output tokens
// Average text generation: ~800 input tokens + ~1500 output tokens
// Cost per text gen: (800 * 0.00000015) + (1500 * 0.0000006) = $0.00012 + $0.0009 = ~$0.001
// We round up to $0.004 to account for retries, longer prompts, variation
const COST_PER_TEXT_GENERATION = 0.004

// KIE Nano Banana Pro (1K resolution via kie.ai): ~$0.09-0.12 per image
// Using $0.10 as average (mix of 1K at $0.09 and occasional retries)
const COST_PER_IMAGE_GENERATION = 0.10

// ===== PLAN PRICES (USD/month) =====
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 19,
  professional: 49,
  enterprise: 99,
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // ===== BASIC COUNTS =====
    const [users, stores, products, images, allTransactions] = await Promise.all([
      supabase.from('users').select('id, email, name, plan, credits, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('stores').select('*', { count: 'exact' }),
      supabase.from('products').select('*', { count: 'exact' }),
      supabase.from('generated_images').select('*', { count: 'exact' }),
      supabase.from('credit_transactions').select('*').eq('type', 'usage'),
    ])

    const totalCreditsUsed = (allTransactions.data || []).reduce(
      (sum: number, t: any) => sum + Math.abs(t.amount), 0
    )

    // ===== RECENT GENERATION JOBS =====
    const { data: recentJobs } = await supabase
      .from('generation_jobs')
      .select('id, type, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(10)

    // Enrich jobs with user info
    const jobUserIds = [...new Set((recentJobs || []).map(j => j.user_id))]
    let jobUserMap: Record<string, { email: string; name: string | null }> = {}
    if (jobUserIds.length > 0) {
      const { data: jobUsers } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', jobUserIds)
      ;(jobUsers || []).forEach(u => {
        jobUserMap[u.id] = { email: u.email, name: u.name }
      })
    }

    const enrichedJobs = (recentJobs || []).map(job => ({
      ...job,
      user_email: jobUserMap[job.user_id]?.email || 'unknown',
      user_name: jobUserMap[job.user_id]?.name || null,
    }))

    // ===== FINANCIAL METRICS =====

    // 1. MRR (Monthly Recurring Revenue) - based on active paid plans
    const { data: allUsers } = await supabase
      .from('users')
      .select('plan, stripe_subscription_id')

    let mrr = 0
    let planDistribution: Record<string, number> = { free: 0, starter: 0, professional: 0, enterprise: 0 }
    ;(allUsers || []).forEach(u => {
      const plan = u.plan || 'free'
      if (planDistribution[plan] !== undefined) {
        planDistribution[plan]++
      }
      // Only count MRR for users with active subscriptions
      if (u.stripe_subscription_id && PLAN_PRICES[plan]) {
        mrr += PLAN_PRICES[plan]
      }
    })

    // 2. Credit pack revenue this month
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: monthlyPurchases } = await supabase
      .from('credit_transactions')
      .select('amount, description, reference_type')
      .in('type', ['purchase', 'subscription'])
      .gte('created_at', firstOfMonth)

    let monthlySubscriptionRevenue = 0
    let monthlyCreditPackRevenue = 0
    ;(monthlyPurchases || []).forEach(t => {
      if (t.reference_type === 'subscription' || t.reference_type === 'subscription_renewal') {
        if (t.amount === 250) monthlySubscriptionRevenue += 19
        else if (t.amount === 750) monthlySubscriptionRevenue += 49
        else if (t.amount === 2000) monthlySubscriptionRevenue += 99
      } else if (t.reference_type === 'credit_purchase') {
        if (t.amount === 50) monthlyCreditPackRevenue += 39
        else if (t.amount === 100) monthlyCreditPackRevenue += 69
        else if (t.amount === 300) monthlyCreditPackRevenue += 159
        else if (t.amount === 500) monthlyCreditPackRevenue += 249
        else if (t.amount === 1000) monthlyCreditPackRevenue += 399
      }
    })

    const totalMonthlyRevenue = monthlySubscriptionRevenue + monthlyCreditPackRevenue

    // 3. API Costs this month
    const { data: monthlyUsage } = await supabase
      .from('credit_transactions')
      .select('amount, reference_type')
      .eq('type', 'usage')
      .gte('created_at', firstOfMonth)

    let monthlyImageGenerations = 0
    let monthlyTextGenerations = 0
    ;(monthlyUsage || []).forEach(t => {
      if (t.reference_type === 'image_generation') monthlyImageGenerations++
      else if (t.reference_type === 'text_generation') monthlyTextGenerations++
    })

    const monthlyImageCost = monthlyImageGenerations * COST_PER_IMAGE_GENERATION
    const monthlyTextCost = monthlyTextGenerations * COST_PER_TEXT_GENERATION
    const totalMonthlyApiCost = monthlyImageCost + monthlyTextCost

    // 4. Profit (all values in USD)
    const monthlyProfit = totalMonthlyRevenue - totalMonthlyApiCost
    const profitMargin = totalMonthlyRevenue > 0 ? (monthlyProfit / totalMonthlyRevenue) * 100 : 0

    // 5. All-time costs
    const { count: totalImageCount } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })

    const { data: allTextUsage } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('type', 'usage')
      .eq('reference_type', 'text_generation')

    const totalTextGenerations = allTextUsage?.length || 0
    const totalImageCost = (totalImageCount || 0) * COST_PER_IMAGE_GENERATION
    const totalTextCost = totalTextGenerations * COST_PER_TEXT_GENERATION
    const totalApiCost = totalImageCost + totalTextCost

    // 6. All-time revenue (excluding manual/bonus credit additions)
    const { data: allPurchases } = await supabase
      .from('credit_transactions')
      .select('amount, reference_type')
      .in('type', ['purchase', 'subscription'])

    let totalRevenue = 0
    ;(allPurchases || []).forEach(t => {
      if (t.reference_type === 'subscription' || t.reference_type === 'subscription_renewal') {
        if (t.amount === 250) totalRevenue += 19
        else if (t.amount === 750) totalRevenue += 49
        else if (t.amount === 2000) totalRevenue += 99
      } else if (t.reference_type === 'credit_purchase') {
        if (t.amount === 50) totalRevenue += 39
        else if (t.amount === 100) totalRevenue += 69
        else if (t.amount === 300) totalRevenue += 159
        else if (t.amount === 500) totalRevenue += 249
        else if (t.amount === 1000) totalRevenue += 399
      }
    })

    // 7. Average revenue per user (ARPU)
    const totalPaidUsers = (allUsers || []).filter(u => u.stripe_subscription_id).length
    const arpu = totalPaidUsers > 0 ? mrr / totalPaidUsers : 0

    // 8. Cost per credit
    const costPerCredit = totalCreditsUsed > 0 ? totalApiCost / totalCreditsUsed : 0

    // 9. Revenue per credit (what users pay per credit on average)
    const revenuePerCredit = totalCreditsUsed > 0 ? totalRevenue / totalCreditsUsed : 0

    return NextResponse.json({
      // Basic stats
      totalUsers: users.count || 0,
      totalStores: stores.count || 0,
      totalProducts: products.count || 0,
      totalImages: totalImageCount || 0,
      totalCreditsUsed,
      recentUsers: users.data || [],
      recentJobs: enrichedJobs,

      // Financial metrics
      financial: {
        // Monthly
        mrr,
        monthlySubscriptionRevenue,
        monthlyCreditPackRevenue,
        totalMonthlyRevenue,
        monthlyImageGenerations,
        monthlyTextGenerations,
        monthlyImageCost,
        monthlyTextCost,
        totalMonthlyApiCost,
        monthlyProfit,
        profitMargin,

        // All-time
        totalRevenue,
        totalApiCost,
        totalProfit: totalRevenue - totalApiCost,
        totalImageCost,
        totalTextCost,
        totalTextGenerations,

        // Per-unit metrics
        arpu,
        costPerCredit,
        revenuePerCredit,
        totalPaidUsers,

        // Plan distribution
        planDistribution,

        // Cost references
        costPerImageGeneration: COST_PER_IMAGE_GENERATION,
        costPerTextGeneration: COST_PER_TEXT_GENERATION,
      },
    })
  } catch (err) {
    console.error('Stats error:', err)
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}