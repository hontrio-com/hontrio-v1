import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import {
  billableUnitMicros, GoogleAdsApiError, idFromResourceName, mutate, search,
  type GoogleAdsErrorDetail, type MutateOperationResponse,
} from '@/lib/google/ads'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import {
  buildLaunchOperations, campaignStatusOp, euDeclarationOps, FINAL_URL_SUFFIX,
  type LaunchIds, type LaunchSpec, type ListingSpec,
} from '@/lib/google/operations'
import { logAction, notify } from '@/lib/ads/journal'
import { syncMerchant } from '@/lib/merchant/sync'
import type { PlanContext, PlanStore } from '@/lib/campaigns/context'
import { CAMPAIGN_EXCLUSIONS, type Plan } from '@/lib/campaigns/plan'

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

/** Arborele de produse din plan: lista de ID-uri sau eticheta Hontrio. */
export function listingFromPlan(plan: Plan, labelIndex: number | null): ListingSpec {
  if (plan.exclusions.mode === 'label' && labelIndex !== null) return { kind: 'exclude_label', index: labelIndex, value: EXCLUDE_LABEL }
  return plan.exclusions.item_ids.length ? { kind: 'exclude_items', item_ids: plan.exclusions.item_ids } : { kind: 'all' }
}

/**
 * Lansarea cerută de om din pagina Campanii: treapta din plan, cu alegerea lui
 * pentru campaniile existente și confirmarea declarației UE.
 */
export async function launchFromPlan(supabase: Supabase, userId: string, store: PlanStore, ctx: PlanContext, opts: LaunchOptions): Promise<LaunchResult> {
  const { plan, account, audit } = ctx
  const fail = (reason: string, error: string, details?: GoogleAdsErrorDetail[]): LaunchResult => ({ ok: false, reason, error, details })

  if (plan.blockers.length) return fail('blocked', storedMessage('sync.launch_blocked'))
  if (!account || !audit?.result) return fail('audit_missing', storedMessage('sync.launch_audit_missing'))
  const a = audit.result
  if (a.eu_undeclared.length && !opts.declareEu) return fail('eu_confirm', storedMessage('sync.launch_eu_confirm'))
  if (a.overlap.length && !opts.overlap) return fail('overlap_choice', storedMessage('sync.launch_overlap_choice'))
  const merchantId = plan.structure.merchant_id
  if (!merchantId) return fail('no_merchant', storedMessage('sync.launch_no_merchant'))

  const { data: live } = await supabase.from('ad_campaigns').select('id').eq('store_id', store.id).in('status', ['active', 'paused']).limit(1)
  if (live?.length) return fail('already_active', storedMessage('sync.launch_already_active'))

  let token: string
  try {
    token = await getAccessTokenForUser(userId)
  } catch (err) {
    if (err instanceof GoogleAuthError) return fail('google_auth', storedMessage('sync.google_access_revoked'))
    throw err
  }
  const acc: Account = { customer_id: account.customer_id, login_customer_id: account.login_customer_id }
  const warnings: string[] = []

  try {
    // 1. Declarația UE pe campaniile omului: altfel Google blochează orice modificare în cont
    if (a.eu_undeclared.length) {
      await mutate(token, acc.customer_id, euDeclarationOps(acc.customer_id, a.eu_undeclared), { loginCustomerId: acc.login_customer_id })
      await logAction(supabase, { user_id: userId, store_id: store.id, kind: 'declare_eu', params: { campaigns: a.eu_undeclared }, status: 'applied', source: 'user' })
    }

    // 2. Eticheta Hontrio în Merchant Center, dacă arborele filtrează după ea
    const listing = listingFromPlan(plan, store.merchant_label_index)
    if (listing.kind === 'exclude_label') {
      const labels = new Map(plan.offers.filter(o => o.reason && CAMPAIGN_EXCLUSIONS.includes(o.reason)).map(o => [o.offer_id, EXCLUDE_LABEL]))
      const r = await syncMerchant(store.id, { auditMerchantId: a.merchant_id, labels })
      if (!r.ok) return fail('merchant_labels', storedMessage('sync.launch_labels_failed'))
    }

    // 3. Campania
    const currency = plan.campaign.currency
    const unit = await billableUnitMicros(token, acc.customer_id, currency, acc.login_customer_id)
    const country = plan.campaign.country || store.country
    if (!country) return fail('geo_unknown', storedMessage('sync.launch_geo_unknown', { country: '?' }))
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
    if (error || !row) {
      // Campania există în Google: n-o pierdem din vedere, o scriem în jurnal cu ID-ul ei
      logError('launch', 'Campania creată nu s-a salvat', { storeId: store.id, campaign: ids.campaign, error: error?.message })
      await logAction(supabase, { user_id: userId, store_id: store.id, kind: 'launch', params: { google_campaign_id: ids.campaign }, status: 'failed', source: 'user', error: error?.message ?? 'insert' })
      return fail('save_failed', storedMessage('sync.launch_save_failed', { campaign: ids.campaign ?? '' }))
    }

    // 4. Campaniile omului care vând aceleași produse: pe pauză, dacă a ales asta
    if (a.overlap.length && opts.overlap === 'pause') {
      try {
        await mutate(token, acc.customer_id, a.overlap.map(id => campaignStatusOp(acc.customer_id, id, 'PAUSED')), { loginCustomerId: acc.login_customer_id })
        await logAction(supabase, { user_id: userId, store_id: store.id, ad_campaign_id: row.id, kind: 'pause_existing', params: { campaigns: a.overlap }, status: 'applied', source: 'user' })
      } catch (err) {
        if (!(err instanceof GoogleAdsApiError)) throw err
        warnings.push(storedMessage('sync.launch_pause_existing_failed', { detail: err.message.slice(0, 200) }))
        await logAction(supabase, { user_id: userId, store_id: store.id, ad_campaign_id: row.id, kind: 'pause_existing', params: { campaigns: a.overlap }, status: 'failed', source: 'user', error: err.message.slice(0, 500) })
      }
    }

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
    if (err instanceof LaunchError) return fail(err.reason, err.stored, err.details)
    if (err instanceof GoogleAdsApiError) {
      return fail('google_error', storedMessage('sync.launch_google_error', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) }), err.details)
    }
    if (err instanceof GoogleAuthError) return fail('google_auth', storedMessage('sync.google_access_revoked'))
    throw err
  }
}
