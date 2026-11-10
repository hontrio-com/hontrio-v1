import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { applyAndLog, loadApplyEnv, reconcileProducts, type ApplyEnv } from '@/lib/ads/autopilot'
import { GROUP_COLUMNS } from '@/lib/campaigns/context'
import { parseGroup, todayIn } from '@/lib/campaigns/groups'
import { parseGroupFields } from '@/lib/campaigns/group-input'
import { translateStored } from '@/lib/i18n/stored'
import { getT } from '@/lib/i18n/server'

// =============================================
// PATCH  /api/campaigns/groups/{id} — schimbă grupa. Pe una lansată, schimbarea
//        ajunge pe loc în Google Ads: produsele (arborele grupei și al campaniei
//        principale), bugetul, sfârșitul perioadei. Tipul campaniei și începutul
//        nu se mai schimbă după lansare. { status: 'ended' } încheie campania
//        grupei, iar produsele ei se întorc în campania principală.
// DELETE /api/campaigns/groups/{id} — șterge o ciornă sau o grupă încheiată.
// =============================================

const ROUTE = '/api/campaigns/groups/[id]'

export const maxDuration = 120

type Store = { id: string; platform: string; timezone: string | null }

async function readGroup(id: string) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return { response: NextResponse.json({ error: t('api.unauthorized') }, { status: 401 }) }
  const userId = session.user.id
  const supabase = createAdminClient()
  const { data: store } = await getActiveStore<Store>(supabase, userId, 'id, platform, timezone')
  if (!store) return { response: NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 }) }
  const { data: row } = await supabase.from('ad_product_groups').select(GROUP_COLUMNS).eq('id', id).eq('store_id', store.id).eq('user_id', userId).maybeSingle()
  if (!row) return { response: NextResponse.json({ error: t('campaigns.group_not_found') }, { status: 404 }) }
  return { t, userId, supabase, store, group: parseGroup(row as Record<string, unknown>) }
}

/** Campaniile grupei care rulează sau stau pe pauză. */
const groupCampaigns = (env: ApplyEnv, groupId: string) => env.campaigns.filter(c => c.product_group_id === groupId && (c.status === 'active' || c.status === 'paused'))

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await readGroup(id)
  if ('response' in r) return r.response
  const { t, userId, supabase, store, group } = r

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  const now = new Date().toISOString()

  // ── Încheierea: campania se oprește, produsele se întorc în campania principală ──
  if (body.status === 'ended') {
    if (group.status !== 'live') return NextResponse.json({ error: t('campaigns.group_not_live') }, { status: 409 })
    const env = await loadApplyEnv(supabase, store.id)
    if ('error' in env) return NextResponse.json({ error: translateStored(t, env.error) }, { status: 409 })
    for (const c of groupCampaigns(env, group.id)) {
      const res = await applyAndLog(env, 'end', c.id, {}, { source: 'user' })
      if (!res.ok) {
        logApiError(ROUTE, 502, 'Campania grupei n-a putut fi încheiată', { userId, error: res.error })
        return NextResponse.json({ error: translateStored(t, res.error ?? null) }, { status: 502 })
      }
    }
    await supabase.from('ad_product_groups').update({ status: 'ended', updated_at: now }).eq('id', group.id)
    const fresh = await loadApplyEnv(supabase, store.id)
    if (!('error' in fresh)) await reconcileProducts(fresh)
    return NextResponse.json({ status: 'ended' })
  }

  const parsed = parseGroupFields(body, todayIn(store.timezone))
  if ('error' in parsed) return NextResponse.json({ error: t(parsed.error) }, { status: 400 })
  const { fields } = parsed
  if (!Object.keys(fields).length) return NextResponse.json({ error: t('sync.nothing_to_save') }, { status: 400 })

  const live = group.status === 'live'
  if (live && fields.campaign_type !== undefined && fields.campaign_type !== group.campaign_type) {
    return NextResponse.json({ error: t('campaigns.group_type_locked') }, { status: 409 })
  }
  if (live && fields.starts_on !== undefined && fields.starts_on !== group.starts_on) {
    return NextResponse.json({ error: t('campaigns.group_start_locked') }, { status: 409 })
  }
  const next = { ...group, ...fields }
  if (next.starts_on && next.ends_on && next.ends_on < next.starts_on) return NextResponse.json({ error: t('campaigns.group_period_invalid') }, { status: 400 })

  // O grupă lansată se schimbă și în Google: întâi verificăm că avem acces la cont
  let env: ApplyEnv | null = null
  if (live) {
    const loaded = await loadApplyEnv(supabase, store.id)
    if ('error' in loaded) return NextResponse.json({ error: translateStored(t, loaded.error) }, { status: 409 })
    env = loaded
  }

  const { data: saved, error } = await supabase.from('ad_product_groups').update({ ...fields, updated_at: now }).eq('id', group.id).select(GROUP_COLUMNS).single()
  if (error || !saved) {
    logApiError(ROUTE, 500, 'Eroare la salvarea grupei', { userId, error: error?.message ?? 'niciun rând' })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }

  const warnings: string[] = []
  if (env) {
    // Planul de acum, cu regulile noi
    const fresh = await loadApplyEnv(supabase, store.id)
    if (!('error' in fresh)) env = fresh
    const mine = groupCampaigns(env, group.id)
    if (fields.daily_budget !== undefined) {
      const to = fields.daily_budget ?? env.ctx.groupPlans.find(p => p.group.id === group.id)?.budget.suggested ?? null
      for (const c of mine) {
        if (to === null || c.daily_budget === to) continue
        const res = await applyAndLog(env, 'set_budget', c.id, { from: c.daily_budget, to }, { source: 'user' })
        if (!res.ok) warnings.push(translateStored(t, res.error) ?? t('campaigns.save_error'))
      }
    }
    if (fields.ends_on !== undefined && fields.ends_on !== group.ends_on) {
      for (const c of mine) {
        const res = await applyAndLog(env, 'set_end_date', c.id, { ends_on: fields.ends_on }, { source: 'user' })
        if (!res.ok) warnings.push(translateStored(t, res.error) ?? t('campaigns.save_error'))
      }
    }
    // Produsele grupei (și ce lasă afară campania principală), pe regulile noi
    if (fields.rules !== undefined) await reconcileProducts(env)
  }
  return NextResponse.json({ group: parseGroup(saved as Record<string, unknown>), warnings })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await readGroup(id)
  if ('response' in r) return r.response
  const { t, userId, supabase, group } = r
  // Una lansată se încheie întâi: campania ei din Google trebuie oprită
  if (group.status === 'live') return NextResponse.json({ error: t('campaigns.group_delete_live') }, { status: 409 })
  const { error } = await supabase.from('ad_product_groups').delete().eq('id', group.id)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la ștergerea grupei', { userId, error: error.message })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}
