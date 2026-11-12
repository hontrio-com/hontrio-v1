import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { applyAndLog, loadApplyEnv, reconcileProducts, loadCampaigns } from '@/lib/ads/autopilot'
import { budgetRoom } from '@/lib/ads/optimizer'
import { isExpired, CLAIM_TTL_MS } from '@/lib/ads/schedule'
import { loadPlanContext } from '@/lib/campaigns/context'
import { storedMessage, translateStored } from '@/lib/i18n/stored'
import { getT } from '@/lib/i18n/server'
import type { ActionKind } from '@/lib/ads/journal'

// =============================================
// POST /api/campaigns/actions — omul aprobă sau respinge o propunere a
// pilotului. Aprobarea o aplică imediat în contul Google Ads.
// Body: { id, decision: 'approve' | 'reject' }
//
// - O propunere mai veche de 7 zile a expirat (cifrele de sub ea s-au schimbat),
//   chiar dacă pilotul n-a apucat s-o treacă așa: nu se mai aplică.
// - O singură hotărâre pe propunere: cererea care o „ia" (decided_at) o duce la
//   capăt; un dublu clic sau două file deschise nu o aplică de două ori.
// - Bugetul se verifică din nou la aprobare: împreună, campaniile Hontrio care
//   rulează nu trec de bugetul maxim ales de om.
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

  const { data: action } = await supabase.from('ad_actions').select('id, kind, status, created_at')
    .eq('id', body.id).eq('store_id', store.id).eq('user_id', userId).maybeSingle()
  if (!action) return NextResponse.json({ error: t('campaigns.action_not_found') }, { status: 404 })
  if (action.status !== 'proposed') return NextResponse.json({ error: t('campaigns.action_decided') }, { status: 409 })

  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  if (isExpired(action.created_at, nowMs)) {
    await supabase.from('ad_actions').update({ status: 'expired', decided_at: now }).eq('id', action.id).eq('status', 'proposed')
    return NextResponse.json({ error: t('campaigns.action_expired') }, { status: 409 })
  }

  // Propunerea e a acestei cereri (sau a fost a uneia care a căzut de mult); altfel o hotărăște altcineva acum
  const staleClaim = new Date(nowMs - CLAIM_TTL_MS).toISOString()
  const { data: claimed } = await supabase.from('ad_actions').update({ decided_at: now })
    .eq('id', action.id).eq('status', 'proposed').or(`decided_at.is.null,decided_at.lt.${staleClaim}`)
    .select('id, kind, params, ad_campaign_id').maybeSingle()
  if (!claimed) return NextResponse.json({ error: t('campaigns.action_decided') }, { status: 409 })
  const release = () => supabase.from('ad_actions').update({ decided_at: null }).eq('id', claimed.id).eq('status', 'proposed')

  if (body.decision === 'reject') {
    await supabase.from('ad_actions').update({ status: 'rejected', decided_at: now }).eq('id', claimed.id).eq('status', 'proposed')
    return NextResponse.json({ status: 'rejected' })
  }

  let settled = false
  try {
    const env = await loadApplyEnv(supabase, store.id)
    if ('error' in env) return NextResponse.json({ error: translateStored(t, env.error) }, { status: 409 })

    const kind = claimed.kind as ActionKind
    const params = { ...((claimed.params ?? {}) as Record<string, unknown>) }
    if (kind === 'set_budget') {
      // Bugetele s-au putut schimba de la propunere: noul buget încape sub maxim, altfel se micșorează sau nu se aplică
      const campaign = env.campaigns.find(c => c.id === claimed.ad_campaign_id)
      const room = budgetRoom(env.ctx.draft.max_daily_budget, claimed.ad_campaign_id ?? '', env.campaigns)
      const to = Number(params.to)
      if (room !== null && to > room) {
        if (!campaign || room <= (campaign.daily_budget ?? 0) + 0.01) {
          const error = storedMessage('campaigns.budget_over_max', { max: env.ctx.draft.max_daily_budget! })
          await supabase.from('ad_actions').update({ status: 'failed', error, decided_at: now }).eq('id', claimed.id)
          settled = true
          return NextResponse.json({ error: translateStored(t, error) }, { status: 409 })
        }
        params.to = room
      }
    }

    const r = await applyAndLog(env, kind, claimed.ad_campaign_id, params, { source: 'user', actionId: claimed.id })
    settled = true
    if (!r.ok) {
      logApiError(ROUTE, 502, 'Propunerea aprobată n-a putut fi aplicată', { userId, kind, error: r.error })
      return NextResponse.json({ error: translateStored(t, r.error ?? null) }, { status: 502 })
    }

    // Produsele scoase schimbă planul: arborii campaniilor se refac pe loc
    if (kind === 'exclude_products') {
      const { context } = await loadPlanContext(supabase, env.store.user_id, env.store)
      if (context) {
        env.ctx = context
        env.campaigns = await loadCampaigns(supabase, store.id)
        try {
          await reconcileProducts(env)
        } catch (err) {
          // Propunerea s-a aplicat; arborii se pun la zi oricum la următoarea trecere a pilotului
          logApiError(ROUTE, 502, 'Arborii de produse n-au putut fi puși la zi', { userId, error: err instanceof Error ? err.message : String(err) })
        }
      }
    }
    return NextResponse.json({ status: 'applied' })
  } finally {
    // O cerere care n-a dus propunerea la capăt o lasă liberă (se poate aproba din nou)
    if (!settled) await release()
  }
}
