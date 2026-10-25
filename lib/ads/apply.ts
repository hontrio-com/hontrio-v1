import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { billableUnitMicros, GoogleAdsApiError, mutate, toMicros, type MutateOperation } from '@/lib/google/ads'
import {
  addNegativesOps, budgetOp, campaignStatusOp, normalizeItemId, pmaxListingOps, removeNodesOps, shoppingListingOps,
  targetRoasOp, FINAL_URL_SUFFIX, MAX_LISTING_ITEMS, type ListingSpec,
} from '@/lib/google/operations'
import { campaignName, createCampaign, EXCLUDE_LABEL, LaunchError, resolveTargeting, type Account } from '@/lib/google/launch'
import { fetchListingNodes } from '@/lib/google/reporting'
import type { Plan } from '@/lib/campaigns/plan'
import type { PlanStore } from '@/lib/campaigns/context'
import type { AuditResult } from '@/lib/google/audit'
import type { ActionKind } from '@/lib/ads/journal'

// =============================================
// Aplicarea schimbărilor în contul Google Ads: cele propuse de pilot (după
// aprobare sau singure, în modul automat), cele cerute de om (pauză,
// repornire) și sincronizarea produselor din campanii cu planul.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type CampaignRow = {
  id: string; user_id: string; store_id: string; type: 'shopping' | 'performance_max'; status: string
  stage: 'starter' | 'growth' | 'segment' | null; segment: string | null; name: string | null
  customer_id: string | null; google_campaign_id: string | null; google_budget_id: string | null
  google_asset_group_id: string | null; google_ad_group_id: string | null
  merchant_center_id: string | null; feed_label: string | null
  daily_budget: number | null; target_roas: number | null; cpc_ceiling: number | null; currency: string | null
  excluded_item_ids: string[]; included_item_ids: string[] | null
  launched_at: string | null; target_changed_at: string | null; budget_changed_at: string | null; loss_check_from: string | null
  goal: string
}

export const CAMPAIGN_COLUMNS = 'id, user_id, store_id, type, status, stage, segment, name, customer_id, google_campaign_id, google_budget_id, google_asset_group_id, google_ad_group_id, merchant_center_id, feed_label, daily_budget, target_roas, cpc_ceiling, currency, excluded_item_ids, included_item_ids, launched_at, target_changed_at, budget_changed_at, loss_check_from, goal'

export function parseCampaign(r: Record<string, unknown>): CampaignRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    ...(r as unknown as CampaignRow),
    daily_budget: num(r.daily_budget),
    target_roas: num(r.target_roas),
    cpc_ceiling: num(r.cpc_ceiling),
    excluded_item_ids: (r.excluded_item_ids as string[] | null) ?? [],
    included_item_ids: (r.included_item_ids as string[] | null) ?? null,
  }
}

export class ApplyError extends Error {
  constructor(public stored: string) { super(stored) }
}

function googleFailure(err: unknown): never {
  if (err instanceof GoogleAdsApiError) {
    throw new ApplyError(storedMessage('sync.apply_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) }))
  }
  throw err
}

async function run(token: string, acc: Account, ops: MutateOperation[]) {
  if (!ops.length) return
  try {
    await mutate(token, acc.customer_id, ops, { loginCustomerId: acc.login_customer_id })
  } catch (err) {
    googleFailure(err)
  }
}

// ─── Produsele din campanie ─────────────────────────────────────────────────

/** Arborele dorit al unei campanii: lista ei (segmentul de marjă mare) sau totul minus excluderi. */
export function desiredListing(c: CampaignRow, plan: Plan, others: CampaignRow[], labelIndex: number | null): { listing: ListingSpec; excluded: string[]; included: string[] | null } {
  const excluded = new Set(plan.exclusions.item_ids.map(normalizeItemId))
  if (c.included_item_ids) {
    const included = c.included_item_ids.map(normalizeItemId).filter(id => !excluded.has(id))
    return { listing: { kind: 'include_items', item_ids: included }, excluded: [], included }
  }
  // Campania „restul" lasă afară produsele segmentului de marjă mare
  for (const o of others) if (o.id !== c.id && o.included_item_ids && ['active', 'paused'].includes(o.status)) for (const id of o.included_item_ids) excluded.add(normalizeItemId(id))
  const list = [...excluded].sort()
  if (c.type === 'performance_max' && list.length > MAX_LISTING_ITEMS && labelIndex !== null) {
    return { listing: { kind: 'exclude_label', index: labelIndex, value: EXCLUDE_LABEL }, excluded: list, included: null }
  }
  return { listing: list.length ? { kind: 'exclude_items', item_ids: list } : { kind: 'all' }, excluded: list, included: null }
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/** Reface arborele de produse când planul s-a schimbat (alegerile omului, stocul, marjele). */
export async function syncCampaignProducts(supabase: Supabase, token: string, acc: Account, c: CampaignRow, plan: Plan, others: CampaignRow[], labelIndex: number | null): Promise<boolean> {
  const want = desiredListing(c, plan, others, labelIndex)
  const applied = c.included_item_ids ? c.included_item_ids.map(normalizeItemId) : c.excluded_item_ids.map(normalizeItemId)
  const target = c.included_item_ids ? want.included! : want.excluded
  if (sameSet(applied, target)) return false
  const groupId = c.type === 'performance_max' ? c.google_asset_group_id : c.google_ad_group_id
  if (!groupId) return false

  const nodes = await fetchListingNodes(token, acc, { type: c.type, group_id: groupId })
  const ops: MutateOperation[] = c.type === 'performance_max'
    ? [...removeNodesOps(nodes, 'assetGroupListingGroupFilterOperation'), ...pmaxListingOps(acc.customer_id, groupId, want.listing)]
    : [...removeNodesOps(nodes, 'adGroupCriterionOperation'), ...shoppingListingOps(acc.customer_id, groupId, want.listing, toMicros(c.cpc_ceiling ?? 0.1, await billableUnitMicros(token, acc.customer_id, c.currency || 'RON', acc.login_customer_id)))]
  await run(token, acc, ops)
  await supabase.from('ad_campaigns').update({
    excluded_item_ids: want.excluded,
    ...(c.included_item_ids ? { included_item_ids: want.included } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', c.id)
  return true
}

// ─── Acțiunile ──────────────────────────────────────────────────────────────

export type ApplyContext = {
  supabase: Supabase
  token: string
  acc: Account
  store: PlanStore
  plan: Plan
  audit: AuditResult | null
  campaigns: CampaignRow[]
}

/** Aplică o acțiune. Întoarce parametrii de scris în jurnal (pot primi ID-uri noi). */
export async function applyAction(ctx: ApplyContext, kind: ActionKind, campaignId: string | null, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { supabase, token, acc } = ctx
  const c = campaignId ? ctx.campaigns.find(x => x.id === campaignId) ?? null : null
  const now = new Date().toISOString()
  const needCampaign = () => {
    if (!c || !c.google_campaign_id) throw new ApplyError(storedMessage('sync.apply_campaign_missing'))
    return c as CampaignRow & { google_campaign_id: string }
  }

  switch (kind) {
    case 'pause':
    case 'pause_loss_limit': {
      const x = needCampaign()
      await run(token, acc, [campaignStatusOp(acc.customer_id, x.google_campaign_id, 'PAUSED')])
      await supabase.from('ad_campaigns').update({ status: 'paused', paused_reason: kind === 'pause' ? 'user' : 'loss_limit', updated_at: now }).eq('id', x.id)
      return params
    }
    case 'enable': {
      const x = needCampaign()
      await run(token, acc, [campaignStatusOp(acc.customer_id, x.google_campaign_id, 'ENABLED')])
      // Limita de pierdere se socotește din nou de la repornire
      await supabase.from('ad_campaigns').update({ status: 'active', paused_reason: null, loss_check_from: now, updated_at: now }).eq('id', x.id)
      return params
    }
    case 'set_target': {
      const x = needCampaign()
      const to = Number(params.to)
      if (!(to > 0)) throw new ApplyError(storedMessage('sync.apply_invalid'))
      await run(token, acc, [targetRoasOp(acc.customer_id, x.google_campaign_id, to)])
      await supabase.from('ad_campaigns').update({ target_roas: to, target_changed_at: now, updated_at: now }).eq('id', x.id)
      return params
    }
    case 'set_budget': {
      const x = needCampaign()
      const to = Number(params.to)
      if (!(to > 0) || !x.google_budget_id) throw new ApplyError(storedMessage('sync.apply_invalid'))
      const unit = await billableUnitMicros(token, acc.customer_id, x.currency || 'RON', acc.login_customer_id)
      await run(token, acc, [budgetOp(acc.customer_id, x.google_budget_id, to, unit)])
      await supabase.from('ad_campaigns').update({ daily_budget: to, budget_changed_at: now, updated_at: now }).eq('id', x.id)
      return params
    }
    case 'add_negatives': {
      const x = needCampaign()
      const terms = ((params.terms as { term: string }[] | undefined) ?? []).map(t => ({ text: t.term, match: 'EXACT' as const }))
      await run(token, acc, addNegativesOps(acc.customer_id, x.google_campaign_id, terms))
      return params
    }
    case 'exclude_products': {
      // Produsele scoase de pilot: planul le vede ca „scoase de Hontrio", iar omul le poate include la loc
      const products = (params.products as { offer_id: string; why: 'no_sales' | 'unprofitable' }[] | undefined) ?? []
      for (const why of ['no_sales', 'unprofitable'] as const) {
        const ids = products.filter(p => p.why === why).map(p => p.offer_id)
        for (let i = 0; i < ids.length; i += 100) {
          const { error } = await supabase.from('commerce_offers').update({ ads_auto_reason: why, ads_auto_at: now })
            .eq('store_id', ctx.store.id).eq('ads_mode', 'auto').in('offer_id', ids.slice(i, i + 100))
          if (error) throw new ApplyError(storedMessage('sync.apply_invalid'))
        }
      }
      // Arborii campaniilor se refac din planul nou
      return params
    }
    case 'graduate':
    case 'segment':
      return launchFollowUp(ctx, kind, needCampaign(), params)
    default:
      throw new ApplyError(storedMessage('sync.apply_invalid'))
  }
}

/** Trecerea la PMax și segmentarea pe marje: campanii noi, create la fel ca lansarea. */
async function launchFollowUp(ctx: ApplyContext, kind: 'graduate' | 'segment', from: CampaignRow & { google_campaign_id: string }, params: Record<string, unknown>) {
  const { supabase, token, acc, store, plan, audit } = ctx
  if (!audit || !from.merchant_center_id) throw new ApplyError(storedMessage('sync.launch_audit_missing'))
  const country = plan.campaign.country || store.country
  if (!country) throw new ApplyError(storedMessage('sync.launch_geo_unknown', { country: '?' }))
  const targeting = await resolveTargeting(token, acc, country, plan.campaign.language)
  const unit = await billableUnitMicros(token, acc.customer_id, from.currency || 'RON', acc.login_customer_id)
  const now = new Date().toISOString()

  const segment = kind === 'segment' ? 'high_margin' : 'all'
  const included = kind === 'segment'
    ? ((params.high_item_ids as string[] | undefined) ?? []).map(normalizeItemId).filter(id => !plan.exclusions.item_ids.map(normalizeItemId).includes(id))
    : null
  const listing: ListingSpec = included
    ? { kind: 'include_items', item_ids: included }
    : plan.exclusions.item_ids.length ? { kind: 'exclude_items', item_ids: plan.exclusions.item_ids } : { kind: 'all' }
  const target = Number(kind === 'segment' ? params.high_target : params.target_roas) || null
  const daily = kind === 'segment'
    ? Math.max(1, Math.round(((from.daily_budget ?? 10) / 2) * 100) / 100)
    : from.daily_budget ?? plan.budget.daily ?? 10
  const name = campaignName('performance_max', store.store_name, kind === 'segment' ? 'high-margin' : undefined)

  const ids = await createCampaign(token, acc, {
    kind: 'performance_max',
    customerId: acc.customer_id,
    name,
    merchantId: from.merchant_center_id,
    feedLabel: from.feed_label,
    dailyBudget: daily,
    billableUnitMicros: unit,
    geoTargetConstant: targeting.geo,
    languageConstant: targeting.language,
    finalUrl: store.store_url,
    finalUrlSuffix: FINAL_URL_SUFFIX,
    listing,
    negatives: plan.structure.brand_negatives.map(text => ({ text, match: 'PHRASE' as const })),
    targetRoas: target,
    goals: audit.goals.map(g => ({ category: g.category, origin: g.origin })),
  }).catch(err => { throw err instanceof LaunchError ? new ApplyError(err.stored) : err })

  const { data: row } = await supabase.from('ad_campaigns').insert({
    user_id: from.user_id, store_id: from.store_id, type: 'performance_max', status: 'active', goal: from.goal,
    daily_budget: daily, currency: from.currency, customer_id: acc.customer_id, google_campaign_id: ids.campaign,
    launched_at: now, stage: kind === 'segment' ? 'segment' : 'growth', segment, name,
    merchant_center_id: from.merchant_center_id, feed_label: from.feed_label, google_budget_id: ids.budget,
    google_asset_group_id: ids.group, target_roas: target, included_item_ids: included,
    excluded_item_ids: listing.kind === 'exclude_items' ? listing.item_ids : [],
    loss_check_from: now, target_changed_at: now, budget_changed_at: now,
  }).select('id').single()

  if (kind === 'graduate') {
    // Pornirea și-a făcut treaba: se oprește, ca să nu concureze cu PMax pe aceleași produse
    await run(token, acc, [campaignStatusOp(acc.customer_id, from.google_campaign_id, 'PAUSED')])
    await supabase.from('ad_campaigns').update({ status: 'ended', paused_reason: 'graduated', updated_at: now }).eq('id', from.id)
  } else {
    // Campania de până acum devine „restul": fără produsele de marjă mare, cu ținta grupei ei
    const restTarget = Number(params.rest_target) || from.target_roas
    if (restTarget) await run(token, acc, [targetRoasOp(acc.customer_id, from.google_campaign_id, restTarget)])
    await supabase.from('ad_campaigns').update({
      segment: 'rest', stage: 'segment', target_roas: restTarget, target_changed_at: now, updated_at: now,
      daily_budget: Math.max(1, Math.round(((from.daily_budget ?? 10) - daily) * 100) / 100),
    }).eq('id', from.id)
    if (from.google_budget_id && from.daily_budget) {
      await run(token, acc, [budgetOp(acc.customer_id, from.google_budget_id, Math.max(1, from.daily_budget - daily), unit)])
    }
    const fresh = { ...from, segment: 'rest' }
    const all = [...ctx.campaigns.filter(x => x.id !== from.id), fresh, { ...from, id: row?.id ?? 'new', included_item_ids: included, status: 'active' }]
    await syncCampaignProducts(supabase, token, acc, fresh, plan, all, store.merchant_label_index)
  }
  return { ...params, new_campaign_id: row?.id ?? null, google_campaign_id: ids.campaign }
}
