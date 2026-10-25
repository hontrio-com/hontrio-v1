import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/catalog/cost/bulk
// Costul ca procent din preț, în masă: pe tot catalogul, pe o categorie sau
// pe o marcă. { percent, category?, brand?, only_missing, preview? }
// `preview` doar numără ofertele care s-ar schimba. Costurile completate așa
// sunt „estimate": omul le poate corecta una câte una.
// =============================================

const ROUTE = '/api/catalog/cost/bulk'

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`catalog-cost-bulk:${userId}`, 30, 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  let body: { percent?: unknown; category?: unknown; brand?: unknown; only_missing?: unknown; preview?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  const percent = Number(body.percent)
  if (typeof body.percent !== 'number' || !Number.isFinite(percent) || percent < 1 || percent > 99) {
    return NextResponse.json({ error: t('catalog.bulk_invalid') }, { status: 400 })
  }
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const category = text(body.category)
  const brand = text(body.brand)
  if (category && brand) return NextResponse.json({ error: t('sync.bulk_scope_conflict') }, { status: 400 })

  const supabase = createAdminClient()
  // Doar ofertele magazinului activ al OMULUI: funcția filtrează pe store_id
  const { data: store } = await getActiveStore<{ id: string }>(supabase, userId, 'id')
  if (!store) return NextResponse.json({ error: t('sync.no_store') }, { status: 404 })

  const { data, error } = await supabase.rpc('commerce_estimate_costs', {
    p_store_id: store.id,
    p_percent: Math.round(percent * 100) / 100,
    p_category: category,
    p_brand: brand,
    p_only_missing: body.only_missing !== false,
    p_dry_run: body.preview === true,
  })
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la completarea costurilor', { userId, error: error.message })
    return NextResponse.json({ error: t('catalog.bulk_error') }, { status: 500 })
  }
  return NextResponse.json(body.preview === true ? { would_update: Number(data) || 0 } : { updated: Number(data) || 0 })
}
