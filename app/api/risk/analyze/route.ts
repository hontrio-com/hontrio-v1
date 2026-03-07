import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { openai } from '@/lib/openai/client'
import {
  normalizePhone, normalizeEmail,
  findOrCreateCustomer, recalcCustomerFromDB,
} from '@/lib/risk/identity'

// ─── GET: AI Intelligence Report pentru un client ─────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const customer_context = searchParams.get('customer_context')

    if (!customer_context) return NextResponse.json({ error: 'customer_context necesar' }, { status: 400 })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: 'Ești un sistem de analiză risc pentru magazine online din România. Analizezi comportamentul clienților și dai recomandări clare. Răspunde concis în română, în 3-4 paragrafe scurte. Nu folosi liste sau bullets. Fii direct și specific.',
        },
        {
          role: 'user',
          content: `Analizează acest profil de client și oferă: (1) evaluarea riscului, (2) pattern-urile de comportament identificate, (3) recomandarea ta clară (procesează / ține în așteptare / blochează).\n\n${customer_context}`,
        },
      ],
    })

    const report = completion.choices[0]?.message?.content || 'Nu s-a putut genera raportul.'
    return NextResponse.json({ report })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const body = await req.json()

    // ─── Intelligence Report AI ───────────────────────────────────────────────
    if (body.customer_context) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: 'Ești un sistem de analiză risc pentru magazine online din România. Analizezi comportamentul clienților și dai recomandări clare. Răspunde concis în română, în 3-4 paragrafe scurte. Nu folosi liste sau bullets. Fii direct și specific.',
          },
          {
            role: 'user',
            content: `Analizează acest profil de client și oferă: (1) evaluarea riscului, (2) pattern-urile de comportament identificate, (3) recomandarea ta clară (procesează / ține în așteptare / blochează).\n\n${body.customer_context}`,
          },
        ],
      })
      const report = completion.choices[0]?.message?.content || 'Nu s-a putut genera raportul.'

      // Deduce 2 credite
      const supabaseAi = createAdminClient()
      const userId = (session.user as any).id
      const { data: userCredits } = await supabaseAi
        .from('users').select('credits').eq('id', userId).single()
      if (userCredits && userCredits.credits >= 2) {
        const newBalance = userCredits.credits - 2
        await supabaseAi.from('users').update({ credits: newBalance }).eq('id', userId)
        await supabaseAi.from('credit_transactions').insert({
          user_id: userId, type: 'usage', amount: -2, balance_after: newBalance,
          description: 'AI Intelligence Report — Risk Shield',
          reference_type: 'risk_ai_report',
        })
      }

      return NextResponse.json({ report })
    }

    // ─── Analiză comandă nouă ─────────────────────────────────────────────────
    const {
      store_id,
      external_order_id,
      order_number,
      customer_phone,
      customer_email,
      customer_name,
      shipping_address,
      payment_method = 'cod',
      total_value,
      currency = 'RON',
      ordered_at,
    } = body

    if (!store_id || !external_order_id || (!customer_phone && !customer_email)) {
      return NextResponse.json({ error: 'store_id, external_order_id și telefon/email sunt obligatorii' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    // Verifică ownership store
    const { data: store } = await supabase
      .from('stores').select('id, user_id').eq('id', store_id).eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Store negăsit' }, { status: 404 })

    // Setări
    const { data: rs } = await supabase
      .from('risk_store_settings').select('*').eq('store_id', store_id).single()
    const settings = {
      participate_in_global_blacklist: rs?.participate_in_global_blacklist ?? true,
      score_watch_threshold: rs?.score_watch_threshold ?? 41,
      score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
      score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
      alert_on_blocked: rs?.alert_on_blocked ?? true,
      alert_on_problematic: rs?.alert_on_problematic ?? true,
      alert_on_watch: rs?.alert_on_watch ?? false,
      ...(rs?.custom_rules || {}),
      ml_weights: rs?.ml_weights,
    }

    // ── FOLOSEȘTE ACEEAȘI REGULĂ DE IDENTITATE CA WEBHOOK ──────────────────
    const { customer, isNew } = await findOrCreateCustomer(
      supabase, store_id, userId,
      customer_phone, customer_email, customer_name,
      ordered_at || new Date().toISOString()
    )
    const customerId = customer.id

    // Update info dacă lipsesc
    const custUpdates: any = { updated_at: new Date().toISOString() }
    if (!customer.name && customer_name) custUpdates.name = customer_name
    if (!customer.phone && customer_phone) custUpdates.phone = customer_phone
    if (!customer.email && customer_email) custUpdates.email = normalizeEmail(customer_email)
    custUpdates.last_order_at = ordered_at || new Date().toISOString()
    await supabase.from('risk_customers').update(custUpdates).eq('id', customerId)

    // Comenzi azi
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let ordersToday = 0
    if (customer_phone || customer_email) {
      const filters: string[] = []
      if (customer_phone) filters.push(`customer_phone.eq.${customer_phone}`)
      if (customer_email) filters.push(`customer_email.eq.${customer_email}`)

      const { count } = await supabase
        .from('risk_orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store_id)
        .gte('ordered_at', todayStart.toISOString())
        .or(filters.join(','))
      ordersToday = count || 0
    }

    // Adrese unice
    let addressChanges = 0
    if (!isNew) {
      const { data: addresses } = await supabase
        .from('risk_orders').select('shipping_address')
        .eq('customer_id', customerId).not('shipping_address', 'is', null)
      addressChanges = new Set((addresses || []).map(a => a.shipping_address?.trim().toLowerCase())).size
    }

    // Blacklist global
    let inGlobalBlacklist = false, globalReportCount = 0
    if (settings.participate_in_global_blacklist) {
      for (const val of [customer_phone, customer_email].filter(Boolean)) {
        const hash = hashIdentifier(val!)
        const { data: gb } = await supabase.from('risk_global_blacklist')
          .select('report_count').or(`phone_hash.eq.${hash},email_hash.eq.${hash}`).single()
        if (gb) { inGlobalBlacklist = true; globalReportCount = Math.max(globalReportCount, gb.report_count) }
      }
    }

    // Calculează scorul
    const history: CustomerHistory = {
      totalOrders: customer.total_orders || 0,
      ordersCollected: customer.orders_collected || 0,
      ordersRefused: customer.orders_refused || 0,
      ordersNotHome: customer.orders_not_home || 0,
      ordersCancelled: customer.orders_cancelled || 0,
      ordersToday,
      lastOrderAt: customer.last_order_at || null,
      firstOrderAt: customer.first_order_at || null,
      accountCreatedAt: null,
      phoneValidated: !!(customer_phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: isNew,
      addressChanges,
    }

    const orderCtx: OrderContext = {
      paymentMethod: payment_method,
      totalValue: total_value || 0,
      currency,
      orderedAt: ordered_at || new Date().toISOString(),
      customerEmail: customer_email || '',
      shippingAddress: shipping_address || '',
      inGlobalBlacklist,
      globalReportCount,
    }

    const result = calculateRiskScore(history, orderCtx, settings)
    const finalLabel = customer.manual_label_override || result.label

    // Update customer
    await supabase.from('risk_customers').update({
      risk_score: result.score,
      risk_label: finalLabel,
      total_orders: (customer.total_orders || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', customerId)

    // Inserează comanda
    const { data: riskOrder } = await supabase.from('risk_orders')
      .upsert({
        store_id, user_id: userId, customer_id: customerId,
        external_order_id, order_number,
        customer_phone, customer_email, customer_name,
        shipping_address, payment_method,
        total_value, currency, order_status: 'pending',
        risk_score_at_order: result.score, risk_flags: result.flags,
        ordered_at: ordered_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,external_order_id' })
      .select('id').single()

    // Alerte
    if (
      (finalLabel === 'problematic' && settings.alert_on_problematic !== false) ||
      (finalLabel === 'blocked' && settings.alert_on_blocked !== false) ||
      (finalLabel === 'watch' && settings.alert_on_watch === true)
    ) {
      const topFlags = result.flags.slice(0, 3).map(f => f.label).join(', ')
      await supabase.from('risk_alerts').insert({
        store_id, user_id: userId,
        customer_id: customerId, order_id: riskOrder?.id,
        alert_type: finalLabel === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
        severity: finalLabel === 'blocked' ? 'critical' : finalLabel === 'problematic' ? 'warning' : 'info',
        title: `Client ${finalLabel}: ${customer_name || customer_phone || customer_email}`,
        description: `Scor risc: ${result.score}/100. ${topFlags ? 'Motive: ' + topFlags : ''}`,
      })
    }

    // Blacklist global
    if (settings.participate_in_global_blacklist && result.score >= 61) {
      const upsertGlobal = async (field: 'phone_hash' | 'email_hash', value: string) => {
        const hash = hashIdentifier(value)
        const { data: ex } = await supabase.from('risk_global_blacklist')
          .select('id, report_count').eq(field, hash).single()
        if (ex) {
          await supabase.from('risk_global_blacklist').update({
            report_count: ex.report_count + 1, last_reported_at: new Date().toISOString(),
            global_risk_score: Math.min(ex.report_count * 20, 100),
          }).eq('id', ex.id)
        } else {
          await supabase.from('risk_global_blacklist').insert({ [field]: hash, report_count: 1, global_risk_score: 20 })
        }
      }
      if (customer_phone) await upsertGlobal('phone_hash', customer_phone)
      if (customer_email) await upsertGlobal('email_hash', customer_email)
    }

    return NextResponse.json({
      score: result.score, label: finalLabel, flags: result.flags,
      recommendation: result.recommendation,
      customerId, orderId: riskOrder?.id,
      action: finalLabel === 'blocked' ? 'block' : finalLabel === 'problematic' ? 'hold' : 'proceed',
    })
  } catch (err: any) {
    console.error('Risk analyze error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}