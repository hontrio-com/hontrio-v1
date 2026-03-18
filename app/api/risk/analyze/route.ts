import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { openai } from '@/lib/openai/client'
import { resolveCustomer, getSettings } from '@/lib/risk/identity'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const ctx = new URL(req.url).searchParams.get('customer_context')
    if (!ctx) return NextResponse.json({ error: 'customer_context required' }, { status: 400 })
    const c = await openai.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 400,
      messages: [
        { role: 'system', content: 'Ești un sistem de analiză risc pentru magazine online din România. Răspunde concis în română.' },
        { role: 'user', content: `Analizează: (1) evaluare risc, (2) pattern-uri, (3) recomandare.\n\n${ctx}` },
      ],
    })
    return NextResponse.json({ report: c.choices[0]?.message?.content || 'Eroare.' })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    // AI Report
    if (body.customer_context) {
      const c = await openai.chat.completions.create({
        model: 'gpt-4o-mini', max_tokens: 400,
        messages: [
          { role: 'system', content: 'Ești un sistem de analiză risc pentru magazine online din România. Răspunde concis în română.' },
          { role: 'user', content: `Analizează: (1) evaluare risc, (2) pattern-uri, (3) recomandare.\n\n${body.customer_context}` },
        ],
      })
      const report = c.choices[0]?.message?.content || 'Eroare.'
      const supabaseAi = createAdminClient()
      const uid = (session.user as any).id
      const { data: u } = await supabaseAi.from('users').select('credits').eq('id', uid).single()
      if (u && u.credits >= 2) {
        const bal = u.credits - 2
        await supabaseAi.from('users').update({ credits: bal }).eq('id', uid)
        await supabaseAi.from('credit_transactions').insert({
          user_id: uid, type: 'usage', amount: -2, balance_after: bal,
          description: 'AI Intelligence Report — Risk Shield', reference_type: 'risk_ai_report',
        })
      }
      return NextResponse.json({ report })
    }

    // Order analysis — uses resolveCustomer (external_customer_id based)
    const { store_id, external_order_id, order_number, customer_id: wc_customer_id,
      customer_phone, customer_email, customer_name,
      shipping_address, payment_method = 'cod', total_value, currency = 'RON', ordered_at } = body

    if (!store_id || !external_order_id || (!customer_phone && !customer_email)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id
    const { data: store } = await supabase.from('stores')
      .select('id').eq('id', store_id).eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const settings = await getSettings(supabase, store_id)
    const { customer, isNew } = await resolveCustomer(
      supabase, store_id, userId,
      wc_customer_id ? String(wc_customer_id) : null,
      customer_phone, customer_email, customer_name,
      ordered_at || new Date().toISOString()
    )
    const cid = customer.id

    const history: CustomerHistory = {
      totalOrders: customer.total_orders || 0, ordersCollected: customer.orders_collected || 0,
      ordersRefused: customer.orders_refused || 0, ordersNotHome: customer.orders_not_home || 0,
      ordersCancelled: customer.orders_cancelled || 0, ordersToday: 0,
      lastOrderAt: customer.last_order_at, firstOrderAt: customer.first_order_at,
      accountCreatedAt: null,
      phoneValidated: !!(customer_phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: isNew, addressChanges: 0,
    }
    const ctx: OrderContext = {
      paymentMethod: payment_method, totalValue: total_value || 0, currency,
      orderedAt: ordered_at || new Date().toISOString(),
      customerEmail: customer_email || '', shippingAddress: shipping_address || '',
      inGlobalBlacklist: customer.in_global_blacklist || false, globalReportCount: 0,
    }
    const result = calculateRiskScore(history, ctx, settings)
    const label = customer.manual_label_override || result.label

    await supabase.from('risk_customers').update({
      risk_score: result.score, risk_label: label,
      total_orders: (customer.total_orders || 0) + 1, updated_at: new Date().toISOString(),
    }).eq('id', cid)

    const { data: ro } = await supabase.from('risk_orders').upsert({
      store_id, user_id: userId, customer_id: cid,
      external_order_id, external_customer_id: wc_customer_id ? String(wc_customer_id) : null,
      order_number, customer_phone, customer_email, customer_name,
      shipping_address, payment_method, total_value, currency,
      order_status: 'pending', risk_score_at_order: result.score, risk_flags: result.flags,
      ordered_at: ordered_at || new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,external_order_id' }).select('id').single()

    return NextResponse.json({
      score: result.score, label, flags: result.flags,
      recommendation: result.recommendation, customerId: cid, orderId: ro?.id,
      action: label === 'blocked' ? 'block' : label === 'problematic' ? 'hold' : 'proceed',
    })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}