import { fromMicros, search } from '@/lib/google/ads'
import type { Account } from '@/lib/google/launch'

// =============================================
// Metricile din Google Ads pe care se sprijină Rapoartele și bucla de
// optimizare: pe zi și campanie, pe zi și produs (Shopping + PMax), termenii
// de căutare și starea campaniilor Hontrio. Sumele sunt în moneda contului.
// =============================================

export type Metrics = { cost: number; clicks: number; impressions: number; conversions: number; value: number }

type MetricsJson = { costMicros?: string; clicks?: string; impressions?: string; conversions?: number; conversionsValue?: number }

function metricsOf(m: MetricsJson | undefined): Metrics {
  return {
    cost: Math.round(fromMicros(m?.costMicros) * 100) / 100,
    clicks: Number(m?.clicks) || 0,
    impressions: Number(m?.impressions) || 0,
    conversions: Math.round((Number(m?.conversions) || 0) * 100) / 100,
    value: Math.round((Number(m?.conversionsValue) || 0) * 100) / 100,
  }
}

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)
const idList = (ids: string[]) => ids.filter(id => /^\d+$/.test(id)).join(', ')

export type CampaignDay = Metrics & { campaign_id: string; name: string; channel: string; date: string }

export async function fetchCampaignDays(token: string, acc: Account, from: string, to: string): Promise<CampaignDay[]> {
  if (!isDate(from) || !isDate(to)) return []
  const rows = await search<{ campaign?: { id?: string; name?: string; advertisingChannelType?: string }; segments?: { date?: string }; metrics?: MetricsJson }>(
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    token, acc.customer_id, `
      SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date,
             metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'`, acc.login_customer_id)
  return rows.filter(r => r.campaign?.id && r.segments?.date).map(r => ({
    campaign_id: String(r.campaign!.id),
    name: r.campaign!.name ?? '',
    channel: r.campaign!.advertisingChannelType ?? 'UNKNOWN',
    date: r.segments!.date!,
    ...metricsOf(r.metrics),
  }))
}

export type ProductDay = Metrics & { campaign_id: string; date: string; item_id: string }

/** Performanța pe produs, la Shopping standard și la PMax (Google dă ID-ul cu litere mici). */
export async function fetchProductDays(token: string, acc: Account, from: string, to: string): Promise<ProductDay[]> {
  if (!isDate(from) || !isDate(to)) return []
  const rows = await search<{ campaign?: { id?: string }; segments?: { date?: string; productItemId?: string }; metrics?: MetricsJson }>(
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    token, acc.customer_id, `
      SELECT campaign.id, segments.date, segments.product_item_id,
             metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
      FROM shopping_performance_view
      WHERE segments.date BETWEEN '${from}' AND '${to}'`, acc.login_customer_id)
  return rows.filter(r => r.campaign?.id && r.segments?.date && r.segments.productItemId).map(r => ({
    campaign_id: String(r.campaign!.id),
    date: r.segments!.date!,
    item_id: r.segments!.productItemId!.toLowerCase(),
    ...metricsOf(r.metrics),
  }))
}

export type SearchTerm = Metrics & { campaign_id: string; term: string }

/** Termenii de căutare ai campaniilor Hontrio: Shopping standard din search_term_view, PMax din campaign_search_term_view. */
export async function fetchSearchTerms(token: string, acc: Account, campaigns: { id: string; type: 'shopping' | 'performance_max' }[], from: string, to: string): Promise<SearchTerm[]> {
  if (!isDate(from) || !isDate(to)) return []
  const out: SearchTerm[] = []
  const shopping = idList(campaigns.filter(c => c.type === 'shopping').map(c => c.id))
  const pmax = idList(campaigns.filter(c => c.type === 'performance_max').map(c => c.id))
  type Row = { campaign?: { id?: string }; searchTermView?: { searchTerm?: string }; campaignSearchTermView?: { searchTerm?: string }; metrics?: MetricsJson }
  const add = (rows: Row[], key: 'searchTermView' | 'campaignSearchTermView') => {
    // Același termen poate apărea pe mai multe rânduri (grupuri, potriviri): se adună
    const acc = new Map<string, SearchTerm>()
    for (const r of rows) {
      const term = r[key]?.searchTerm
      const campaignId = r.campaign?.id
      if (!term || !campaignId) continue
      const k = `${campaignId}|${term}`
      const m = metricsOf(r.metrics)
      const prev = acc.get(k)
      acc.set(k, prev
        ? { ...prev, cost: prev.cost + m.cost, clicks: prev.clicks + m.clicks, impressions: prev.impressions + m.impressions, conversions: prev.conversions + m.conversions, value: prev.value + m.value }
        : { campaign_id: String(campaignId), term, ...m })
    }
    out.push(...acc.values())
  }
  if (shopping) {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    add(await search<Row>(token, acc.customer_id, `
      SELECT campaign.id, search_term_view.search_term,
             metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM search_term_view
      WHERE segments.date BETWEEN '${from}' AND '${to}' AND campaign.id IN (${shopping})`, acc.login_customer_id), 'searchTermView')
  }
  if (pmax) {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    add(await search<Row>(token, acc.customer_id, `
      SELECT campaign.id, campaign_search_term_view.search_term,
             metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM campaign_search_term_view
      WHERE segments.date BETWEEN '${from}' AND '${to}' AND campaign.id IN (${pmax})`, acc.login_customer_id), 'campaignSearchTermView')
  }
  return out
}

export type CampaignState = {
  id: string
  status: string
  primary_status: string | null
  reasons: string[]
  target_roas: number | null
  budget: number | null
  recommended_budget: number | null
}

/** Starea de acum a campaniilor Hontrio (inclusiv dacă bugetul le limitează). */
export async function fetchCampaignStates(token: string, acc: Account, ids: string[]): Promise<CampaignState[]> {
  const list = idList(ids)
  if (!list) return []
  const rows = await search<{
    campaign?: { id?: string; status?: string; primaryStatus?: string; primaryStatusReasons?: string[]; maximizeConversionValue?: { targetRoas?: number } }
    campaignBudget?: { amountMicros?: string; hasRecommendedBudget?: boolean; recommendedBudgetAmountMicros?: string }
  // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
  }>(token, acc.customer_id, `
    SELECT campaign.id, campaign.status, campaign.primary_status, campaign.primary_status_reasons,
           campaign.maximize_conversion_value.target_roas,
           campaign_budget.amount_micros, campaign_budget.has_recommended_budget, campaign_budget.recommended_budget_amount_micros
    FROM campaign
    WHERE campaign.id IN (${list})`, acc.login_customer_id)
  return rows.filter(r => r.campaign?.id).map(r => ({
    id: String(r.campaign!.id),
    status: r.campaign!.status ?? 'UNKNOWN',
    primary_status: r.campaign!.primaryStatus ?? null,
    reasons: r.campaign!.primaryStatusReasons ?? [],
    target_roas: r.campaign!.maximizeConversionValue?.targetRoas ?? null,
    budget: r.campaignBudget?.amountMicros ? fromMicros(r.campaignBudget.amountMicros) : null,
    recommended_budget: r.campaignBudget?.hasRecommendedBudget && r.campaignBudget.recommendedBudgetAmountMicros
      ? fromMicros(r.campaignBudget.recommendedBudgetAmountMicros) : null,
  }))
}

/** Nodurile existente ale arborelui de produse (ca să-l refacem întreg). */
export async function fetchListingNodes(token: string, acc: Account, campaign: { type: 'shopping' | 'performance_max'; group_id: string }) {
  if (!/^\d+$/.test(campaign.group_id)) return []
  if (campaign.type === 'performance_max') {
    // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
    const rows = await search<{ assetGroupListingGroupFilter?: { resourceName?: string; parentListingGroupFilter?: string } }>(token, acc.customer_id, `
      SELECT asset_group_listing_group_filter.resource_name, asset_group_listing_group_filter.parent_listing_group_filter
      FROM asset_group_listing_group_filter
      WHERE asset_group.id = ${campaign.group_id}`, acc.login_customer_id)
    return rows.filter(r => r.assetGroupListingGroupFilter?.resourceName).map(r => ({
      resourceName: r.assetGroupListingGroupFilter!.resourceName!, parent: r.assetGroupListingGroupFilter!.parentListingGroupFilter ?? null,
    }))
  }
  // i18n-ignore: interogare tehnică (GAQL / Merchant Reports)
  const rows = await search<{ adGroupCriterion?: { resourceName?: string; listingGroup?: { parentAdGroupCriterion?: string } } }>(token, acc.customer_id, `
    SELECT ad_group_criterion.resource_name, ad_group_criterion.listing_group.parent_ad_group_criterion
    FROM ad_group_criterion
    WHERE ad_group.id = ${campaign.group_id} AND ad_group_criterion.type = 'LISTING_GROUP' AND ad_group_criterion.status != 'REMOVED'`, acc.login_customer_id)
  return rows.filter(r => r.adGroupCriterion?.resourceName).map(r => ({
    resourceName: r.adGroupCriterion!.resourceName!, parent: r.adGroupCriterion!.listingGroup?.parentAdGroupCriterion ?? null,
  }))
}
