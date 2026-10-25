import { breakEvenRoas, economicsOf, marginOf, round1, THIN_MARGIN, type OrderTotals } from '@/lib/ads/economics'
import type { AdsMode, Offer, Sales } from '@/lib/commerce/ads-data'
import type { SetupStatus, StoreSetup } from '@/lib/commerce/setup'
import type { AuditResult } from '@/lib/google/audit'
import { MAX_LISTING_ITEMS } from '@/lib/google/operations'

// =============================================
// Planul de campanie — ce va crea Hontrio în contul Google Ads al omului,
// socotit din datele magazinului și din auditul contului: treapta (pornire
// sau creștere), ce produse intră, ROAS-ul țintă din pragul de profit,
// bugetul, plafonul de CPC și limita de pierdere. Funcție pură, ca motorul
// de recomandări. Vezi docs/campanii/SPECIFICATIE.md §2–§5.
//
// O singură campanie pe tot catalogul eligibil: cu puține conversii, o
// campanie învață mai repede decât mai multe mici. Segmentarea pe marje vine
// mai târziu, din bucla de optimizare.
// =============================================

export type Goal = 'growth' | 'balanced' | 'profit'
export type Mode = 'approve' | 'auto'
export type Stage = 'starter' | 'growth'

/** Din profitul unei vânzări (înainte de reclamă), cât rămâne comerciantului. */
export const GOAL_KEEP: Record<Goal, number> = { growth: 0.1, balanced: 0.25, profit: 0.4 }
export const GOALS = Object.keys(GOAL_KEEP) as Goal[]
export const MODES: Mode[] = ['approve', 'auto']

/** Google învață o campanie cu ~30 de conversii pe lună. */
export const CONVERSIONS_PER_MONTH = 30
/** Minimul Google pentru ROAS țintă la Shopping: 15 conversii în ultimele 30 de zile. */
export const GROWTH_MIN_CONVERSIONS = 15
/** Rata de conversie presupusă pentru plafonul de CPC la pornire (prudentă pentru Shopping). */
export const ASSUMED_CONVERSION_RATE = 0.01
/** Limita de pierdere: atâtea „costuri pe comandă la prag" fără nicio conversie / cu ROAS sub jumătate din prag. */
export const LOSS_NO_CONVERSIONS = 3
export const LOSS_LOW_ROAS = 6
/** Sub plafonul ăsta (în moneda contului) campania de pornire va avea foarte puțin trafic. */
const LOW_CPC = 0.05
const DAYS_PER_MONTH = 30.4
/** Sub partea asta din vânzări acoperită de costuri, marja medie nu e de încredere. */
const MIN_COST_COVERAGE = 0.5

export type Reason =
  // Nu pot rula: se repară în magazin
  | 'out_of_stock' | 'google_rejected' | 'price_unconfirmed' | 'not_in_merchant'
  // Scoasă de om
  | 'manual'
  // Hotărârea Hontrio, pe care omul o poate întoarce
  | 'negative_margin' | 'thin_margin'
  // Scoasă de pilot după cifrele din Google Ads (omul o poate include la loc)
  | 'ads_no_sales' | 'ads_unprofitable'

/** Motivele pentru care o ofertă care ar putea rula e scoasă din campanie (în arborele de produse). */
export const CAMPAIGN_EXCLUSIONS: Reason[] = ['manual', 'negative_margin', 'thin_margin', 'ads_no_sales', 'ads_unprofitable']

export type PlanOffer = {
  offer_id: string
  /** ID-ul din Merchant Center, pe care se exclude produsul în campanie; null = nepotrivit încă. */
  item_id: string | null
  title: string
  variant_title: string | null
  image_url: string | null
  price: number
  cost_price: number | null
  /** Vânzările de pe site din ultimele 90 de zile. */
  units: number
  revenue: number
  margin: number | null
  /** ROAS-ul de la care vânzarea produsului își plătește reclama. */
  break_even: number | null
  mode: AdsMode
  /** De ce nu intră în campanie; null = intră. */
  reason: Reason | null
  /** Ce l-ar ține pe dinafară după Hontrio, chiar dacă omul l-a inclus. */
  margin_issue: 'negative_margin' | 'thin_margin' | null
}

export type BlockerId =
  | 'store' | 'google_ads' | 'ads_account' | 'currency' | 'merchant' | 'conversion' | 'no_offers' | 'costs'
  // Din auditul contului Google Ads
  | 'audit' | 'account_manager' | 'merchant_not_linked' | 'merchant_other' | 'merchant_choose'
  | 'purchase_missing' | 'purchase_not_primary' | 'purchase_no_value' | 'too_many_exclusions'

export type PlanInput = {
  store: { currency: string; connection_status: string | null; name: string | null; url: string | null }
  /** Ce e pregătit în magazin și unde se repară ce lipsește, pe platforma lui. */
  setup: StoreSetup
  google: { connected: boolean; account: { customer_id: string; name: string | null; currency: string | null } | null }
  /** Ultimul audit al contului Google Ads; null = încă nefăcut (sau eșuat). */
  audit: AuditResult | null
  merchant: {
    id: string | null
    feed_label: string | null
    /**
     * Starea ofertelor la Google e știută (de la Edinio cu Merchant legat, sau din Merchant
     * Center la celelalte): o ofertă fără stare e atunci „netrimisă".
     */
    statuses_known: boolean
    /** custom_label_N liber pentru Hontrio (cataloagele prea mari pentru lista de ID-uri). */
    label_index: number | null
  }
  offers: Offer[]
  sales90: Sales
  orders90: OrderTotals
  googleAds90: { orders: number; total: number }
  googleAds30: { orders: number; total: number }
  settings: { goal: Goal; daily_budget: number | null; mode: Mode; max_daily_budget: number | null }
}

export type Plan = {
  platform: { id: StoreSetup['platform']; name: string }
  /**
   * Ce mai trebuie făcut până la lansare, în ordinea în care se face.
   * `variant` = varianta textului: platforma, unde pasul se face altfel (Merchant
   * Center, conversia); „catalog" la costuri, când acoperirea e pe oferte (fără vânzări).
   */
  blockers: { id: BlockerId; href: string; external: boolean; variant?: string; params?: Record<string, string | number> }[]
  /** Pornire = Shopping standard cu CPC plafonat; creștere = Performance Max doar pe feed. */
  stage: { id: Stage; conversions30: number; basis: 'google_ads' | 'store' }
  campaign: {
    country: string | null
    language: string | null
    currency: string
    account: { customer_id: string; name: string | null } | null
    merchant: { status: SetupStatus; via: string | null }
    conversion: { status: SetupStatus; via: string | null }
  }
  structure: {
    type: 'shopping' | 'performance_max'
    /** Ținta de pornire la creștere: ROAS-ul real din cont, dar nu sub prag. */
    start_target: number | null
    cpc_ceiling: number | null
    cpc_ceiling_low: boolean
    /** Cheltuiala la care pilotul oprește campania: fără nicio conversie / cu ROAS sub jumătate din prag. */
    loss_limit: { no_conversions: number; low_roas: number } | null
    merchant_id: string | null
    feed_label: string | null
    /** Numele magazinului ca cuvânt negativ, când contul are o campanie Search (căutările pe brand sunt ale ei). */
    brand_negatives: string[]
  }
  economics: {
    /** Marja medie a produselor incluse: din vânzări sau, fără vânzări, din catalog. */
    margin: number | null
    margin_basis: 'sales' | 'catalog' | null
    /** Cât din vânzările (sau ofertele) incluse are preț de cost. */
    cost_coverage: number
    /** Pe ce se măsoară acoperirea: vânzările incluse sau, fără vânzări, ofertele incluse. */
    cost_basis: 'sales' | 'catalog' | null
    vat_pct: number
    /** Cota de TVA e cea standard a țării (comenzile n-au TVA). */
    vat_assumed: boolean
    discount_pct: number
    aov: number | null
    break_even: number | null
  }
  goal: Goal
  targets: Record<Goal, number | null>
  target_roas: number | null
  budget: { suggested: number | null; chosen: number | null; daily: number | null }
  settings: { mode: Mode; max_daily_budget: number | null }
  /** Pe lună, dacă campania atinge ROAS-ul țintă. */
  forecast: { spend: number; revenue: number; orders: number | null; profit: number } | null
  history: { google_ads_orders: number; google_ads_total: number }
  /** Ce se exclude în campanie, după ID-ul din Merchant Center. */
  exclusions: { item_ids: string[]; unmatched: number; mode: 'items' | 'label' | 'too_many' }
  offers: PlanOffer[]
  counts: { included: number; excluded: number }
}

const REJECTED = ['disapproved', 'error', 'expirat']

/** Un buget ușor de citit: din 10 în 10 peste 100, din 5 în 5 peste 20. */
function niceBudget(n: number): number {
  if (n >= 100) return Math.round(n / 10) * 10
  if (n >= 20) return Math.round(n / 5) * 5
  return Math.max(1, Math.round(n))
}

function marginIssue(margin: number | null): PlanOffer['margin_issue'] {
  if (margin === null) return null
  return margin <= 0 ? 'negative_margin' : margin < THIN_MARGIN ? 'thin_margin' : null
}

function reasonOf(o: Offer, issue: PlanOffer['margin_issue'], statusKnown: boolean): Reason | null {
  if (!o.available) return 'out_of_stock'
  if (o.google_status && REJECTED.includes(o.google_status)) return 'google_rejected'
  if (o.google_status === 'exclus') return 'price_unconfirmed'
  // O ofertă fără stare e „netrimisă" doar dacă știm starea și Merchant Center e legat;
  // altfel lipsa lui e deja un pas de făcut, nu vina ofertei
  if (statusKnown && !o.google_status) return 'not_in_merchant'
  if (o.ads_mode === 'exclude') return 'manual'
  if (o.ads_mode === 'include') return null
  if (o.ads_auto_reason) return o.ads_auto_reason === 'no_sales' ? 'ads_no_sales' : 'ads_unprofitable'
  return issue
}

/** O țintă de pornire peste atât din ținta obiectivului ar ține o campanie nouă fără trafic. */
export const START_TARGET_CAP = 1.5

/**
 * Ținta cu care pornește o campanie PMax: ROAS-ul pe care contul îl face deja
 * (Google cere să pleci din istoric), dar niciodată sub prag și nici peste
 * 1,5 × ținta obiectivului; de acolo o mută bucla, treptat.
 */
export function startingTarget(historical: number | null, breakEven: number, goalTarget: number | null): number {
  const goal = goalTarget ?? breakEven
  const cap = Math.max(goal, breakEven) * START_TARGET_CAP
  return round1(Math.min(cap, Math.max(breakEven, historical ?? goal)))
}

/** „Lampi LED SRL" + „https://www.lampi-led.ro" → ['lampi led'] (fără forma juridică, fără duplicate). */
export function brandTerms(name: string | null, url: string | null): string[] {
  const clean = (s: string) => s.toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|pfa|ii|ltd|llc|gmbh|inc)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
  const terms = new Set<string>()
  if (name) terms.add(clean(name))
  if (url) {
    try { terms.add(clean(new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').split('.')[0])) } catch {}
  }
  return [...terms].filter(t => t.length >= 3).slice(0, 2)
}

export function buildPlan(input: PlanInput): Plan {
  const { store, setup, audit } = input
  const econ = economicsOf(input.orders90, setup.pricesIncludeVat, setup.assumedVatRate)
  const statusKnown = input.merchant.statuses_known

  const offers: PlanOffer[] = input.offers.map(o => {
    const s = input.sales90.get(o.offer_id) ?? { units: 0, revenue: 0 }
    const margin = o.cost_price === null ? null : marginOf(o.price, o.cost_price)
    const issue = marginIssue(margin)
    return {
      offer_id: o.offer_id,
      item_id: o.merchant_offer_id ?? (setup.platform === 'edinio' ? o.offer_id : null),
      title: o.product_name || o.title,
      variant_title: o.variant_title,
      image_url: o.image_url,
      price: o.price,
      cost_price: o.cost_price,
      units: s.units,
      revenue: s.revenue,
      margin,
      break_even: margin === null ? null : breakEvenRoas(margin, econ),
      mode: o.ads_mode,
      reason: reasonOf(o, issue, statusKnown),
      margin_issue: issue,
    }
  }).sort((a, b) => b.revenue - a.revenue || b.price - a.price)

  // ── Marja produselor care intră în campanie ──────────────────────────────
  const included = offers.filter(o => o.reason === null)
  const soldIncluded = included.filter(o => o.revenue > 0)
  const soldRevenue = soldIncluded.reduce((s, o) => s + o.revenue, 0)
  let margin: number | null = null
  let basis: Plan['economics']['margin_basis'] = null
  let coverage = 0
  if (soldRevenue > 0) {
    const withCost = soldIncluded.filter(o => o.cost_price !== null)
    const costRevenue = withCost.reduce((s, o) => s + o.revenue, 0)
    coverage = costRevenue / soldRevenue
    if (coverage >= MIN_COST_COVERAGE) {
      margin = withCost.reduce((s, o) => s + o.revenue - o.units * o.cost_price!, 0) / costRevenue
      basis = 'sales'
    }
  } else if (included.length) {
    // Fără vânzări, media marjelor din catalog
    const withCost = included.filter(o => o.margin !== null)
    coverage = withCost.length / included.length
    if (coverage >= MIN_COST_COVERAGE) {
      margin = withCost.reduce((s, o) => s + o.margin!, 0) / withCost.length
      basis = 'catalog'
    }
  }
  const breakEven = margin === null ? null : breakEvenRoas(margin, econ)
  const targets = Object.fromEntries(
    GOALS.map(g => [g, breakEven === null ? null : round1(breakEven / (1 - GOAL_KEEP[g]))]),
  ) as Record<Goal, number | null>
  const target = targets[input.settings.goal]

  // ── Bugetul: cât ajunge pentru ~30 de vânzări pe lună la ROAS-ul țintă ──
  const aov = econ.aov ?? (included.length ? included.reduce((s, o) => s + o.price, 0) / included.length : null)
  const suggested = target !== null && aov !== null ? niceBudget((CONVERSIONS_PER_MONTH * aov) / target / DAYS_PER_MONTH) : null
  const chosen = input.settings.daily_budget
  const daily = chosen ?? suggested

  let forecast: Plan['forecast'] = null
  if (target !== null && breakEven !== null && daily !== null) {
    const spend = daily * DAYS_PER_MONTH
    const revenue = spend * target
    // Profitul rămas după reclame: valoarea ÷ prag = profitul dinaintea reclamei
    forecast = { spend, revenue, orders: aov ? revenue / aov : null, profit: revenue / breakEven - spend }
  }

  // ── Treapta: Google cere 15 conversii în 30 de zile pentru ROAS țintă la Shopping ──
  const conversions30 = audit ? audit.history.conversions30 : input.googleAds30.orders
  const stageId: Stage = conversions30 >= GROWTH_MIN_CONVERSIONS ? 'growth' : 'starter'

  // Ținta de pornire la creștere: ROAS-ul pe care contul îl face deja (Shopping/PMax, altfel tot contul)
  let historical: number | null = null
  if (audit) {
    const h = audit.history
    if (h.shopping_cost30 > 0 && h.shopping_conversions30 >= 5) historical = h.shopping_value30 / h.shopping_cost30
    else if (h.cost30 > 0 && h.conversions30 >= 5) historical = h.value30 / h.cost30
  }
  const startTarget = stageId === 'growth' && breakEven !== null
    ? startingTarget(historical, breakEven, target)
    : null

  // Plafonul de CPC la pornire: cât poate costa un click ca, la rata presupusă, comanda să nu piardă bani
  const cpcCeiling = stageId === 'starter' && breakEven !== null && aov !== null
    ? Math.max(0.01, Math.floor(((aov * ASSUMED_CONVERSION_RATE) / breakEven) * 100) / 100)
    : null
  const cpaAtBreakEven = breakEven !== null && aov !== null ? aov / breakEven : null
  const lossLimit = cpaAtBreakEven !== null
    ? { no_conversions: Math.ceil(LOSS_NO_CONVERSIONS * cpaAtBreakEven), low_roas: Math.ceil(LOSS_LOW_ROAS * cpaAtBreakEven) }
    : null

  // ── Excluderile din campanie, după ID-ul din Merchant Center ─────────────
  const excludedOffers = offers.filter(o => o.reason !== null && CAMPAIGN_EXCLUSIONS.includes(o.reason))
  const itemIds = [...new Set(excludedOffers.map(o => o.item_id).filter((x): x is string => !!x))]
  const unmatched = excludedOffers.filter(o => !o.item_id).length
  // Shopping standard duce 20.000 de noduri; PMax 1.000 pe grup, iar peste ele trece pe eticheta Hontrio
  const exclusionMode: Plan['exclusions']['mode'] = stageId === 'starter' || itemIds.length <= MAX_LISTING_ITEMS
    ? 'items' : input.merchant.label_index !== null ? 'label' : 'too_many'

  // ── Ce lipsește până la lansare ──────────────────────────────────────────
  const blockers: Plan['blockers'] = []
  const settingsPage = { href: '/settings?tab=integrations', external: false }
  if (store.connection_status !== 'active') blockers.push({ id: 'store', ...settingsPage })
  if (!input.google.connected) blockers.push({ id: 'google_ads', ...settingsPage })
  else if (!input.google.account) blockers.push({ id: 'ads_account', ...settingsPage })
  else if (input.google.account.currency && input.google.account.currency !== store.currency) {
    // Bugetul și valorile conversiilor sunt în moneda contului
    blockers.push({ id: 'currency', ...settingsPage, params: { account: input.google.account.currency, store: store.currency } })
  }
  // „De verificat" nu oprește planul: pluginul se verifică la lansare, prin audit
  if (setup.merchant.status === 'missing') blockers.push({ id: 'merchant', href: setup.merchant.href, external: true, variant: setup.platform })
  if (setup.conversion.status === 'missing') blockers.push({ id: 'conversion', href: setup.conversion.href, external: true, variant: setup.platform })
  if (!included.length) blockers.push({ id: 'no_offers', href: '/products', external: false })
  else if (margin === null) {
    blockers.push({
      id: 'costs', href: '/products?view=no_cost', external: false,
      ...(soldRevenue > 0 ? {} : { variant: 'catalog' }), params: { pct: Math.round(coverage * 100) },
    })
  }
  // Auditul contului: fără el nu știm dacă Merchant Center e legat și dacă există conversia
  if (input.google.account) {
    if (!audit) blockers.push({ id: 'audit', href: '/campaigns#audit', external: false })
    else {
      for (const c of audit.checks) {
        // Moneda o spune deja pasul contului; valoarea conversiei contează doar la licitarea pe valoare
        if (c.level !== 'blocker' || c.id === 'currency_mismatch') continue
        blockers.push({ id: c.id as BlockerId, href: '/campaigns#audit', external: false, params: c.params })
      }
      if (stageId === 'growth' && audit.checks.some(c => c.id === 'purchase_no_value')) {
        blockers.push({ id: 'purchase_no_value', href: '/campaigns#audit', external: false })
      }
    }
  }
  if (exclusionMode === 'too_many') blockers.push({ id: 'too_many_exclusions', href: '/campaigns', external: false, params: { count: itemIds.length } })

  const merchantId = input.merchant.id ?? audit?.merchant_id ?? null

  return {
    platform: { id: setup.platform, name: setup.platformName },
    blockers,
    stage: { id: stageId, conversions30: Math.round(conversions30 * 10) / 10, basis: audit ? 'google_ads' : 'store' },
    campaign: {
      country: setup.feed.country,
      language: setup.feed.language,
      currency: input.google.account?.currency || store.currency,
      account: input.google.account ? { customer_id: input.google.account.customer_id, name: input.google.account.name } : null,
      merchant: { status: setup.merchant.status, via: setup.merchant.via },
      conversion: { status: setup.conversion.status, via: setup.conversion.via },
    },
    structure: {
      type: stageId === 'starter' ? 'shopping' : 'performance_max',
      start_target: startTarget,
      cpc_ceiling: cpcCeiling,
      cpc_ceiling_low: cpcCeiling !== null && cpcCeiling < LOW_CPC,
      loss_limit: lossLimit,
      merchant_id: merchantId,
      feed_label: input.merchant.feed_label,
      brand_negatives: audit?.search_active ? brandTerms(store.name, store.url) : [],
    },
    economics: {
      margin,
      margin_basis: basis,
      cost_coverage: coverage,
      cost_basis: soldRevenue > 0 ? 'sales' : included.length ? 'catalog' : null,
      vat_pct: Math.round((econ.vatFactor - 1) * 100),
      vat_assumed: econ.vatAssumed,
      discount_pct: Math.round(econ.discountRate * 100),
      aov,
      break_even: breakEven === null ? null : round1(breakEven),
    },
    goal: input.settings.goal,
    targets,
    target_roas: target,
    budget: { suggested, chosen, daily },
    settings: { mode: input.settings.mode, max_daily_budget: input.settings.max_daily_budget },
    forecast,
    history: { google_ads_orders: input.googleAds90.orders, google_ads_total: input.googleAds90.total },
    exclusions: { item_ids: itemIds, unmatched, mode: exclusionMode },
    offers,
    counts: { included: included.length, excluded: offers.length - included.length },
  }
}
