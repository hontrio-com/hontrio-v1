import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { decrypt } from '@/lib/security/encryption'

function safeDecrypt(val: string | null): string {
  if (!val) return ''
  try { return val.includes(':') ? decrypt(val) : val } catch { return val }
}

function mapWooStatus(s: string): string {
  const m: Record<string, string> = {
    'pending': 'pending', 'processing': 'processing', 'on-hold': 'pending',
    'completed': 'collected', 'cancelled': 'cancelled', 'refunded': 'returned',
    'failed': 'cancelled', 'shipped': 'shipped', 'delivered': 'collected',
    'returned': 'returned', 'refused': 'refused', 'not-home': 'not_home',
    'livrata': 'collected', 'refuzata': 'refused', 'returnata': 'returned',
    'expediat': 'shipped', 'in-livrare': 'shipped', 'nepreluat': 'not_home',
  }
  const norm = s.toLowerCase()
    .replace(/[ăâ]/g, 'a').replace(/î/g, 'i')
    .replace(/[șs]/g, 's').replace(/[țt]/g, 't')
  return m[norm] || m[s.toLowerCase()] || 'pending'
}

// ─── Verifică strict că o comandă WooCommerce aparține acestui client ─────────
// Nu ne bazăm pe search fuzzy — verificăm telefon AND/OR email exact
function orderBelongsToCustomer(
  wooOrder: any,
  customerPhone: string | null,
  customerEmail: string | null
): boolean {
  const billingPhone = (wooOrder.billing?.phone || '').replace(/\s+/g, '')
  const billingEmail = (wooOrder.billing?.email || '').toLowerCase().trim()
  const cleanCustomerPhone = (customerPhone || '').replace(/\s+/g, '')
  const cleanCustomerEmail = (customerEmail || '').toLowerCase().trim()

  // Match exact pe telefon SAU email
  const phoneMatch = cleanCustomerPhone && billingPhone &&
    (billingPhone === cleanCustomerPhone ||
     billingPhone.slice(-9) === cleanCustomerPhone.slice(-9)) // ultimele 9 cifre (fara prefix tara)

  const emailMatch = cleanCustomerEmail && billingEmail &&
    billingEmail === cleanCustomerEmail

  return !!(phoneMatch || emailMatch)
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { customer_id } = await req.json()
    if (!customer_id) return NextResponse.json({ error: 'customer_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()

    // Verifică că clientul aparține userului
    const { data: customer } = await supabase
      .from('risk_customers')
      .select('*')
      .eq('id', customer_id)
      .eq('user_id', session.user.id)
      .single()

    if (!customer) return NextResponse.json({ error: 'Client negăsit' }, { status: 404 })

    // Ia store-ul cu credențiale
    const { data: store } = await supabase
      .from('stores')
      .select('id, store_url, api_key, api_secret, user_id')
      .eq('id', customer.store_id)
      .single()

    if (!store) return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })

    const ck = safeDecrypt(store.api_key)
    const cs = safeDecrypt(store.api_secret)
    if (!ck || !cs) return NextResponse.json({ error: 'Credențiale API lipsă. Reconectează magazinul.' }, { status: 400 })

    // Ia TOATE comenzile existente din DB pentru acest store (nu doar pentru customer_id)
    // — ca să detectăm comenzi deja atribuite altui client
    const { data: allExistingOrders } = await supabase
      .from('risk_orders')
      .select('external_order_id, customer_id')
      .eq('store_id', store.id)

    // Map: external_order_id -> customer_id (cui îi aparține deja în DB)
    const existingOrderMap = new Map<string, string>(
      (allExistingOrders || []).map((o: any) => [o.external_order_id, o.customer_id])
    )

    const baseUrl = store.store_url.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')

    const fetchOrders = async (params: Record<string, string>) => {
      const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`)
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': auth },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${await res.text()}`)
      const data = await res.json()
      const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')
      return { data, totalPages }
    }

    const allWooOrders: any[] = []
    const seen = new Set<number>()

    // ── Căutare după email (parametru direct WooCommerce — precis) ────────────
    if (customer.email) {
      let page = 1
      while (page <= 10) { // max 1000 comenzi
        const { data, totalPages } = await fetchOrders({
          billing_email: customer.email,
          per_page: '100', page: String(page),
          orderby: 'date', order: 'desc',
        })
        for (const o of data) {
          // Verifică strict că emailul din comandă = emailul clientului
          if (orderBelongsToCustomer(o, null, customer.email)) {
            if (!seen.has(o.id)) { seen.add(o.id); allWooOrders.push(o) }
          }
        }
        if (page >= totalPages) break
        page++
      }
    }

    // ── Căutare după telefon (search fuzzy → filtru strict după) ──────────────
    if (customer.phone) {
      const cleanPhone = customer.phone.replace(/\s+/g, '')
      let page = 1
      while (page <= 10) {
        const { data, totalPages } = await fetchOrders({
          search: cleanPhone,
          per_page: '100', page: String(page),
          orderby: 'date', order: 'desc',
        })
        for (const o of data) {
          // Verifică STRICT că telefonul din comandă = telefonul clientului
          if (orderBelongsToCustomer(o, customer.phone, null)) {
            if (!seen.has(o.id)) { seen.add(o.id); allWooOrders.push(o) }
          }
        }
        if (page >= totalPages) break
        page++
      }
    }

    // ── Procesează comenzile găsite ───────────────────────────────────────────
    const ordersToInsert: any[] = []
    let skippedOtherCustomer = 0

    for (const wooOrder of allWooOrders) {
      const extId = String(wooOrder.id)
      const status = mapWooStatus(wooOrder.status || 'pending')

      // Verificare finală strictă — comanda trebuie să aparțină ACESTUI client
      if (!orderBelongsToCustomer(wooOrder, customer.phone, customer.email)) {
        skippedOtherCustomer++
        continue
      }

      const existingCustomerId = existingOrderMap.get(extId)

      if (existingCustomerId) {
        if (existingCustomerId === customer_id) {
          // Comanda noastră — actualizează statusul
          await supabase.from('risk_orders')
            .update({ order_status: status, updated_at: new Date().toISOString() })
            .eq('store_id', store.id)
            .eq('external_order_id', extId)
        }
        // Dacă aparține altui client — NU atingem, e comanda lui
        continue
      }

      // Comandă nouă — construiește payload
      const s = wooOrder.shipping || {}
      const b = wooOrder.billing || {}
      const addr = [s.address_1 || b.address_1, s.city || b.city, s.country || b.country]
        .filter(Boolean).join(', ')
      const pm = (wooOrder.payment_method || '').toLowerCase()
      const paymentMethod = pm.includes('cod') || pm.includes('cash') ? 'cod'
        : pm.includes('card') || pm.includes('stripe') ? 'card'
        : 'bank_transfer'

      ordersToInsert.push({
        store_id: store.id,
        user_id: store.user_id,
        customer_id,
        external_order_id: extId,
        order_number: wooOrder.number ? String(wooOrder.number) : null,
        customer_phone: b.phone || customer.phone,
        customer_email: b.email || customer.email,
        customer_name: [b.first_name, b.last_name].filter(Boolean).join(' ') || customer.name,
        shipping_address: addr,
        payment_method: paymentMethod,
        total_value: parseFloat(wooOrder.total || '0'),
        currency: wooOrder.currency || 'RON',
        order_status: status,
        risk_score_at_order: 0,
        risk_flags: [],
        ordered_at: wooOrder.date_created || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    // Insert comenzi noi în batch-uri
    if (ordersToInsert.length > 0) {
      for (let i = 0; i < ordersToInsert.length; i += 50) {
        await supabase.from('risk_orders')
          .insert(ordersToInsert.slice(i, i + 50))
          // Nu upsert — insert, ca să nu suprascrie comenzile altor clienți
          .select('id')
      }
    }

    // ── Recalculează statistici din DOAR comenzile ACESTUI client ────────────
    const { data: myOrders } = await supabase
      .from('risk_orders')
      .select('order_status, ordered_at')
      .eq('customer_id', customer_id)
      .eq('store_id', store.id)

    let totalCollected = 0, totalRefused = 0, totalNotHome = 0, totalCancelled = 0
    for (const o of (myOrders || [])) {
      if (o.order_status === 'collected') totalCollected++
      else if (['refused', 'returned'].includes(o.order_status)) totalRefused++
      else if (o.order_status === 'not_home') totalNotHome++
      else if (o.order_status === 'cancelled') totalCancelled++
    }
    const totalOrders = (myOrders || []).length

    // Recalculează scorul cu engine-ul
    const history: CustomerHistory = {
      totalOrders, ordersCollected: totalCollected, ordersRefused: totalRefused,
      ordersNotHome: totalNotHome, ordersCancelled: totalCancelled, ordersToday: 0,
      lastOrderAt: customer.last_order_at, firstOrderAt: customer.first_order_at,
      accountCreatedAt: null,
      phoneValidated: !!(customer.phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
      isNewAccount: false, addressChanges: 1,
    }
    const orderCtx: OrderContext = {
      paymentMethod: 'cod', totalValue: 0, currency: 'RON',
      orderedAt: customer.last_order_at || new Date().toISOString(),
      customerEmail: customer.email || '', shippingAddress: '',
      inGlobalBlacklist: customer.in_global_blacklist || false, globalReportCount: 0,
    }
    const result = calculateRiskScore(history, orderCtx, {})
    const finalLabel = customer.manual_label_override || result.label

    await supabase.from('risk_customers').update({
      orders_collected: totalCollected,
      orders_refused: totalRefused,
      orders_not_home: totalNotHome,
      orders_cancelled: totalCancelled,
      total_orders: totalOrders,
      risk_score: result.score,
      risk_label: finalLabel,
      updated_at: new Date().toISOString(),
    }).eq('id', customer_id)

    return NextResponse.json({
      ok: true,
      imported: ordersToInsert.length,
      updated: allWooOrders.length - ordersToInsert.length,
      skipped_other_customer: skippedOtherCustomer,
      total_found_in_woo: allWooOrders.length,
      total_in_db: totalOrders,
      new_score: result.score,
      new_label: finalLabel,
    })
  } catch (err: any) {
    console.error('[ImportHistory]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}