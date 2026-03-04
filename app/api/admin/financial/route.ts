import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

const COST_PER_IMAGE = 0.09  // $0.09 KIE Nano Banana Pro 1K
const COST_PER_TEXT  = 0.004 // GPT-4o-mini average
const USD_TO_RON     = 4.60

const PLAN_PRICES_RON: Record<string, number> = {
  free: 0, starter: 99, professional: 249, enterprise: 499,
}
const PLAN_CREDITS: Record<string, number> = {
  free: 20, starter: 250, professional: 750, enterprise: 2000,
}
const PACK_PRICES_RON: Record<number, number> = {
  50: 39, 100: 69, 300: 159, 500: 249, 1000: 399,
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }
    const supabase = createAdminClient()
    const now = new Date()

    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return {
        label: d.toLocaleDateString('ro-RO', { month: 'short', year: '2-digit' }),
        start: d.toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
      }
    })

    const [{ data: allTx }, { data: allUsers }] = await Promise.all([
      supabase.from('credit_transactions').select('amount,type,reference_type,created_at,user_id').order('created_at', { ascending: true }),
      supabase.from('users').select('id,plan,stripe_subscription_id,created_at'),
    ])

    const monthlyData = months.map(m => {
      const txInMonth = (allTx || []).filter(t => t.created_at >= m.start && t.created_at < m.end)

      let subRevenue = 0, packRevenue = 0
      txInMonth.filter(t => t.type === 'purchase').forEach(t => {
        const planMatch = Object.entries(PLAN_CREDITS).find(([, cr]) => cr === t.amount)
        if (planMatch) subRevenue += PLAN_PRICES_RON[planMatch[0]] || 0
        else packRevenue += PACK_PRICES_RON[t.amount] || 0
      })

      const imgCount = txInMonth.filter(t => t.type === 'usage' && t.reference_type === 'image_generation').length
      const txtCount = txInMonth.filter(t => t.type === 'usage' && t.reference_type === 'text_generation').length
      const apiCostRon = (imgCount * COST_PER_IMAGE + txtCount * COST_PER_TEXT) * USD_TO_RON
      const newUsers = (allUsers || []).filter(u => u.created_at >= m.start && u.created_at < m.end).length
      const totalRevenue = subRevenue + packRevenue
      const profit = totalRevenue - apiCostRon

      return {
        label: m.label,
        revenue: Math.round(totalRevenue),
        subRevenue: Math.round(subRevenue),
        packRevenue: Math.round(packRevenue),
        apiCost: Math.round(apiCostRon * 100) / 100,
        profit: Math.round(profit),
        margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
        images: imgCount,
        texts: txtCount,
        newUsers,
      }
    })

    const current = monthlyData[11]
    const prev = monthlyData[10]

    const mrr = (allUsers || [])
      .filter(u => u.stripe_subscription_id)
      .reduce((sum, u) => sum + (PLAN_PRICES_RON[u.plan] || 0), 0)

    const planDist: Record<string, number> = { free: 0, starter: 0, professional: 0, enterprise: 0 }
    ;(allUsers || []).forEach(u => { const p = u.plan || 'free'; if (planDist[p] !== undefined) planDist[p]++ })

    const paidNow = (allUsers || []).filter(u => u.plan !== 'free').length
    const paidLastMonth = (allUsers || []).filter(u => u.plan !== 'free' && u.created_at < months[11].start).length
    const churnRate = paidLastMonth > 0 ? Math.max(0, Math.round(((paidLastMonth - paidNow) / paidLastMonth) * 1000) / 10) : 0
    const arpu = paidNow > 0 ? Math.round((mrr / paidNow) * 100) / 100 : 0
    const ltv = churnRate > 0 ? Math.round(arpu / (churnRate / 100)) : arpu * 24

    const last3rev = monthlyData.slice(9, 12).map(m => m.revenue)
    const avgGrowth = last3rev.length > 1 ? (last3rev[2] - last3rev[0]) / 2 : 0
    const forecastRevenue = Math.max(0, Math.round(current.revenue + avgGrowth))
    const forecastMargin = current.margin
    const forecastProfit = Math.round(forecastRevenue * (forecastMargin / 100))

    return NextResponse.json({
      monthly: monthlyData,
      current, prev, mrr, arpu, ltv, churnRate,
      forecastRevenue, forecastProfit, forecastMargin,
      planDist, totalPaid: paidNow,
      totalUsers: (allUsers || []).length,
      allTimeRevenue: monthlyData.reduce((s, m) => s + m.revenue, 0),
      allTimeProfit: monthlyData.reduce((s, m) => s + m.profit, 0),
      allTimeApiCost: Math.round(monthlyData.reduce((s, m) => s + m.apiCost, 0) * 100) / 100,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}