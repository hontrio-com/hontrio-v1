import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'

// =============================================
// PATCH /api/catalog/cost
// Prețul de cost al unei oferte ({ offer_id }) sau al tuturor variantelor
// unui produs ({ product_id }). `cost_price: null` îl șterge.
// Sincronizarea nu scrie niciodată coloana asta, deci valoarea rămâne.
// =============================================

const ROUTE = '/api/catalog/cost'
const MAX_COST = 1_000_000_000

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`catalog-cost:${userId}`, 120, 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: 'Prea multe modificări. Așteaptă un minut.' }, { status: 429 })

  const body = await request.json().catch(() => null) as { offer_id?: unknown; product_id?: unknown; cost_price?: unknown } | null
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })

  const offerId = typeof body.offer_id === 'string' && body.offer_id.trim() ? body.offer_id.trim() : null
  const productId = typeof body.product_id === 'string' && body.product_id.trim() ? body.product_id.trim() : null
  if (!offerId === !productId) return NextResponse.json({ error: 'Trimite fie offer_id, fie product_id' }, { status: 400 })

  let cost: number | null = null
  if (body.cost_price !== null && body.cost_price !== undefined && body.cost_price !== '') {
    const n = Number(body.cost_price)
    if (!Number.isFinite(n) || n < 0 || n > MAX_COST) {
      return NextResponse.json({ error: 'Prețul de cost trebuie să fie un număr pozitiv' }, { status: 400 })
    }
    cost = Math.round(n * 100) / 100
  }

  const supabase = createAdminClient()
  // Oferta trebuie să fie din magazinul OMULUI: filtrul pe store_id e chiar paza
  const { data: store } = await supabase.from('stores').select('id').eq('user_id', userId).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Nu ai un magazin conectat' }, { status: 404 })

  let q = supabase.from('commerce_offers').update({ cost_price: cost }).eq('store_id', store.id)
  q = offerId ? q.eq('offer_id', offerId) : q.eq('external_product_id', productId!)
  const { data, error } = await q.select('offer_id')
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la salvarea prețului de cost', { userId, error: error.message })
    return NextResponse.json({ error: 'Nu am putut salva prețul de cost' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Produsul nu a fost găsit' }, { status: 404 })

  return NextResponse.json({ updated: data.map(d => d.offer_id), cost_price: cost })
}
