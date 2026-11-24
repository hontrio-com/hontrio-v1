import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanStore } from '@/lib/campaigns/context'
import { runAudit } from '@/lib/ads/audit-run'
import { loadApplyEnv, reconcileProducts } from '@/lib/ads/autopilot'
import { launchFromPlan, launchGroup } from '@/lib/google/launch'
import { AUDIT_FRESH_MS } from '@/lib/google/audit'
import { translateStored } from '@/lib/i18n/stored'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/campaigns/launch
// Lansează campania din plan (sau a unei grupe, cu group_id) în contul Google
// Ads al magazinului activ. Planul se socotește din nou aici (nu se ia de la
// client), cu un audit proaspăt. După o grupă, campania principală care
// rulează îi lasă produsele afară.
// Body: { overlap: 'pause' | 'keep' | null, declare_eu: boolean, group_id?: string,
//         expected_type?: 'shopping' | 'performance_max' } (tipul văzut în pagină; altul în plan = 409)
// =============================================

const ROUTE = '/api/campaigns/launch'

export const maxDuration = 120

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: { overlap?: unknown; declare_eu?: unknown; group_id?: unknown; expected_type?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  const overlap = body.overlap === 'pause' || body.overlap === 'keep' ? body.overlap : null
  const declareEu = body.declare_eu === true
  const groupId = typeof body.group_id === 'string' && body.group_id ? body.group_id : null
  const expectedType = body.expected_type === 'shopping' || body.expected_type === 'performance_max' ? body.expected_type : null

  const supabase = createAdminClient()
  const { data: store, error } = await getActiveStore<PlanStore>(supabase, userId, STORE_PLAN_COLUMNS)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })
  // Factură neplătită (Termeni, art. 13): nicio lansare nouă până la plată
  const { data: billing } = await supabase.from('stores').select('billing_suspended_at').eq('id', store.id).maybeSingle()
  if (billing?.billing_suspended_at) return NextResponse.json({ error: t('billing.launch_suspended') }, { status: 402 })

  // Lansarea se sprijină pe un audit proaspăt: contul s-ar putea să se fi schimbat de ieri
  const { data: last } = await supabase.from('google_audits').select('checked_at, customer_id').eq('store_id', store.id).maybeSingle()
  if (!last || Date.now() - Date.parse(last.checked_at) > AUDIT_FRESH_MS / 4 || last.customer_id !== store.google_ads_customer_id) {
    await runAudit(supabase, store)
  }

  const { context, errors } = await loadPlanContext(supabase, userId, store)
  for (const e of errors) logApiError(ROUTE, 500, 'Eroare la citirea datelor magazinului', { userId, error: e })
  if (!context) return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })

  const result = groupId
    ? await launchGroup(supabase, userId, store, context, groupId, { overlap, declareEu })
    : await launchFromPlan(supabase, userId, store, context, { overlap, declareEu, expectedType })
  if (!result.ok) {
    if (result.reason === 'google_error' || result.reason === 'save_failed') {
      logApiError(ROUTE, 502, 'Lansarea a eșuat', { userId, reason: result.reason, error: result.error, details: result.details })
    }
    const conflict = ['blocked', 'group_blocked', 'group_missing', 'audit_missing', 'eu_confirm', 'overlap_choice', 'no_merchant', 'already_active', 'too_many_exclusions', 'type_changed']
    return NextResponse.json({
      error: translateStored(t, result.error),
      reason: result.reason,
      // Câmpul vinovat, din răspunsul Google (ajută la depanare; nu conține date ale omului)
      details: result.details?.slice(0, 5) ?? [],
    }, { status: conflict.includes(result.reason) ? 409 : 502 })
  }

  // Grupa are acum campania ei: campania principală care rulează îi lasă produsele afară
  if (groupId) {
    try {
      const env = await loadApplyEnv(supabase, store.id)
      if (!('error' in env)) await reconcileProducts(env)
    } catch (err) {
      logApiError(ROUTE, 500, 'Produsele campaniei principale n-au putut fi puse la zi', { userId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Contul tocmai s-a schimbat (campania nouă, declarația UE, campaniile puse pe pauză): auditul se reface,
  // ca Recomandările să nu mai arate probleme rezolvate chiar acum. Lansarea a reușit oricum.
  try {
    await runAudit(supabase, store)
  } catch (err) {
    logApiError(ROUTE, 500, 'Auditul de după lansare a eșuat', { userId, error: err instanceof Error ? err.message : String(err) })
  }
  return NextResponse.json({
    ad_campaign_id: result.ad_campaign_id,
    google_campaign_id: result.google_campaign_id,
    warnings: result.warnings.map(w => translateStored(t, w)),
  })
}
