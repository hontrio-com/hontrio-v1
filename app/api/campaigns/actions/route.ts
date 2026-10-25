import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { applyAndLog, loadApplyEnv, reconcileProducts, loadCampaigns } from '@/lib/ads/autopilot'
import { loadPlanContext } from '@/lib/campaigns/context'
import { translateStored } from '@/lib/i18n/stored'
import { getT } from '@/lib/i18n/server'
import type { ActionKind } from '@/lib/ads/journal'

// =============================================
// POST /api/campaigns/actions — omul aprobă sau respinge o propunere a
// pilotului. Aprobarea o aplică imediat în contul Google Ads.
// Body: { id, decision: 'approve' | 'reject' }
// =============================================

const ROUTE = '/api/campaigns/actions'

export const maxDuration = 120

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: { id?: unknown; decision?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !['approve', 'reject'].includes(body.decision as string)) {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: store } = await getActiveStore<{ id: string }>(supabase, userId, 'id')
  if (!store) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })

  const { data: action } = await supabase.from('ad_actions').select('id, kind, params, ad_campaign_id, status')
    .eq('id', body.id).eq('store_id', store.id).eq('user_id', userId).maybeSingle()
  if (!action) return NextResponse.json({ error: t('campaigns.action_not_found') }, { status: 404 })
  if (action.status !== 'proposed') return NextResponse.json({ error: t('campaigns.action_decided') }, { status: 409 })

  const now = new Date().toISOString()
  if (body.decision === 'reject') {
    await supabase.from('ad_actions').update({ status: 'rejected', decided_at: now }).eq('id', action.id).eq('status', 'proposed')
    return NextResponse.json({ status: 'rejected' })
  }

  const env = await loadApplyEnv(supabase, store.id)
  if ('error' in env) return NextResponse.json({ error: translateStored(t, env.error) }, { status: 409 })

  const r = await applyAndLog(env, action.kind as ActionKind, action.ad_campaign_id, (action.params ?? {}) as Record<string, unknown>, { source: 'user', actionId: action.id })
  if (!r.ok) {
    logApiError(ROUTE, 502, 'Propunerea aprobată n-a putut fi aplicată', { userId, kind: action.kind, error: r.error })
    return NextResponse.json({ error: translateStored(t, r.error ?? null) }, { status: 502 })
  }

  // Produsele scoase schimbă planul: arborii campaniilor se refac pe loc
  if (action.kind === 'exclude_products') {
    const { context } = await loadPlanContext(supabase, env.store.user_id, env.store)
    if (context) {
      env.ctx = context
      env.campaigns = await loadCampaigns(supabase, store.id)
      await reconcileProducts(env)
    }
  }
  return NextResponse.json({ status: 'applied' })
}
