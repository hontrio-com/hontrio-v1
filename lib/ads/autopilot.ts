import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { storeAdsAccount } from '@/lib/google/accounts'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import { normalizeItemId } from '@/lib/google/operations'
import { fetchCampaignDays, fetchCampaignStates, fetchProductDays, fetchSearchTerms } from '@/lib/google/reporting'
import { EXCLUDE_LABEL, type Account } from '@/lib/google/launch'
import { runAudit } from '@/lib/ads/audit-run'
import { logAction, notify, type ActionKind } from '@/lib/ads/journal'
import { applyAction, ApplyError, CAMPAIGN_COLUMNS, closeGroupIfDone, groupItems, parseCampaign, syncCampaignProducts, type CampaignRow } from '@/lib/ads/apply'
import { optimize, sumWindows, windowOf, EMPTY, type OptCampaign, type OptProduct, type Proposal, type Window } from '@/lib/ads/optimizer'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanContext, type PlanStore } from '@/lib/campaigns/context'
import { brandTerms, CAMPAIGN_EXCLUSIONS } from '@/lib/campaigns/plan'
import { syncMerchant } from '@/lib/merchant/sync'
import { AUDIT_FRESH_MS } from '@/lib/google/audit'

// =============================================
// Pilotul, o trecere pe magazin (cronul zilnic): auditul contului, metricile
// din Google Ads, Merchant Center, produsele din campanii puse la zi cu
// planul, apoi bucla de optimizare. Ce propune bucla se aplică singur în
// modul automat (și protecțiile, mereu); altfel așteaptă aprobarea omului.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

const DAY = 86_400_000
const dayStr = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => dayStr(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY))
const daysSince = (iso: string | null, now: number) => (iso ? Math.floor((now - Date.parse(iso)) / DAY) : null)
/** Propunerile nedecise expiră: cifrele de sub ele s-au schimbat. */
const PROPOSAL_TTL_DAYS = 7
/** Felurile de propuneri de când Hontrio lucra cu marje (ținta, împărțirea): nu se mai aplică. */
const RETIRED_KINDS = ['set_target', 'segment']
const FIRST_SYNC_DAYS = 90
const OVERLAP_DAYS = 3

export type AutopilotResult = { ok: boolean; note: string }

export async function loadCampaigns(supabase: Supabase, storeId: string): Promise<CampaignRow[]> {
  const { data } = await supabase.from('ad_campaigns').select(CAMPAIGN_COLUMNS)
    .eq('store_id', storeId).in('status', ['active', 'paused']).not('google_campaign_id', 'is', null)
  return (data ?? []).map(r => parseCampaign(r as Record<string, unknown>))
}

/** O propunere deschisă de același fel se reîmprospătează, nu se dublează. */
async function propose(supabase: Supabase, store: PlanStore, p: Proposal) {
  const reason = storedMessage(p.reason.key, p.reason.params)
  let q = supabase.from('ad_actions').select('id').eq('store_id', store.id).eq('kind', p.kind).eq('status', 'proposed')
  q = p.campaign_id ? q.eq('ad_campaign_id', p.campaign_id) : q.is('ad_campaign_id', null)
  const { data: open } = await q.maybeSingle()
  if (open) {
    await supabase.from('ad_actions').update({ params: p.params, reason, created_at: new Date().toISOString() }).eq('id', open.id)
    return false
  }
  await logAction(supabase, { user_id: store.user_id, store_id: store.id, ad_campaign_id: p.campaign_id, kind: p.kind, params: p.params, reason, status: 'proposed', source: 'autopilot' })
  return true
}

export type ApplyEnv = { supabase: Supabase; store: PlanStore; ctx: PlanContext; token: string; acc: Account; campaigns: CampaignRow[] }

/**
 * Pune arborii de produse ai campaniilor la zi cu planul (alegerile omului, stocul, pilotul)
 * și cu grupele omului: întâi campaniile grupelor (regulile lor pot prinde produse noi), apoi
 * celelalte, care le lasă produsele afară.
 */
export async function reconcileProducts(env: ApplyEnv): Promise<number> {
  let changed = 0
  const running = env.campaigns.filter(x => x.status === 'active' || x.status === 'paused')
  const ordered = [...running.filter(c => c.product_group_id), ...running.filter(c => !c.product_group_id)]
  for (const c of ordered) {
    const members = c.product_group_id ? groupItems(env.ctx.plan, env.ctx.assigned, c.product_group_id) : null
    try {
      const r = await syncCampaignProducts(env.supabase, env.token, env.acc, c, env.ctx.plan, env.campaigns, env.store.merchant_label_index, members)
      if (!r) continue
      changed++
      // Campaniile de după văd lista nouă
      env.campaigns = env.campaigns.map(x => (x.id === c.id ? { ...x, included_item_ids: r.included ?? x.included_item_ids, excluded_item_ids: r.excluded } : x))
      await logAction(env.supabase, {
        user_id: env.store.user_id, store_id: env.store.id, ad_campaign_id: c.id, kind: 'sync_products', status: 'applied', source: 'autopilot',
        params: r.included ? { included: r.included.length } : { excluded: r.excluded.length },
        reason: r.included
          ? storedMessage('campaigns.reason_sync_group', { count: r.included.length })
          : storedMessage('campaigns.reason_sync_products', { count: r.excluded.length }),
      })
    } catch (err) {
      if (!(err instanceof ApplyError)) throw err
      await logAction(env.supabase, { user_id: env.store.user_id, store_id: env.store.id, ad_campaign_id: c.id, kind: 'sync_products', status: 'failed', source: 'autopilot', error: err.stored })
    }
  }
  return changed
}

/** Aplică o acțiune și o trece în jurnal (aplicată sau eșuată). */
export async function applyAndLog(env: ApplyEnv, kind: ActionKind, campaignId: string | null, params: Record<string, unknown>, opts: { source: 'autopilot' | 'user'; reason?: string | null; actionId?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await applyAction({
      supabase: env.supabase, token: env.token, acc: env.acc, store: env.store, plan: env.ctx.plan, audit: env.ctx.audit?.result ?? null,
      campaigns: env.campaigns, groups: env.ctx.groups, assigned: env.ctx.assigned,
    }, kind, campaignId, params)
    const now = new Date().toISOString()
    if (opts.actionId) await env.supabase.from('ad_actions').update({ status: 'applied', params: result, decided_at: now, applied_at: now }).eq('id', opts.actionId)
    else await logAction(env.supabase, { user_id: env.store.user_id, store_id: env.store.id, ad_campaign_id: campaignId, kind, params: result, reason: opts.reason ?? null, status: 'applied', source: opts.source })
    return { ok: true }
  } catch (err) {
    const error = err instanceof ApplyError ? err.stored
      : err instanceof GoogleAdsApiError ? storedMessage('sync.apply_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) })
      : err instanceof GoogleAuthError ? storedMessage('sync.google_access_revoked')
      : null
    if (error === null) throw err
    const now = new Date().toISOString()
    if (opts.actionId) await env.supabase.from('ad_actions').update({ status: 'failed', error, decided_at: now }).eq('id', opts.actionId)
    else await logAction(env.supabase, { user_id: env.store.user_id, store_id: env.store.id, ad_campaign_id: campaignId, kind, params, reason: opts.reason ?? null, status: 'failed', source: opts.source, error })
    return { ok: false, error }
  }
}

/** Contextul complet pentru a schimba ceva în contul unui magazin (aprobare, pauză, cron). */
export async function loadApplyEnv(supabase: Supabase, storeId: string): Promise<ApplyEnv | { error: string }> {
  const { data: store } = await supabase.from('stores').select(STORE_PLAN_COLUMNS).eq('id', storeId).maybeSingle<PlanStore>()
  if (!store) return { error: storedMessage('sync.store_read_failed') }
  const { context } = await loadPlanContext(supabase, store.user_id, store)
  if (!context || !context.account) return { error: storedMessage('sync.apply_no_account') }
  let token: string
  try {
    token = await getAccessTokenForUser(store.user_id)
  } catch (err) {
    if (err instanceof GoogleAuthError) return { error: storedMessage('sync.google_access_revoked') }
    throw err
  }
  const acc: Account = { customer_id: context.account.customer_id, login_customer_id: context.account.login_customer_id }
  return { supabase, store, ctx: context, token, acc, campaigns: await loadCampaigns(supabase, storeId) }
}

// ─── Trecerea zilnică ───────────────────────────────────────────────────────

export async function runAutopilot(storeId: string, opts: { deadline?: number } = {}): Promise<AutopilotResult> {
  const supabase = createAdminClient()
  const nowMs = Date.now()
  const now = new Date(nowMs)
  const { data: store } = await supabase.from('stores').select(`${STORE_PLAN_COLUMNS}, ads_synced_at`).eq('id', storeId).maybeSingle<PlanStore & { ads_synced_at: string | null }>()
  if (!store) return { ok: false, note: 'no_store' }

  const finish = async (note: string, error: string | null = null) => {
    await supabase.from('stores').update({ ads_synced_at: now.toISOString(), ads_sync_error: error }).eq('id', storeId)
    return { ok: error === null, note }
  }

  const account = await storeAdsAccount(supabase, store.user_id, store.google_ads_customer_id)

  // Merchant Center merge și fără cont Google Ads ales (stările ofertelor ajută și înainte de lansare)
  const { data: auditRow } = await supabase.from('google_audits').select('checked_at, customer_id, result').eq('store_id', storeId).maybeSingle()
  let auditFresh = !!auditRow && nowMs - Date.parse(auditRow.checked_at) < AUDIT_FRESH_MS * 0.8 && auditRow.customer_id === account?.customer_id
  if (account && !auditFresh) {
    await runAudit(supabase, store)
    auditFresh = true
  }

  if (!account) {
    await runMerchant(supabase, store, null)
    return finish('no_account')
  }

  let token: string
  try {
    token = await getAccessTokenForUser(store.user_id)
  } catch (err) {
    if (err instanceof GoogleAuthError) return finish('google_auth', storedMessage('sync.google_access_revoked'))
    throw err
  }
  const acc: Account = { customer_id: account.customer_id, login_customer_id: account.login_customer_id }

  try {
    // 1. Metricile pe zi (campanii și produse), de la ultima trecere, cu suprapunere
    const yesterday = addDays(dayStr(now), -1)
    const from = store.ads_synced_at ? addDays(dayStr(new Date(store.ads_synced_at)), -OVERLAP_DAYS) : addDays(yesterday, -(FIRST_SYNC_DAYS - 1))
    const safeFrom = from > yesterday ? addDays(yesterday, -OVERLAP_DAYS) : from
    const [days, productDays] = await Promise.all([
      fetchCampaignDays(token, acc, safeFrom, yesterday),
      fetchProductDays(token, acc, safeFrom, yesterday),
    ])
    const syncedAt = now.toISOString()
    for (let i = 0; i < days.length; i += 1000) {
      const { error } = await supabase.from('ad_metrics_daily').upsert(days.slice(i, i + 1000).map(d => ({
        store_id: storeId, customer_id: acc.customer_id, google_campaign_id: d.campaign_id, date: d.date,
        campaign_name: d.name, channel_type: d.channel, cost: d.cost, clicks: d.clicks, impressions: d.impressions,
        conversions: d.conversions, conversions_value: d.value, synced_at: syncedAt,
      })), { onConflict: 'store_id,google_campaign_id,date' })
      if (error) throw new Error(`ad_metrics_daily: ${error.message}`)
    }
    for (let i = 0; i < productDays.length; i += 1000) {
      const { error } = await supabase.from('ad_product_metrics_daily').upsert(productDays.slice(i, i + 1000).map(d => ({
        store_id: storeId, google_campaign_id: d.campaign_id, date: d.date, item_id: d.item_id,
        cost: d.cost, clicks: d.clicks, impressions: d.impressions, conversions: d.conversions, conversions_value: d.value,
      })), { onConflict: 'store_id,google_campaign_id,date,item_id' })
      if (error) throw new Error(`ad_product_metrics_daily: ${error.message}`)
    }

    // 2. Campaniile Hontrio: starea din Google (omul le poate opri sau schimba și din Google Ads)
    let campaigns = await loadCampaigns(supabase, storeId)
    if (campaigns.length) {
      const states = await fetchCampaignStates(token, acc, campaigns.map(c => c.google_campaign_id!))
      const ended: CampaignRow[] = []
      for (const s of states) {
        const c = campaigns.find(x => x.google_campaign_id === s.id)
        if (!c) continue
        const patch: Record<string, unknown> = {}
        if (s.status === 'REMOVED') patch.status = 'removed'
        // Perioada aleasă de om s-a încheiat: Google a oprit-o singur
        else if (s.primary_status === 'ENDED') { patch.status = 'ended'; patch.paused_reason = 'scheduled'; ended.push(c) }
        else if (s.status === 'PAUSED' && c.status === 'active') { patch.status = 'paused'; patch.paused_reason = 'google' }
        else if (s.status === 'ENABLED' && c.status === 'paused') { patch.status = 'active'; patch.paused_reason = null; patch.loss_check_from = syncedAt }
        if (s.target_roas !== null && c.target_roas !== null && Math.abs(s.target_roas - c.target_roas) >= 0.05) { patch.target_roas = s.target_roas; patch.target_changed_at = syncedAt }
        if (s.budget !== null && c.daily_budget !== null && Math.abs(s.budget - c.daily_budget) >= 0.01) { patch.daily_budget = s.budget; patch.budget_changed_at = syncedAt }
        patch.last_synced_at = syncedAt
        await supabase.from('ad_campaigns').update(patch).eq('id', c.id)
      }
      for (const c of ended) {
        if (c.product_group_id) await closeGroupIfDone(supabase, c.product_group_id, syncedAt)
        await logAction(supabase, {
          user_id: store.user_id, store_id: storeId, ad_campaign_id: c.id, kind: 'end', status: 'applied', source: 'autopilot',
          params: { scheduled: true }, reason: storedMessage('campaigns.reason_end_scheduled'),
        })
      }
      campaigns = await loadCampaigns(supabase, storeId)
    }
    const google = new Map<string, { reasons: string[]; recommended_budget: number | null }>()
    if (campaigns.length) {
      for (const s of await fetchCampaignStates(token, acc, campaigns.map(c => c.google_campaign_id!))) google.set(s.id, { reasons: s.reasons, recommended_budget: s.recommended_budget })
    }

    // 3. Termenii de căutare ai campaniilor noastre (30 de zile)
    const live = campaigns.filter(c => c.status === 'active')
    if (live.length) {
      const termFrom = addDays(yesterday, -29)
      const terms = await fetchSearchTerms(token, acc, live.map(c => ({ id: c.google_campaign_id!, type: c.type })), termFrom, yesterday)
      await supabase.from('ad_search_terms').delete().eq('store_id', storeId)
      for (let i = 0; i < terms.length; i += 1000) {
        await supabase.from('ad_search_terms').insert(terms.slice(i, i + 1000).map(t => ({
          store_id: storeId, google_campaign_id: t.campaign_id, search_term: t.term.slice(0, 500), clicks: t.clicks,
          impressions: t.impressions, cost: t.cost, conversions: t.conversions, conversions_value: t.value,
          period_start: termFrom, period_end: yesterday,
        })))
      }
    }

    // 4. Merchant Center (stări, piață), apoi planul pe datele proaspete
    let { context } = await loadPlanContext(supabase, store.user_id, store)
    if (!context) return finish('no_plan')
    await runMerchant(supabase, store, context)
    ;({ context } = await loadPlanContext(supabase, store.user_id, store))
    if (!context) return finish('no_plan')
    if (opts.deadline && Date.now() > opts.deadline) return finish('deadline')

    const env: ApplyEnv = { supabase, store, ctx: context, token, acc, campaigns }

    // Perioada unei grupe s-a încheiat, dar campania încă rulează (data schimbată după lansare): o încheiem noi
    const today = context.today
    const expired = new Set(context.groups.filter(g => g.status === 'live' && g.ends_on && g.ends_on < today).map(g => g.id))
    const overdue = campaigns.filter(c => c.product_group_id && expired.has(c.product_group_id))
    for (const c of overdue) {
      await applyAndLog(env, 'end', c.id, { scheduled: true }, { source: 'autopilot', reason: storedMessage('campaigns.reason_end_scheduled') })
    }
    if (overdue.length) {
      ;({ context } = await loadPlanContext(supabase, store.user_id, store))
      if (!context) return finish('no_plan')
      env.ctx = context
      campaigns = await loadCampaigns(supabase, storeId)
      env.campaigns = campaigns
    }

    // 5. Bucla de optimizare
    await supabase.from('ad_actions').update({ status: 'expired', decided_at: syncedAt })
      .eq('store_id', storeId).eq('status', 'proposed').lt('created_at', new Date(nowMs - PROPOSAL_TTL_DAYS * DAY).toISOString())
    await supabase.from('ad_actions').update({ status: 'expired', decided_at: syncedAt })
      .eq('store_id', storeId).eq('status', 'proposed').in('kind', RETIRED_KINDS)

    let proposedNew = 0
    let applied = 0
    const mode = context.draft.mode
    if (campaigns.length) {
      const proposals = optimize(await optimizerInput(supabase, store, context, campaigns, google, yesterday, nowMs))
      for (const p of proposals) {
        const auto = p.protective || (mode === 'auto' && !p.needs_approval)
        if (!auto) { if (await propose(supabase, store, p)) proposedNew++; continue }
        const r = await applyAndLog(env, p.kind, p.campaign_id, p.params, { source: 'autopilot', reason: storedMessage(p.reason.key, p.reason.params) })
        if (r.ok) {
          applied++
          if (p.kind === 'pause_loss_limit') {
            await notify(supabase, store.user_id, 'warning', storedMessage('notifications.loss_limit_title'), storedMessage(p.reason.key, p.reason.params))
          }
        }
      }
      // Produsele scoase de pilot schimbă planul: arborii se refac pe planul nou
      if (applied) {
        ;({ context } = await loadPlanContext(supabase, store.user_id, store))
        if (context) env.ctx = context
        env.campaigns = await loadCampaigns(supabase, storeId)
      }
      await reconcileProducts(env)
    }

    if (proposedNew) {
      await notify(supabase, store.user_id, 'info', storedMessage('notifications.proposals_title'), storedMessage('notifications.proposals_body', { count: proposedNew }))
    } else if (applied && mode === 'auto') {
      await notify(supabase, store.user_id, 'info', storedMessage('notifications.applied_title'), storedMessage('notifications.applied_body', { count: applied }))
    }
    // i18n-ignore: rezumat tehnic pentru jurnalul cronului
    return finish(`ok days=${days.length} products=${productDays.length} proposed=${proposedNew} applied=${applied}`)
  } catch (err) {
    if (err instanceof GoogleAdsApiError) {
      logError('autopilot', 'Google Ads API a refuzat trecerea', { storeId, code: err.errorCode, error: err.message })
      return finish('google_error', storedMessage('sync.autopilot_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) }))
    }
    if (err instanceof GoogleAuthError) return finish('google_auth', storedMessage('sync.google_access_revoked'))
    throw err
  }
}

async function runMerchant(supabase: Supabase, store: PlanStore, context: PlanContext | null) {
  // Eticheta Hontrio doar când arborele filtrează după ea (cataloage peste limita listei de ID-uri)
  const labels = context?.plan.exclusions.mode === 'label'
    ? new Map(context.plan.offers.filter(o => o.reason && CAMPAIGN_EXCLUSIONS.includes(o.reason)).map(o => [o.offer_id, EXCLUDE_LABEL]))
    : null
  try {
    await syncMerchant(store.id, { auditMerchantId: context?.audit?.result?.merchant_id ?? null, labels })
  } catch (err) {
    logError('autopilot', 'Sincronizarea Merchant Center a eșuat', { storeId: store.id, error: err instanceof Error ? err.message : String(err) })
  }
}

/** Datele pentru buclă: ferestrele de metrici pe campanie și pe produs, termenii, istoricul deciziilor. */
async function optimizerInput(supabase: Supabase, store: PlanStore, ctx: PlanContext, campaigns: CampaignRow[], google: Map<string, { reasons: string[]; recommended_budget: number | null }>, yesterday: string, nowMs: number) {
  const plan = ctx.plan
  const storeId = store.id
  const ids = campaigns.map(c => c.google_campaign_id!)
  const since = addDays(yesterday, -45)
  const [dailyRes, productRes, termRes, journalRes] = await Promise.all([
    supabase.from('ad_metrics_daily').select('google_campaign_id, date, cost, clicks, conversions, conversions_value').eq('store_id', storeId).in('google_campaign_id', ids).gte('date', since),
    supabase.from('ad_product_metrics_daily').select('google_campaign_id, date, item_id, cost, clicks, conversions, conversions_value').eq('store_id', storeId).in('google_campaign_id', ids).gte('date', addDays(yesterday, -31)),
    supabase.from('ad_search_terms').select('google_campaign_id, search_term, cost, conversions, clicks').eq('store_id', storeId).in('google_campaign_id', ids),
    supabase.from('ad_actions').select('kind, status, params, ad_campaign_id, created_at').eq('store_id', storeId).gte('created_at', new Date(nowMs - 365 * DAY).toISOString()),
  ])
  const toDay = (r: { date: string; cost: unknown; clicks: unknown; conversions: unknown; conversions_value: unknown }) => ({
    date: r.date, cost: Number(r.cost) || 0, clicks: Number(r.clicks) || 0, conversions: Number(r.conversions) || 0, value: Number(r.conversions_value) || 0,
  })
  const evalTo = addDays(yesterday, -2)
  const evalFrom = addDays(evalTo, -29)
  const recentFrom = addDays(yesterday, -13)

  const optCampaigns: OptCampaign[] = campaigns.map(c => {
    const rows = (dailyRes.data ?? []).filter(r => r.google_campaign_id === c.google_campaign_id).map(toDay)
    const lossFrom = (c.loss_check_from ?? c.launched_at ?? since).slice(0, 10)
    return {
      id: c.id,
      google_campaign_id: c.google_campaign_id!,
      type: c.type,
      stage: c.stage ?? 'growth',
      segment: c.segment ?? 'all',
      status: c.status === 'active' ? 'active' : 'paused',
      days_live: daysSince(c.launched_at, nowMs) ?? 0,
      daily_budget: c.daily_budget ?? 0,
      group: !!c.product_group_id,
      days_since_budget_change: daysSince(c.budget_changed_at, nowMs),
      google: google.get(c.google_campaign_id!) ?? null,
      since_loss_check: windowOf(rows, lossFrom, yesterday),
      eval30: windowOf(rows, evalFrom, evalTo),
      recent14: windowOf(rows, recentFrom, yesterday),
    }
  })

  // Produsele: cât au cheltuit și adus în campaniile noastre, în fereastra de evaluare
  const byItem = new Map<string, Window>()
  for (const r of productRes.data ?? []) {
    if (r.date < evalFrom || r.date > evalTo) continue
    const d = toDay(r)
    const prev = byItem.get(r.item_id) ?? EMPTY
    byItem.set(r.item_id, sumWindows([prev, d]))
  }
  const longest = Math.max(0, ...optCampaigns.map(c => c.days_live))
  const products: OptProduct[] = plan.offers.filter(o => o.item_id && byItem.has(normalizeItemId(o.item_id))).map(o => ({
    item_id: normalizeItemId(o.item_id!),
    offer_id: o.offer_id,
    title: o.variant_title ? `${o.title} · ${o.variant_title}` : o.title,
    price: o.price,
    included_by_user: o.mode === 'include',
    // Produsele grupelor rulează, în campaniile lor: pilotul le judecă la fel
    excluded: o.reason !== null && o.reason !== 'in_group',
    window: byItem.get(normalizeItemId(o.item_id!))!,
    days: longest,
  }))

  const rowOf = new Map(campaigns.map(c => [c.google_campaign_id!, c.id]))
  const searchTerms = (termRes.data ?? []).filter(t => rowOf.has(t.google_campaign_id)).map(t => ({
    campaign_id: rowOf.get(t.google_campaign_id)!, term: t.search_term, cost: Number(t.cost) || 0, conversions: Number(t.conversions) || 0, clicks: Number(t.clicks) || 0,
  }))

  // Ce s-a hotărât deja: negativele puse, ce a respins omul (30 de zile)
  const journal = journalRes.data ?? []
  const negatives = new Map<string, Set<string>>()
  const rejected = { items: new Set<string>(), terms: new Set<string>(), kinds: new Set<string>() }
  const recent = nowMs - 30 * DAY
  for (const a of journal) {
    const params = (a.params ?? {}) as { terms?: { term: string }[]; products?: { item_id: string }[] }
    if (a.kind === 'add_negatives' && a.status === 'applied' && a.ad_campaign_id) {
      const set = negatives.get(a.ad_campaign_id) ?? new Set<string>()
      for (const t of params.terms ?? []) set.add(t.term.toLowerCase())
      negatives.set(a.ad_campaign_id, set)
    }
    if (a.status === 'rejected' && Date.parse(a.created_at) >= recent) {
      for (const t of params.terms ?? []) rejected.terms.add(t.term.toLowerCase())
      for (const p of params.products ?? []) rejected.items.add(normalizeItemId(p.item_id))
      rejected.kinds.add(a.kind)
    }
  }
  return {
    economics: { aov: plan.economics.aov },
    account: { conversions30: ctx.audit?.result?.history.conversions30 ?? 0 },
    max_daily_budget: ctx.draft.max_daily_budget,
    loss_limit: plan.structure.loss_limit,
    campaigns: optCampaigns,
    products,
    searchTerms,
    negatives,
    brand: brandTerms(store.store_name, store.store_url),
    rejected,
  }
}

