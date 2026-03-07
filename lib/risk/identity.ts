/**
 * lib/risk/identity.ts
 * 
 * Sursa unică de adevăr pentru identitatea clienților.
 * REGULA: phone last9 SAU email = ACELAȘI CLIENT
 */

import { calculateRiskScore, type CustomerHistory, type OrderContext } from './engine'
import { decrypt } from '@/lib/security/encryption'

// ─── Normalizare ──────────────────────────────────────────────────────────────

export function phoneNorm(p: string): string {
  return p.replace(/\D/g, '').slice(-9)
}

export function emailNorm(e: string): string {
  return e.toLowerCase().trim()
}

export function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const SM: Record<string, string> = {
  pending: 'pending', processing: 'processing', 'on-hold': 'pending',
  completed: 'collected', cancelled: 'cancelled', refunded: 'returned',
  failed: 'cancelled', shipped: 'shipped', delivered: 'collected',
  returned: 'returned', refused: 'refused', 'not-home': 'not_home',
  livrata: 'collected', refuzata: 'refused', returnata: 'returned',
  expediat: 'shipped', 'in-livrare': 'shipped', nepreluat: 'not_home',
}

export function mapStatus(s: string): string {
  const n = s.toLowerCase()
    .replace(/[ăâ]/g, 'a').replace(/î/g, 'i')
    .replace(/[șş]/g, 's').replace(/[țţ]/g, 't')
  return SM[n] || SM[s.toLowerCase()] || 'pending'
}

// ─── Find customer ────────────────────────────────────────────────────────────

export async function findCustomer(
  supabase: any, storeId: string, phone: string | null, email: string | null
): Promise<any | null> {
  const ph = phone ? phoneNorm(phone) : null
  const em = email ? emailNorm(email) : null

  // Phone match — ia toți cu telefon din store, filtrează last9
  if (ph && ph.length === 9) {
    const { data } = await supabase.from('risk_customers')
      .select('*').eq('store_id', storeId).not('phone', 'is', null)
    const match = (data || []).find((c: any) => c.phone && phoneNorm(c.phone) === ph)
    if (match) return match
  }

  // Email match
  if (em) {
    const { data } = await supabase.from('risk_customers')
      .select('*').eq('store_id', storeId).ilike('email', em).limit(1)
    if (data?.[0]) return data[0]
  }

  return null
}

export async function findOrCreate(
  supabase: any, storeId: string, userId: string,
  phone: string | null, email: string | null, name: string | null, orderedAt: string
): Promise<{ customer: any; isNew: boolean }> {
  const found = await findCustomer(supabase, storeId, phone, email)
  if (found) return { customer: found, isNew: false }

  const { data, error } = await supabase.from('risk_customers').insert({
    store_id: storeId, user_id: userId,
    phone: phone || null, email: email ? emailNorm(email) : null, name: name || null,
    risk_score: 0, risk_label: 'new',
    total_orders: 0, orders_collected: 0, orders_refused: 0,
    orders_not_home: 0, orders_cancelled: 0,
    last_order_at: orderedAt, first_order_at: orderedAt,
    in_local_blacklist: false, in_global_blacklist: false,
    manually_reviewed: false, updated_at: new Date().toISOString(),
  }).select('*').single()

  if (error || !data) {
    // Race condition retry
    const retry = await findCustomer(supabase, storeId, phone, email)
    if (retry) return { customer: retry, isNew: false }
    throw new Error('Cannot create customer: ' + error?.message)
  }

  return { customer: data, isNew: true }
}

// ─── Recalculare completă din DB ──────────────────────────────────────────────

export async function recalc(
  supabase: any, customerId: string, storeId: string, settings: any = {}
): Promise<{ score: number; label: string; flags: any[] }> {
  const { data: orders } = await supabase.from('risk_orders')
    .select('order_status, shipping_address')
    .eq('customer_id', customerId).eq('store_id', storeId)

  const all = orders || []
  let tc = 0, tr = 0, tn = 0, tcan = 0
  const addrs = new Set<string>()

  for (const o of all) {
    if (o.order_status === 'collected') tc++
    else if (['refused', 'returned'].includes(o.order_status)) tr++
    else if (o.order_status === 'not_home') tn++
    else if (o.order_status === 'cancelled') tcan++
    if (o.shipping_address) addrs.add(o.shipping_address.trim().toLowerCase())
  }

  const { data: cust } = await supabase.from('risk_customers')
    .select('*').eq('id', customerId).single()

  const result = calculateRiskScore({
    totalOrders: all.length, ordersCollected: tc, ordersRefused: tr,
    ordersNotHome: tn, ordersCancelled: tcan, ordersToday: 0,
    lastOrderAt: cust?.last_order_at, firstOrderAt: cust?.first_order_at,
    accountCreatedAt: null,
    phoneValidated: !!(cust?.phone?.match(/^(07\d{8}|02\d{8}|03\d{8})$/)),
    isNewAccount: all.length <= 1, addressChanges: addrs.size,
  }, {
    paymentMethod: 'cod', totalValue: 0, currency: 'RON',
    orderedAt: cust?.last_order_at || new Date().toISOString(),
    customerEmail: cust?.email || '', shippingAddress: '',
    inGlobalBlacklist: cust?.in_global_blacklist || false, globalReportCount: 0,
  }, settings)

  const label = cust?.manual_label_override || result.label

  await supabase.from('risk_customers').update({
    total_orders: all.length, orders_collected: tc, orders_refused: tr,
    orders_not_home: tn, orders_cancelled: tcan,
    risk_score: result.score, risk_label: label,
    updated_at: new Date().toISOString(),
  }).eq('id', customerId)

  return { score: result.score, label, flags: result.flags }
}

// ─── WooCommerce fetch helper ─────────────────────────────────────────────────

export async function wooFetch(
  storeUrl: string, ck: string, cs: string,
  params: Record<string, string>, maxPages = 100
): Promise<any[]> {
  const base = storeUrl.replace(/\/$/, '')
  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64')
  const all: any[] = []

  for (let p = 1; p <= maxPages; p++) {
    const url = new URL(`${base}/wp-json/wc/v3/orders`)
    Object.entries({ ...params, page: String(p), per_page: '100' })
      .forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`WooCommerce ${res.status}`)

    const data = await res.json()
    const pages = parseInt(res.headers.get('x-wp-totalpages') || '1')

    if (!Array.isArray(data) || !data.length) break
    all.push(...data)
    if (p >= pages) break
  }
  return all
}

// ─── Build risk order from WooCommerce ────────────────────────────────────────

export function buildOrder(woo: any, storeId: string, userId: string, customerId: string): any {
  const b = woo.billing || {}, s = woo.shipping || {}
  const pm = (woo.payment_method || '').toLowerCase()
  return {
    store_id: storeId, user_id: userId, customer_id: customerId,
    external_order_id: String(woo.id),
    order_number: woo.number ? String(woo.number) : null,
    customer_phone: b.phone || null, customer_email: b.email || null,
    customer_name: [b.first_name, b.last_name].filter(Boolean).join(' ') || null,
    shipping_address: [s.address_1 || b.address_1, s.city || b.city, s.country || b.country]
      .filter(Boolean).join(', '),
    payment_method: pm.includes('cod') || pm.includes('cash') ? 'cod'
      : pm.includes('card') ? 'card' : 'bank_transfer',
    total_value: parseFloat(woo.total || '0'), currency: woo.currency || 'RON',
    order_status: mapStatus(woo.status || 'pending'),
    risk_score_at_order: 0, risk_flags: [],
    ordered_at: woo.date_created || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ─── Helpers pentru store + settings ──────────────────────────────────────────

export async function getStoreAndSettings(supabase: any, storeId: string) {
  const { data: rs } = await supabase
    .from('risk_store_settings').select('*').eq('store_id', storeId).single()
  return {
    participate_in_global_blacklist: rs?.participate_in_global_blacklist ?? true,
    alert_on_blocked: rs?.alert_on_blocked ?? true,
    alert_on_problematic: rs?.alert_on_problematic ?? true,
    alert_on_watch: rs?.alert_on_watch ?? false,
    score_watch_threshold: rs?.score_watch_threshold ?? 41,
    score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
    score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
    alert_email: rs?.alert_email,
    email_alerts_enabled: rs?.email_alerts_enabled ?? true,
    ...(rs?.custom_rules || {}),
    ml_weights: rs?.ml_weights,
  }
}