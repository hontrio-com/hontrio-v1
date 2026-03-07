/**
 * lib/risk/identity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Sursa unică de adevăr pentru identitatea clienților în Risk Shield.
 *
 * REGULA DE IDENTITATE:
 *   Același telefon (ultimele 9 cifre) SAU același email = ACELAȘI CLIENT
 *   Nu contează numele, nu contează prefixul (+40 vs 0 vs 0040)
 *   Phone match are prioritate față de email match
 *
 * Toate modulele Risk Shield TREBUIE să folosească acest fișier:
 *   - webhook/route.ts
 *   - import-history/route.ts
 *   - repair/route.ts
 *   - analyze/route.ts
 *   - sync-all/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { calculateRiskScore, type CustomerHistory, type OrderContext } from '@/lib/risk/engine'

// ─── Normalizare telefon ────────────────────────────────────────────────────

/**
 * Normalizează un număr de telefon la ultimele 9 cifre.
 * Exemple:
 *   +40757123456  → 757123456
 *   0757123456    → 757123456
 *   0040757123456 → 757123456
 *   40757123456   → 757123456
 *   757 123 456   → 757123456
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')  // doar cifre
  return digits.slice(-9)                   // ultimele 9 — universal
}

/**
 * Normalizează un email: lowercase + trim
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

// ─── Status mapping WooCommerce → Risk Shield ─────────────────────────────

const STATUS_MAP: Record<string, string> = {
  pending: 'pending', processing: 'processing', 'on-hold': 'pending',
  completed: 'collected', cancelled: 'cancelled', refunded: 'returned',
  failed: 'cancelled', shipped: 'shipped', delivered: 'collected',
  returned: 'returned', refused: 'refused', 'not-home': 'not_home',
  livrata: 'collected', refuzata: 'refused', returnata: 'returned',
  expediat: 'shipped', 'in-livrare': 'shipped', nepreluat: 'not_home',
}

export function mapWooStatus(status: string): string {
  const normalized = status.toLowerCase()
    .replace(/[ăâ]/g, 'a').replace(/î/g, 'i')
    .replace(/[șş]/g, 's').replace(/[țţ]/g, 't')
  return STATUS_MAP[normalized] || STATUS_MAP[status.toLowerCase()] || 'pending'
}

// ─── Extract helpers ──────────────────────────────────────────────────────

export function extractAddress(order: any): string {
  const s = order.shipping || {}
  const b = order.billing || {}
  return [s.address_1 || b.address_1, s.city || b.city, s.state || b.state, s.country || b.country]
    .filter(Boolean).join(', ')
}

export function extractPayment(order: any): 'cod' | 'card' | 'bank_transfer' {
  const m = (order.payment_method || '').toLowerCase()
  if (m.includes('cod') || m.includes('cash')) return 'cod'
  if (m.includes('card') || m.includes('stripe') || m.includes('paypal')) return 'card'
  return 'bank_transfer'
}

export function extractCustomerName(order: any): string | null {
  const b = order.billing || {}
  return [b.first_name, b.last_name].filter(Boolean).join(' ') || null
}

// ─── Find or Create Customer ──────────────────────────────────────────────
//
// Caută clientul prin query-uri directe pe phone/email (fără a încărca toți
// clienții în memorie). Dacă nu există, creează unul nou.
//

export async function findOrCreateCustomer(
  supabase: any,
  storeId: string,
  userId: string,
  phone: string | null,
  email: string | null,
  name: string | null,
  firstOrderAt: string,
): Promise<{ customer: any; isNew: boolean }> {

  const phoneNorm = phone ? normalizePhone(phone) : null
  const emailNorm = email ? normalizeEmail(email) : null

  // ── Caută clientul existent ─────────────────────────────────────────────
  let found: any = null

  // Prioritate 1: match telefon (ultimele 9 cifre)
  // Supabase nu poate filtra pe ultimele 9 cifre direct, așa că luăm
  // toți clienții cu telefon non-null din store și filtrăm client-side.
  // Optimizare: folosim LIKE pe sufixul de 9 cifre
  if (phoneNorm && phoneNorm.length === 9) {
    const { data: phoneMatches } = await supabase
      .from('risk_customers')
      .select('*')
      .eq('store_id', storeId)
      .not('phone', 'is', null)

    if (phoneMatches) {
      found = phoneMatches.find((c: any) =>
        c.phone && normalizePhone(c.phone) === phoneNorm
      ) || null
    }
  }

  // Prioritate 2: match email exact (dacă nu s-a găsit prin telefon)
  if (!found && emailNorm) {
    const { data: emailMatches } = await supabase
      .from('risk_customers')
      .select('*')
      .eq('store_id', storeId)
      .ilike('email', emailNorm)
      .limit(1)

    if (emailMatches?.length) {
      found = emailMatches[0]
    }
  }

  if (found) {
    return { customer: found, isNew: false }
  }

  // ── Creează client nou ──────────────────────────────────────────────────
  const { data: newC, error } = await supabase
    .from('risk_customers')
    .insert({
      store_id: storeId,
      user_id: userId,
      phone: phone || null,
      email: emailNorm || null,
      name: name || null,
      risk_score: 0,
      risk_label: 'new',
      total_orders: 0,
      orders_collected: 0,
      orders_refused: 0,
      orders_not_home: 0,
      orders_cancelled: 0,
      last_order_at: firstOrderAt,
      first_order_at: firstOrderAt,
      in_local_blacklist: false,
      in_global_blacklist: false,
      manually_reviewed: false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !newC) {
    // Race condition: altcineva a creat clientul între timp — retry
    console.warn('[Identity] Insert conflict, retrying:', error?.message)

    let retry: any = null
    if (phoneNorm && phoneNorm.length === 9) {
      const { data: phoneRetry } = await supabase
        .from('risk_customers').select('*')
        .eq('store_id', storeId).not('phone', 'is', null)
      if (phoneRetry) {
        retry = phoneRetry.find((c: any) => c.phone && normalizePhone(c.phone) === phoneNorm) || null
      }
    }
    if (!retry && emailNorm) {
      const { data: emailRetry } = await supabase
        .from('risk_customers').select('*')
        .eq('store_id', storeId).ilike('email', emailNorm).limit(1)
      if (emailRetry?.length) retry = emailRetry[0]
    }
    if (retry) return { customer: retry, isNew: false }

    throw new Error('Nu s-a putut crea/găsi clientul: ' + error?.message)
  }

  return { customer: newC, isNew: true }
}

// ─── Recalculează scorul unui client din DB ─────────────────────────────
//
// Numără TOATE comenzile clientului din DB (nu incrementare/decrementare),
// apoi recalculează scorul cu engine-ul.
//

export async function recalcCustomerFromDB(
  supabase: any,
  customerId: string,
  storeId: string,
  settings: any,
  orderContext?: {
    phone: string | null
    email: string | null
    paymentMethod: 'cod' | 'card' | 'bank_transfer'
    totalValue: number
    currency: string
    orderedAt: string
    shippingAddress: string
  },
): Promise<{ score: number; label: string; flags: any[]; recommendation: string; refusalProbability: number }> {

  // Ia TOATE comenzile clientului din DB
  const { data: allOrders } = await supabase
    .from('risk_orders')
    .select('order_status, shipping_address')
    .eq('customer_id', customerId)
    .eq('store_id', storeId)

  const orders = allOrders || []
  let tc = 0, tr = 0, tn = 0, tcan = 0
  const addrs = new Set<string>()

  for (const o of orders) {
    if (o.order_status === 'collected') tc++
    else if (['refused', 'returned'].includes(o.order_status)) tr++
    else if (o.order_status === 'not_home') tn++
    else if (o.order_status === 'cancelled') tcan++
    if (o.shipping_address) addrs.add(o.shipping_address.trim().toLowerCase())
  }

  // Ia datele clientului
  const { data: cust } = await supabase
    .from('risk_customers').select('*').eq('id', customerId).single()

  const phone = orderContext?.phone || cust?.phone || null
  const email = orderContext?.email || cust?.email || null

  const hist: CustomerHistory = {
    totalOrders: orders.length,
    ordersCollected: tc,
    ordersRefused: tr,
    ordersNotHome: tn,
    ordersCancelled: tcan,
    ordersToday: 0,
    lastOrderAt: cust?.last_order_at || null,
    firstOrderAt: cust?.first_order_at || null,
    accountCreatedAt: null,
    phoneValidated: !!(phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
    isNewAccount: orders.length <= 1,
    addressChanges: addrs.size,
  }

  const ctx: OrderContext = {
    paymentMethod: orderContext?.paymentMethod || 'cod',
    totalValue: orderContext?.totalValue || 0,
    currency: orderContext?.currency || 'RON',
    orderedAt: orderContext?.orderedAt || cust?.last_order_at || new Date().toISOString(),
    customerEmail: email || '',
    shippingAddress: orderContext?.shippingAddress || '',
    inGlobalBlacklist: cust?.in_global_blacklist || false,
    globalReportCount: 0,
  }

  const result = calculateRiskScore(hist, ctx, settings)

  // Respectă override-ul manual dacă există
  const finalLabel = cust?.manual_label_override || result.label

  // Actualizează clientul cu contoarele corecte din DB (sursa de adevăr)
  await supabase.from('risk_customers').update({
    total_orders: orders.length,
    orders_collected: tc,
    orders_refused: tr,
    orders_not_home: tn,
    orders_cancelled: tcan,
    risk_score: result.score,
    risk_label: finalLabel,
    updated_at: new Date().toISOString(),
  }).eq('id', customerId)

  return { ...result, label: finalLabel }
}

// ─── Fetch paginated orders from WooCommerce ─────────────────────────────

export async function fetchWooOrders(
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string>,
  maxPages = 100,
): Promise<{ orders: any[]; totalPages: number }> {
  const base = storeUrl.replace(/\/$/, '')
  const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const allOrders: any[] = []
  let totalPages = 1

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${base}/wp-json/wc/v3/orders`)
    Object.entries({ ...params, page: String(page), per_page: '100' })
      .forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`WooCommerce ${res.status}: ${txt.slice(0, 200)}`)
    }

    const data = await res.json()
    totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1')

    if (!Array.isArray(data) || data.length === 0) break
    allOrders.push(...data)

    if (page >= totalPages) break
  }

  return { orders: allOrders, totalPages }
}

// ─── Build risk order object from WooCommerce order ──────────────────────

export function buildRiskOrderFromWoo(
  wooOrder: any,
  storeId: string,
  userId: string,
  customerId: string,
  fallbackPhone: string | null,
  fallbackEmail: string | null,
): any {
  const b = wooOrder.billing || {}
  const s = wooOrder.shipping || {}
  const pm = (wooOrder.payment_method || '').toLowerCase()

  return {
    store_id: storeId,
    user_id: userId,
    customer_id: customerId,
    external_order_id: String(wooOrder.id),
    order_number: wooOrder.number ? String(wooOrder.number) : null,
    customer_phone: b.phone || fallbackPhone,
    customer_email: b.email || fallbackEmail,
    customer_name: [b.first_name, b.last_name].filter(Boolean).join(' ') || null,
    shipping_address: [s.address_1 || b.address_1, s.city || b.city, s.country || b.country]
      .filter(Boolean).join(', '),
    payment_method: pm.includes('cod') || pm.includes('cash')
      ? 'cod'
      : pm.includes('card') ? 'card' : 'bank_transfer',
    total_value: parseFloat(wooOrder.total || '0'),
    currency: wooOrder.currency || 'RON',
    order_status: mapWooStatus(wooOrder.status || 'pending'),
    risk_score_at_order: 0,
    risk_flags: [],
    ordered_at: wooOrder.date_created || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}