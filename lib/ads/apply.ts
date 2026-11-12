import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import { billableUnitMicros, GoogleAdsApiError, mutate, type MutateOperation } from '@/lib/google/ads'
import {
  addNegativesOps, budgetOp, campaignStatusOp, endDateOp, endOfDay, normalizeItemId, pmaxListingOps, removeNodesOps, shoppingListingOps,
  FINAL_URL_SUFFIX, MAX_LISTING_ITEMS, type NegativeKeyword,
} from '@/lib/google/operations'
import { campaignName, createCampaign, LaunchError, resolveTargeting, type Account } from '@/lib/google/launch'
import { fetchListingNodes } from '@/lib/google/reporting'
import { isDay, type ProductGroup } from '@/lib/campaigns/groups'
import type { Plan } from '@/lib/campaigns/plan'
import type { PlanStore } from '@/lib/campaigns/context'
import type { AuditResult } from '@/lib/google/audit'
import { logAction, type ActionKind } from '@/lib/ads/journal'
import { readAll } from '@/lib/ads/read-all'
import { desiredListing, groupItems, listingSize, type CampaignRow } from '@/lib/ads/listing'

// Arborele de produse (funcții pure) stă în lib/ads/listing.ts; aici rămân și pentru cei care îl importau de aici
export { CAMPAIGN_COLUMNS, desiredListing, groupItems, merchantLabels, parseCampaign, type CampaignRow } from '@/lib/ads/listing'

// =============================================
// Aplicarea schimbărilor în contul Google Ads: cele propuse de pilot (după
// aprobare sau singure, în modul automat), cele cerute de om (pauză,
// repornire, încheiere, sfârșitul perioadei) și sincronizarea produselor din
// campanii cu planul și cu grupele omului.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

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

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * Reface arborele de produse când planul s-a schimbat (alegerile omului, stocul, pilotul, grupele).
 * Întoarce listele noi, sau null când nu era nimic de schimbat.
 */
export async function syncCampaignProducts(supabase: Supabase, token: string, acc: Account, c: CampaignRow, plan: Plan, others: CampaignRow[], labelIndex: number | null, members: string[] | null = null): Promise<{ included: string[] | null; excluded: string[] } | null> {
  const want = desiredListing(c, plan, others, labelIndex, members)
  const hasList = want.included !== null
  const applied = hasList ? (c.included_item_ids ?? []).map(normalizeItemId) : c.excluded_item_ids.map(normalizeItemId)
  const target = hasList ? want.included! : want.excluded
  if (sameSet(applied, target)) return null
  const groupId = c.type === 'performance_max' ? c.google_asset_group_id : c.google_ad_group_id
  if (!groupId) return null

  const nodes = await fetchListingNodes(token, acc, { type: c.type, group_id: groupId })
  const ops: MutateOperation[] = c.type === 'performance_max'
    ? [...removeNodesOps(nodes, 'assetGroupListingGroupFilterOperation'), ...pmaxListingOps(acc.customer_id, groupId, want.listing)]
    : [...removeNodesOps(nodes, 'adGroupCriterionOperation'), ...shoppingListingOps(acc.customer_id, groupId, want.listing)]
  await run(token, acc, ops)
  await supabase.from('ad_campaigns').update({
    excluded_item_ids: want.excluded,
    ...(hasList ? { included_item_ids: want.included } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', c.id)
  return { included: want.included, excluded: want.excluded }
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
  /** Grupele omului și grupa fiecărei oferte (din planul de acum). */
  groups: ProductGroup[]
  assigned: Map<string, string>
}

/** Grupa rămâne „lansată" cât timp are o campanie care rulează sau stă pe pauză. */
export async function closeGroupIfDone(supabase: Supabase, groupId: string, now: string) {
  const { data: still } = await supabase.from('ad_campaigns').select('id').eq('product_group_id', groupId).in('status', ['active', 'paused']).limit(1)
  if (!still?.length) await supabase.from('ad_product_groups').update({ status: 'ended', updated_at: now }).eq('id', groupId).eq('status', 'live')
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
    case 'end': {
      // Încheiată: oprită în Google, iar produsele ei se întorc în campania principală
      const x = needCampaign()
      await run(token, acc, [campaignStatusOp(acc.customer_id, x.google_campaign_id, 'PAUSED')])
      await supabase.from('ad_campaigns').update({ status: 'ended', paused_reason: params.scheduled ? 'scheduled' : 'user', updated_at: now }).eq('id', x.id)
      if (x.product_group_id) await closeGroupIfDone(supabase, x.product_group_id, now)
      return params
    }
    case 'set_end_date': {
      const x = needCampaign()
      const day = isDay(params.ends_on) ? params.ends_on : null
      await run(token, acc, [endDateOp(acc.customer_id, x.google_campaign_id, day ? endOfDay(day) : null)])
      return { ends_on: day }
    }
    case 'set_target':
    case 'segment':
      // Propuneri vechi, de când Hontrio lucra cu marje: nu se mai aplică
      throw new ApplyError(storedMessage('sync.apply_retired'))
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
      return graduate(ctx, needCampaign(), params)
    default:
      throw new ApplyError(storedMessage('sync.apply_invalid'))
  }
}

/**
 * Campania Performance Max care a luat deja locul pornirii (o trecere de mai înainte a creat-o, dar n-a
 * apucat să oprească pornirea): aceeași grupă, sau, la campania principală, tot catalogul.
 */
export function graduatedTwin(from: CampaignRow, campaigns: CampaignRow[]): CampaignRow | null {
  return campaigns.find(x => x.id !== from.id && x.type === 'performance_max' && (x.status === 'active' || x.status === 'paused')
    && (from.product_group_id ? x.product_group_id === from.product_group_id : !x.product_group_id && !x.included_item_ids)) ?? null
}

/** Arborele campaniei Performance Max în care ar trece pornirea (grupa: produsele ei de acum). */
export function graduateListing(from: CampaignRow, plan: Plan, campaigns: CampaignRow[], labelIndex: number | null, assigned: Map<string, string>) {
  const others = campaigns.filter(x => x.id !== from.id)
  return from.product_group_id
    ? desiredListing(from, plan, others, labelIndex, groupItems(plan, assigned, from.product_group_id))
    : desiredListing({ ...from, type: 'performance_max', included_item_ids: null }, plan, others, labelIndex)
}

/** Cuvintele negative aprobate (sau aplicate singure) pe o campanie: trec și în campania care o înlocuiește. */
async function appliedNegatives(supabase: Supabase, campaignId: string): Promise<NegativeKeyword[]> {
  const rows = await readAll<{ params: { terms?: { term?: string }[] } | null }>((a, b) => supabase.from('ad_actions').select('params')
    .eq('ad_campaign_id', campaignId).eq('kind', 'add_negatives').eq('status', 'applied').order('created_at').range(a, b))
  return rows.flatMap(r => (r.params?.terms ?? []).filter(t => typeof t.term === 'string').map(t => ({ text: t.term!, match: 'EXACT' as const })))
}

/**
 * Trecerea la Performance Max: o campanie nouă, creată la fel ca lansarea, cu „Maximizează
 * valoarea conversiilor" fără ROAS țintă; pornirea se oprește după. Se poate relua: dacă o trecere
 * de mai înainte a creat deja campania, acum doar oprește pornirea.
 */
async function graduate(ctx: ApplyContext, from: CampaignRow & { google_campaign_id: string }, params: Record<string, unknown>) {
  const { supabase, token, acc, store, plan, audit } = ctx
  const finishStarter = async (now: string) => {
    // Pornirea și-a făcut treaba: se oprește, ca să nu concureze cu PMax pe aceleași produse
    await run(token, acc, [campaignStatusOp(acc.customer_id, from.google_campaign_id, 'PAUSED')])
    await supabase.from('ad_campaigns').update({ status: 'ended', paused_reason: 'graduated', updated_at: now }).eq('id', from.id)
  }

  const twin = graduatedTwin(from, ctx.campaigns)
  if (twin) {
    await finishStarter(new Date().toISOString())
    return { ...params, new_campaign_id: twin.id, google_campaign_id: twin.google_campaign_id, resumed: true }
  }

  if (!audit || !from.merchant_center_id) throw new ApplyError(storedMessage('sync.launch_audit_missing'))
  const country = plan.campaign.country || store.country
  if (!country) throw new ApplyError(storedMessage('sync.launch_geo_unknown', { country: '?' }))

  // Campania unei grupe rămâne a grupei: aceleași produse (cum le prind regulile acum), aceeași perioadă.
  // Pornirea principală trece la PMax fără produsele grupelor.
  const group = from.product_group_id ? ctx.groups.find(g => g.id === from.product_group_id) ?? null : null
  const want = graduateListing(from, plan, ctx.campaigns, store.merchant_label_index, ctx.assigned)
  const included = want.included
  const listing = want.listing
  // Google: cel mult 1.000 de filtre pe grupul de materiale
  if (listingSize(listing) > MAX_LISTING_ITEMS) {
    throw new ApplyError(storedMessage('campaigns.graduate_too_many', { items: listingSize(listing), limit: MAX_LISTING_ITEMS }))
  }
  const targeting = await resolveTargeting(token, acc, country, plan.campaign.language)
  const unit = await billableUnitMicros(token, acc.customer_id, from.currency || 'RON', acc.login_customer_id)
  const now = new Date().toISOString()
  // Bugetul de acum al pornirii (omul l-ar fi putut schimba după propunere)
  const daily = from.daily_budget || Number(params.daily_budget) || plan.budget.daily || 10
  const name = campaignName('performance_max', store.store_name, group?.name)
  // Negativele: numele magazinului (când are o campanie Search) și termenii scoși deja din pornire
  const negatives: NegativeKeyword[] = [
    ...plan.structure.brand_negatives.map(text => ({ text, match: 'PHRASE' as const })),
    ...await appliedNegatives(supabase, from.id),
  ]

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
    negatives,
    goals: audit.goals.map(g => ({ category: g.category, origin: g.origin })),
    endDateTime: group?.ends_on ? endOfDay(group.ends_on) : null,
  }).catch(err => { throw err instanceof LaunchError ? new ApplyError(err.stored) : err })

  const { data: row, error } = await supabase.from('ad_campaigns').insert({
    user_id: from.user_id, store_id: from.store_id, type: 'performance_max', status: 'active',
    daily_budget: daily, currency: from.currency, customer_id: acc.customer_id, google_campaign_id: ids.campaign,
    launched_at: now, stage: 'growth', segment: group ? 'group' : 'all', name,
    merchant_center_id: from.merchant_center_id, feed_label: from.feed_label, google_budget_id: ids.budget,
    google_asset_group_id: ids.group, target_roas: null, included_item_ids: included,
    excluded_item_ids: listing.kind === 'exclude_items' ? listing.item_ids : [],
    loss_check_from: now, budget_changed_at: now,
    product_group_id: from.product_group_id,
  }).select('id').single()
  if (error || !row) {
    // Creată în Google, dar nesalvată: n-ar avea oprire de siguranță. O punem pe pauză și o scriem în jurnal,
    // iar pornirea rulează mai departe (data viitoare trecerea se reia de la capăt)
    logError('graduate', 'Campania PMax creată nu s-a salvat', { storeId: store.id, campaign: ids.campaign, error: error?.message })
    if (ids.campaign) await run(token, acc, [campaignStatusOp(acc.customer_id, ids.campaign, 'PAUSED')]).catch(() => undefined)
    await logAction(supabase, { user_id: from.user_id, store_id: from.store_id, ad_campaign_id: from.id, kind: 'launch', params: { google_campaign_id: ids.campaign }, status: 'failed', source: 'autopilot', error: error?.message ?? 'insert' })
    throw new ApplyError(storedMessage('sync.launch_save_failed', { campaign: ids.campaign ?? '' }))
  }

  // Dacă oprirea pornirii nu reușește acum, data viitoare găsim campania nouă (graduatedTwin) și doar o oprim
  await finishStarter(now)
  return { ...params, daily_budget: daily, new_campaign_id: row.id, google_campaign_id: ids.campaign }
}
