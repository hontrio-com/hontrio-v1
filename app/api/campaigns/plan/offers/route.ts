import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { parseRules } from '@/lib/campaigns/groups'
import { likePattern, planOfferOf, planWindows, type PlanPageRow } from '@/lib/campaigns/plan-store'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/campaigns/plan/offers — o pagină din produsele planului, din baza
// de date (plan_offer_page, migrations/037), ca un catalog de zeci de mii de
// oferte să nu plece întreg spre pagină:
//   { filter: 'included' | 'groups' | 'excluded', q?, page? }            fila din Campanii
//   { filter: 'group' | 'all', rules, group?, preceding?, q?, page? }    editorul grupei
// Motivul și grupa fiecărei oferte vin din ultima socotire a planului (GET
// /api/campaigns/plan le salvează); regulile grupei în lucru se aplică pe loc.
// =============================================

const ROUTE = '/api/campaigns/plan/offers'
const FILTERS = ['included', 'groups', 'excluded', 'group', 'all'] as const
type Filter = typeof FILTERS[number]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE = 10_000

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  const filter = FILTERS.includes(body.filter as Filter) ? (body.filter as Filter) : null
  if (!filter) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(body.page) || 1)))
  const perPage = Math.min(100, Math.max(10, Math.floor(Number(body.per_page) || DEFAULT_PAGE_SIZE)))
  // Grupa în lucru: regulile ei (curățate ca la salvare), ID-ul ei (o grupă nouă nu are) și grupele dinaintea ei
  const draft = filter === 'group' || (filter === 'all' && body.rules !== undefined)
  const rules = draft ? parseRules(body.rules) : null
  const group = typeof body.group === 'string' && UUID.test(body.group) ? body.group : null
  const preceding = Array.isArray(body.preceding)
    ? body.preceding.filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 20)
    : []

  const supabase = createAdminClient()
  const { data: store, error: storeError } = await getActiveStore<{ id: string; platform: string }>(supabase, userId, 'id, platform')
  if (storeError) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeError.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })

  const w = planWindows()
  const { data, error } = await supabase.rpc('plan_offer_page', {
    p_store_id: store.id, p_since90: w.since90, p_since30: w.since30, p_day30: w.day30,
    p_filter: filter, p_q: likePattern(body.q), p_rules: rules, p_group: group, p_preceding: preceding,
    p_offset: (page - 1) * perPage, p_limit: perPage,
  })
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea produselor planului', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })
  }
  const res = (data ?? {}) as { total?: unknown; rows?: PlanPageRow[] }
  return NextResponse.json({
    total: Number(res.total) || 0,
    page,
    per_page: perPage,
    offers: (Array.isArray(res.rows) ? res.rows : []).map(planOfferOf),
  })
}
