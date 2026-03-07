import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRiskScore, hashIdentifier, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'
import { sendRiskAlert } from '@/lib/risk/notifications'
import { normalizeRomanian, extractCity, findClusterMatches, type ClusterCandidate } from '@/lib/risk/cluster'
import { decrypt } from '@/lib/security/encryption'
import crypto from 'crypto'

// ─── Utilitare ────────────────────────────────────────────────────────────────

function safeDecrypt(val: string | null): string {
  if (!val) return ''
  try { return val.includes(':') ? decrypt(val) : val } catch { return val }
}

function verifyHmac(body: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch { return false }
}

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    pending: 'pending', processing: 'processing', 'on-hold': 'pending',
    completed: 'collected', cancelled: 'cancelled', refunded: 'returned',
    failed: 'cancelled', shipped: 'shipped', delivered: 'collected',
    returned: 'returned', refused: 'refused', 'not-home': 'not_home',
    livrata: 'collected', refuzata: 'refused', returnata: 'returned',
    expediat: 'shipped', 'in-livrare': 'shipped', nepreluat: 'not_home',
  }
  const n = s.toLowerCase()
    .replace(/[ăâ]/g,'a').replace(/î/g,'i')
    .replace(/[șs]/g,'s').replace(/[țt]/g,'t')
  return m[n] || m[s.toLowerCase()] || 'pending'
}

function extractAddress(order: any): string {
  const s = order.shipping || {}
  const b = order.billing  || {}
  return [s.address_1||b.address_1, s.city||b.city, s.state||b.state, s.country||b.country]
    .filter(Boolean).join(', ')
}

function extractPayment(order: any): 'cod'|'card'|'bank_transfer' {
  const m = (order.payment_method||'').toLowerCase()
  if (m.includes('cod')||m.includes('cash')) return 'cod'
  if (m.includes('card')||m.includes('stripe')||m.includes('paypal')) return 'card'
  return 'bank_transfer'
}

// Normalizare telefon: intotdeauna ultimele 9 cifre, fara spatii
// +40757123456 → 757123456, 0757123456 → 757123456, 0040757... → 757123456
function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '')        // doar cifre
  return digits.slice(-9)                    // ultimele 9 — universal
}

// ─── findOrCreateCustomer — sursa de adevar pentru identitate ─────────────────
//
// REGULA UNICA: acelasi telefon (last9) SAU acelasi email = ACELASI CLIENT
// Nu conteaza numele, nu conteaza prefixul (+40 vs 0 vs 0040)
// Primul match castiga — phone are prioritate fata de email
//
async function findOrCreateCustomer(
  supabase: any,
  storeId: string,
  userId: string,
  phone: string | null,
  email: string | null,
  name: string | null,
  firstOrderAt: string,
): Promise<{ customer: any; isNew: boolean }> {

  const phoneNorm = phone ? normalizePhone(phone) : null
  const emailNorm = email ? email.toLowerCase().trim() : null

  // ── Cauta clientul existent ───────────────────────────────────────────────
  // Ia toti clientii magazinului o singura data (eficient pentru magazine mici/medii)
  const { data: allCustomers } = await supabase
    .from('risk_customers')
    .select('*')
    .eq('store_id', storeId)

  const pool = allCustomers || []

  let found: any = null

  // Prioritate 1: match telefon (last9)
  if (phoneNorm) {
    found = pool.find((c: any) =>
      c.phone && normalizePhone(c.phone) === phoneNorm
    ) || null
  }

  // Prioritate 2: match email exact (daca nu s-a gasit prin telefon)
  if (!found && emailNorm) {
    found = pool.find((c: any) =>
      c.email && c.email.toLowerCase().trim() === emailNorm
    ) || null
  }

  if (found) {
    return { customer: found, isNew: false }
  }

  // ── Creeaza client nou ────────────────────────────────────────────────────
  const { data: newC, error } = await supabase
    .from('risk_customers')
    .insert({
      store_id:   storeId,
      user_id:    userId,
      phone:      phone  || null,
      email:      emailNorm || null,
      name:       name   || null,
      risk_score: 0,
      risk_label: 'new',
      total_orders:      0,
      orders_collected:  0,
      orders_refused:    0,
      orders_not_home:   0,
      orders_cancelled:  0,
      last_order_at:   firstOrderAt,
      first_order_at:  firstOrderAt,
      in_local_blacklist:  false,
      in_global_blacklist: false,
      manually_reviewed:   false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !newC) {
    // Race condition: altcineva a creat clientul intre timp — incearca din nou
    console.warn('[Webhook] Insert conflict, retrying lookup:', error?.message)
    const { data: retry } = await supabase
      .from('risk_customers')
      .select('*')
      .eq('store_id', storeId)

    const retryPool = retry || []
    let retryFound: any = null
    if (phoneNorm) retryFound = retryPool.find((c: any) => c.phone && normalizePhone(c.phone) === phoneNorm) || null
    if (!retryFound && emailNorm) retryFound = retryPool.find((c: any) => c.email && c.email.toLowerCase().trim() === emailNorm) || null
    if (retryFound) return { customer: retryFound, isNew: false }

    throw new Error('Nu s-a putut crea/găsi clientul: ' + error?.message)
  }

  return { customer: newC, isNew: true }
}

// ─── Recalculeaza scorul clientului din DB — sursa de adevar ─────────────────
async function recalcCustomer(
  supabase: any,
  customerId: string,
  storeId: string,
  phone: string | null,
  email: string | null,
  pm: 'cod'|'card'|'bank_transfer',
  value: number,
  curr: string,
  ordAt: string,
  addr: string,
  settings: any,
): Promise<{ score: number; label: string; flags: any[]; recommendation: string; refusalProbability: number }> {
  const { data: allOrders } = await supabase
    .from('risk_orders')
    .select('order_status, shipping_address')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)

  const orders = allOrders || []
  let tc=0, tr=0, tn=0, tcan=0
  const addrs = new Set<string>()

  for (const o of orders) {
    if (o.order_status === 'collected') tc++
    else if (['refused','returned'].includes(o.order_status)) tr++
    else if (o.order_status === 'not_home') tn++
    else if (o.order_status === 'cancelled') tcan++
    if (o.shipping_address) addrs.add(o.shipping_address.trim().toLowerCase())
  }

  const { data: cust } = await supabase
    .from('risk_customers').select('*').eq('id', customerId).single()

  const hist: CustomerHistory = {
    totalOrders:     orders.length,
    ordersCollected: tc,
    ordersRefused:   tr,
    ordersNotHome:   tn,
    ordersCancelled: tcan,
    ordersToday:     0,
    lastOrderAt:     cust?.last_order_at  || null,
    firstOrderAt:    cust?.first_order_at || null,
    accountCreatedAt: null,
    phoneValidated:  !!(phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
    isNewAccount:    orders.length <= 1,
    addressChanges:  addrs.size,
  }

  const ctx: OrderContext = {
    paymentMethod: pm, totalValue: value, currency: curr, orderedAt: ordAt,
    customerEmail: email || '', shippingAddress: addr,
    inGlobalBlacklist: cust?.in_global_blacklist || false, globalReportCount: 0,
  }

  const result = calculateRiskScore(hist, ctx, settings)

  // Actualizeaza clientul cu contoarele corecte din DB
  const finalLabel = cust?.manual_label_override || result.label
  await supabase.from('risk_customers').update({
    total_orders:      orders.length,
    orders_collected:  tc,
    orders_refused:    tr,
    orders_not_home:   tn,
    orders_cancelled:  tcan,
    risk_score:  result.score,
    risk_label:  finalLabel,
    updated_at:  new Date().toISOString(),
  }).eq('id', customerId)

  return { ...result, label: finalLabel }
}

// ─── Import istoric WooCommerce (background, non-blocking) ───────────────────
async function importHistory(params: {
  supabase: any, storeId: string, userId: string, customerId: string,
  storeUrl: string, apiKey: string, apiSecret: string,
  phone: string|null, email: string|null
}): Promise<void> {
  const { supabase, storeId, userId, customerId, storeUrl, apiKey, apiSecret, phone, email } = params
  const ck = safeDecrypt(apiKey), cs = safeDecrypt(apiSecret)
  if (!ck || !cs) return

  try {
    const base = storeUrl.replace(/\/$/, '')
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
    const phoneNorm = phone ? normalizePhone(phone) : null

    const fetchPage = async (qp: Record<string,string>) => {
      const url = new URL(`${base}/wp-json/wc/v3/orders`)
      Object.entries(qp).forEach(([k,v]) => url.searchParams.set(k,v))
      const res = await fetch(url.toString(), { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`WC ${res.status}`)
      return { data: await res.json(), pages: parseInt(res.headers.get('x-wp-totalpages')||'1') }
    }

    const seen = new Set<number>()
    const wooOrders: any[] = []

    if (email) {
      for (let p=1; p<=5; p++) {
        const { data, pages } = await fetchPage({ billing_email: email, per_page:'100', page:String(p), orderby:'date', order:'desc' })
        for (const o of (data||[])) {
          const bEmail = (o.billing?.email||'').toLowerCase()
          if (!seen.has(o.id) && bEmail === email.toLowerCase()) {
            seen.add(o.id); wooOrders.push(o)
          }
        }
        if (p >= pages) break
      }
    }

    if (phone) {
      for (let p=1; p<=5; p++) {
        const { data, pages } = await fetchPage({ search: phone.replace(/\s/g,''), per_page:'100', page:String(p), orderby:'date', order:'desc' })
        for (const o of (data||[])) {
          if (!seen.has(o.id)) {
            const bPhone = (o.billing?.phone||'').replace(/\s/g,'')
            if (bPhone && phoneNorm && normalizePhone(bPhone) === phoneNorm) {
              seen.add(o.id); wooOrders.push(o)
            }
          }
        }
        if (p >= pages) break
      }
    }

    if (!wooOrders.length) return

    const { data: existing } = await supabase
      .from('risk_orders').select('external_order_id').eq('store_id', storeId)
    const existSet = new Set<string>((existing||[]).map((o:any) => String(o.external_order_id)))

    const toInsert: any[] = []
    for (const woo of wooOrders) {
      const extId = String(woo.id)
      if (existSet.has(extId)) continue
      const b = woo.billing||{}, s = woo.shipping||{}
      const pm2 = (woo.payment_method||'').toLowerCase()
      toInsert.push({
        store_id: storeId, user_id: userId, customer_id: customerId,
        external_order_id: extId, order_number: woo.number ? String(woo.number) : null,
        customer_phone: b.phone||phone, customer_email: b.email||email,
        customer_name: [b.first_name,b.last_name].filter(Boolean).join(' ')||null,
        shipping_address: [s.address_1||b.address_1, s.city||b.city, s.country||b.country].filter(Boolean).join(', '),
        payment_method: pm2.includes('cod')||pm2.includes('cash') ? 'cod' : pm2.includes('card') ? 'card' : 'bank_transfer',
        total_value: parseFloat(woo.total||'0'), currency: woo.currency||'RON',
        order_status: mapStatus(woo.status||'pending'),
        risk_score_at_order: 0, risk_flags: [],
        ordered_at: woo.date_created||new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    for (let i=0; i<toInsert.length; i+=50) {
      await supabase.from('risk_orders').insert(toInsert.slice(i, i+50))
    }

    // Recalculeaza contoarele din DB dupa import
    const { data: mine } = await supabase.from('risk_orders')
      .select('order_status').eq('customer_id', customerId).eq('store_id', storeId)
    let tc=0,tr=0,tn=0,tcan=0
    for (const o of (mine||[])) {
      if (o.order_status==='collected') tc++
      else if (['refused','returned'].includes(o.order_status)) tr++
      else if (o.order_status==='not_home') tn++
      else if (o.order_status==='cancelled') tcan++
    }
    await supabase.from('risk_customers').update({
      total_orders: (mine||[]).length,
      orders_collected: tc, orders_refused: tr,
      orders_not_home: tn, orders_cancelled: tcan,
      updated_at: new Date().toISOString(),
    }).eq('id', customerId)

    console.log(`[Webhook] Imported ${toInsert.length} historical orders for customer ${customerId}`)
  } catch (e: any) {
    console.error('[Webhook] History import error:', e.message)
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let rawBody = ''
  try { rawBody = await req.text() } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
  }

  const topic     = req.headers.get('x-wc-webhook-topic') || ''
  const signature = req.headers.get('x-wc-webhook-signature') || ''
  const sourceUrl = req.headers.get('x-wc-webhook-source') || ''

  console.log('[Webhook] topic:', topic, 'bytes:', rawBody.length)

  if (!['order.created','order.updated'].includes(topic)) {
    return NextResponse.json({ ok: true, skipped: topic })
  }

  let order: any
  try { order = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Gaseste store-ul ──────────────────────────────────────────────────────
  const { data: stores } = await supabase
    .from('stores').select('id, user_id, store_url, webhook_secret, api_key, api_secret')
    .not('webhook_secret', 'is', null)

  if (!stores?.length) return NextResponse.json({ error: 'No stores' }, { status: 404 })

  let store: any = null
  for (const s of stores) {
    if (verifyHmac(rawBody, signature, s.webhook_secret)) { store = s; break }
  }
  if (!store && sourceUrl) {
    store = stores.find((s: any) =>
      s.store_url && sourceUrl.replace(/\/$/,'').includes(
        s.store_url.replace(/^https?:\/\//,'').replace(/\/$/,'')
      )
    )
  }
  if (!store && stores.length === 1) store = stores[0]
  if (!store) return NextResponse.json({ error: 'Store not matched' }, { status: 401 })

  const storeId = store.id
  const userId  = store.user_id

  // ── Setari Risk Shield ────────────────────────────────────────────────────
  const { data: rs } = await supabase
    .from('risk_store_settings').select('*').eq('store_id', storeId).single()
  const settings = {
    participate_in_global_blacklist: rs?.participate_in_global_blacklist ?? true,
    alert_on_blocked:     rs?.alert_on_blocked     ?? true,
    alert_on_problematic: rs?.alert_on_problematic ?? true,
    alert_on_watch:       rs?.alert_on_watch       ?? false,
    score_watch_threshold:       rs?.score_watch_threshold       ?? 41,
    score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
    score_blocked_threshold:     rs?.score_blocked_threshold     ?? 81,
    alert_email:          rs?.alert_email,
    email_alerts_enabled: rs?.email_alerts_enabled ?? true,
    ...(rs?.custom_rules||{}),
    ml_weights: rs?.ml_weights,
  }

  // ── Date din comanda WooCommerce ──────────────────────────────────────────
  const phone   = (order.billing?.phone || '').replace(/\s/g,'') || null
  const email   = (order.billing?.email || '').toLowerCase().trim() || null
  const name    = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || null
  const addr    = extractAddress(order)
  const pm      = extractPayment(order)
  const value   = parseFloat(order.total||'0')
  const curr    = order.currency || 'RON'
  const ordAt   = order.date_created || new Date().toISOString()
  const extId   = String(order.id)
  const orderNr = order.number ? String(order.number) : null
  const status  = mapStatus(order.status||'pending')

  if (!phone && !email) {
    return NextResponse.json({ ok: true, skipped: 'no_contact' })
  }

  // ── Verifica daca comanda exista deja ─────────────────────────────────────
  const { data: existingOrder } = await supabase
    .from('risk_orders').select('id, order_status, customer_id')
    .eq('store_id', storeId).eq('external_order_id', extId).single()

  // ─── ORDER.UPDATED ────────────────────────────────────────────────────────
  if (topic === 'order.updated' && existingOrder) {
    if (existingOrder.order_status === status) {
      return NextResponse.json({ ok: true, action: 'no_change' })
    }

    await supabase.from('risk_orders')
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq('id', existingOrder.id)

    if (existingOrder.customer_id) {
      const result = await recalcCustomer(
        supabase, existingOrder.customer_id, storeId,
        phone, email, pm, value, curr, ordAt, addr, settings
      )

      // Alerta livrare esuata
      const failStatuses = ['refused','returned','not_home']
      if (failStatuses.includes(status) && !failStatuses.includes(existingOrder.order_status)) {
        await supabase.from('risk_alerts').insert({
          store_id: storeId, user_id: userId,
          customer_id: existingOrder.customer_id, order_id: existingOrder.id,
          alert_type: 'delivery_failed',
          severity: status === 'refused' ? 'warning' : 'info',
          title: `Livrare eșuată — ${name||phone||email}`,
          description: `Comanda #${orderNr||extId} → ${status}. Scor: ${result.score}/100`,
        })
      }
    }

    return NextResponse.json({ ok: true, action: 'updated', status })
  }

  // ─── DUPLICAT ─────────────────────────────────────────────────────────────
  if (existingOrder) {
    console.log('[Webhook] Duplicate order.created for', extId, '— skipping')
    return NextResponse.json({ ok: true, action: 'duplicate_skipped' })
  }

  // ─── ORDER.CREATED — comanda noua ─────────────────────────────────────────

  // Gaseste sau creeaza clientul — REGULA UNICA: phone last9 OR email
  const { customer, isNew } = await findOrCreateCustomer(
    supabase, storeId, userId, phone, email, name, ordAt
  )
  const customerId = customer.id

  // Actualizează name + phone + email pe client dacă lipsesc
  const custUpdates: any = { last_order_at: ordAt, updated_at: new Date().toISOString() }
  if (!customer.name && name)   custUpdates.name  = name
  if (!customer.phone && phone) custUpdates.phone = phone
  if (!customer.email && email) custUpdates.email = emailNorm(email)
  await supabase.from('risk_customers').update(custUpdates).eq('id', customerId)

  // Blacklist global
  let inGlobalBlacklist = false, globalReportCount = 0
  if (settings.participate_in_global_blacklist) {
    for (const val of [phone, email].filter(Boolean)) {
      const hash = hashIdentifier(val!)
      const { data: gb } = await supabase.from('risk_global_blacklist')
        .select('report_count').or(`phone_hash.eq.${hash},email_hash.eq.${hash}`).single()
      if (gb) { inGlobalBlacklist = true; globalReportCount = Math.max(globalReportCount, gb.report_count) }
    }
    if (inGlobalBlacklist) {
      await supabase.from('risk_customers')
        .update({ in_global_blacklist: true }).eq('id', customerId)
    }
  }

  // Insereaza comanda
  const { data: riskOrder } = await supabase.from('risk_orders').insert({
    store_id: storeId, user_id: userId, customer_id: customerId,
    external_order_id: extId, order_number: orderNr,
    customer_phone: phone, customer_email: email, customer_name: name,
    shipping_address: addr, payment_method: pm,
    total_value: value, currency: curr, order_status: status,
    risk_score_at_order: 0, risk_flags: [],
    ordered_at: ordAt, updated_at: new Date().toISOString(),
  }).select('id').single()

  // Recalculeaza scorul din DB (acum include si comanda tocmai inserata)
  const result = await recalcCustomer(
    supabase, customerId, storeId,
    phone, email, pm, value, curr, ordAt, addr, settings
  )

  // Update risk_score_at_order pe comanda inserata
  if (riskOrder?.id) {
    await supabase.from('risk_orders').update({
      risk_score_at_order: result.score,
      risk_flags: result.flags,
    }).eq('id', riskOrder.id)
  }

  // Alerte
  const shouldAlert =
    (result.label === 'blocked'     && settings.alert_on_blocked     !== false) ||
    (result.label === 'problematic' && settings.alert_on_problematic !== false) ||
    (result.label === 'watch'       && settings.alert_on_watch       === true)

  if (shouldAlert) {
    const topFlags = result.flags.slice(0,3).map((f:any) => f.label).join(', ')
    await supabase.from('risk_alerts').insert({
      store_id: storeId, user_id: userId,
      customer_id: customerId, order_id: riskOrder?.id,
      alert_type: result.label === 'blocked' ? 'blocked_customer' : 'new_problematic_order',
      severity:   result.label === 'blocked' ? 'critical' : result.label === 'problematic' ? 'warning' : 'info',
      title: `Comandă nouă — client ${result.label}: ${name||phone||email}`,
      description: `Scor: ${result.score}/100. ${topFlags ? 'Motive: '+topFlags : ''}`,
    })

    if (settings.alert_email && settings.email_alerts_enabled !== false) {
      sendRiskAlert({
        to: settings.alert_email,
        storeName: store.store_url.replace(/^https?:\/\//,'').replace(/\/$/,''),
        storeUrl: store.store_url, customerName: name, customerPhone: phone,
        customerEmail: email, riskScore: result.score, riskLabel: result.label,
        orderNumber: orderNr||extId, orderValue: value, currency: curr,
        flags: result.flags.slice(0,5), recommendation: result.recommendation,
        refusalProbability: result.refusalProbability,
        dashboardUrl: `${process.env.NEXTAUTH_URL||'https://app.hontrio.com'}/risk`,
      }).catch(e => console.error('[Webhook] Email failed:', e?.message))
    }
  }

  // Blacklist global — update daca scor >= 61
  if (settings.participate_in_global_blacklist && result.score >= 61) {
    const upsertBl = async (field: 'phone_hash'|'email_hash', val: string) => {
      const hash = hashIdentifier(val)
      const { data: ex } = await supabase.from('risk_global_blacklist')
        .select('id, report_count').eq(field, hash).single()
      if (ex) {
        await supabase.from('risk_global_blacklist').update({
          report_count: ex.report_count + 1,
          last_reported_at: new Date().toISOString(),
          global_risk_score: Math.min(ex.report_count * 20, 100),
        }).eq('id', ex.id)
      } else {
        await supabase.from('risk_global_blacklist').insert({
          [field]: hash, report_count: 1, global_risk_score: 20,
        })
      }
    }
    if (phone) await upsertBl('phone_hash', phone)
    if (email) await upsertBl('email_hash', email)
  }

  // Import istoric — DOAR pentru client nou, non-blocking
  if (isNew && store.api_key) {
    importHistory({
      supabase, storeId, userId, customerId,
      storeUrl: store.store_url, apiKey: store.api_key, apiSecret: store.api_secret,
      phone, email,
    }).catch(() => {})
  }

  // Cluster detection — non-blocking
  if (customerId && (phone||email)) {
    void (async () => {
      try {
        const { data: pool } = await supabase.from('risk_customers')
          .select('id,name,phone,email').eq('store_id', storeId).neq('id', customerId).limit(200)
        if (!pool?.length) return
        const candidates: ClusterCandidate[] = pool.map((c:any) => ({
          id: c.id, name: c.name, phone: c.phone, email: c.email, shipping_address: null, city: null,
        }))
        const matches = findClusterMatches(
          { id: customerId, name, phone, email, shipping_address: addr, city: extractCity(addr) },
          candidates, 0.75
        )
        if (matches.length) {
          await supabase.from('risk_audit_log').insert(
            matches.slice(0,3).map(m => ({
              store_id: storeId, user_id: userId, customer_id: customerId,
              action: 'cluster_match',
              old_value: JSON.stringify({ similarity: m.similarity, reasons: m.matchReason }),
              new_value: m.matchedCustomerId,
            }))
          )
        }
      } catch {}
    })()
  }

  console.log(`[Webhook] Done: customer=${customerId} isNew=${isNew} score=${result.score} label=${result.label}`)

  return NextResponse.json({
    ok: true, action: 'created',
    score: result.score, label: result.label,
    refusal_probability: result.refusalProbability,
    customer_id: customerId, is_new_customer: isNew,
  })
}

function emailNorm(e: string): string {
  return e.toLowerCase().trim()
}