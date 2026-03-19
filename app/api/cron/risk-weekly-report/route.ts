import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWeeklyReport } from '@/lib/risk/notifications'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const now = new Date()

  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() - 1)
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekStart.getDate() - 6)
  const prevWeekEnd = new Date(weekStart)
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
  const prevWeekStart = new Date(prevWeekEnd)
  prevWeekStart.setDate(prevWeekStart.getDate() - 6)

  const weekStartLabel = weekStart.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
  const weekEndLabel = weekEnd.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })

  const { data: settingsList } = await supabase
    .from('risk_store_settings')
    .select('store_id, user_id, alert_email, weekly_report_enabled')
    .eq('weekly_report_enabled', true)

  let sent = 0, errors = 0

  for (const settings of (settingsList || [])) {
    try {
      const { data: store } = await supabase
        .from('stores')
        .select('id, store_url, user_id')
        .eq('id', settings.store_id)
        .single()
      if (!store) continue

      const [ordersRes, prevOrdersRes, alertsRes, newCustRes, topRiskRes, blockedCustRes] = await Promise.all([
        supabase.from('risk_orders').select('order_status,total_value,currency,customer_id').eq('store_id', settings.store_id).gte('ordered_at', weekStart.toISOString()).lte('ordered_at', weekEnd.toISOString()),
        supabase.from('risk_orders').select('order_status,total_value').eq('store_id', settings.store_id).gte('ordered_at', prevWeekStart.toISOString()).lte('ordered_at', prevWeekEnd.toISOString()),
        supabase.from('risk_alerts').select('id', { count: 'exact', head: true }).eq('store_id', settings.store_id).gte('created_at', weekStart.toISOString()),
        supabase.from('risk_customers').select('id', { count: 'exact', head: true }).eq('store_id', settings.store_id).gte('first_order_at', weekStart.toISOString()),
        supabase.from('risk_customers').select('name,phone,risk_score,risk_label,orders_refused,total_orders').eq('store_id', settings.store_id).in('risk_label', ['blocked','problematic']).order('risk_score', { ascending: false }).limit(5),
        supabase.from('risk_customers').select('id').eq('store_id', settings.store_id).in('risk_label', ['blocked','problematic']).gte('updated_at', weekStart.toISOString()),
      ])

      const allOrders = ordersRes.data || []
      const allPrev = prevOrdersRes.data || []
      const refusedOrders = allOrders.filter((o: any) => ['refused','returned','not_home'].includes(o.order_status))
      const collectedOrders = allOrders.filter((o: any) => o.order_status === 'collected')
      const prevRefused = allPrev.filter((o: any) => ['refused','returned','not_home'].includes(o.order_status))

      const totalFinalized = refusedOrders.length + collectedOrders.length
      const collectionRate = totalFinalized > 0 ? Math.round((collectedOrders.length / totalFinalized) * 100) : 0
      const refusalRate = totalFinalized > 0 ? Math.round((refusedOrders.length / totalFinalized) * 100) : 0
      const prevFinalized = allPrev.filter((o: any) => ['collected','refused','returned','cancelled'].includes(o.order_status)).length
      const prevRefusalRate = prevFinalized > 0 ? Math.round((prevRefused.length / prevFinalized) * 100) : 0

      let recipientEmail = settings.alert_email
      if (!recipientEmail) {
        const { data: user } = await supabase.from('users').select('email').eq('id', store.user_id).single()
        recipientEmail = (user as any)?.email
      }
      if (!recipientEmail) continue

      const baseUrl = process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
      const storeName = store.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '')

      await sendWeeklyReport({
        to: recipientEmail,
        storeName,
        storeUrl: store.store_url,
        dashboardUrl: baseUrl,
        weekStart: weekStartLabel,
        weekEnd: weekEndLabel,
        currency: 'RON',
        stats: {
          totalOrders: allOrders.length,
          blockedOrders: (blockedCustRes.data || []).length,
          problematicOrders: (topRiskRes.data || []).filter((c: any) => c.risk_label === 'problematic').length,
          watchOrders: 0,
          refusedOrders: refusedOrders.length,
          totalRefusalValue: Math.round(refusedOrders.reduce((s: number, o: any) => s + (o.total_value || 0), 0)),
          savedValue: Math.round((blockedCustRes.data || []).length * 180),
          newCustomers: (newCustRes as any).count || 0,
          alertsGenerated: (alertsRes as any).count || 0,
          topRiskCustomers: (topRiskRes.data || []).map((c: any) => ({
            name: c.name, phone: c.phone, score: c.risk_score,
            label: c.risk_label, totalOrders: c.total_orders, refusedOrders: c.orders_refused,
          })),
          collectionRate, refusalRate,
          vsLastWeek: { refusalRateChange: refusalRate - prevRefusalRate, blockedChange: 0 },
        },
      })
      sent++
    } catch (err) {
      console.error(`[Risk Weekly] store ${settings.store_id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ ok: true, sent, errors })
}