import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { EMPTY_TOTALS, isEmptyRules, parseRules } from '@/lib/campaigns/groups'
import { groupTotalsFrom, planWindows } from '@/lib/campaigns/plan-store'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/campaigns/groups/preview — { rules, preceding? } → totalurile grupei
// în lucru, din baza de date (plan_group_preview, migrations/037): membrii, cei
// care pot rula, vânzările, conversiile. Pagina socotește din ele planul grupei
// cu aceeași funcție ca serverul (groupPlanFromTotals), fără tot catalogul.
// =============================================

const ROUTE = '/api/campaigns/groups/preview'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const rules = parseRules(body.rules)
  // Fără reguli, grupa nu prinde nimic: nu e nevoie de baza de date
  if (isEmptyRules(rules)) return NextResponse.json({ totals: EMPTY_TOTALS })
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
  const { data, error } = await supabase.rpc('plan_group_preview', {
    p_store_id: store.id, p_since90: w.since90, p_since30: w.since30, p_day30: w.day30, p_rules: rules, p_preceding: preceding,
  })
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la totalurile grupei', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })
  }
  return NextResponse.json({ totals: groupTotalsFrom(data) })
}
