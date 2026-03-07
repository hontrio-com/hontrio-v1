import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, normalizeEmail, recalcCustomerFromDB } from '@/lib/risk/identity'

/**
 * POST /api/risk/repair
 *
 * Repară atribuirile greșite de comenzi — le mută la clientul corect
 * bazat pe telefon (last9) / email (normalizat).
 * Apoi recalculează contoarele tuturor clienților afectați.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores').select('id').eq('user_id', userId).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    const storeId = store.id

    const { data: customers } = await supabase
      .from('risk_customers').select('id, name, phone, email').eq('store_id', storeId)
    const { data: orders } = await supabase
      .from('risk_orders').select('id, customer_id, customer_phone, customer_email').eq('store_id', storeId)

    if (!customers || !orders) return NextResponse.json({ fixed: 0 })

    // Construiește map-uri cu normalizePhone și normalizeEmail din identity.ts
    const phoneMap = new Map<string, string>()
    const emailMap = new Map<string, string>()
    for (const c of customers) {
      if (c.phone) {
        const norm = normalizePhone(c.phone)
        if (norm.length === 9) phoneMap.set(norm, c.id)
      }
      if (c.email) emailMap.set(normalizeEmail(c.email), c.id)
    }

    const affectedCustomerIds = new Set<string>()
    let fixed = 0

    for (const order of orders) {
      let correctId: string | null = null

      // Prioritate 1: telefon normalizat
      if (order.customer_phone) {
        const norm = normalizePhone(order.customer_phone)
        if (norm.length === 9) correctId = phoneMap.get(norm) || null
      }

      // Prioritate 2: email normalizat
      if (!correctId && order.customer_email) {
        correctId = emailMap.get(normalizeEmail(order.customer_email)) || null
      }

      if (correctId && correctId !== order.customer_id) {
        await supabase.from('risk_orders')
          .update({ customer_id: correctId, updated_at: new Date().toISOString() })
          .eq('id', order.id)
        affectedCustomerIds.add(correctId)
        if (order.customer_id) affectedCustomerIds.add(order.customer_id)
        fixed++
      }
    }

    // Recalculează contoarele din scratch pentru toți clienții afectați
    const { data: rs } = await supabase
      .from('risk_store_settings').select('*').eq('store_id', storeId).single()
    const settings = {
      score_watch_threshold: rs?.score_watch_threshold ?? 41,
      score_problematic_threshold: rs?.score_problematic_threshold ?? 61,
      score_blocked_threshold: rs?.score_blocked_threshold ?? 81,
      ...(rs?.custom_rules || {}),
      ml_weights: rs?.ml_weights,
    }

    for (const custId of affectedCustomerIds) {
      try {
        await recalcCustomerFromDB(supabase, custId, storeId, settings)
      } catch (e: any) {
        console.error(`[Repair] Recalc error for ${custId}:`, e.message)
      }
    }

    return NextResponse.json({
      ok: true,
      fixed,
      customersRecalculated: affectedCustomerIds.size,
      message: fixed > 0
        ? `${fixed} comenzi reatribuite corect, ${affectedCustomerIds.size} clienți recalculați.`
        : 'Toate comenzile sunt atribuite corect.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}