import { round1 } from '@/lib/ads/economics'
import { MAX_LISTING_ITEMS } from '@/lib/google/operations'
import {
  ASSUMED_CONVERSION_RATE, CONVERSIONS_PER_MONTH, DAYS_PER_MONTH, GOAL_KEEP, GOALS, GROWTH_MIN_CONVERSIONS,
  LOSS_LOW_ROAS, LOSS_NO_CONVERSIONS, LOW_CPC, MIN_COST_COVERAGE, niceBudget, startingTarget,
  type Goal, type Plan, type PlanOffer,
} from '@/lib/campaigns/plan'

// =============================================
// Grupele de produse — campaniile pe care le face omul: pe o categorie, un
// brand, un interval de preț, produsele cu reducere sau produse alese de el.
// Funcții pure, folosite de server (lansarea, pilotul) și de editorul din
// pagină (previzualizarea pe loc), ca cifrele să fie aceleași peste tot.
//
// Regulile care țin campaniile eficiente (docs/campanii/SPECIFICATIE.md §13):
// - un produs stă într-o singură campanie: grupele lansate își păstrează
//   produsele (cea lansată mai devreme are întâietate), apoi ciornele, în
//   ordinea lor; ce nu e în nicio grupă rămâne în campania principală;
// - grupa are pragul de profit al produselor ei și ținta obiectivului ei;
// - treapta se alege pe grupă, ca pe magazin: sub 15 conversii în 30 de zile,
//   Shopping standard cu CPC plafonat (nu are nevoie de istoric); altfel
//   Performance Max cu ROAS țintă.
// =============================================

/** Grupele care pot rula în același timp, pe lângă campania principală: altfel bugetul se fărâmițează. */
export const MAX_GROUPS = 5
/** Cât trebuie să învețe o campanie nouă: ținta bugetului propus, chiar fără istoric. */
export const LEARNING_CONVERSIONS = 10
/** O campanie Performance Max are nevoie de ~6 săptămâni; sub 2 nu apucă să învețe nimic. */
export const SHORT_PERIOD_DAYS = 14
const MAX_LIST = 200
const MAX_IDS = 5000
const MAX_NAME = 80

export type GroupType = 'auto' | 'shopping' | 'performance_max'
export const GROUP_TYPES: GroupType[] = ['auto', 'shopping', 'performance_max']
export type GroupStatus = 'draft' | 'live' | 'ended'

export type GroupRules = {
  categories: string[]
  brands: string[]
  price_min: number | null
  price_max: number | null
  on_sale: boolean
  /** Ofertele adăugate de mână (ID-ul din magazin). */
  include: string[]
  /** Ofertele scoase de mână din ce prind regulile. */
  exclude: string[]
}

export const EMPTY_RULES: GroupRules = { categories: [], brands: [], price_min: null, price_max: null, on_sale: false, include: [], exclude: [] }

export type ProductGroup = {
  id: string
  name: string
  rules: GroupRules
  goal: Goal
  /** null = bugetul propus de Hontrio. */
  daily_budget: number | null
  campaign_type: GroupType
  /** YYYY-MM-DD, în fusul orar al contului Google Ads. */
  starts_on: string | null
  ends_on: string | null
  position: number
  status: GroupStatus
  launched_at: string | null
}

/** O zi scrisă YYYY-MM-DD, care există în calendar. */
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))

/** Regulile din baza de date sau din cerere, curățate: liste fără dubluri, prețuri pozitive, în ordine. */
export function parseRules(raw: unknown): GroupRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = (v: unknown, max: number) => Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean))].slice(0, max)
    : []
  const amount = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
  }
  let min = amount(r.price_min)
  let max = amount(r.price_max)
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  return {
    categories: list(r.categories, MAX_LIST),
    brands: list(r.brands, MAX_LIST),
    price_min: min,
    price_max: max,
    on_sale: r.on_sale === true,
    include: list(r.include, MAX_IDS),
    exclude: list(r.exclude, MAX_IDS),
  }
}

/** Un rând din ad_product_groups, citit. */
export function parseGroup(row: Record<string, unknown>): ProductGroup {
  const goal = GOALS.includes(row.goal as Goal) ? (row.goal as Goal) : 'balanced'
  const budget = row.daily_budget === null || row.daily_budget === undefined ? null : Number(row.daily_budget)
  return {
    id: String(row.id),
    name: String(row.name ?? '').slice(0, MAX_NAME),
    rules: parseRules(row.rules),
    goal,
    daily_budget: budget !== null && Number.isFinite(budget) && budget > 0 ? budget : null,
    campaign_type: GROUP_TYPES.includes(row.campaign_type as GroupType) ? (row.campaign_type as GroupType) : 'auto',
    starts_on: isDay(row.starts_on) ? row.starts_on : null,
    ends_on: isDay(row.ends_on) ? row.ends_on : null,
    position: Number(row.position) || 0,
    status: row.status === 'live' || row.status === 'ended' ? row.status : 'draft',
    launched_at: typeof row.launched_at === 'string' ? row.launched_at : null,
  }
}

/** Regulile prind produse singure (categorie, brand, preț, reducere); fără ele, grupa are doar produsele alese de mână. */
export function hasFilters(r: GroupRules): boolean {
  return r.categories.length > 0 || r.brands.length > 0 || r.price_min !== null || r.price_max !== null || r.on_sale
}

/** Grupa nu cere niciun produs. */
export function isEmptyRules(r: GroupRules): boolean {
  return !hasFilters(r) && r.include.length === 0
}

const norm = (s: string) => s.trim().toLocaleLowerCase('ro')

/** Ce trebuie să știe o grupă despre o ofertă. */
export type GroupOffer = Pick<PlanOffer, 'offer_id' | 'category' | 'brand' | 'price' | 'on_sale'>

/** Oferta trece de filtre (toate cele alese: categorie ȘI brand ȘI preț ȘI reducere). */
export function matchesFilters(o: GroupOffer, r: GroupRules): boolean {
  if (!hasFilters(r)) return false
  if (r.categories.length && !(o.category && r.categories.some(c => norm(c) === norm(o.category!)))) return false
  if (r.brands.length && !(o.brand && r.brands.some(b => norm(b) === norm(o.brand!)))) return false
  if (r.price_min !== null && o.price < r.price_min) return false
  if (r.price_max !== null && o.price > r.price_max) return false
  if (r.on_sale && !o.on_sale) return false
  return true
}

type Matcher = { id: string; rules: GroupRules; include: Set<string>; exclude: Set<string> }
const matcher = (g: Pick<ProductGroup, 'id' | 'rules'>): Matcher => ({ id: g.id, rules: g.rules, include: new Set(g.rules.include), exclude: new Set(g.rules.exclude) })
const wants = (m: Matcher, o: GroupOffer) => !m.exclude.has(o.offer_id) && (m.include.has(o.offer_id) || matchesFilters(o, m.rules))

type Ordered = Pick<ProductGroup, 'id' | 'rules' | 'status' | 'position' | 'launched_at'>

/** Ordinea în care grupele își iau produsele: cele lansate (întâi cea mai veche), apoi ciornele, în ordinea lor. */
export function groupOrder<T extends Ordered>(groups: T[]): T[] {
  const rank = (g: T) => (g.status === 'live' ? 0 : 1)
  return groups.filter(g => g.status !== 'ended').sort((a, b) =>
    rank(a) - rank(b)
    || (a.status === 'live' ? (a.launched_at ?? '').localeCompare(b.launched_at ?? '') : 0)
    || a.position - b.position
    || a.id.localeCompare(b.id))
}

/** Grupa fiecărei oferte (ofertă → grupă). Un produs stă într-o singură grupă; grupele încheiate nu mai iau nimic. */
export function assignGroups(offers: GroupOffer[], groups: Ordered[]): Map<string, string> {
  const ordered = groupOrder(groups).map(matcher)
  const out = new Map<string, string>()
  if (!ordered.length) return out
  for (const o of offers) {
    const g = ordered.find(m => wants(m, o))
    if (g) out.set(o.offer_id, g.id)
  }
  return out
}

/** Pragul unei liste de produse: pragul fiecăruia, ponderat cu vânzările (fără vânzări, cu prețul). */
export function weightedBreakEven(offers: Pick<PlanOffer, 'break_even' | 'revenue' | 'price'>[]): number | null {
  const priced = offers.filter(o => o.break_even !== null)
  const weight = priced.reduce((s, o) => s + (o.revenue || o.price), 0)
  if (!priced.length || weight <= 0) return null
  return priced.reduce((s, o) => s + o.break_even! * (o.revenue || o.price), 0) / weight
}

/** Produsul poate rula (motivul de excludere al planului se aplică și grupelor: epuizat, marjă mică, scos de om). */
export const canRun = (o: Pick<PlanOffer, 'reason'>) => o.reason === null || o.reason === 'in_group'

export type GroupWarningId =
  | 'few_products' | 'excluded_members' | 'unmatched' | 'in_other_group'
  | 'pmax_low_data' | 'main_low_data' | 'over_max_budget' | 'low_budget' | 'short_period'
export type GroupBlockerId = 'empty' | 'no_products' | 'not_in_merchant' | 'costs' | 'too_many_items' | 'period'

type Note<Id> = { id: Id; params?: Record<string, string | number> }

export type GroupPlan = {
  group: ProductGroup
  /** Ofertele grupei (cu cele care nu pot rula acum). */
  members: string[]
  counts: {
    members: number
    /** Pot rula și sunt găsite în Merchant Center: intră în campanie. */
    included: number
    /** Nu pot rula acum (epuizate, marjă mică, scoase de om...). */
    excluded: number
    /** Pot rula, dar nu sunt găsite în Merchant Center. */
    unmatched: number
    /** Le-ar prinde regulile, dar sunt deja în altă grupă. */
    elsewhere: number
  }
  /** ID-urile din Merchant Center ale produselor din campanie. */
  item_ids: string[]
  sales90: { units: number; revenue: number }
  /** Conversiile din Google în 30 de zile ale produselor grupei. */
  conversions30: number
  basis: 'google_ads' | 'store'
  economics: {
    break_even: number | null
    aov: number | null
    targets: Record<Goal, number | null>
    target: number | null
    /** ROAS-ul pe care îl fac acum produsele grupei (sau contul), de la care pornește ținta. */
    historical_roas: number | null
  }
  /** Ce ar alege Hontrio din date, și ce rulează (alegerea omului, dacă a făcut una). */
  auto_type: 'shopping' | 'performance_max'
  type: 'shopping' | 'performance_max'
  stage: 'starter' | 'growth'
  start_target: number | null
  cpc_ceiling: number | null
  cpc_ceiling_low: boolean
  loss_limit: { no_conversions: number; low_roas: number } | null
  budget: { suggested: number | null; chosen: number | null; daily: number | null }
  forecast: { spend: number; revenue: number; orders: number | null; profit: number } | null
  warnings: Note<GroupWarningId>[]
  blockers: Note<GroupBlockerId>[]
}

export type GroupPlanContext = {
  plan: Plan
  /** Grupa fiecărei oferte (assignGroups pe toate grupele, cu aceasta cu tot). */
  assigned: Map<string, string>
  /** Conversiile în 30 de zile ale celorlalte grupe care rulează sau sunt plănuite. */
  otherConversions: number
  /** Bugetul pe zi al celorlalte campanii Hontrio care rulează sau sunt plănuite. */
  otherBudgets: number
  /** Azi, YYYY-MM-DD. */
  today: string
}

const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1

export function buildGroupPlan(group: ProductGroup, ctx: GroupPlanContext): GroupPlan {
  const { plan } = ctx
  const m = matcher(group)
  const members = plan.offers.filter(o => ctx.assigned.get(o.offer_id) === group.id)
  const elsewhere = plan.offers.filter(o => {
    const owner = ctx.assigned.get(o.offer_id)
    return owner !== undefined && owner !== group.id && wants(m, o)
  }).length
  const running = members.filter(canRun)
  const matched = running.filter(o => o.item_id)
  const itemIds = [...new Set(matched.map(o => o.item_id!))]

  // ── Pragul grupei: al produselor ei, ponderat cu vânzările ──────────────
  // Ca la magazin, costurile trebuie să acopere măcar jumătate din vânzări (sau din oferte, fără vânzări)
  const sold = running.filter(o => o.revenue > 0)
  const soldRevenue = sold.reduce((s, o) => s + o.revenue, 0)
  const coverage = soldRevenue > 0
    ? sold.filter(o => o.cost_price !== null).reduce((s, o) => s + o.revenue, 0) / soldRevenue
    : running.length ? running.filter(o => o.margin !== null).length / running.length : 0
  const rawBe = coverage >= MIN_COST_COVERAGE ? weightedBreakEven(running) : null
  const breakEven = rawBe === null ? null : round1(rawBe)
  const targets = Object.fromEntries(GOALS.map(g => [g, breakEven === null ? null : round1(breakEven / (1 - GOAL_KEEP[g]))])) as Record<Goal, number | null>
  const target = targets[group.goal]

  // Valoarea medie a unei comenzi cu produsele grupei: valoarea lor pe comandă, cu TVA și transport ca la magazin
  const orders = running.reduce((s, o) => s + o.orders, 0)
  const ratio = plan.economics.value_ratio || 1
  const aov = orders > 0 && soldRevenue > 0
    ? (soldRevenue / orders) * ratio
    : running.length ? (running.reduce((s, o) => s + o.price, 0) / running.length) * ratio : plan.economics.aov

  // ── Conversiile: ce a raportat Google pe produs, altfel comenzile aduse de Google din magazin ──
  const googleData = plan.history.product_data
  const conversions30 = Math.round(members.reduce((s, o) => s + (googleData ? o.ads30?.conversions ?? 0 : o.google30), 0) * 10) / 10
  let historical: number | null = plan.history.roas30
  if (googleData) {
    const cost = members.reduce((s, o) => s + (o.ads30?.cost ?? 0), 0)
    const value = members.reduce((s, o) => s + (o.ads30?.value ?? 0), 0)
    if (cost > 0 && conversions30 >= 5) historical = Math.round((value / cost) * 100) / 100
  }

  // ── Treapta, ca pe magazin; omul poate alege altfel ─────────────────────
  const autoType = conversions30 >= GROWTH_MIN_CONVERSIONS ? 'performance_max' : 'shopping'
  const type = group.campaign_type === 'auto' ? autoType : group.campaign_type
  // Performance Max fără destule conversii pornește fără țintă: o țintă fără istoric taie traficul
  const startTarget = type === 'performance_max' && breakEven !== null && conversions30 >= GROWTH_MIN_CONVERSIONS
    ? startingTarget(historical, breakEven, target)
    : null
  const cpcCeiling = type === 'shopping' && breakEven !== null && aov !== null
    ? Math.max(0.01, Math.floor(((aov * ASSUMED_CONVERSION_RATE) / breakEven) * 100) / 100)
    : null
  const cpa = breakEven !== null && aov !== null ? aov / breakEven : null
  const lossLimit = cpa !== null ? { no_conversions: Math.ceil(LOSS_NO_CONVERSIONS * cpa), low_roas: Math.ceil(LOSS_LOW_ROAS * cpa) } : null

  // ── Bugetul: cât ajunge pentru vânzările grupei la țintă, cu loc de creștere și de învățare ──
  const wanted = Math.min(CONVERSIONS_PER_MONTH, Math.max(LEARNING_CONVERSIONS, conversions30 * 1.25))
  const suggested = target !== null && aov !== null ? niceBudget((wanted * aov) / target / DAYS_PER_MONTH) : null
  const chosen = group.daily_budget
  const daily = chosen ?? suggested
  let forecast: GroupPlan['forecast'] = null
  if (target !== null && breakEven !== null && daily !== null) {
    const spend = daily * DAYS_PER_MONTH
    const revenue = spend * target
    forecast = { spend, revenue, orders: aov ? revenue / aov : null, profit: revenue / breakEven - spend }
  }

  // ── Ce trebuie știut ────────────────────────────────────────────────────
  const warnings: Note<GroupWarningId>[] = []
  if (running.length > 0 && running.length < 3) warnings.push({ id: 'few_products', params: { count: running.length } })
  if (members.length > running.length) warnings.push({ id: 'excluded_members', params: { count: members.length - running.length } })
  if (running.length > matched.length && matched.length > 0) warnings.push({ id: 'unmatched', params: { count: running.length - matched.length } })
  if (elsewhere > 0) warnings.push({ id: 'in_other_group', params: { count: elsewhere } })
  if (group.campaign_type === 'performance_max' && conversions30 < GROWTH_MIN_CONVERSIONS) {
    warnings.push({ id: 'pmax_low_data', params: { conversions: Math.round(conversions30) } })
  }
  // Campania principală pierde conversiile grupelor: sub 15, licitarea ei pe valoare învață greu
  const total = plan.stage.conversions30
  const remaining = Math.max(0, Math.round(total - conversions30 - ctx.otherConversions))
  if (total >= GROWTH_MIN_CONVERSIONS && remaining < GROWTH_MIN_CONVERSIONS && conversions30 > 0) {
    warnings.push({ id: 'main_low_data', params: { remaining } })
  }
  const max = plan.settings.max_daily_budget
  if (max !== null && daily !== null && ctx.otherBudgets + daily > max) {
    warnings.push({ id: 'over_max_budget', params: { total: Math.round((ctx.otherBudgets + daily) * 100) / 100, max } })
  }
  if (chosen !== null && suggested !== null && chosen < suggested * 0.5) warnings.push({ id: 'low_budget', params: { suggested } })
  if (group.ends_on && type === 'performance_max') {
    const span = days(group.starts_on && group.starts_on > ctx.today ? group.starts_on : ctx.today, group.ends_on)
    if (span > 0 && span < SHORT_PERIOD_DAYS) warnings.push({ id: 'short_period', params: { days: span } })
  }

  // ── Ce oprește lansarea ─────────────────────────────────────────────────
  const blockers: Note<GroupBlockerId>[] = []
  if (isEmptyRules(group.rules)) blockers.push({ id: 'empty' })
  else if (!running.length) blockers.push({ id: 'no_products' })
  else if (!matched.length) blockers.push({ id: 'not_in_merchant' })
  else if (breakEven === null) blockers.push({ id: 'costs', params: { pct: Math.round(coverage * 100) } })
  if (type === 'performance_max' && itemIds.length > MAX_LISTING_ITEMS) blockers.push({ id: 'too_many_items', params: { count: itemIds.length, limit: MAX_LISTING_ITEMS } })
  if (group.ends_on && (group.ends_on < ctx.today || (group.starts_on !== null && group.ends_on < group.starts_on))) blockers.push({ id: 'period' })

  return {
    group,
    members: members.map(o => o.offer_id),
    counts: { members: members.length, included: matched.length, excluded: members.length - running.length, unmatched: running.length - matched.length, elsewhere },
    item_ids: itemIds,
    sales90: { units: running.reduce((s, o) => s + o.units, 0), revenue: soldRevenue },
    conversions30,
    basis: googleData ? 'google_ads' : 'store',
    economics: { break_even: breakEven, aov: aov === null ? null : Math.round(aov * 100) / 100, targets, target, historical_roas: historical },
    auto_type: autoType,
    type,
    stage: type === 'shopping' ? 'starter' : 'growth',
    start_target: startTarget,
    cpc_ceiling: cpcCeiling,
    cpc_ceiling_low: cpcCeiling !== null && cpcCeiling < LOW_CPC,
    loss_limit: lossLimit,
    budget: { suggested, chosen, daily },
    forecast,
    warnings,
    blockers,
  }
}

/**
 * Produsele pe care le-ar prinde o grupă încheiată dacă ar fi relansată: ca o ciornă, după toate
 * celelalte grupe (cele lansate și ciornele își păstrează produsele).
 */
export function assignedAsDraft(offers: GroupOffer[], others: ProductGroup[], g: ProductGroup): Map<string, string> {
  return assignGroups(offers, [...others.filter(x => x.id !== g.id), { ...g, status: 'draft', position: Number.MAX_SAFE_INTEGER }])
}

/** Bugetul pe zi al celorlalte campanii: cele care rulează (ale grupelor, cu bugetul de acum) și ciornele celorlalte grupe. */
export function otherBudgetsFor(groupId: string, live: { group_id: string | null; daily_budget: number }[], drafts: { id: string; daily: number | null }[]): number {
  return live.filter(c => c.group_id !== groupId).reduce((s, c) => s + c.daily_budget, 0)
    + drafts.filter(d => d.id !== groupId).reduce((s, d) => s + (d.daily ?? 0), 0)
}

/**
 * Planurile tuturor grupelor, fiecare cu ce au celelalte: conversiile și bugetele lor, ca
 * avertismentele să vadă tot magazinul. `live` = campaniile Hontrio care rulează, cu bugetul lor.
 */
export function buildGroupPlans(groups: ProductGroup[], plan: Plan, assigned: Map<string, string>, live: { group_id: string | null; daily_budget: number }[], today: string): GroupPlan[] {
  const base = { plan, assigned, otherConversions: 0, otherBudgets: 0, today }
  const active = groups.filter(g => g.status !== 'ended')
  // Întâi fiecare grupă singură, ca să știm conversiile și bugetul fiecăreia
  const solo = new Map(active.map(g => [g.id, buildGroupPlan(g, base)]))
  const drafts = active.filter(g => g.status === 'draft').map(g => ({ id: g.id, daily: solo.get(g.id)!.budget.daily }))
  return groups.map(g => {
    // O grupă încheiată nu mai ține produse; planul ei arată ce ar prinde dacă o relansezi (după celelalte)
    if (g.status === 'ended') return buildGroupPlan(g, { ...base, assigned: assignedAsDraft(plan.offers, active, g) })
    const others = active.filter(x => x.id !== g.id).map(x => solo.get(x.id)!)
    return buildGroupPlan(g, {
      ...base,
      otherConversions: others.reduce((s, p) => s + p.conversions30, 0),
      otherBudgets: otherBudgetsFor(g.id, live, drafts),
    })
  })
}

/** Ziua de azi (YYYY-MM-DD) în fusul orar dat (al magazinului sau al contului). */
export function todayIn(timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Oferta, cum o vede o grupă (din oferta magazinului). */
export function groupOfferOf(o: { offer_id: string; category: string | null; brand: string | null; price: number; compare_at_price: number | null }): GroupOffer {
  return {
    offer_id: o.offer_id,
    category: o.category?.trim() || null,
    brand: o.brand?.trim() || null,
    price: o.price,
    on_sale: o.compare_at_price !== null && o.compare_at_price > o.price,
  }
}

/** Grupele care nu pot rula fără ceva rezolvat la nivelul contului (aceleași ca la campania principală). */
export const ACCOUNT_BLOCKERS = new Set([
  'store', 'google_ads', 'ads_account', 'currency', 'merchant', 'conversion', 'audit',
  'account_manager', 'merchant_not_linked', 'merchant_other', 'merchant_choose', 'purchase_missing', 'purchase_not_primary',
])

/**
 * Pașii de la nivelul contului care opresc lansarea unei grupe. Valoarea conversiei contează doar la
 * Performance Max (licitarea pe valoare): `noValue` = auditul a găsit conversia fără valoarea comenzii.
 */
export function accountBlockers(plan: Plan, type: 'shopping' | 'performance_max', noValue: boolean): Plan['blockers'] {
  const out = plan.blockers.filter(b => ACCOUNT_BLOCKERS.has(b.id))
  if (type === 'performance_max' && noValue) out.push({ id: 'purchase_no_value', href: '/campaigns#audit', external: false })
  return out
}
