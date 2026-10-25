import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import type { AdsMode } from '@/lib/commerce/ads-data'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'

// =============================================
// PATCH /api/campaigns/offers
// Omul scoate oferte din campanie, le include deși au marjă mică, sau le
// lasă din nou pe mâna Hontrio. Scrie numai în ofertele magazinului lui.
// =============================================

const ROUTE = '/api/campaigns/offers'
const MODES: AdsMode[] = ['auto', 'include', 'exclude']
// Lista de oferte ajunge în adresa cererii către Supabase
const MAX_OFFERS = 100

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  let body: { offer_ids?: unknown; mode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  }
  const ids = Array.isArray(body.offer_ids) ? [...new Set(body.offer_ids.filter((x): x is string => typeof x === 'string' && x.length > 0))] : []
  if (!ids.length || ids.length > MAX_OFFERS) return NextResponse.json({ error: 'Oferte invalide' }, { status: 400 })
  if (!MODES.includes(body.mode as AdsMode)) return NextResponse.json({ error: 'Alegere invalidă' }, { status: 400 })
  const mode = body.mode as AdsMode

  const supabase = createAdminClient()
  const { data: store, error: storeError } = await getActiveStore<{ id: string; platform: string }>(supabase, userId, 'id, platform')
  if (storeError) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeError.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: 'Magazin nesuportat' }, { status: 400 })

  const { data, error } = await supabase.from('commerce_offers')
    .update({ ads_mode: mode })
    .eq('store_id', store.id)
    .in('offer_id', ids)
    .select('offer_id')
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la salvarea alegerii', { userId, error: error.message })
    return NextResponse.json({ error: 'Nu am putut salva' }, { status: 500 })
  }

  return NextResponse.json({ updated: (data ?? []).map(r => r.offer_id), mode })
}
