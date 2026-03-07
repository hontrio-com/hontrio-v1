/**
 * lib/risk/identity.ts — v2
 * 
 * PRINCIPIU FUNDAMENTAL:
 *   Identitatea clientului = external_customer_id din WooCommerce
 *   Phone/email sunt doar atribute de contact, NU chei de identitate
 *
 * REGULI:
 *   1. Dacă order are customer_id > 0 → caută/creează prin external_customer_id
 *   2. Dacă order e guest (customer_id = 0) → creează client guest separat
 *   3. Doi clienți Woo diferiți cu același email/telefon = DOI clienți separați
 *   4. Phone/email sunt doar pentru search, clustering, și fraud detection
 */

import { calculateRiskScore, type CustomerHistory, type OrderContext } from './engine'
import { decrypt } from '@/lib/security/encryption'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return v.includes(':') ? decrypt(v) : v } catch { return v }
}

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

// ─── Resolve Customer Identity ────────────────────────────────────────────────
//
// REGULA: Identitatea se bazează pe external_customer_id din WooCommerce.
// NICIODATĂ pe phone/email.
//

export async function resolveCustomer(
  supabase: any, storeId: string, userId: string,
  externalCustomerId: string | null, // WooCommerce customer_id (null/0 = guest)
  phone: string | null, email: string | null, name: string | null,
  orderedAt: string,
): Promise<{ customer: any; isNew: boolean }> {

  const isGuest = !externalCustomerId || externalCustomerId === '0'
  const extId = isGuest ? null : externalCustomerId

  // ── REGISTERED CUSTOMER (external_customer_id > 0) ──────────────────────
  if (extId) {
    // Caută prin external_customer_id — sursa unică de adevăr
    const { data: existing } = await supabase.from('risk_customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('external_customer_id', extId)
      .single()

    if (existing) {
      return { customer: existing, isNew: false }
    }

    // Nu există — creează client NOU
    const { data: newC, error } = await supabase.from('risk_customers').insert({
      store_id: storeId, user_id: userId,
      external_customer_id: extId,
      phone: phone || null, email: email?.toLowerCase().trim() || null,
      name: name || null, is_guest: false,
      risk_score: 0, risk_label: 'new',
      total_orders: 0, orders_collected: 0, orders_refused: 0,
      orders_not_home: 0, orders_cancelled: 0,
      last_order_at: orderedAt, first_order_at: orderedAt,
      in_local_blacklist: false, in_global_blacklist: false,
      manually_reviewed: false, updated_at: new Date().toISOString(),
    }).select('*').single()

    if (error) {
      // Race condition — retry lookup
      const { data: retry } = await supabase.from('risk_customers')
        .select('*').eq('store_id', storeId).eq('external_customer_id', extId).single()
      if (retry) return { customer: retry, isNew: false }
      throw new Error('Cannot create customer: ' + error.message)
    }

    return { customer: newC, isNew: true }
  }

  // ── GUEST ORDER (no customer_id) ────────────────────────────────────────
  // Fiecare guest order creează un client guest separat.
  // NU facem merge automat pe phone/email — asta e treaba clustering-ului.
  const { data: guest, error } = await supabase.from('risk_customers').insert({
    store_id: storeId, user_id: userId,
    external_customer_id: null,
    phone: phone || null, email: email?.toLowerCase().trim() || null,
    name: name || null, is_guest: true,
    risk_score: 0, risk_label: 'new',
    total_orders: 0, orders_collected: 0, orders_refused: 0,
    orders_not_home: 0, orders_cancelled: 0,
    last_order_at: orderedAt, first_order_at: orderedAt,
    in_local_blacklist: false, in_global_blacklist: false,
    manually_reviewed: false, updated_at: new Date().toISOString(),
  }).select('*').single()

  if (error) throw new Error('Cannot create guest: ' + error.message)
  return { customer: guest, isNew: true }
}

// ─── Recalculare completă din DB ──────────────────────────────────────────────

export async function recalc(
  supabase: any, customerId: string, storeId: string, settings: any = {}
): Promise<{ score: number; label: string; flags: any[]; recommendation: string; refusalProbability: number }> {
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

  return { score: result.score, label, flags: result.flags, recommendation: result.recommendation, refusalProbability: result.refusalProbability }
}

// ─── WooCommerce API helper ───────────────────────────────────────────────────

export async function wcGet(
  base: string, auth: string, endpoint: string, params: Record<string, string>
): Promise<{ data: any[]; total: number; totalPages: number }> {
  const url = new URL(`${base}/wp-json/wc/v3/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: auth }, signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`WC ${endpoint} HTTP ${res.status}`)

  const data = await res.json()
  return {
    data: Array.isArray(data) ? data : [],
    total: parseInt(res.headers.get('x-wp-total') || '0'),
    totalPages: parseInt(res.headers.get('x-wp-totalpages') || '1'),
  }
}

// ─── Build risk order ─────────────────────────────────────────────────────────

export function buildOrder(woo: any, storeId: string, userId: string, customerId: string): any {
  const b = woo.billing || {}, s = woo.shipping || {}
  const pm = (woo.payment_method || '').toLowerCase()
  return {
    store_id: storeId, user_id: userId, customer_id: customerId,
    external_order_id: String(woo.id),
    external_customer_id: woo.customer_id ? String(woo.customer_id) : null,
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

// ─── Settings helper ──────────────────────────────────────────────────────────

export async function getSettings(supabase: any, storeId: string) {
  const { data: rs } = await supabase.from('risk_store_settings')
    .select('*').eq('store_id', storeId).single()
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
    ...(rs?.custom_rules || {}), ml_weights: rs?.ml_weights,
  }
}