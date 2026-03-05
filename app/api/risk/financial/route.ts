import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateFinancialLoss } from '@/lib/risk/engine'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    const period = searchParams.get('period') || '30'
    const periodDays = Math.min(parseInt(period), 365)

    const supabase = createAdminClient()
    const fromDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
    const prevFromDate = new Date(Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString()

    let q = supabase.from('risk_orders')
      .select('order_status,total_value,currency,ordered_at,customer_id,payment_method')
      .eq('user_id', session.user.id)
      .gte('ordered_at', fromDate)
    if (store_id) q = q.eq('store_id', store_id)
    const { data: orders } = await q

    let qPrev = supabase.from('risk_orders')
      .select('order_status,total_value,currency,ordered_at')
      .eq('user_id', session.user.id)
      .gte('ordered_at', prevFromDate)
      .lt('ordered_at', fromDate)
    if (store_id) qPrev = qPrev.eq('store_id', store_id)
    const { data: prevOrders } = await qPrev

    let qBlocked = supabase.from('risk_customers')
      .select('id,risk_score,risk_label,orders_refused,total_orders')
      .eq('user_id', session.user.id)
      .in('risk_label', ['blocked','problematic'])
      .gte('updated_at', fromDate)
    if (store_id) qBlocked = qBlocked.eq('store_id', store_id)
    const { data: blockedCustomers } = await qBlocked

    const allOrders = orders || []
    const allPrevOrders = prevOrders || []

    const refusedOrders = allOrders.filter(o => ['refused','returned','not_home'].includes(o.order_status))
    const cancelledOrders = allOrders.filter(o => o.order_status === 'cancelled')
    const collectedOrders = allOrders.filter(o => o.order_status === 'collected')
    const prevRefused = allPrevOrders.filter(o => ['refused','returned','not_home'].includes(o.order_status))

    const loss = calculateFinancialLoss(
      refusedOrders.map(o => ({ total_value: o.total_value || 0, currency: o.currency || 'RON' }))
    )
    const prevLoss = calculateFinancialLoss(
      prevRefused.map(o => ({ total_value: o.total_value || 0, currency: o.currency || 'RON' }))
    )

    const blockedValue = (blockedCustomers || []).reduce((sum: number, c: any) => {
      return sum + (c.orders_refused > 0 ? c.orders_refused * 200 : 150)
    }, 0)

    // Trending zilnic
    const dailyMap: Record<string, { refused: number; collected: number; value: number }> = {}
    for (const o of allOrders) {
      const day = (o.ordered_at || '').substring(0, 10)
      if (!dailyMap[day]) dailyMap[day] = { refused: 0, collected: 0, value: 0 }
      if (['refused','returned'].includes(o.order_status)) {
        dailyMap[day].refused++
        dailyMap[day].value += o.total_value || 0
      }
      if (o.order_status === 'collected') dailyMap[day].collected++
    }
    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        refused: d.refused,
        collected: d.collected,
        refusalValue: Math.round(d.value),
        refusalRate: (d.collected + d.refused) > 0
          ? Math.round((d.refused / (d.collected + d.refused)) * 100) : 0,
      }))

    const totalFinalized = collectedOrders.length + refusedOrders.length + cancelledOrders.length
    const collectionRate = totalFinalized > 0 ? Math.round((collectedOrders.length / totalFinalized) * 100) : 0
    const refusalRate = totalFinalized > 0 ? Math.round((refusedOrders.length / totalFinalized) * 100) : 0
    const prevFinalized = allPrevOrders.filter(o => ['collected','refused','returned','cancelled'].includes(o.order_status)).length
    const prevRefusalRate = prevFinalized > 0 ? Math.round((prevRefused.length / prevFinalized) * 100) : 0

    // Proiecție lunară (din ultimele 7 zile)
    const cutoff7 = Date.now() - 7 * 24 * 3600 * 1000
    const last7Refused = allOrders.filter(o =>
      ['refused','returned'].includes(o.order_status) && new Date(o.ordered_at || '').getTime() > cutoff7
    )
    const avgDailyLoss = last7Refused.reduce((s, o) => s + (o.total_value || 0), 0) / 7
    const projectedMonthlyLoss = Math.round(avgDailyLoss * 30)

    // Top clienți cu pierderi mari
    const customerLossMap: Record<string, { totalLoss: number; orderCount: number }> = {}
    for (const o of refusedOrders) {
      if (!o.customer_id) continue
      if (!customerLossMap[o.customer_id]) customerLossMap[o.customer_id] = { totalLoss: 0, orderCount: 0 }
      customerLossMap[o.customer_id].totalLoss += o.total_value || 0
      customerLossMap[o.customer_id].orderCount++
    }

    const topIds = Object.entries(customerLossMap)
      .sort(([, a], [, b]) => b.totalLoss - a.totalLoss)
      .slice(0, 5)
      .map(([id]) => id)

    let topCustomers: any[] = []
    if (topIds.length > 0) {
      const { data } = await supabase
        .from('risk_customers')
        .select('id,name,phone,email,risk_score,risk_label,orders_refused,total_orders')
        .in('id', topIds)
      topCustomers = (data || []).map((c: any) => ({
        ...c,
        totalLoss: Math.round(customerLossMap[c.id]?.totalLoss || 0),
        lossOrders: customerLossMap[c.id]?.orderCount || 0,
      })).sort((a: any, b: any) => b.totalLoss - a.totalLoss)
    }

    return NextResponse.json({
      period: periodDays, currency: 'RON',
      loss, prevLoss,
      blockedValue: Math.round(blockedValue),
      collectionRate, refusalRate, prevRefusalRate,
      refusalRateChange: refusalRate - prevRefusalRate,
      totalOrders: allOrders.length,
      refusedCount: refusedOrders.length,
      collectedCount: collectedOrders.length,
      cancelledCount: cancelledOrders.length,
      projectedMonthlyLoss, daily,
      topLossCustomers: topCustomers,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}