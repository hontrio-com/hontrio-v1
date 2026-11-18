import { fromMicros, GoogleAdsApiError, search } from '@/lib/google/ads'

// =============================================
// Auditul contului Google Ads înainte de lansare (și zilnic, în cron).
// Citește contul cu 6 interogări GAQL, apoi `evaluateAudit` (funcție pură)
// spune ce blochează lansarea, ce trebuie ales și ce e doar de știut.
// Vezi docs/campanii/SPECIFICATIE.md §1.
// =============================================

// Rândurile REST (camelCase; int64 vin ca text, valorile implicite lipsesc)
type CustomerRow = { customer?: { id?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string; autoTaggingEnabled?: boolean; manager?: boolean; testAccount?: boolean } }
type ProductLinkRow = { productLink?: { type?: string; merchantCenter?: { merchantCenterId?: string } } }
type ConversionActionRow = {
  conversionAction?: {
    id?: string; name?: string; status?: string; category?: string; origin?: string; primaryForGoal?: boolean
    valueSettings?: { defaultValue?: number; alwaysUseDefaultValue?: boolean }
  }
}
type GoalRow = { customerConversionGoal?: { category?: string; origin?: string; biddable?: boolean } }
type CampaignRow = {
  campaign?: {
    id?: string; name?: string; status?: string; advertisingChannelType?: string
    shoppingSetting?: { merchantId?: string; feedLabel?: string }
    missingEuPoliticalAdvertisingDeclaration?: boolean
  }
  campaignBudget?: { amountMicros?: string }
}
type MetricsRow = { campaign?: { id?: string; advertisingChannelType?: string }; metrics?: { costMicros?: string; conversions?: number; conversionsValue?: number } }
type PurchaseRow = { metrics?: { conversions?: number } }

export type AuditRaw = {
  customer: CustomerRow[]
  productLinks: ProductLinkRow[]
  conversionActions: ConversionActionRow[]
  goals: GoalRow[]
  campaigns: CampaignRow[]
  metrics30: MetricsRow[]
  /** Conversiile de cumpărare din 30 de zile (segments.conversion_action_category); null = nu s-au putut citi. */
  purchase30?: PurchaseRow[] | null
}

export type AuditCheckId =
  | 'account_manager' | 'currency_mismatch' | 'auto_tagging_off'
  | 'merchant_not_linked' | 'merchant_other' | 'merchant_choose'
  | 'purchase_missing' | 'purchase_not_primary' | 'purchase_no_value' | 'purchase_duplicate' | 'no_recent_conversions'
  | 'eu_undeclared' | 'overlap' | 'search_active'

/**
 * blocker = lansarea nu se poate face; choice = omul alege la lansare
 * (declarația UE, campaniile care se suprapun); warning/info = de știut.
 */
export type AuditLevel = 'blocker' | 'choice' | 'warning' | 'info'
export type AuditCheck = { id: AuditCheckId; level: AuditLevel; params?: Record<string, string | number> }

export type AuditCampaign = {
  id: string
  name: string
  status: string
  channel: string
  merchant_id: string | null
  feed_label: string | null
  eu_missing: boolean
  hontrio: boolean
  daily_budget: number | null
  cost30: number
  conversions30: number
  value30: number
}

export type AuditResult = {
  version: 1
  customer: { id: string; name: string | null; currency: string | null; time_zone: string | null; auto_tagging: boolean; manager: boolean; test_account: boolean }
  /** Conturile Merchant Center legate de contul Google Ads. */
  merchant_ids: string[]
  /** Contul Merchant pe care rulează campaniile Hontrio; null = trebuie ales sau legat. */
  merchant_id: string | null
  purchase: { actions: { id: string; name: string; primary: boolean; has_value: boolean; origin: string | null }[] }
  goals: { category: string; origin: string; biddable: boolean }[]
  /**
   * Ultimele 30 de zile: tot contul și doar campaniile Shopping/PMax. `purchase_conversions30` = doar
   * cumpărările (treapta); lipsește în auditurile mai vechi sau când Google n-a răspuns la interogare.
   */
  history: {
    conversions30: number; value30: number; cost30: number; shopping_conversions30: number; shopping_value30: number; shopping_cost30: number
    purchase_conversions30?: number | null
  }
  campaigns: AuditCampaign[]
  /** Campaniile omului (Shopping/PMax active, pe același Merchant) care ar concura cu ale noastre. */
  overlap: string[]
  /** Campaniile fără declarația UE: din 1.04.2026 blochează orice modificare prin API. */
  eu_undeclared: string[]
  search_active: boolean
  checks: AuditCheck[]
}

export type AuditContext = {
  storeCurrency: string
  /** Merchant Center-ul știut din magazin (Edinio) sau ales de om; null = nu-l știm. */
  storeMerchantId: string | null
  hontrioCampaignIds: Set<string>
}

const SHOPPING_CHANNELS = new Set(['SHOPPING', 'PERFORMANCE_MAX'])
const round2 = (n: number) => Math.round(n * 100) / 100

export async function fetchAuditRaw(accessToken: string, customerId: string, loginCustomerId?: string | null): Promise<AuditRaw> {
  const q = <T>(query: string) => search<T>(accessToken, customerId, query, loginCustomerId)
  // Doar cumpărările, pentru treaptă. Fără să oprească auditul: dacă Google n-o primește, treapta se
  // socotește din toate conversiile, ca înainte
  const purchases = q<PurchaseRow>(`
    SELECT segments.conversion_action_category, metrics.conversions
    FROM customer
    WHERE segments.date DURING LAST_30_DAYS AND segments.conversion_action_category = 'PURCHASE'`)
    .catch((err: unknown) => { if (err instanceof GoogleAdsApiError) return null; throw err })
  const [customer, productLinks, conversionActions, goals, campaigns, metrics30, purchase30] = await Promise.all([
    q<CustomerRow>(`
      SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone,
             customer.auto_tagging_enabled, customer.manager, customer.test_account
      FROM customer`),
    q<ProductLinkRow>(`
      SELECT product_link.product_link_id, product_link.type, product_link.merchant_center.merchant_center_id
      FROM product_link
      WHERE product_link.type = 'MERCHANT_CENTER'`),
    q<ConversionActionRow>(`
      SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category,
             conversion_action.origin, conversion_action.primary_for_goal,
             conversion_action.value_settings.default_value, conversion_action.value_settings.always_use_default_value
      FROM conversion_action
      WHERE conversion_action.status = 'ENABLED'`),
    q<GoalRow>(`
      SELECT customer_conversion_goal.category, customer_conversion_goal.origin, customer_conversion_goal.biddable
      FROM customer_conversion_goal`),
    q<CampaignRow>(`
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             campaign.shopping_setting.merchant_id, campaign.shopping_setting.feed_label,
             campaign.missing_eu_political_advertising_declaration, campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'`),
    // Toate campaniile, și cele șterse: Google numără conversiile contului, nu ale campaniilor vii
    q<MetricsRow>(`
      SELECT campaign.id, campaign.advertising_channel_type,
             metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS`),
    purchases,
  ])
  return { customer, productLinks, conversionActions, goals, campaigns, metrics30, purchase30 }
}

/** Conversiile de cumpărare din 30 de zile (treapta); un audit fără ele folosește toate conversiile. */
export function purchaseConversions30(audit: Pick<AuditResult, 'history'>): number {
  const p = audit.history.purchase_conversions30
  return typeof p === 'number' ? p : audit.history.conversions30
}

export function evaluateAudit(raw: AuditRaw, ctx: AuditContext): AuditResult {
  const c = raw.customer[0]?.customer ?? {}
  const customer = {
    id: String(c.id ?? ''),
    name: c.descriptiveName ?? null,
    currency: c.currencyCode ?? null,
    time_zone: c.timeZone ?? null,
    auto_tagging: !!c.autoTaggingEnabled,
    manager: !!c.manager,
    test_account: !!c.testAccount,
  }

  const merchantIds = [...new Set(raw.productLinks
    .filter(r => r.productLink?.type === 'MERCHANT_CENTER' && r.productLink.merchantCenter?.merchantCenterId)
    .map(r => String(r.productLink!.merchantCenter!.merchantCenterId)))]

  // Metricile pe campanie (30 de zile)
  const perCampaign = new Map<string, { cost: number; conversions: number; value: number }>()
  const history = { conversions30: 0, value30: 0, cost30: 0, shopping_conversions30: 0, shopping_value30: 0, shopping_cost30: 0 }
  for (const r of raw.metrics30) {
    const id = String(r.campaign?.id ?? '')
    const cost = fromMicros(r.metrics?.costMicros)
    const conversions = Number(r.metrics?.conversions) || 0
    const value = Number(r.metrics?.conversionsValue) || 0
    const prev = perCampaign.get(id) ?? { cost: 0, conversions: 0, value: 0 }
    perCampaign.set(id, { cost: prev.cost + cost, conversions: prev.conversions + conversions, value: prev.value + value })
    history.cost30 += cost; history.conversions30 += conversions; history.value30 += value
    if (SHOPPING_CHANNELS.has(r.campaign?.advertisingChannelType ?? '')) {
      history.shopping_cost30 += cost; history.shopping_conversions30 += conversions; history.shopping_value30 += value
    }
  }
  for (const k of Object.keys(history) as (keyof typeof history)[]) history[k] = round2(history[k])
  // Cumpărările (treapta): null când interogarea lor n-a mers
  const purchaseConversions = raw.purchase30
    ? round2(raw.purchase30.reduce((s, r) => s + (Number(r.metrics?.conversions) || 0), 0))
    : null

  const campaigns: AuditCampaign[] = raw.campaigns.filter(r => r.campaign?.id).map(r => {
    const x = r.campaign!
    const id = String(x.id)
    const m = perCampaign.get(id) ?? { cost: 0, conversions: 0, value: 0 }
    return {
      id,
      name: x.name ?? id,
      status: x.status ?? 'UNKNOWN',
      channel: x.advertisingChannelType ?? 'UNKNOWN',
      merchant_id: x.shoppingSetting?.merchantId ? String(x.shoppingSetting.merchantId) : null,
      feed_label: x.shoppingSetting?.feedLabel ?? null,
      eu_missing: !!x.missingEuPoliticalAdvertisingDeclaration,
      hontrio: ctx.hontrioCampaignIds.has(id),
      daily_budget: r.campaignBudget?.amountMicros ? round2(fromMicros(r.campaignBudget.amountMicros)) : null,
      cost30: round2(m.cost),
      conversions30: round2(m.conversions),
      value30: round2(m.value),
    }
  })

  const checks: AuditCheck[] = []

  // ── Contul ──────────────────────────────────────────────────────────────
  if (customer.manager) checks.push({ id: 'account_manager', level: 'blocker' })
  if (customer.currency && customer.currency !== ctx.storeCurrency) {
    checks.push({ id: 'currency_mismatch', level: 'blocker', params: { account: customer.currency, store: ctx.storeCurrency } })
  }
  if (!customer.auto_tagging) checks.push({ id: 'auto_tagging_off', level: 'warning' })

  // ── Merchant Center ─────────────────────────────────────────────────────
  let merchantId: string | null = null
  if (ctx.storeMerchantId) {
    if (merchantIds.includes(ctx.storeMerchantId)) merchantId = ctx.storeMerchantId
    else checks.push({ id: merchantIds.length ? 'merchant_other' : 'merchant_not_linked', level: 'blocker', params: { merchant: ctx.storeMerchantId } })
  } else if (merchantIds.length === 1) merchantId = merchantIds[0]
  else if (merchantIds.length > 1) checks.push({ id: 'merchant_choose', level: 'blocker', params: { count: merchantIds.length } })
  else checks.push({ id: 'merchant_not_linked', level: 'blocker', params: { merchant: '' } })

  // ── Conversia de cumpărare ──────────────────────────────────────────────
  const purchases = raw.conversionActions
    .map(r => r.conversionAction)
    .filter((a): a is NonNullable<typeof a> => !!a && a.status === 'ENABLED' && a.category === 'PURCHASE')
    .map(a => ({
      id: String(a.id ?? ''),
      name: a.name ?? '',
      primary: !!a.primaryForGoal,
      // Cu „folosește mereu valoarea implicită", Google n-are valoarea reală a comenzii
      has_value: !a.valueSettings?.alwaysUseDefaultValue,
      origin: a.origin ?? null,
    }))
  if (!purchases.length) checks.push({ id: 'purchase_missing', level: 'blocker' })
  else if (!purchases.some(p => p.primary)) checks.push({ id: 'purchase_not_primary', level: 'blocker' })
  // Fără valoarea comenzii, pilotul n-are ROAS: oprirea de siguranță și produsele s-ar judeca greșit
  else if (!purchases.some(p => p.primary && p.has_value)) checks.push({ id: 'purchase_no_value', level: 'blocker' })
  // Mai multe cumpărări principale pe site (ex. tagul magazinului și importuri din GA4): aceeași comandă
  // se poate număra de mai multe ori, iar ROAS-ul și oprirea de siguranță ar ieși umflate
  const primaryWeb = purchases.filter(p => p.primary && p.origin === 'WEBSITE').length
  if (primaryWeb > 1) checks.push({ id: 'purchase_duplicate', level: 'warning', params: { count: primaryWeb } })
  if (purchases.length && history.conversions30 === 0) checks.push({ id: 'no_recent_conversions', level: 'info' })

  // ── Campaniile existente ────────────────────────────────────────────────
  const euUndeclared = campaigns.filter(x => x.eu_missing).map(x => x.id)
  if (euUndeclared.length) checks.push({ id: 'eu_undeclared', level: 'choice', params: { count: euUndeclared.length } })

  const overlap = campaigns
    .filter(x => !x.hontrio && x.status === 'ENABLED' && SHOPPING_CHANNELS.has(x.channel) && x.merchant_id !== null && x.merchant_id === merchantId)
    .map(x => x.id)
  if (overlap.length) checks.push({ id: 'overlap', level: 'choice', params: { count: overlap.length } })

  // Doar o campanie Search care chiar rulează (a cheltuit în 30 de zile) prinde căutările după numele magazinului.
  // Una pornită, dar fără nicio afișare, nu le prinde, iar cuvântul negativ din campania Hontrio le-ar pierde
  const searchActive = campaigns.some(x => !x.hontrio && x.status === 'ENABLED' && x.channel === 'SEARCH' && x.cost30 > 0)
  if (searchActive) checks.push({ id: 'search_active', level: 'info' })

  return {
    version: 1,
    customer,
    merchant_ids: merchantIds,
    merchant_id: merchantId,
    purchase: { actions: purchases },
    goals: raw.goals
      .map(r => r.customerConversionGoal)
      .filter((g): g is NonNullable<typeof g> => !!g?.category && !!g.origin)
      .map(g => ({ category: g.category!, origin: g.origin!, biddable: !!g.biddable })),
    history: { ...history, purchase_conversions30: purchaseConversions },
    campaigns,
    overlap,
    eu_undeclared: euUndeclared,
    search_active: searchActive,
    checks,
  }
}

/** Auditul e proaspăt cât timp e mai nou de atât (cronul îl reface zilnic). */
export const AUDIT_FRESH_MS = 24 * 60 * 60 * 1000

export function blockingChecks(audit: AuditResult): AuditCheck[] {
  return audit.checks.filter(c => c.level === 'blocker')
}
