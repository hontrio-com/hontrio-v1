/**
 * lib/risk/identity.ts — v3
 *
 * STRATEGIE IDENTITY RESOLUTION:
 *   1. Registered (WC customer_id > 0):
 *      a. Caută prin external_customer_id (sursa unică de adevăr)
 *      b. Dacă nu există, caută prin phone_normalized sau email — poate fi același client cu cont nou
 *      c. Dacă nu există deloc, creează client nou
 *   2. Guest (WC customer_id = 0):
 *      a. Caută prin phone_normalized (cel mai fiabil — același telefon = aceeași persoană)
 *      b. Caută prin email normalizat
 *      c. Dacă nu există, creează client nou
 *   3. La creare client nou: detectează potențiali duplicați și salvează în risk_identity_candidates
 */

import { calculateRiskScore } from './engine'
import { decrypt } from '@/lib/security/encryption'
import { normalizePhone, normalizeEmail, computeIdentityConfidence } from './utils'

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

// ─── Detectare candidați duplicați ────────────────────────────────────────────

async function detectAndSaveDuplicateCandidates(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  storeId: string,
  userId: string,
  newCustomer: Record<string, any>
): Promise<void> {
  try {
    const phonN = normalizePhone(newCustomer.phone)
    const emailN = normalizeEmail(newCustomer.email)
    if (!phonN && !emailN && !newCustomer.name) return

    // Caută clienți similari (limitează la 100 pentru performance)
    const { data: pool } = await supabase.from('risk_customers')
      .select('id, external_customer_id, phone, phone_normalized, email, name, is_merged')
      .eq('store_id', storeId)
      .eq('is_merged', false)
      .neq('id', newCustomer.id)
      .limit(200)

    if (!pool?.length) return

    for (const existing of pool) {
      const { confidence, reasons, method } = computeIdentityConfidence(
        { externalId: newCustomer.external_customer_id, phone: phonN, email: emailN, name: newCustomer.name },
        { externalId: existing.external_customer_id, phone: existing.phone_normalized || existing.phone, email: existing.email, name: existing.name }
      )

      // Ignoră match-urile slabe și exact matches (deja handled în resolveCustomer)
      if (confidence < 0.70 || confidence >= 0.95) continue

      // Salvează candidat dacă nu există deja
      const [a, b] = [newCustomer.id, existing.id].sort()
      await supabase.from('risk_identity_candidates').upsert({
        store_id: storeId, user_id: userId,
        customer_a_id: a, customer_b_id: b,
        confidence, match_reasons: reasons,
        status: 'pending',
      }, { onConflict: 'customer_a_id,customer_b_id', ignoreDuplicates: true })
    }
  } catch (err: unknown) {
    console.warn('[identity] detectDuplicates error:', err instanceof Error ? err.message : err)
  }
}

// ─── Resolve Customer Identity ────────────────────────────────────────────────

export async function resolveCustomer(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  storeId: string,
  userId: string,
  externalCustomerId: string | null,
  phone: string | null,
  email: string | null,
  name: string | null,
  orderedAt: string,
): Promise<{ customer: Record<string, any>; isNew: boolean }> {

  const isGuest = !externalCustomerId || externalCustomerId === '0'
  const extId = isGuest ? null : externalCustomerId
  const phonN = normalizePhone(phone)
  const emailN = normalizeEmail(email)

  // ── REGISTERED CUSTOMER ──────────────────────────────────────────────────
  if (extId) {
    // 1. Prima căutare: external_customer_id
    const { data: byWcId } = await supabase.from('risk_customers')
      .select('*').eq('store_id', storeId).eq('external_customer_id', extId)
      .eq('is_merged', false).single()

    if (byWcId) return { customer: byWcId, isNew: false }

    // 2. Secundar: același telefon normalizat (clientul și-a schimbat WC account-ul)
    if (phonN) {
      const { data: byPhone } = await supabase.from('risk_customers')
        .select('*').eq('store_id', storeId).eq('phone_normalized', phonN)
        .eq('is_merged', false).limit(1)
      if (byPhone?.[0]) {
        // Link the new WC ID to existing record
        await supabase.from('risk_customers')
          .update({ external_customer_id: extId, updated_at: new Date().toISOString() })
          .eq('id', byPhone[0].id)
        return { customer: { ...byPhone[0], external_customer_id: extId }, isNew: false }
      }
    }

    // 3. Terțiar: același email
    if (emailN) {
      const { data: byEmail } = await supabase.from('risk_customers')
        .select('*').eq('store_id', storeId).ilike('email', emailN)
        .eq('is_merged', false).limit(1)
      if (byEmail?.[0]) {
        await supabase.from('risk_customers')
          .update({ external_customer_id: extId, updated_at: new Date().toISOString() })
          .eq('id', byEmail[0].id)
        return { customer: { ...byEmail[0], external_customer_id: extId }, isNew: false }
      }
    }

    // Nu există — creează client NOU
    const { data: newC, error } = await supabase.from('risk_customers').insert({
      store_id: storeId, user_id: userId,
      external_customer_id: extId,
      phone: phonN || phone || null,
      phone_normalized: phonN,
      email: emailN || null,
      name: name || null, is_guest: false, is_merged: false,
      risk_score: 0, risk_label: 'new',
      total_orders: 0, orders_collected: 0, orders_refused: 0,
      orders_not_home: 0, orders_cancelled: 0,
      last_order_at: orderedAt, first_order_at: orderedAt,
      in_local_blacklist: false, in_global_blacklist: false,
      manually_reviewed: false, updated_at: new Date().toISOString(),
    }).select('*').single()

    if (error) {
      const { data: retry } = await supabase.from('risk_customers')
        .select('*').eq('store_id', storeId).eq('external_customer_id', extId).single()
      if (retry) return { customer: retry, isNew: false }
      throw new Error('Cannot create customer: ' + error.message)
    }

    void detectAndSaveDuplicateCandidates(supabase, storeId, userId, newC)
    return { customer: newC, isNew: true }
  }

  // ── GUEST ORDER ──────────────────────────────────────────────────────────
  // Prioritate: phone_normalized > email > create new

  // 1. Caută prin telefon normalizat (cel mai fiabil)
  if (phonN) {
    const { data: byPhone } = await supabase.from('risk_customers')
      .select('*').eq('store_id', storeId).eq('phone_normalized', phonN)
      .eq('is_merged', false).limit(1)
    if (byPhone?.[0]) return { customer: byPhone[0], isNew: false }
  }

  // 2. Caută prin email (fallback dacă nu are telefon)
  if (emailN) {
    const { data: byEmail } = await supabase.from('risk_customers')
      .select('*').eq('store_id', storeId).ilike('email', emailN)
      .eq('is_merged', false).limit(1)
    if (byEmail?.[0]) return { customer: byEmail[0], isNew: false }
  }

  // 3. Nicio potrivire → creează guest nou
  const { data: guest, error } = await supabase.from('risk_customers').insert({
    store_id: storeId, user_id: userId,
    external_customer_id: null,
    phone: phonN || phone || null,
    phone_normalized: phonN,
    email: emailN || null,
    name: name || null, is_guest: true, is_merged: false,
    risk_score: 0, risk_label: 'new',
    total_orders: 0, orders_collected: 0, orders_refused: 0,
    orders_not_home: 0, orders_cancelled: 0,
    last_order_at: orderedAt, first_order_at: orderedAt,
    in_local_blacklist: false, in_global_blacklist: false,
    manually_reviewed: false, updated_at: new Date().toISOString(),
  }).select('*').single()

  if (error) throw new Error('Cannot create guest: ' + error.message)

  void detectAndSaveDuplicateCandidates(supabase, storeId, userId, guest)
  return { customer: guest, isNew: true }
}

// ─── Recalculare completă din DB ──────────────────────────────────────────────

export async function recalc(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  customerId: string,
  storeId: string,
  settings: Partial<import('./engine').StoreRules> = {}
): Promise<{ score: number; label: string; flags: import('./engine').RiskFlag[]; recommendation: string; refusalProbability: number }> {
  const { data: orders } = await supabase.from('risk_orders')
    .select('order_status, shipping_address, payment_method, total_value, currency, ordered_at')
    .eq('customer_id', customerId).eq('store_id', storeId)

  const all = orders || []
  let tc = 0, tr = 0, tn = 0, tcan = 0
  const addrs = new Set<string>()
  const today = new Date().toISOString().slice(0, 10)
  let ordersToday = 0
  let lastPm = 'cod', lastVal = 0, lastCurr = 'RON', lastAddr = ''

  for (const o of all) {
    if (o.order_status === 'collected') tc++
    else if (['refused', 'returned'].includes(o.order_status)) tr++
    else if (o.order_status === 'not_home') tn++
    else if (o.order_status === 'cancelled') tcan++
    if (o.shipping_address) addrs.add(o.shipping_address.trim().toLowerCase())
    if (o.ordered_at?.slice(0, 10) === today) ordersToday++
  }
  if (all.length > 0) {
    const last = all[all.length - 1]
    lastPm = last.payment_method || 'cod'
    lastVal = last.total_value || 0
    lastCurr = last.currency || 'RON'
    lastAddr = last.shipping_address || ''
  }

  const { data: cust } = await supabase.from('risk_customers')
    .select('*').eq('id', customerId).single()

  const result = calculateRiskScore({
    totalOrders: all.length, ordersCollected: tc, ordersRefused: tr,
    ordersNotHome: tn, ordersCancelled: tcan, ordersToday,
    lastOrderAt: cust?.last_order_at, firstOrderAt: cust?.first_order_at,
    accountCreatedAt: null,
    phoneValidated: !!(cust?.phone_normalized || cust?.phone?.match(/^0[23-9]\d{8}$/)),
    isNewAccount: all.length <= 1, addressChanges: addrs.size,
  }, {
    paymentMethod: lastPm as 'cod' | 'card' | 'bank_transfer',
    totalValue: lastVal, currency: lastCurr,
    orderedAt: cust?.last_order_at || new Date().toISOString(),
    customerEmail: cust?.email || '', shippingAddress: lastAddr,
    inGlobalBlacklist: cust?.in_global_blacklist || false, globalReportCount: 0,
  }, settings)

  const label = cust?.manual_label_override || result.label

  await supabase.from('risk_customers').update({
    total_orders: all.length, orders_collected: tc, orders_refused: tr,
    orders_not_home: tn, orders_cancelled: tcan,
    risk_score: result.score, risk_label: label,
    updated_at: new Date().toISOString(),
  }).eq('id', customerId)

  return {
    score: result.score, label, flags: result.flags,
    recommendation: result.recommendation,
    refusalProbability: result.refusalProbability,
  }
}

// ─── WooCommerce API helper ───────────────────────────────────────────────────

export async function wcGet(
  base: string, auth: string, endpoint: string, params: Record<string, string>
): Promise<{ data: Record<string, unknown>[]; total: number; totalPages: number }> {
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

export function buildOrder(woo: Record<string, unknown>, storeId: string, userId: string, customerId: string): Record<string, unknown> {
  const b = (woo.billing as Record<string, unknown>) || {}
  const s = (woo.shipping as Record<string, unknown>) || {}
  const pm = ((woo.payment_method as string) || '').toLowerCase()
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
    total_value: parseFloat((woo.total as string) || '0'), currency: (woo.currency as string) || 'RON',
    order_status: mapStatus((woo.status as string) || 'pending'),
    risk_score_at_order: 0, risk_flags: [],
    ordered_at: (woo.date_created as string) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ─── Settings helper ──────────────────────────────────────────────────────────

export async function getSettings(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  storeId: string
) {
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
