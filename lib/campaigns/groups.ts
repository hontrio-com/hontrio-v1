import { MAX_LISTING_ITEMS } from '@/lib/google/operations'
import {
  GROWTH_MIN_CONVERSIONS, LOW_CPC, MIN_AOV_ORDERS, cpcCeilingOf, lossLimitOf, startBudget,
  type AovBasis, type Plan, type PlanOffer,
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
// - grupa are bugetul ei; comanda medie a produselor ei dă plafonul pe click,
//   oprirea de siguranță și bugetul propus;
// - treapta se alege pe grupă, ca pe magazin: sub 15 conversii în 30 de zile,
//   Shopping standard cu „Maximizează clicurile" (nu are nevoie de istoric);
//   altfel Performance Max cu „Maximizează valoarea conversiilor".
// =============================================

/** Grupele care pot rula în același timp, pe lângă campania principală: altfel bugetul se fărâmițează. */
export const MAX_GROUPS = 5
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
  const budget = row.daily_budget === null || row.daily_budget === undefined ? null : Number(row.daily_budget)
  return {
    id: String(row.id),
    name: String(row.name ?? '').slice(0, MAX_NAME),
    rules: parseRules(row.rules),
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

/** Produsul poate rula (motivul de excludere al planului se aplică și grupelor: epuizat, scos de om sau de pilot). */
export const canRun = (o: Pick<PlanOffer, 'reason'>) => o.reason === null || o.reason === 'in_group'

export type GroupWarningId =
  | 'few_products' | 'excluded_members' | 'unmatched' | 'in_other_group'
  | 'pmax_low_data' | 'main_low_data' | 'over_max_budget' | 'low_budget' | 'short_period'
export type GroupBlockerId = 'empty' | 'no_products' | 'not_in_merchant' | 'too_many_items' | 'period'

type Note<Id> = { id: Id; params?: Record<string, string | number> }

export type GroupPlan = {
  group: ProductGroup
  /** Ofertele grupei (cu cele care nu pot rula acum). */
  members: string[]
  counts: {
    members: number
    /** Pot rula și sunt găsite în Merchant Center: intră în campanie. */
    included: number
    /** Nu pot rula acum (epuizate, scoase de om sau de pilot...). */
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
    /** Comanda medie cu produsele grupei (cu TVA și transport, ca la magazin). */
    aov: number | null
    /** Din comenzile grupei (de la MIN_AOV_ORDERS), altfel estimată după prețurile produselor ei. */
    aov_basis: AovBasis | null
    /** ROAS-ul pe care îl fac acum produsele grupei (sau contul), doar ca informație. */
    historical_roas: number | null
  }
  /** Ce ar alege Hontrio din date, și ce rulează (alegerea omului, dacă a făcut una). */
  auto_type: 'shopping' | 'performance_max'
  type: 'shopping' | 'performance_max'
  stage: 'starter' | 'growth'
  cpc_ceiling: number | null
  cpc_ceiling_low: boolean
  loss_limit: { no_conversions: number; low_roas: number } | null
  budget: { suggested: number | null; chosen: number | null; daily: number | null }
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

/**
 * Totalurile unei grupe, din care se socotește planul ei. Pe server vin din oferte (groupTotalsOf); în editorul din
 * pagină, din baza de date (plan_group_preview, migrations/037), fără ca pagina să primească tot catalogul.
 */
export type GroupTotals = {
  /** Ofertele grupei (cu cele care nu pot rula acum). */
  members: number
  /** Pot rula (fără motiv de excludere, sau doar în grupă). */
  running: number
  /** Pot rula și sunt găsite în Merchant Center. */
  matched: number
  /** ID-uri diferite din Merchant Center ale celor găsite. */
  items: number
  /** Le-ar prinde regulile, dar sunt deja în altă grupă (una dinaintea ei). */
  elsewhere: number
  /** Vânzările din magazin în 90 de zile ale celor care pot rula, și suma prețurilor lor. */
  units: number
  revenue: number
  orders: number
  price_sum: number
  /** Comenzile aduse de Google Ads în 30 de zile (toți membrii). */
  google_orders: number
  /** Cifrele Google pe produs în 30 de zile (toți membrii; conversiile și valoarea, cele mai mari dintre Google și magazin). */
  ads_cost: number
  ads_conversions: number
  ads_value: number
}

export const EMPTY_TOTALS: GroupTotals = {
  members: 0, running: 0, matched: 0, items: 0, elsewhere: 0, units: 0, revenue: 0, orders: 0, price_sum: 0,
  google_orders: 0, ads_cost: 0, ads_conversions: 0, ads_value: 0,
}

/** Totalurile grupei din ofertele planului și grupa fiecărei oferte; cu membrii și ID-urile lor, pentru lansare. */
export function groupTotalsOf(group: Pick<ProductGroup, 'id' | 'rules'>, offers: PlanOffer[], assigned: Map<string, string>): { totals: GroupTotals; members: string[]; item_ids: string[] } {
  const m = matcher(group)
  const members = offers.filter(o => assigned.get(o.offer_id) === group.id)
  const elsewhere = offers.filter(o => {
    const owner = assigned.get(o.offer_id)
    return owner !== undefined && owner !== group.id && wants(m, o)
  }).length
  const running = members.filter(canRun)
  const matched = running.filter(o => o.item_id)
  const itemIds = [...new Set(matched.map(o => o.item_id!))]
  const sum = (list: PlanOffer[], f: (o: PlanOffer) => number) => list.reduce((s, o) => s + f(o), 0)
  return {
    totals: {
      members: members.length, running: running.length, matched: matched.length, items: itemIds.length, elsewhere,
      units: sum(running, o => o.units), revenue: sum(running, o => o.revenue), orders: sum(running, o => o.orders), price_sum: sum(running, o => o.price),
      google_orders: sum(members, o => o.google30),
      ads_cost: sum(members, o => o.ads30?.cost ?? 0), ads_conversions: sum(members, o => o.ads30?.conversions ?? 0), ads_value: sum(members, o => o.ads30?.value ?? 0),
    },
    members: members.map(o => o.offer_id),
    item_ids: itemIds,
  }
}

/** Ce trebuie din planul magazinului ca să socotești planul unei grupe (îl are și planul fără lista ofertelor, din pagină). */
export type GroupPlanBasis = {
  plan: Pick<Plan, 'economics' | 'history' | 'stage' | 'settings'>
  /** Conversiile în 30 de zile ale celorlalte grupe care rulează sau sunt plănuite. */
  otherConversions: number
  /** Bugetul pe zi al celorlalte campanii Hontrio care rulează sau sunt plănuite. */
  otherBudgets: number
  /** Azi, YYYY-MM-DD. */
  today: string
}

/** Planul grupei din totalurile ei: aceleași cifre pe server și în editorul din pagină. Fără listele de oferte. */
export function groupPlanFromTotals(group: ProductGroup, totals: GroupTotals, ctx: GroupPlanBasis): Omit<GroupPlan, 'members' | 'item_ids'> {
  const { plan } = ctx
  const t = totals

  // Valoarea medie a unei comenzi cu produsele grupei: valoarea lor pe comandă, cu TVA și transport ca la magazin.
  // Din câteva comenzi, una mare ar umfla plafonul și oprirea: atunci se estimează după prețuri, ca la magazin
  const ratio = plan.economics.value_ratio || 1
  const fromOrders = t.orders >= MIN_AOV_ORDERS && t.revenue > 0 ? (t.revenue / t.orders) * ratio : null
  const fromPrices = t.running ? (t.price_sum / t.running) * ratio : null
  const aov = fromOrders ?? fromPrices ?? plan.economics.aov
  const aovBasis: AovBasis | null = fromOrders !== null ? 'orders' : fromPrices !== null ? 'prices' : plan.economics.aov_basis

  // ── Conversiile: ce a raportat Google pe produs, altfel comenzile aduse de Google din magazin ──
  const googleData = plan.history.product_data
  const conversions30 = Math.round((googleData ? t.ads_conversions : t.google_orders) * 10) / 10
  let historical: number | null = plan.history.roas30
  if (googleData && t.ads_cost > 0 && conversions30 >= 5) historical = Math.round((t.ads_value / t.ads_cost) * 100) / 100

  // ── Treapta, ca pe magazin; omul poate alege altfel ─────────────────────
  const autoType = conversions30 >= GROWTH_MIN_CONVERSIONS ? 'performance_max' : 'shopping'
  const type = group.campaign_type === 'auto' ? autoType : group.campaign_type
  const cpcCeiling = type === 'shopping' ? cpcCeilingOf(aov) : null

  // ── Bugetul: ales de om, altfel o cincime din comanda medie a grupei ─────
  const suggested = startBudget(aov)
  const chosen = group.daily_budget
  const daily = chosen ?? suggested

  // ── Ce trebuie știut ────────────────────────────────────────────────────
  const warnings: Note<GroupWarningId>[] = []
  if (t.running > 0 && t.running < 3) warnings.push({ id: 'few_products', params: { count: t.running } })
  if (t.members > t.running) warnings.push({ id: 'excluded_members', params: { count: t.members - t.running } })
  if (t.running > t.matched && t.matched > 0) warnings.push({ id: 'unmatched', params: { count: t.running - t.matched } })
  if (t.elsewhere > 0) warnings.push({ id: 'in_other_group', params: { count: t.elsewhere } })
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
  else if (!t.running) blockers.push({ id: 'no_products' })
  else if (!t.matched) blockers.push({ id: 'not_in_merchant' })
  if (type === 'performance_max' && t.items > MAX_LISTING_ITEMS) blockers.push({ id: 'too_many_items', params: { count: t.items, limit: MAX_LISTING_ITEMS } })
  if (group.ends_on && (group.ends_on < ctx.today || (group.starts_on !== null && group.ends_on < group.starts_on))) blockers.push({ id: 'period' })

  return {
    group,
    counts: { members: t.members, included: t.matched, excluded: t.members - t.running, unmatched: t.running - t.matched, elsewhere: t.elsewhere },
    sales90: { units: t.units, revenue: t.revenue },
    conversions30,
    basis: googleData ? 'google_ads' : 'store',
    economics: { aov: aov === null ? null : Math.round(aov * 100) / 100, aov_basis: aov === null ? null : aovBasis, historical_roas: historical },
    auto_type: autoType,
    type,
    stage: type === 'shopping' ? 'starter' : 'growth',
    cpc_ceiling: cpcCeiling,
    cpc_ceiling_low: cpcCeiling !== null && cpcCeiling < LOW_CPC,
    loss_limit: lossLimitOf(aov),
    budget: { suggested, chosen, daily },
    warnings,
    blockers,
  }
}

export function buildGroupPlan(group: ProductGroup, ctx: GroupPlanContext): GroupPlan {
  const { totals, members, item_ids } = groupTotalsOf(group, ctx.plan.offers, ctx.assigned)
  return { ...groupPlanFromTotals(group, totals, ctx), members, item_ids }
}

/** Planul grupei cum pleacă spre pagină: fără listele de oferte și ID-uri (la un catalog mare, zeci de mii). */
export function groupPlanForPage(g: GroupPlan): GroupPlan {
  return { ...g, members: [], item_ids: [] }
}

/**
 * Grupele dinaintea celei în lucru, care își păstrează produsele (ca în assignGroups). O grupă încheiată se
 * vede ca la relansare: după toate celelalte.
 */
export function precedingGroupIds(others: Ordered[], draft: Ordered): string[] {
  const active = others.filter(g => g.id !== draft.id && g.status !== 'ended')
  if (draft.status === 'ended') return groupOrder(active).map(g => g.id)
  const ordered = groupOrder([...active, draft])
  return ordered.slice(0, ordered.findIndex(g => g.id === draft.id)).map(g => g.id)
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
  'purchase_no_value',
])

/**
 * Pașii de la nivelul contului care opresc lansarea unei grupe, la ambele tipuri de campanie. Fără valoarea
 * comenzii în conversie (`noValue`), pilotul n-ar avea ROAS-ul pe care se sprijină oprirea de siguranță.
 */
export function accountBlockers(plan: Plan, noValue: boolean): Plan['blockers'] {
  const out = plan.blockers.filter(b => ACCOUNT_BLOCKERS.has(b.id))
  if (noValue && !out.some(b => b.id === 'purchase_no_value')) out.push({ id: 'purchase_no_value', href: '/campaigns?tab=plan#audit', external: false })
  return out
}
