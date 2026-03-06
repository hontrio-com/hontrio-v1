import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { normalizeRomanian, stringSimilarity } from '@/lib/risk/cluster'
import { openai } from '@/lib/openai/client'

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
          content: `Ești un sistem de analiză risc pentru magazine online din România. Analizezi comportamentul clienților și dai recomandări clare. Răspunde concis în română, în 3-4 paragrafe scurte. Nu folosi liste sau bullets. Fii direct și specific.`,
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

      // Deduce 2 credite — același pattern folosit în toate rutele
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

    // Verifică că store-ul aparține userului
    const { data: store } = await supabase
      .from('stores')
      .select('id, user_id')
      .eq('id', store_id)
      .eq('user_id', session.user.id)
      .single()
    if (!store) return NextResponse.json({ error: 'Store negăsit' }, { status: 404 })

    // Aduce setările magazinului
    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single()

    const rules = settings?.custom_rules || {}
    const storeSettings = {
      ...rules,
      score_watch_threshold: settings?.score_watch_threshold || 41,
      score_problematic_threshold: settings?.score_problematic_threshold || 61,
      score_blocked_threshold: settings?.score_blocked_threshold || 81,
    }

    // ─── Caută profilul clientului — logică strictă de identitate ──────────────
    // Un client = combinație unică phone + email + name (normalizat)
    // Același telefon dar alt nume = client diferit (flag multiple_identities)
    let customer: any = null
    const normalizedIncomingName = customer_name ? normalizeRomanian(customer_name) : null

    if (customer_phone) {
      // Ia TOȚI clienții cu același telefon din acest magazin
      const { data: phoneMatches } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('store_id', store_id)
        .eq('phone', customer_phone)

      if (phoneMatches && phoneMatches.length > 0) {
        if (!normalizedIncomingName) {
          // Fără nume — folosim primul match cu același telefon
          customer = phoneMatches[0]
        } else {
          // Cu nume — căutăm match exact sau foarte similar (>85%)
          const exactMatch = phoneMatches.find((c: any) => {
            if (!c.name) return true // client fără nume stocat = same identity
            return stringSimilarity(normalizedIncomingName, normalizeRomanian(c.name)) >= 0.85
          })
          customer = exactMatch || null
          // Dacă nu am match de nume = client NOU cu același telefon (identitate diferită)
        }
      }
    }

    // Fallback pe email dacă nu am găsit după telefon
    if (!customer && customer_email) {
      const { data: emailMatches } = await supabase
        .from('risk_customers')
        .select('*')
        .eq('store_id', store_id)
        .eq('email', customer_email)

      if (emailMatches && emailMatches.length > 0) {
        if (!normalizedIncomingName) {
          customer = emailMatches[0]
        } else {
          const exactMatch = emailMatches.find((c: any) => {
            if (!c.name) return true
            return stringSimilarity(normalizedIncomingName, normalizeRomanian(c.name)) >= 0.85
          })
          customer = exactMatch || null
        }
      }
    }

    // Detectează câți clienți diferiți folosesc același telefon (pentru flag multiple_identities)
    let samePhoneCount = 0
    if (customer_phone) {
      const { count } = await supabase
        .from('risk_customers')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store_id)
        .eq('phone', customer_phone)
      samePhoneCount = count || 0
    }

    // Comenzi azi pentru același client
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    let ordersToday = 0
    if (customer_phone || customer_email) {
      const { count } = await supabase
        .from('risk_orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store_id)
        .gte('ordered_at', todayStart.toISOString())
        .or(
          [
            customer_phone ? `customer_phone.eq.${customer_phone}` : null,
            customer_email ? `customer_email.eq.${customer_email}` : null,
          ].filter(Boolean).join(',')
        )
      ordersToday = count || 0
    }

    // Adrese unice folosite
    let addressChanges = 0
    if (customer) {
      const { data: addresses } = await supabase
        .from('risk_orders')
        .select('shipping_address')
        .eq('customer_id', customer.id)
        .not('shipping_address', 'is', null)
      const uniqueAddresses = new Set((addresses || []).map(a => a.shipping_address?.trim().toLowerCase()))
      addressChanges = uniqueAddresses.size
    }

    // Verifică blacklist global
    let inGlobalBlacklist = false
    let globalReportCount = 0
    if (settings?.participate_in_global_blacklist) {
      const hashesToCheck = [
        customer_phone ? hashIdentifier(customer_phone) : null,
        customer_email ? hashIdentifier(customer_email) : null,
      ].filter(Boolean)

      for (const hash of hashesToCheck) {
        const { data: globalEntry } = await supabase
          .from('risk_global_blacklist')
          .select('report_count, global_risk_score')
          .or(`phone_hash.eq.${hash},email_hash.eq.${hash}`)
          .single()
        if (globalEntry) {
          inGlobalBlacklist = true
          globalReportCount = Math.max(globalReportCount, globalEntry.report_count)
        }
      }
    }

    // Construiește istoricul
    const history: CustomerHistory = {
      totalOrders: customer?.total_orders || 0,
      ordersCollected: customer?.orders_collected || 0,
      ordersRefused: customer?.orders_refused || 0,
      ordersNotHome: customer?.orders_not_home || 0,
      ordersCancelled: customer?.orders_cancelled || 0,
      ordersToday,
      lastOrderAt: customer?.last_order_at || null,
      firstOrderAt: customer?.first_order_at || null,
      accountCreatedAt: null,
      phoneValidated: !!(customer_phone && customer_phone.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: !customer,
      addressChanges,
      // Câți clienți diferiți folosesc același telefon — activează flagul multiple_identities
      uniquePhoneCount: samePhoneCount > 1 ? samePhoneCount : undefined,
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

    // Calculează scorul
    const result = calculateRiskScore(history, orderCtx, storeSettings)

    // Folosește override manual dacă există
    const finalLabel = customer?.manual_label_override || result.label

    // Upsert client
    // IMPORTANT: name nu suprascrie niciodată numele existent al unui client deja înregistrat
    // — același client poate comanda cu variatii minore de nume (Ion vs Ioan)
    // — dar un client existent nu își schimbă identitatea
    const customerData = {
      store_id,
      user_id: session.user.id,
      phone: customer_phone || customer?.phone,
      email: customer_email || customer?.email,
      // Păstrează numele original al clientului existent; pentru client nou, folosim numele din comandă
      name: customer ? (customer.name || customer_name) : customer_name,
      risk_score: result.score,
      risk_label: finalLabel,
      total_orders: (customer?.total_orders || 0) + 1,
      orders_collected: customer?.orders_collected || 0,
      orders_refused: customer?.orders_refused || 0,
      orders_not_home: customer?.orders_not_home || 0,
      orders_cancelled: customer?.orders_cancelled || 0,
      last_order_at: ordered_at || new Date().toISOString(),
      first_order_at: customer?.first_order_at || ordered_at || new Date().toISOString(),
      in_global_blacklist: inGlobalBlacklist,
      updated_at: new Date().toISOString(),
    }

    let customerId = customer?.id
    if (customer) {
      await supabase.from('risk_customers').update(customerData).eq('id', customer.id)
    } else {
      const { data: newCustomer } = await supabase
        .from('risk_customers')
        .insert({ ...customerData, first_order_at: ordered_at || new Date().toISOString() })
        .select('id')
        .single()
      customerId = newCustomer?.id
    }

    // Inserează comanda
    const { data: riskOrder } = await supabase
      .from('risk_orders')
      .upsert({
        store_id,
        user_id: session.user.id,
        customer_id: customerId,
        external_order_id,
        order_number,
        customer_phone,
        customer_email,
        customer_name,
        shipping_address,
        payment_method,
        total_value,
        currency,
        order_status: 'pending',
        risk_score_at_order: result.score,
        risk_flags: result.flags,
        ordered_at: ordered_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id,external_order_id' })
      .select('id')
      .single()

    // Generează alertă dacă e necesar
    if (
      (finalLabel === 'problematic' && settings?.alert_on_problematic !== false) ||
      (finalLabel === 'blocked' && settings?.alert_on_blocked !== false) ||
      (finalLabel === 'watch' && settings?.alert_on_watch === true)
    ) {
      const severity = finalLabel === 'blocked' ? 'critical' : finalLabel === 'problematic' ? 'warning' : 'info'
      const topFlags = result.flags.slice(0, 3).map(f => f.label).join(', ')

      await supabase.from('risk_alerts').insert({
        store_id,
        user_id: session.user.id,
        customer_id: customerId,
        order_id: riskOrder?.id,
        alert_type: finalLabel === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
        severity,
        title: `Client ${finalLabel === 'blocked' ? 'blocat' : 'problematic'}: ${customer_name || customer_phone || customer_email}`,
        description: `Scor risc: ${result.score}/100. Motive: ${topFlags || 'Vezi detalii'}`,
      })
    }

    // Raportează în blacklist global (opțional)
    if (settings?.participate_in_global_blacklist && result.score >= 61) {
      const upsertGlobal = async (field: 'phone_hash' | 'email_hash', value: string) => {
        const hash = hashIdentifier(value)
        const { data: existing } = await supabase
          .from('risk_global_blacklist')
          .select('id, report_count')
          .eq(field, hash)
          .single()

        if (existing) {
          await supabase
            .from('risk_global_blacklist')
            .update({
              report_count: existing.report_count + 1,
              last_reported_at: new Date().toISOString(),
              global_risk_score: Math.min(existing.report_count * 20, 100),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('risk_global_blacklist').insert({
            [field]: hash,
            report_count: 1,
            global_risk_score: 20,
          })
        }
      }

      if (customer_phone) await upsertGlobal('phone_hash', customer_phone)
      if (customer_email) await upsertGlobal('email_hash', customer_email)
    }

    return NextResponse.json({
      score: result.score,
      label: finalLabel,
      flags: result.flags,
      recommendation: result.recommendation,
      customerId,
      orderId: riskOrder?.id,
      action: finalLabel === 'blocked'
        ? 'block'
        : finalLabel === 'problematic'
        ? 'hold'
        : 'proceed',
    })
  } catch (err: any) {
    console.error('Risk analyze error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}