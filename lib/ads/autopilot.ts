import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { storeAdsAccount } from '@/lib/google/accounts'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import { normalizeItemId, MAX_LISTING_ITEMS } from '@/lib/google/operations'
import { fetchCampaignDays, fetchCampaignStates, fetchProductDays, fetchSearchTerms, type CampaignDay, type CampaignState, type ProductDay } from '@/lib/google/reporting'
import type { Account } from '@/lib/google/launch'
import { AUDIT_FRESH_MS, purchaseConversions30 } from '@/lib/google/audit'
import { runAudit } from '@/lib/ads/audit-run'
import { logAction, notify, type ActionKind } from '@/lib/ads/journal'
import { applyAction, ApplyError, closeGroupIfDone, graduateListing, syncCampaignProducts } from '@/lib/ads/apply'
import { CAMPAIGN_COLUMNS, groupItems, listingSize, merchantLabels, parseCampaign, type CampaignRow } from '@/lib/ads/listing'
import { lossStops, optimize, sumWindows, windowOf, EMPTY, type OptCampaign, type OptimizerInput, type OptProduct, type Proposal, type Window } from '@/lib/ads/optimizer'
import { readAll } from '@/lib/ads/read-all'
import { addDays, dayStr, daysBetween, isTransientGoogleError, refreshFrom, DAY_MS, MISSED_PASS_MS, PROPOSAL_TTL_DAYS } from '@/lib/ads/schedule'
import { alertBudgetSpent, alertLossStop, alertPilotBlocked, alertProposals, alertProtectionFailed } from '@/lib/ads/alerts'
import { loadPlanContext, STORE_PLAN_COLUMNS, type PlanContext, type PlanStore } from '@/lib/campaigns/context'
import { brandTerms } from '@/lib/campaigns/plan'
import { syncMerchant, type MerchantLabels } from '@/lib/merchant/sync'

// =============================================
// Pilotul, o trecere pe magazin (cronul, o dată pe zi pe magazin):
//   1. protecția întâi: cifrele campaniilor din Google, starea lor și oprirea
//      de siguranță (§5), ca nimic de după să n-o poată întârzia;
//   2. restul datelor: auditul contului, cifrele pe produs, termenii de
//      căutare, Merchant Center;
//   3. bucla de optimizare (§6): ce propune se aplică singur în modul automat
//      (bugetul, niciodată), altfel așteaptă aprobarea omului; apoi arborii
//      de produse se pun la zi cu planul.
// O eroare care trece singură (Google ocupat, limită de cereri) se reia la
// ora următoare; una care rămâne se scrie pe magazin (pagina Campanii o
// arată), iar omul află, o dată, că pilotul nu-i poate proteja campaniile.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>
/** Magazinul, cu ultima trecere a pilotului și eroarea ei. */
type PilotStore = PlanStore & { ads_synced_at: string | null; ads_sync_error: string | null }

/** Felurile de propuneri de când Hontrio lucra cu marje (ținta, împărțirea): nu se mai aplică. */
const RETIRED_KINDS = ['set_target', 'segment']

const daysSince = (iso: string | null, now: number) => (iso ? Math.floor((now - Date.parse(iso)) / DAY_MS) : null)

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

/**
 * Etichetele Hontrio de ținut în Merchant Center, după campaniile care rulează (lib/ads/listing.ts): aceeași
 * regulă pentru pilot și pentru butonul din Setări. Fără plan (citirea a eșuat), etichetele rămân cum sunt.
 */
export async function labelsForStore(supabase: Supabase, store: PlanStore, context?: PlanContext | null, campaigns?: CampaignRow[] | null): Promise<MerchantLabels> {
  const ctx = context ?? (await loadPlanContext(supabase, store.user_id, store)).context
  if (!ctx) return 'keep'
  return merchantLabels(ctx.plan, campaigns ?? await loadCampaigns(supabase, store.id), store.merchant_label_index)
}

// ─── Trecerea zilnică ───────────────────────────────────────────────────────

/**
 * `deadline`: până când are voie să lucreze (cronul are 300 de secunde pentru toate magazinele).
 * `first`: magazinul e primul din rularea cronului; dacă nici așa nu încape, trecerea lui se socotește
 * făcută (oprirea de siguranță a rulat), ca să nu se reia la nesfârșit în fiecare oră.
 */
export async function runAutopilot(storeId: string, opts: { deadline?: number; first?: boolean } = {}): Promise<AutopilotResult> {
  const supabase = createAdminClient()
  const nowMs = Date.now()
  const now = new Date(nowMs)
  const { data: store } = await supabase.from('stores').select(`${STORE_PLAN_COLUMNS}, ads_synced_at, ads_sync_error`).eq('id', storeId).maybeSingle<PilotStore>()
  if (!store) return { ok: false, note: 'no_store' }
  const storeName = store.store_name || store.store_url

  /** Trecerea zilei s-a făcut (și cu o eroare care nu trece singură): următoarea, peste ~20 de ore. */
  const finish = async (note: string, error: string | null = null) => {
    await supabase.from('stores').update({ ads_synced_at: now.toISOString(), ads_sync_error: error }).eq('id', storeId)
    return { ok: error === null, note }
  }
  /** Trecerea se reia la ora următoare (cronul ia întâi magazinele netrecute de cel mai mult timp). */
  const retry = async (note: string, error: string | null) => {
    if (error !== null) await supabase.from('stores').update({ ads_sync_error: error }).eq('id', storeId)
    return { ok: false, note }
  }
  /**
   * Pilotul n-a putut citi contul: eroarea rămâne pe magazin (pagina Campanii o arată), iar omul află, o dată
   * pe întâmplare, că oprirea de siguranță n-a rulat. O oră pierdută nu contează (oprirea rulează o dată pe zi);
   * o zi întreagă, da.
   */
  const blocked = async (note: string, error: string, transient: boolean) => {
    const lastPass = store.ads_synced_at
    if (!transient || !lastPass || nowMs - Date.parse(lastPass) >= MISSED_PASS_MS) {
      const { data: live } = await supabase.from('ad_campaigns').select('id').eq('store_id', storeId).eq('status', 'active').not('google_campaign_id', 'is', null).limit(1)
      if (live?.length) await alertPilotBlocked(supabase, store.user_id, storeName, lastPass ?? new Date(nowMs - 7 * DAY_MS).toISOString())
    }
    return transient ? retry(note, error) : finish(note, error)
  }

  const account = await storeAdsAccount(supabase, store.user_id, store.google_ads_customer_id)
  // Merchant Center merge și fără cont Google Ads ales (stările ofertelor ajută și înainte de lansare)
  if (!account) {
    await runMerchant(supabase, store, null, null, opts.deadline)
    return finish('no_account')
  }

  let token: string
  try {
    token = await getAccessTokenForUser(store.user_id)
  } catch (err) {
    if (!(err instanceof GoogleAuthError)) throw err
    // Accesul retras: omul a aflat chiar atunci (lib/google/oauth.ts), iar cronul nu mai trece pe aici până la reconectare
    if (err.code === 'invalid_grant') return finish('google_auth', storedMessage('sync.google_access_revoked'))
    return blocked('google_auth', storedMessage('campaigns.pilot_error_token', { code: err.code }), true)
  }
  const acc: Account = { customer_id: account.customer_id, login_customer_id: account.login_customer_id }
  const yesterday = addDays(dayStr(now), -1)
  // Cel puțin ultimele 33 de zile, la fiecare trecere: o vânzare raportată târziu ajunge pe ziua clicului
  const from = refreshFrom(store.ads_synced_at, yesterday)
  const syncedAt = now.toISOString()

  try {
    // ── 1. Protecția întâi: cifrele campaniilor, starea lor din Google, oprirea de siguranță ──
    const days = await fetchCampaignDays(token, acc, from, yesterday)
    await saveCampaignDays(supabase, storeId, acc, days, syncedAt)

    let campaigns = await loadCampaigns(supabase, storeId)
    const google = new Map<string, CampaignState>()
    if (campaigns.length) {
      const states = await fetchCampaignStates(token, acc, campaigns.map(c => c.google_campaign_id!))
      for (const s of states) google.set(s.id, s)
      await syncStates(supabase, store, campaigns, states, syncedAt)
      campaigns = await loadCampaigns(supabase, storeId)
    }

    let { context } = await loadPlanContext(supabase, store.user_id, store)
    if (!context) return retry('no_plan', null)
    const env: ApplyEnv = { supabase, store, ctx: context, token, acc, campaigns }

    const flagged = new Set<string>()
    const stops = lossStops(await campaignInputs(supabase, store, context, campaigns, google, yesterday, nowMs), context.plan.structure.loss_limit)
    for (const p of stops) {
      flagged.add(p.campaign_id!)
      await protect(env, p, storeName)
    }
    if (flagged.size) env.campaigns = campaigns = await loadCampaigns(supabase, storeId)

    // ── 2. Restul datelor zilei: auditul, cifrele pe produs, termenii de căutare, Merchant Center ──
    const { data: auditRow } = await supabase.from('google_audits').select('checked_at, customer_id').eq('store_id', storeId).maybeSingle()
    const auditFresh = !!auditRow && nowMs - Date.parse(auditRow.checked_at) < AUDIT_FRESH_MS * 0.8 && auditRow.customer_id === account.customer_id
    if (!auditFresh) await runAudit(supabase, store)

    // Contul fără buget: campaniile noastre sunt pornite, dar Google nu le arată, iar doar omul poate adăuga bani
    if (campaigns.some(c => c.status === 'active')) {
      const { data: latest } = await supabase.from('google_audits').select('result').eq('store_id', storeId).maybeSingle()
      const checks = (latest?.result as { checks?: { id?: string }[] } | null)?.checks ?? []
      if (checks.some(c => c.id === 'account_budget_spent')) await alertBudgetSpent(supabase, store.user_id, storeName)
    }

    const productDays = await fetchProductDays(token, acc, from, yesterday)
    await saveProductDays(supabase, storeId, productDays)

    // Termenii de căutare ai campaniilor noastre (30 de zile), înlocuiți la fiecare trecere
    const live = campaigns.filter(c => c.status === 'active')
    if (live.length) {
      const termFrom = addDays(yesterday, -29)
      const terms = await fetchSearchTerms(token, acc, live.map(c => ({ id: c.google_campaign_id!, type: c.type })), termFrom, yesterday)
      await supabase.from('ad_search_terms').delete().eq('store_id', storeId)
      for (let i = 0; i < terms.length; i += 1000) {
        const { error } = await supabase.from('ad_search_terms').insert(terms.slice(i, i + 1000).map(t => ({
          store_id: storeId, google_campaign_id: t.campaign_id, search_term: t.term.slice(0, 500), clicks: t.clicks,
          impressions: t.impressions, cost: t.cost, conversions: t.conversions, conversions_value: t.value,
          period_start: termFrom, period_end: yesterday,
        })))
        if (error) logError('autopilot', 'Termenii de căutare nu s-au salvat', { storeId, error: error.message })
      }
    }

    await runMerchant(supabase, store, context, campaigns, opts.deadline)
    ;({ context } = await loadPlanContext(supabase, store.user_id, store))
    if (!context) return retry('no_plan', null)
    env.ctx = context
    if (opts.deadline && Date.now() > opts.deadline) {
      // Oprirea de siguranță a rulat; bucla se reia la ora următoare
      return opts.first ? finish('deadline_full') : retry('deadline', null)
    }

    // Perioada unei grupe s-a încheiat, dar campania încă rulează (data schimbată după lansare): o încheiem noi
    const today = context.today
    const expired = new Set(context.groups.filter(g => g.status === 'live' && g.ends_on && g.ends_on < today).map(g => g.id))
    const overdue = campaigns.filter(c => c.product_group_id && expired.has(c.product_group_id))
    for (const c of overdue) {
      await applyAndLog(env, 'end', c.id, { scheduled: true }, { source: 'autopilot', reason: storedMessage('campaigns.reason_end_scheduled') })
    }
    if (overdue.length) {
      ;({ context } = await loadPlanContext(supabase, store.user_id, store))
      if (!context) return retry('no_plan', null)
      env.ctx = context
      env.campaigns = campaigns = await loadCampaigns(supabase, storeId)
    }

    // ── 3. Bucla de optimizare ─────────────────────────────────────────────
    await supabase.from('ad_actions').update({ status: 'expired', decided_at: syncedAt })
      .eq('store_id', storeId).eq('status', 'proposed').lt('created_at', new Date(nowMs - PROPOSAL_TTL_DAYS * DAY_MS).toISOString())
    await supabase.from('ad_actions').update({ status: 'expired', decided_at: syncedAt })
      .eq('store_id', storeId).eq('status', 'proposed').in('kind', RETIRED_KINDS)

    let proposedNew = 0
    let applied = 0
    const mode = context.draft.mode
    if (campaigns.length) {
      const input = await optimizerInput(supabase, store, context, campaigns, google, yesterday, nowMs)
      // Ce a judecat deja oprirea de siguranță (oprită sau cu oprirea eșuată) nu mai primește nimic azi
      const proposals = optimize({ ...input, skip: flagged })
      for (const p of proposals) {
        if (p.kind === 'pause_loss_limit') { await protect(env, p, storeName); continue }
        const auto = p.protective || (mode === 'auto' && !p.needs_approval)
        if (!auto) { if (await propose(supabase, store, p)) proposedNew++; continue }
        const r = await applyAndLog(env, p.kind, p.campaign_id, p.params, { source: 'autopilot', reason: storedMessage(p.reason.key, p.reason.params) })
        if (r.ok) applied++
      }
      // Produsele scoase de pilot și campaniile trecute la PMax schimbă planul: arborii se refac pe planul nou
      if (applied) {
        ;({ context } = await loadPlanContext(supabase, store.user_id, store))
        if (context) env.ctx = context
        env.campaigns = await loadCampaigns(supabase, storeId)
      }
      await reconcileProducts(env)
    }

    if (proposedNew) await alertProposals(supabase, store.user_id, storeName, proposedNew)
    if (applied && mode === 'auto') {
      await notify(supabase, store.user_id, 'info', storedMessage('notifications.applied_title'), storedMessage('notifications.applied_body', { count: applied }))
    }
    // i18n-ignore: rezumat tehnic pentru jurnalul cronului
    return finish(`ok days=${days.length} products=${productDays.length} stopped=${flagged.size} proposed=${proposedNew} applied=${applied}`)
  } catch (err) {
    if (err instanceof GoogleAdsApiError) {
      logError('autopilot', 'Google Ads API a refuzat trecerea', { storeId, code: err.errorCode, error: err.message })
      const error = storedMessage('sync.autopilot_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) })
      return blocked('google_error', error, isTransientGoogleError(err))
    }
    if (err instanceof GoogleAuthError) {
      if (err.code === 'invalid_grant') return finish('google_auth', storedMessage('sync.google_access_revoked'))
      return blocked('google_auth', storedMessage('campaigns.pilot_error_token', { code: err.code }), true)
    }
    throw err
  }
}

/**
 * Oprirea de siguranță pe o campanie: protecție, se aplică în ambele moduri. Omul află mereu, fie că
 * campania s-a oprit, fie că Google a refuzat oprirea (atunci campania pierde mai departe).
 */
async function protect(env: ApplyEnv, p: Proposal, storeName: string) {
  const c = env.campaigns.find(x => x.id === p.campaign_id)
  const r = await applyAndLog(env, 'pause_loss_limit', p.campaign_id, p.params, { source: 'autopilot', reason: storedMessage(p.reason.key, p.reason.params) })
  const campaign = c?.name || c?.google_campaign_id || ''
  if (r.ok) {
    await alertLossStop(env.supabase, env.store.user_id, {
      store: storeName, campaign, spend: Number(p.params.spend) || 0, currency: c?.currency || env.ctx.plan.campaign.currency, reason: p.reason,
    })
  } else {
    await alertProtectionFailed(env.supabase, env.store.user_id, { store: storeName, campaign })
  }
}

async function saveCampaignDays(supabase: Supabase, storeId: string, acc: Account, days: CampaignDay[], syncedAt: string) {
  for (let i = 0; i < days.length; i += 1000) {
    const { error } = await supabase.from('ad_metrics_daily').upsert(days.slice(i, i + 1000).map(d => ({
      store_id: storeId, customer_id: acc.customer_id, google_campaign_id: d.campaign_id, date: d.date,
      campaign_name: d.name, channel_type: d.channel, cost: d.cost, clicks: d.clicks, impressions: d.impressions,
      conversions: d.conversions, conversions_value: d.value, synced_at: syncedAt,
    })), { onConflict: 'store_id,google_campaign_id,date' })
    if (error) throw new Error(`ad_metrics_daily: ${error.message}`)
  }
}

async function saveProductDays(supabase: Supabase, storeId: string, rows: ProductDay[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await supabase.from('ad_product_metrics_daily').upsert(rows.slice(i, i + 1000).map(d => ({
      store_id: storeId, google_campaign_id: d.campaign_id, date: d.date, item_id: d.item_id,
      cost: d.cost, clicks: d.clicks, impressions: d.impressions, conversions: d.conversions, conversions_value: d.value,
    })), { onConflict: 'store_id,google_campaign_id,date,item_id' })
    if (error) throw new Error(`ad_product_metrics_daily: ${error.message}`)
  }
}

/** Campaniile Hontrio: starea din Google (omul le poate opri sau schimba și din Google Ads). */
async function syncStates(supabase: Supabase, store: PlanStore, campaigns: CampaignRow[], states: CampaignState[], syncedAt: string) {
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
    // Ținta unei campanii vechi (de dinainte să renunțăm la marje) rămâne a lui Google: doar o urmărim
    if (s.target_roas !== null && c.target_roas !== null && Math.abs(s.target_roas - c.target_roas) >= 0.05) { patch.target_roas = s.target_roas; patch.target_changed_at = syncedAt }
    if (s.budget !== null && c.daily_budget !== null && Math.abs(s.budget - c.daily_budget) >= 0.01) { patch.daily_budget = s.budget; patch.budget_changed_at = syncedAt }
    patch.last_synced_at = syncedAt
    await supabase.from('ad_campaigns').update(patch).eq('id', c.id)
  }
  for (const c of ended) {
    if (c.product_group_id) await closeGroupIfDone(supabase, c.product_group_id, syncedAt)
    await logAction(supabase, {
      user_id: store.user_id, store_id: store.id, ad_campaign_id: c.id, kind: 'end', status: 'applied', source: 'autopilot',
      params: { scheduled: true }, reason: storedMessage('campaigns.reason_end_scheduled'),
    })
  }
}

async function runMerchant(supabase: Supabase, store: PlanStore, context: PlanContext | null, campaigns: CampaignRow[] | null, deadline?: number) {
  try {
    // Eticheta Hontrio doar cât timp un arbore filtrează după ea (cataloage peste limita listei de ID-uri)
    const labels = await labelsForStore(supabase, store, context, campaigns)
    await syncMerchant(store.id, { auditMerchantId: context?.audit?.result?.merchant_id ?? null, labels, deadline })
  } catch (err) {
    logError('autopilot', 'Sincronizarea Merchant Center a eșuat', { storeId: store.id, error: err instanceof Error ? err.message : String(err) })
  }
}

type DayRow = { google_campaign_id: string; date: string; cost: unknown; clicks: unknown; conversions: unknown; conversions_value: unknown }
const toDay = (r: { date: string; cost: unknown; clicks: unknown; conversions: unknown; conversions_value: unknown }) => ({
  date: r.date, cost: Number(r.cost) || 0, clicks: Number(r.clicks) || 0, conversions: Number(r.conversions) || 0, value: Number(r.conversions_value) || 0,
})

/**
 * Campaniile, cum le vede bucla: ferestrele de cifre (de la lansare sau ultima repornire pentru oprirea de
 * siguranță, oricât de demult; 30 de zile fără ultimele 2; ultimele 14), limita de pierdere a fiecăreia
 * (a grupei, din comanda medie a produselor ei) și dacă pornirea ar încăpea ca Performance Max.
 */
async function campaignInputs(supabase: Supabase, store: PlanStore, ctx: PlanContext, campaigns: CampaignRow[], google: Map<string, CampaignState>, yesterday: string, nowMs: number): Promise<OptCampaign[]> {
  if (!campaigns.length) return []
  const evalTo = addDays(yesterday, -2)
  const evalFrom = addDays(evalTo, -29)
  const recentFrom = addDays(yesterday, -13)
  const lossFromOf = (c: CampaignRow) => (c.loss_check_from ?? c.launched_at ?? evalFrom).slice(0, 10)
  const since = campaigns.map(lossFromOf).reduce((a, b) => (b < a ? b : a), evalFrom < recentFrom ? evalFrom : recentFrom)
  const rows = await readAll<DayRow>((a, b) => supabase.from('ad_metrics_daily')
    .select('google_campaign_id, date, cost, clicks, conversions, conversions_value')
    .eq('store_id', store.id).in('google_campaign_id', campaigns.map(c => c.google_campaign_id!)).gte('date', since).lte('date', yesterday)
    .order('google_campaign_id').order('date').range(a, b))
  const byCampaign = new Map<string, ReturnType<typeof toDay>[]>()
  for (const r of rows) {
    const list = byCampaign.get(r.google_campaign_id)
    if (list) list.push(toDay(r))
    else byCampaign.set(r.google_campaign_id, [toDay(r)])
  }

  const groupLimit = new Map(ctx.groupPlans.map(p => [p.group.id, p.loss_limit]))
  return campaigns.map(c => {
    const own = byCampaign.get(c.google_campaign_id!) ?? []
    const state = google.get(c.google_campaign_id!)
    const opt: OptCampaign = {
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
      google: state ? { reasons: state.reasons, recommended_budget: state.recommended_budget } : null,
      since_loss_check: windowOf(own, lossFromOf(c), yesterday),
      eval30: windowOf(own, evalFrom, evalTo),
      recent14: windowOf(own, recentFrom, yesterday),
    }
    // Campania unei grupe: oprirea de siguranță din comanda medie a produselor ei (§13)
    if (c.product_group_id && groupLimit.has(c.product_group_id)) opt.loss_limit = groupLimit.get(c.product_group_id)!
    // Performance Max duce cel mult 1.000 de filtre pe grup: altfel pornirea rămâne pornire
    if (c.stage === 'starter') opt.can_graduate = listingSize(graduateListing(c, ctx.plan, campaigns, store.merchant_label_index, ctx.assigned).listing) <= MAX_LISTING_ITEMS
    return opt
  })
}

/** Datele pentru buclă: campaniile, cifrele pe produs, termenii, istoricul deciziilor. */
async function optimizerInput(supabase: Supabase, store: PlanStore, ctx: PlanContext, campaigns: CampaignRow[], google: Map<string, CampaignState>, yesterday: string, nowMs: number): Promise<OptimizerInput> {
  const plan = ctx.plan
  const storeId = store.id
  const ids = campaigns.map(c => c.google_campaign_id!)
  const evalTo = addDays(yesterday, -2)
  const evalFrom = addDays(evalTo, -29)
  const productFrom = addDays(yesterday, -31)
  const aov = plan.economics.aov
  const liveIds = campaigns.filter(c => c.status === 'active').map(c => c.google_campaign_id!)
  const recentIso = new Date(nowMs - 30 * DAY_MS).toISOString()

  type ProductRow = DayRow & { item_id: string }
  type TermRow = { google_campaign_id: string; search_term: string; cost: unknown; conversions: unknown; clicks: unknown }
  type ActionRow = { kind: string; params: unknown; ad_campaign_id: string | null }
  const [optCampaigns, productRows, termRows, appliedNegatives, rejectedRows] = await Promise.all([
    campaignInputs(supabase, store, ctx, campaigns, google, yesterday, nowMs),
    readAll<ProductRow>((a, b) => supabase.from('ad_product_metrics_daily')
      .select('google_campaign_id, date, item_id, cost, clicks, conversions, conversions_value')
      .eq('store_id', storeId).in('google_campaign_id', ids).gte('date', productFrom).lte('date', yesterday)
      .order('item_id').order('date').order('google_campaign_id').range(a, b)),
    // Doar termenii care pot deveni negativi: fără vânzări și cu cost de cel puțin o comandă medie
    aov !== null && aov > 0 && liveIds.length
      ? readAll<TermRow>((a, b) => supabase.from('ad_search_terms')
        .select('google_campaign_id, search_term, cost, conversions, clicks')
        .eq('store_id', storeId).in('google_campaign_id', liveIds).eq('conversions', 0).gte('cost', aov)
        .order('cost', { ascending: false }).order('google_campaign_id').order('search_term').range(a, b))
      : Promise.resolve([] as TermRow[]),
    readAll<ActionRow>((a, b) => supabase.from('ad_actions').select('kind, params, ad_campaign_id')
      .eq('store_id', storeId).eq('kind', 'add_negatives').eq('status', 'applied').order('created_at').order('id').range(a, b)),
    readAll<ActionRow>((a, b) => supabase.from('ad_actions').select('kind, params, ad_campaign_id')
      .eq('store_id', storeId).eq('status', 'rejected').gte('decided_at', recentIso).order('decided_at').order('id').range(a, b)),
  ])

  // Produsele: cât au cheltuit și adus în campaniile noastre (fereastra de evaluare) și de când au cifre
  const byItem = new Map<string, Window>()
  const firstSeen = new Map<string, string>()
  for (const r of productRows) {
    const first = firstSeen.get(r.item_id)
    if (!first || r.date < first) firstSeen.set(r.item_id, r.date)
    if (r.date < evalFrom || r.date > evalTo) continue
    byItem.set(r.item_id, sumWindows([byItem.get(r.item_id) ?? EMPTY, toDay(r)]))
  }
  const products: OptProduct[] = plan.offers.filter(o => o.item_id && byItem.has(normalizeItemId(o.item_id))).map(o => {
    const id = normalizeItemId(o.item_id!)
    const first = firstSeen.get(id)
    return {
      item_id: id,
      offer_id: o.offer_id,
      title: o.variant_title ? `${o.title} · ${o.variant_title}` : o.title,
      price: o.price,
      included_by_user: o.mode === 'include',
      // Produsele grupelor rulează, în campaniile lor: pilotul le judecă la fel
      excluded: o.reason !== null && o.reason !== 'in_group',
      window: byItem.get(id)!,
      // Zilele cu cifre ale produsului (de la prima zi citită; cele mai vechi decât fereastra au oricum destule)
      days: first ? daysBetween(first, yesterday) + 1 : 0,
    }
  })

  const rowOf = new Map(campaigns.map(c => [c.google_campaign_id!, c.id]))
  const searchTerms = termRows.filter(t => rowOf.has(t.google_campaign_id)).map(t => ({
    campaign_id: rowOf.get(t.google_campaign_id)!, term: t.search_term, cost: Number(t.cost) || 0, conversions: Number(t.conversions) || 0, clicks: Number(t.clicks) || 0,
  }))

  // Ce s-a hotărât deja: negativele puse (oricând), ce a respins omul (30 de zile)
  const negatives = new Map<string, Set<string>>()
  for (const a of appliedNegatives) {
    if (!a.ad_campaign_id) continue
    const set = negatives.get(a.ad_campaign_id) ?? new Set<string>()
    for (const t of (a.params as { terms?: { term: string }[] } | null)?.terms ?? []) set.add(t.term.toLowerCase())
    negatives.set(a.ad_campaign_id, set)
  }
  const rejected = { items: new Set<string>(), terms: new Set<string>(), kinds: new Set<string>() }
  for (const a of rejectedRows) {
    const params = (a.params ?? {}) as { terms?: { term: string }[]; products?: { item_id: string }[] }
    for (const t of params.terms ?? []) rejected.terms.add(t.term.toLowerCase())
    for (const p of params.products ?? []) rejected.items.add(normalizeItemId(p.item_id))
    // Trecerea la PMax respinsă ține doar pentru campania ei
    rejected.kinds.add(a.kind === 'graduate' && a.ad_campaign_id ? `graduate:${a.ad_campaign_id}` : a.kind)
  }

  return {
    economics: { aov },
    account: { conversions30: ctx.audit?.result ? purchaseConversions30(ctx.audit.result) : 0 },
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
