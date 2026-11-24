import { createAdminClient } from '@/lib/supabase/admin'
import { loadAdsData, type AdsData } from '@/lib/commerce/ads-data'
import { storeSetup, type StoreSetup } from '@/lib/commerce/setup'
import { storeAdsAccount, type StoreAdsAccount } from '@/lib/google/accounts'
import type { AuditResult } from '@/lib/google/audit'
import { feedLabelForStore, merchantIdForStore } from '@/lib/merchant/sync'
import { buildPlan, MODES, type Mode, type Plan } from '@/lib/campaigns/plan'
import { assignGroups, buildGroupPlans, groupOfferOf, parseGroup, todayIn, type GroupPlan, type ProductGroup } from '@/lib/campaigns/groups'
import { planChanges, savePlanOffers } from '@/lib/campaigns/plan-store'

// =============================================
// Tot ce trebuie ca să socotești planul unui magazin, citit la fel peste
// tot (pagina Campanii, Prezentarea generală, lansarea, pilotul din cron),
// ca cifrele să nu se contrazică între pagini.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export const STORE_PLAN_COLUMNS = 'id, user_id, platform, store_name, store_url, currency, country, language, timezone, connection_status, last_sync_at, platform_data, google_ads_customer_id, merchant_center_id, merchant_feed_label, merchant_label_index, merchant_synced_at, merchant_error'

export type PlanStore = {
  id: string; user_id: string; platform: string; store_name: string | null; store_url: string; currency: string | null
  country: string | null; language: string | null; timezone: string | null; connection_status: string | null
  last_sync_at: string | null; platform_data: unknown; google_ads_customer_id: string | null
  merchant_center_id: string | null; merchant_feed_label: string | null; merchant_label_index: number | null
  merchant_synced_at: string | null; merchant_error: string | null
}

export type StoredAudit = {
  checked_at: string
  customer_id: string
  result: AuditResult | null
  /** Mesaj salvat ca cheie de traducere, când auditul n-a putut citi contul. */
  error: string | null
}

export type Draft = { id: string | null; daily_budget: number | null; mode: Mode; max_daily_budget: number | null }

export type PlanContext = {
  setup: StoreSetup
  googleConnected: boolean
  account: StoreAdsAccount | null
  audit: StoredAudit | null
  draft: Draft
  data: AdsData
  plan: Plan
  /** Grupele omului, cu produsele fiecăreia (ofertă → grupă) și planul lor. */
  groups: ProductGroup[]
  assigned: Map<string, string>
  groupPlans: GroupPlan[]
  /** Azi, în fusul orar al magazinului (perioadele grupelor). */
  today: string
}

export const GROUP_COLUMNS = 'id, name, rules, daily_budget, campaign_type, starts_on, ends_on, position, status, launched_at'

/**
 * Știm starea fiecărei oferte la Google: Edinio o spune când Merchant Center e legat;
 * la WooCommerce și Shopify o citim noi din Merchant Center, după prima sincronizare.
 */
export function statusesKnown(setup: StoreSetup, store: { merchant_synced_at: string | null }): boolean {
  return setup.platform === 'edinio'
    ? setup.googleStatusKnown && setup.merchant.status === 'ok'
    : !!store.merchant_synced_at
}

export function parseAudit(row: { checked_at: string; customer_id: string; result: unknown } | null): StoredAudit | null {
  if (!row) return null
  const r = row.result as (AuditResult & { error?: undefined }) | { error?: string } | null
  const ok = !!r && (r as AuditResult).version === 1
  return {
    checked_at: row.checked_at,
    customer_id: row.customer_id,
    result: ok ? (r as AuditResult) : null,
    error: ok ? null : ((r as { error?: string } | null)?.error ?? null),
  }
}

/**
 * Planul magazinului, cu tot contextul lui. `errors` = ce n-a putut fi citit
 * (le scrie apelantul); fără oferte nu se poate socoti nimic, deci `context` e null.
 */
export async function loadPlanContext(supabase: Supabase, userId: string, store: PlanStore): Promise<{ context: PlanContext | null; errors: string[] }> {
  const setup = storeSetup(store)
  if (!setup) return { context: null, errors: [] }

  const googleRes = await supabase.from('google_connections').select('status').eq('user_id', userId).maybeSingle()
  const googleConnected = googleRes.data?.status === 'active'

  const [ads, draftRes, account, auditRes, groupsRes, liveRes, foreignRes] = await Promise.all([
    loadAdsData(supabase, store.id),
    supabase.from('ad_campaigns').select('id, daily_budget, mode, max_daily_budget').eq('store_id', store.id).eq('status', 'draft').maybeSingle(),
    // Contul Google Ads e al magazinului
    googleConnected ? storeAdsAccount(supabase, userId, store.google_ads_customer_id) : null,
    supabase.from('google_audits').select('checked_at, customer_id, result').eq('store_id', store.id).maybeSingle(),
    supabase.from('ad_product_groups').select(GROUP_COLUMNS).eq('store_id', store.id).order('position', { ascending: true }),
    // Bugetul campaniilor care rulează: avertismentele grupelor văd tot ce cheltuie magazinul
    supabase.from('ad_campaigns').select('product_group_id, daily_budget').eq('store_id', store.id).eq('status', 'active').not('google_campaign_id', 'is', null),
    // Produsele din Merchant Center care nu sunt ale magazinului (le scrie sincronizarea Merchant)
    supabase.from('merchant_insights').select('rows').eq('store_id', store.id).eq('kind', 'foreign_items').maybeSingle(),
  ])
  const errors = [...ads.errors]
  if (foreignRes.error) errors.push(`merchant_insights: ${foreignRes.error.message}`)
  const foreignIds = Array.isArray(foreignRes.data?.rows) ? (foreignRes.data.rows as unknown[]).filter((x): x is string => typeof x === 'string') : []
  if (draftRes.error) errors.push(`ad_campaigns: ${draftRes.error.message}`)
  if (auditRes.error) errors.push(`google_audits: ${auditRes.error.message}`)
  if (groupsRes.error) errors.push(`ad_product_groups: ${groupsRes.error.message}`)
  if (!ads.data) return { context: null, errors }

  // Grupele: fiecare ofertă în cel mult una; produsele celor lansate ies din campania principală
  const groups = ((groupsRes.data ?? []) as Record<string, unknown>[]).map(parseGroup)
  const assigned = assignGroups(ads.data.offers.map(groupOfferOf), groups)
  const liveGroups = new Set(groups.filter(g => g.status === 'live').map(g => g.id))

  const d = draftRes.data
  const draft: Draft = {
    id: d?.id ?? null,
    daily_budget: d?.daily_budget === null || d?.daily_budget === undefined ? null : Number(d.daily_budget),
    mode: MODES.includes(d?.mode as Mode) ? (d!.mode as Mode) : 'approve',
    max_daily_budget: d?.max_daily_budget === null || d?.max_daily_budget === undefined ? null : Number(d.max_daily_budget),
  }

  // Un audit făcut pe alt cont (omul a schimbat contul magazinului) nu mai spune nimic
  const storedAudit = parseAudit(auditRes.data)
  const audit = storedAudit && account && storedAudit.customer_id === account.customer_id ? storedAudit : null

  const plan = buildPlan({
    store: { currency: store.currency || 'RON', connection_status: store.connection_status, name: store.store_name, url: store.store_url },
    setup,
    google: {
      connected: googleConnected,
      account: account ? { customer_id: account.customer_id, name: account.descriptive_name, currency: account.currency_code } : null,
    },
    audit: audit?.result ?? null,
    merchant: {
      id: merchantIdForStore(store, audit?.result?.merchant_id ?? null),
      feed_label: feedLabelForStore(store),
      statuses_known: statusesKnown(setup, store),
      label_index: store.merchant_label_index,
      foreign_ids: foreignIds,
    },
    offers: ads.data.offers,
    sales90: ads.data.sales90,
    orders90: ads.data.orders90,
    googleAds90: ads.data.googleAds90,
    googleAds30: ads.data.googleAds30,
    googleSales30: ads.data.googleSales30,
    products30: ads.data.products30,
    groups: { assigned, live: liveGroups },
    settings: { daily_budget: draft.daily_budget, mode: draft.mode, max_daily_budget: draft.max_daily_budget },
  })

  // Ce a hotărât planul, lângă fiecare ofertă: listele din pagini se cer pe pagini, din baza de date.
  // Doar schimbările (de obicei niciuna); o eroare nu oprește planul
  const changes = planChanges(ads.data.offers, plan)
  if (changes.length) {
    const saveError = await savePlanOffers(supabase, store.id, changes)
    if (saveError) errors.push(saveError)
  }

  const today = todayIn(store.timezone)
  const live = ((liveRes.data ?? []) as { product_group_id: string | null; daily_budget: unknown }[])
    .map(c => ({ group_id: c.product_group_id, daily_budget: Number(c.daily_budget) || 0 }))
  const groupPlans = buildGroupPlans(groups, plan, assigned, live, today)

  return { context: { setup, googleConnected, account, audit, draft, data: ads.data, plan, groups, assigned, groupPlans, today }, errors }
}
