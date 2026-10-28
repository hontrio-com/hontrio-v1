import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import {
  billableUnitMicros, GoogleAdsApiError, idFromResourceName, mutate, search,
  type GoogleAdsErrorDetail, type MutateOperationResponse,
} from '@/lib/google/ads'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import {
  buildLaunchOperations, campaignStatusOp, endOfDay, euDeclarationOps, normalizeItemId, startOfDay, FINAL_URL_SUFFIX, MAX_LISTING_ITEMS,
  type LaunchIds, type LaunchSpec, type ListingSpec,
} from '@/lib/google/operations'
import { logAction, notify } from '@/lib/ads/journal'
import { syncMerchant } from '@/lib/merchant/sync'
import type { PlanContext, PlanStore } from '@/lib/campaigns/context'
import { CAMPAIGN_EXCLUSIONS, type Plan } from '@/lib/campaigns/plan'
import { accountBlockers } from '@/lib/campaigns/groups'
import type { AuditResult } from '@/lib/google/audit'

// =============================================
// Lansarea unei campanii în contul Google Ads al omului. Întâi aceeași
// cerere cu `validateOnly: true` (Google întoarce erorile fără să creeze
// nimic), apoi cea adevărată, atomică. Vezi docs/campanii/SPECIFICATIE.md §3.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type Account = { customer_id: string; login_customer_id: string | null }

/** Eticheta Hontrio pentru ofertele scoase din campanie, la cataloagele prea mari pentru lista de ID-uri. */
export const EXCLUDE_LABEL = 'hontrio_exclude'

const geoCache = new Map<string, string>()
const langCache = new Map<string, string | null>()

/** Țara și limba campaniei, ca resurse Google (căutate o dată, apoi ținute minte). */
export async function resolveTargeting(token: string, account: Account, country: string, language: string | null) {
  const cc = country.toUpperCase().replace(/[^A-Z]/g, '')
  let geo = geoCache.get(cc)
  if (!geo) {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    const rows = await search<{ geoTargetConstant?: { resourceName?: string } }>(token, account.customer_id, `
      SELECT geo_target_constant.resource_name, geo_target_constant.country_code, geo_target_constant.target_type
      FROM geo_target_constant
      WHERE geo_target_constant.country_code = '${cc}'
        AND geo_target_constant.target_type = 'Country'
        AND geo_target_constant.status = 'ENABLED'`, account.login_customer_id)
    geo = rows[0]?.geoTargetConstant?.resourceName
    if (!geo) throw new LaunchError('geo_unknown', storedMessage('sync.launch_geo_unknown', { country: cc }))
    geoCache.set(cc, geo)
  }

  let lang: string | null = null
  if (language) {
    const code = language.toLowerCase().replace(/[^a-z_-]/g, '')
    if (langCache.has(code)) lang = langCache.get(code)!
    else {
      // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
      const rows = await search<{ languageConstant?: { resourceName?: string } }>(token, account.customer_id, `
        SELECT language_constant.resource_name, language_constant.code
        FROM language_constant
        WHERE language_constant.code = '${code}'`, account.login_customer_id)
      lang = rows[0]?.languageConstant?.resourceName ?? null
      langCache.set(code, lang)
    }
  }
  return { geo, language: lang }
}

export class LaunchError extends Error {
  constructor(public reason: string, public stored: string, public details: GoogleAdsErrorDetail[] = []) {
    super(reason)
  }
}

function idsOf(responses: MutateOperationResponse[]): LaunchIds {
  const find = (key: string) => idFromResourceName(responses.find(r => r[key]?.resourceName)?.[key]?.resourceName)
  return {
    budget: find('campaignBudgetResult'),
    campaign: find('campaignResult'),
    group: find('assetGroupResult') ?? find('adGroupResult'),
  }
}

/** Verifică, apoi creează. O eroare Google devine LaunchError cu detaliile lui. */
export async function createCampaign(token: string, account: Account, spec: LaunchSpec): Promise<LaunchIds> {
  const ops = buildLaunchOperations(spec)
  try {
    await mutate(token, account.customer_id, ops, { loginCustomerId: account.login_customer_id, validateOnly: true })
    const responses = await mutate(token, account.customer_id, ops, { loginCustomerId: account.login_customer_id })
    const ids = idsOf(responses)
    if (!ids.campaign) throw new LaunchError('google_error', storedMessage('sync.launch_no_campaign'))
    return ids
  } catch (err) {
    if (err instanceof GoogleAdsApiError) {
      throw new LaunchError('google_error', storedMessage('sync.launch_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) }), err.details)
    }
    throw err
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** Numele din Google Ads: unic în cont (data), ușor de recunoscut. */
export function campaignName(kind: 'shopping' | 'performance_max', storeName: string | null, segment?: string) {
  const what = kind === 'shopping' ? 'Shopping' : 'PMax'
  const seg = segment && segment !== 'all' ? ` · ${segment}` : ''
  return `Hontrio · ${what}${seg} · ${(storeName || 'store').slice(0, 60)} · ${today()}` // i18n-ignore: numele campaniei în contul Google Ads
}

export type LaunchOptions = { overlap: 'pause' | 'keep' | null; declareEu: boolean }

export type LaunchResult =
  | { ok: true; ad_campaign_id: string; google_campaign_id: string; warnings: string[] }
  | { ok: false; reason: string; error: string; details?: GoogleAdsErrorDetail[] }

/**
 * Arborele de produse al campaniei principale: lista de ID-uri sau eticheta Hontrio. `taken` = produsele
 * grupelor lansate (ID-ul din Merchant Center), care au campaniile lor; eticheta nu le ține, deci atunci
 * merge doar lista.
 */
export function listingFromPlan(plan: Plan, labelIndex: number | null, taken: string[] = []): ListingSpec {
  if (!taken.length && plan.exclusions.mode === 'label' && labelIndex !== null) return { kind: 'exclude_label', index: labelIndex, value: EXCLUDE_LABEL }
  const ids = [...new Set([...plan.exclusions.item_ids.map(normalizeItemId), ...taken.map(normalizeItemId)])].sort()
  return ids.length ? { kind: 'exclude_items', item_ids: ids } : { kind: 'all' }
}

/** Produsele grupelor lansate, cum le-a împărțit planul (ID-ul din Merchant Center). */
function liveGroupItems(ctx: PlanContext): string[] {
  const live = new Set(ctx.groups.filter(g => g.status === 'live').map(g => g.id))
  return ctx.plan.offers.filter(o => o.item_id && live.has(ctx.assigned.get(o.offer_id) ?? '')).map(o => normalizeItemId(o.item_id!))
}

type Fail = (reason: string, error: string, details?: GoogleAdsErrorDetail[]) => LaunchResult
const failWith: Fail = (reason, error, details) => ({ ok: false, reason, error, details })

/** Alegerile omului pe care le cere auditul înainte de orice lansare: declarația UE și campaniile care se suprapun. */
function choicesMissing(audit: AuditResult | null, opts: LaunchOptions): LaunchResult | null {
  if (!audit) return failWith('audit_missing', storedMessage('sync.launch_audit_missing'))
  if (audit.eu_undeclared.length && !opts.declareEu) return failWith('eu_confirm', storedMessage('sync.launch_eu_confirm'))
  if (audit.overlap.length && !opts.overlap) return failWith('overlap_choice', storedMessage('sync.launch_overlap_choice'))
  return null
}

type Session = { supabase: Supabase; userId: string; storeId: string; token: string; acc: Account }

/** Declarația UE pe campaniile omului: altfel Google blochează orice modificare în cont. */
async function declareEu(s: Session, campaigns: string[]) {
  if (!campaigns.length) return
  await mutate(s.token, s.acc.customer_id, euDeclarationOps(s.acc.customer_id, campaigns), { loginCustomerId: s.acc.login_customer_id })
  await logAction(s.supabase, { user_id: s.userId, store_id: s.storeId, kind: 'declare_eu', params: { campaigns }, status: 'applied', source: 'user' })
}

/** Campaniile omului care vând aceleași produse: pe pauză, dacă a ales asta. O eroare rămâne avertisment. */
async function pauseOverlap(s: Session, campaigns: string[], adCampaignId: string, warnings: string[]) {
  if (!campaigns.length) return
  try {
    await mutate(s.token, s.acc.customer_id, campaigns.map(id => campaignStatusOp(s.acc.customer_id, id, 'PAUSED')), { loginCustomerId: s.acc.login_customer_id })
    await logAction(s.supabase, { user_id: s.userId, store_id: s.storeId, ad_campaign_id: adCampaignId, kind: 'pause_existing', params: { campaigns }, status: 'applied', source: 'user' })
  } catch (err) {
    if (!(err instanceof GoogleAdsApiError)) throw err
    warnings.push(storedMessage('sync.launch_pause_existing_failed', { detail: err.message.slice(0, 200) }))
    await logAction(s.supabase, { user_id: s.userId, store_id: s.storeId, ad_campaign_id: adCampaignId, kind: 'pause_existing', params: { campaigns }, status: 'failed', source: 'user', error: err.message.slice(0, 500) })
  }
}

async function tokenFor(userId: string): Promise<string | LaunchResult> {
  try {
    return await getAccessTokenForUser(userId)
  } catch (err) {
    if (err instanceof GoogleAuthError) return failWith('google_auth', storedMessage('sync.google_access_revoked'))
    throw err
  }
}

/** O eroare Google sau de autorizare, ca rezultat al lansării; celelalte se aruncă mai departe. */
function launchFailure(err: unknown): LaunchResult {
  if (err instanceof LaunchError) return failWith(err.reason, err.stored, err.details)
  if (err instanceof GoogleAdsApiError) {
    return failWith('google_error', storedMessage('sync.launch_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) }), err.details)
  }
  if (err instanceof GoogleAuthError) return failWith('google_auth', storedMessage('sync.google_access_revoked'))
  throw err
}

/** Campania creată în Google, dar nesalvată: n-o pierdem din vedere, o scriem în jurnal cu ID-ul ei. */
async function lostCampaign(s: Session, campaign: string | null, error: string | undefined): Promise<LaunchResult> {
  logError('launch', 'Campania creată nu s-a salvat', { storeId: s.storeId, campaign, error })
  await logAction(s.supabase, { user_id: s.userId, store_id: s.storeId, kind: 'launch', params: { google_campaign_id: campaign }, status: 'failed', source: 'user', error: error ?? 'insert' })
  return failWith('save_failed', storedMessage('sync.launch_save_failed', { campaign: campaign ?? '' }))
}

/**
 * Lansarea cerută de om din pagina Campanii: treapta din plan, cu alegerea lui
 * pentru campaniile existente și confirmarea declarației UE.
 */
export async function launchFromPlan(supabase: Supabase, userId: string, store: PlanStore, ctx: PlanContext, opts: LaunchOptions): Promise<LaunchResult> {
  const { plan, account, audit } = ctx

  if (plan.blockers.length) return failWith('blocked', storedMessage('sync.launch_blocked'))
  if (!account) return failWith('audit_missing', storedMessage('sync.launch_audit_missing'))
  const missing = choicesMissing(audit?.result ?? null, opts)
  if (missing) return missing
  const a = audit!.result!
  const merchantId = plan.structure.merchant_id
  if (!merchantId) return failWith('no_merchant', storedMessage('sync.launch_no_merchant'))

  // Campaniile grupelor nu țin locul campaniei principale
  const { data: live } = await supabase.from('ad_campaigns').select('id').eq('store_id', store.id).in('status', ['active', 'paused']).is('product_group_id', null).limit(1)
  if (live?.length) return failWith('already_active', storedMessage('sync.launch_already_active'))

  // Arborele de produse: excluderile planului și produsele grupelor lansate (au campaniile lor)
  const listing = listingFromPlan(plan, store.merchant_label_index, liveGroupItems(ctx))
  if (plan.structure.type === 'performance_max' && listing.kind === 'exclude_items' && listing.item_ids.length > MAX_LISTING_ITEMS) {
    return failWith('too_many_exclusions', storedMessage('sync.launch_too_many_exclusions', { count: listing.item_ids.length }))
  }

  const token = await tokenFor(userId)
  if (typeof token !== 'string') return token
  const acc: Account = { customer_id: account.customer_id, login_customer_id: account.login_customer_id }
  const s: Session = { supabase, userId, storeId: store.id, token, acc }
  const warnings: string[] = []

  try {
    // 1. Declarația UE pe campaniile omului
    await declareEu(s, a.eu_undeclared)

    // 2. Eticheta Hontrio în Merchant Center, dacă arborele filtrează după ea
    if (listing.kind === 'exclude_label') {
      const labels = new Map(plan.offers.filter(o => o.reason && CAMPAIGN_EXCLUSIONS.includes(o.reason)).map(o => [o.offer_id, EXCLUDE_LABEL]))
      const r = await syncMerchant(store.id, { auditMerchantId: a.merchant_id, labels })
      if (!r.ok) return failWith('merchant_labels', storedMessage('sync.launch_labels_failed'))
    }

    // 3. Campania
    const currency = plan.campaign.currency
    const unit = await billableUnitMicros(token, acc.customer_id, currency, acc.login_customer_id)
    const country = plan.campaign.country || store.country
    if (!country) return failWith('geo_unknown', storedMessage('sync.launch_geo_unknown', { country: '?' }))
    const targeting = await resolveTargeting(token, acc, country, plan.campaign.language)
    const daily = plan.budget.daily!
    const kind = plan.structure.type
    const name = campaignName(kind, store.store_name)
    const common = {
      customerId: acc.customer_id,
      name,
      merchantId,
      feedLabel: plan.structure.feed_label,
      dailyBudget: daily,
      billableUnitMicros: unit,
      geoTargetConstant: targeting.geo,
      finalUrlSuffix: FINAL_URL_SUFFIX,
      listing,
      negatives: plan.structure.brand_negatives.map(text => ({ text, match: 'PHRASE' as const })),
    }
    const spec: LaunchSpec = kind === 'shopping'
      ? { ...common, kind, cpcCeiling: plan.structure.cpc_ceiling!, campaignPriority: opts.overlap === 'keep' ? 0 : 1 }
      : {
        ...common, kind, targetRoas: plan.structure.start_target, languageConstant: targeting.language,
        finalUrl: store.store_url, goals: a.goals.map(g => ({ category: g.category, origin: g.origin })),
      }
    const ids = await createCampaign(token, acc, spec)

    const now = new Date().toISOString()
    const { data: row, error } = await supabase.from('ad_campaigns').insert({
      user_id: userId,
      store_id: store.id,
      type: kind,
      status: 'active',
      goal: plan.goal,
      daily_budget: daily,
      currency,
      customer_id: acc.customer_id,
      google_campaign_id: ids.campaign,
      launched_at: now,
      stage: plan.stage.id,
      segment: 'all',
      name,
      merchant_center_id: merchantId,
      feed_label: plan.structure.feed_label,
      google_budget_id: ids.budget,
      ...(kind === 'shopping' ? { google_ad_group_id: ids.group } : { google_asset_group_id: ids.group }),
      target_roas: kind === 'performance_max' ? plan.structure.start_target : null,
      cpc_ceiling: kind === 'shopping' ? plan.structure.cpc_ceiling : null,
      excluded_item_ids: listing.kind === 'exclude_items' ? listing.item_ids : [],
      loss_check_from: now,
      target_changed_at: now,
      budget_changed_at: now,
    }).select('id').single()
    if (error || !row) return lostCampaign(s, ids.campaign, error?.message)

    // 4. Campaniile omului care vând aceleași produse: pe pauză, dacă a ales asta
    if (opts.overlap === 'pause') await pauseOverlap(s, a.overlap, row.id, warnings)

    await logAction(supabase, {
      user_id: userId, store_id: store.id, ad_campaign_id: row.id, kind: 'launch', status: 'applied', source: 'user',
      params: {
        type: kind, stage: plan.stage.id, daily_budget: daily, target_roas: spec.kind === 'performance_max' ? spec.targetRoas : null,
        cpc_ceiling: spec.kind === 'shopping' ? spec.cpcCeiling : null, excluded: plan.exclusions.item_ids.length, google_campaign_id: ids.campaign,
      },
    })
    await notify(supabase, userId, 'success', storedMessage('notifications.campaign_launched_title'),
      storedMessage(kind === 'shopping' ? 'notifications.campaign_launched_starter' : 'notifications.campaign_launched_growth', { name }))

    return { ok: true, ad_campaign_id: row.id, google_campaign_id: ids.campaign!, warnings }
  } catch (err) {
    return launchFailure(err)
  }
}

/**
 * Lansarea campaniei unei grupe: produsele ei (lista de ID-uri), treapta ei (Shopping standard sau
 * Performance Max), ținta și bugetul ei, perioada aleasă. Campania principală care rulează le lasă
 * apoi afară (apelantul îi reface arborele).
 */
export async function launchGroup(supabase: Supabase, userId: string, store: PlanStore, ctx: PlanContext, groupId: string, opts: LaunchOptions): Promise<LaunchResult> {
  const { plan, account, audit } = ctx
  const gp = ctx.groupPlans.find(p => p.group.id === groupId)
  if (!gp) return failWith('group_missing', storedMessage('sync.group_missing'))
  const group = gp.group
  if (group.status === 'live') return failWith('already_active', storedMessage('sync.launch_group_live'))

  const noValue = !!audit?.result?.checks.some(c => c.id === 'purchase_no_value')
  if (accountBlockers(plan, gp.type, noValue).length) return failWith('blocked', storedMessage('sync.launch_blocked'))
  if (gp.blockers.length) return failWith('group_blocked', storedMessage('sync.launch_group_blocked'))
  if (!account) return failWith('audit_missing', storedMessage('sync.launch_audit_missing'))
  const missing = choicesMissing(audit?.result ?? null, opts)
  if (missing) return missing
  const a = audit!.result!
  const merchantId = plan.structure.merchant_id
  if (!merchantId) return failWith('no_merchant', storedMessage('sync.launch_no_merchant'))
  const daily = gp.budget.daily
  if (daily === null) return failWith('group_blocked', storedMessage('sync.launch_group_blocked'))

  // Campania principală Performance Max trebuie să poată lăsa afară și produsele grupei (cel mult 1.000 de noduri)
  const { data: mains } = await supabase.from('ad_campaigns').select('type').eq('store_id', store.id).in('status', ['active', 'paused']).is('product_group_id', null).is('included_item_ids', null)
  const afterLaunch = listingFromPlan(plan, store.merchant_label_index, [...liveGroupItems(ctx), ...gp.item_ids])
  if ((mains ?? []).some(m => m.type === 'performance_max') && afterLaunch.kind === 'exclude_items' && afterLaunch.item_ids.length > MAX_LISTING_ITEMS) {
    return failWith('too_many_exclusions', storedMessage('sync.launch_too_many_exclusions', { count: afterLaunch.item_ids.length }))
  }

  const token = await tokenFor(userId)
  if (typeof token !== 'string') return token
  const acc: Account = { customer_id: account.customer_id, login_customer_id: account.login_customer_id }
  const s: Session = { supabase, userId, storeId: store.id, token, acc }
  const warnings: string[] = []

  try {
    await declareEu(s, a.eu_undeclared)

    const currency = plan.campaign.currency
    const unit = await billableUnitMicros(token, acc.customer_id, currency, acc.login_customer_id)
    const country = plan.campaign.country || store.country
    if (!country) return failWith('geo_unknown', storedMessage('sync.launch_geo_unknown', { country: '?' }))
    const targeting = await resolveTargeting(token, acc, country, plan.campaign.language)
    const kind = gp.type
    const name = campaignName(kind, store.store_name, group.name)
    const items = gp.item_ids.map(normalizeItemId)
    // Pornește azi sau la începutul perioadei; se oprește singură la sfârșitul ei
    const later = group.starts_on && group.starts_on > ctx.today ? group.starts_on : null
    const common = {
      customerId: acc.customer_id,
      name,
      merchantId,
      feedLabel: plan.structure.feed_label,
      dailyBudget: daily,
      billableUnitMicros: unit,
      geoTargetConstant: targeting.geo,
      finalUrlSuffix: FINAL_URL_SUFFIX,
      listing: { kind: 'include_items', item_ids: items } as ListingSpec,
      negatives: plan.structure.brand_negatives.map(text => ({ text, match: 'PHRASE' as const })),
      startDateTime: later ? startOfDay(later) : null,
      endDateTime: group.ends_on ? endOfDay(group.ends_on) : null,
    }
    const spec: LaunchSpec = kind === 'shopping'
      ? { ...common, kind, cpcCeiling: gp.cpc_ceiling!, campaignPriority: opts.overlap === 'keep' ? 0 : 1 }
      : {
        ...common, kind, targetRoas: gp.start_target, languageConstant: targeting.language,
        finalUrl: store.store_url, goals: a.goals.map(g => ({ category: g.category, origin: g.origin })),
      }
    const ids = await createCampaign(token, acc, spec)

    const now = new Date().toISOString()
    const start = later ? `${later}T00:00:00.000Z` : now
    const { data: row, error } = await supabase.from('ad_campaigns').insert({
      user_id: userId,
      store_id: store.id,
      product_group_id: group.id,
      type: kind,
      status: 'active',
      goal: group.goal,
      daily_budget: daily,
      currency,
      customer_id: acc.customer_id,
      google_campaign_id: ids.campaign,
      launched_at: start,
      stage: gp.stage,
      segment: 'group',
      name,
      merchant_center_id: merchantId,
      feed_label: plan.structure.feed_label,
      google_budget_id: ids.budget,
      ...(kind === 'shopping' ? { google_ad_group_id: ids.group } : { google_asset_group_id: ids.group }),
      target_roas: kind === 'performance_max' ? gp.start_target : null,
      cpc_ceiling: kind === 'shopping' ? gp.cpc_ceiling : null,
      included_item_ids: items,
      excluded_item_ids: [],
      loss_check_from: start,
      target_changed_at: start,
      budget_changed_at: start,
    }).select('id').single()
    if (error || !row) return lostCampaign(s, ids.campaign, error?.message)

    await supabase.from('ad_product_groups').update({ status: 'live', launched_at: now, updated_at: now }).eq('id', group.id)
    if (opts.overlap === 'pause') await pauseOverlap(s, a.overlap, row.id, warnings)

    await logAction(supabase, {
      user_id: userId, store_id: store.id, ad_campaign_id: row.id, kind: 'launch', status: 'applied', source: 'user',
      params: {
        type: kind, stage: gp.stage, daily_budget: daily, target_roas: spec.kind === 'performance_max' ? spec.targetRoas : null,
        cpc_ceiling: spec.kind === 'shopping' ? spec.cpcCeiling : null, included: items.length, google_campaign_id: ids.campaign,
        group_id: group.id, group: group.name, starts_on: later, ends_on: group.ends_on,
      },
    })
    await notify(supabase, userId, 'success', storedMessage('notifications.campaign_launched_title'),
      storedMessage('notifications.campaign_launched_group', { name: group.name, count: items.length }))

    return { ok: true, ad_campaign_id: row.id, google_campaign_id: ids.campaign!, warnings }
  } catch (err) {
    return launchFailure(err)
  }
}

