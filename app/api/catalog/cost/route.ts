import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'

// =============================================
// PATCH /api/catalog/cost
// Prețul de cost al unei oferte ({ offer_id }) sau al tuturor variantelor
// unui produs ({ product_id }). `cost_price: null` îl șterge.
// Sincronizarea nu scrie niciodată coloana asta, deci valoarea rămâne.
// =============================================

const ROUTE = '/api/catalog/cost'
const MAX_COST = 1_000_000_000

export async function PATCH(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`catalog-cost:${userId}`, 120, 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  const body = await request.json().catch(() => null) as { offer_id?: unknown; product_id?: unknown; cost_price?: unknown } | null
  if (!body) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

  const offerId = typeof body.offer_id === 'string' && body.offer_id.trim() ? body.offer_id.trim() : null
  const productId = typeof body.product_id === 'string' && body.product_id.trim() ? body.product_id.trim() : null
  if (!offerId === !productId) return NextResponse.json({ error: t('sync.cost_target_required') }, { status: 400 })

  let cost: number | null = null
  if (body.cost_price !== null && body.cost_price !== undefined && body.cost_price !== '') {
    const n = Number(body.cost_price)
    if (!Number.isFinite(n) || n < 0 || n > MAX_COST) {
      return NextResponse.json({ error: t('sync.cost_invalid') }, { status: 400 })
    }
    cost = Math.round(n * 100) / 100
  }

  const supabase = createAdminClient()
  // Oferta trebuie să fie din magazinul OMULUI (cel activ): filtrul pe store_id e chiar paza
  const { data: store } = await getActiveStore<{ id: string }>(supabase, userId, 'id')
  if (!store) return NextResponse.json({ error: t('sync.no_store') }, { status: 404 })

  // Scris de om: nici estimările în masă, nici preluarea din platformă nu-l mai suprascriu
  let q = supabase.from('commerce_offers').update({ cost_price: cost, cost_source: cost === null ? null : 'manual' }).eq('store_id', store.id)
  q = offerId ? q.eq('offer_id', offerId) : q.eq('external_product_id', productId!)
  const { data, error } = await q.select('offer_id')
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la salvarea prețului de cost', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.cost_save_failed') }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: t('sync.product_not_found') }, { status: 404 })

  return NextResponse.json({ updated: data.map(d => d.offer_id), cost_price: cost })
}
