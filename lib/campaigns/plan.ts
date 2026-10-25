import { breakEvenRoas, economicsOf, marginOf, round1, THIN_MARGIN, type OrderTotals } from '@/lib/ads/economics'
import type { AdsMode, Offer, Sales } from '@/lib/commerce/ads-data'
import type { SetupStatus, StoreSetup } from '@/lib/commerce/setup'

// =============================================
// Planul de campanie — ce va crea Hontrio în contul Google Ads al omului,
// socotit din datele magazinului: ce produse intră, ROAS-ul țintă din pragul
// de profit și bugetul zilnic. Funcție pură, ca motorul de recomandări.
//
// O singură campanie Performance Max pe tot catalogul eligibil: cu puține
// conversii, o campanie învață mai repede decât mai multe mici.
// =============================================

export type Goal = 'growth' | 'balanced' | 'profit'

/** Din profitul unei vânzări (înainte de reclamă), cât rămâne comerciantului. */
export const GOAL_KEEP: Record<Goal, number> = { growth: 0.1, balanced: 0.25, profit: 0.4 }
export const GOALS = Object.keys(GOAL_KEEP) as Goal[]

/** Google învață o campanie cu ~30 de conversii pe lună. */
export const CONVERSIONS_PER_MONTH = 30
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

export type PlanOffer = {
  offer_id: string
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

export type BlockerId = 'store' | 'google_ads' | 'ads_account' | 'currency' | 'merchant' | 'conversion' | 'no_offers' | 'costs'

export type PlanInput = {
  store: { currency: string; connection_status: string | null }
  /** Ce e pregătit în magazin și unde se repară ce lipsește, pe platforma lui. */
  setup: StoreSetup
  google: { connected: boolean; account: { customer_id: string; name: string | null; currency: string | null } | null }
  offers: Offer[]
  sales90: Sales
  orders90: OrderTotals
  googleAds90: { orders: number; total: number }
  settings: { goal: Goal; daily_budget: number | null }
}

export type Plan = {
  platform: { id: StoreSetup['platform']; name: string }
  /**
   * Ce mai trebuie făcut până la lansare, în ordinea în care se face.
   * `variant` = varianta textului: platforma, unde pasul se face altfel (Merchant
   * Center, conversia); „catalog" la costuri, când acoperirea e pe oferte (fără vânzări).
   */
  blockers: { id: BlockerId; href: string; external: boolean; variant?: string; params?: Record<string, string | number> }[]
  campaign: {
    country: string | null
    language: string | null
    currency: string
    account: { customer_id: string; name: string | null } | null
    merchant: { status: SetupStatus; via: string | null }
    conversion: { status: SetupStatus; via: string | null }
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
  /** Pe lună, dacă campania atinge ROAS-ul țintă. */
  forecast: { spend: number; revenue: number; orders: number | null; profit: number } | null
  history: { google_ads_orders: number; google_ads_total: number }
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
  // O ofertă fără stare e „netrimisă" doar dacă platforma știe starea și Merchant Center e legat;
  // altfel lipsa lui e deja un pas de făcut, nu vina ofertei
  if (statusKnown && !o.google_status) return 'not_in_merchant'
  if (o.ads_mode === 'exclude') return 'manual'
  if (o.ads_mode === 'include') return null
  return issue
}

export function buildPlan(input: PlanInput): Plan {
  const { store, setup } = input
  const econ = economicsOf(input.orders90, setup.pricesIncludeVat, setup.assumedVatRate)
  const statusKnown = setup.googleStatusKnown && setup.merchant.status === 'ok'

  const offers: PlanOffer[] = input.offers.map(o => {
    const s = input.sales90.get(o.offer_id) ?? { units: 0, revenue: 0 }
    const margin = o.cost_price === null ? null : marginOf(o.price, o.cost_price)
    const issue = marginIssue(margin)
    return {
      offer_id: o.offer_id,
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
  // „De verificat" nu oprește planul: pluginul se verifică la lansare
  if (setup.merchant.status === 'missing') blockers.push({ id: 'merchant', href: setup.merchant.href, external: true, variant: setup.platform })
  if (setup.conversion.status === 'missing') blockers.push({ id: 'conversion', href: setup.conversion.href, external: true, variant: setup.platform })
  if (!included.length) blockers.push({ id: 'no_offers', href: '/products', external: false })
  else if (margin === null) {
    blockers.push({
      id: 'costs', href: '/products?view=no_cost', external: false,
      ...(soldRevenue > 0 ? {} : { variant: 'catalog' }), params: { pct: Math.round(coverage * 100) },
    })
  }

  return {
    platform: { id: setup.platform, name: setup.platformName },
    blockers,
    campaign: {
      country: setup.feed.country,
      language: setup.feed.language,
      currency: input.google.account?.currency || store.currency,
      account: input.google.account ? { customer_id: input.google.account.customer_id, name: input.google.account.name } : null,
      merchant: { status: setup.merchant.status, via: setup.merchant.via },
      conversion: { status: setup.conversion.status, via: setup.conversion.via },
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
    forecast,
    history: { google_ads_orders: input.googleAds90.orders, google_ads_total: input.googleAds90.total },
    offers,
    counts: { included: included.length, excluded: offers.length - included.length },
  }
}
