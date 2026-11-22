import { round1 } from '@/lib/ads/economics'

// =============================================
// Bucla de optimizare — ce ar schimba pilotul azi, din cifrele Google Ads și
// din comenzile magazinului aduse de campanii (Google nu le vede pe toate: în
// UE conversia pleacă doar cu acordul vizitatorului pentru marketing).
// Funcție pură: primește campaniile, ferestrele de metrici, produsele și
// termenii de căutare și întoarce propuneri. Ce se aplică singur și ce
// așteaptă aprobarea hotărăște apelantul (modul ales).
//
// Hontrio nu știe marjele produselor, deci nu știe ce vânzare e profitabilă.
// Știe doar ce e sigur pe pierdere: o reclamă care a costat mai mult decât au
// adus vânzările ei (ROAS sub 1). Pe asta o oprește; tot ce înseamnă să
// cheltui mai mult (bugetul) rămâne decizia omului, mereu cu aprobare.
// Regulile și protecțiile: docs/campanii/SPECIFICATIE.md §6.
// =============================================

/** Google: o campanie nouă are nevoie de ~6 săptămâni fără schimbări dese. */
export const LEARNING_DAYS = 42
/** Campania de pornire trece la PMax cel mai devreme după atâtea zile. */
export const STARTER_MIN_DAYS = 14
export const GROWTH_MIN_CONVERSIONS = 15
export const BUDGET_STEP = 0.2
export const BUDGET_MIN_GAP_DAYS = 7
export const PRODUCT_MIN_DAYS = 21
/** Un produs care a cheltuit cât prețul lui fără nicio vânzare: orice vânzare acum ar costa mai mult decât aduce. */
export const PRODUCT_NO_SALES_PRICES = 1
/** O căutare care a costat cât o comandă medie fără nicio vânzare. */
export const TERM_NO_SALES_AOV = 1
export const MAX_TERMS_PER_PROPOSAL = 20
/**
 * Cât din vânzările campaniei vede Google, cel puțin: cu Google văzând jumătate din comenzile din magazin, o căutare
 * trebuie să coste de două ori mai mult fără vânzări ca să devină negativă; cel mult de patru ori.
 */
export const MIN_GOOGLE_COVERAGE = 0.25

export type Window = { cost: number; conversions: number; value: number; clicks: number }
export const EMPTY: Window = { cost: 0, conversions: 0, value: 0, clicks: 0 }

/** Cheltuiala la care se oprește o campanie: fără nicio vânzare / cu vânzări sub costul reclamei. */
export type LossLimit = { no_conversions: number; low_roas: number }

export type OptCampaign = {
  id: string
  google_campaign_id: string
  type: 'shopping' | 'performance_max'
  /** `segment` = campaniile vechi, împărțite pe marje înainte să renunțăm la marje. */
  stage: 'starter' | 'growth' | 'segment'
  segment: string
  status: 'active' | 'paused'
  days_live: number
  daily_budget: number
  /** Campania unei grupe a omului: trece la PMax după conversiile ei, nu ale contului. */
  group?: boolean
  days_since_budget_change: number | null
  google: { reasons: string[]; recommended_budget: number | null } | null
  /**
   * De la lansare sau de la ultima repornire (oprirea de siguranță): cifrele Google, cu vânzările campaniei
   * văzute și în magazin (`withStoreSales`).
   */
  since_loss_check: Window
  /** Ultimele 30 de zile, fără ultimele 2 (conversiile întârziate). */
  eval30: Window
  recent14: Window
  /**
   * Comenzile din magazin aduse de campanie în aceeași fereastră ca `eval30` (lib/ads/store-sales.ts). Bugetul și
   * căutările le pun lângă cifrele Google; trecerea pe Performance Max rămâne pe conversiile Google, după care licitează.
   */
  store30?: StoreSales
  /**
   * Limita de pierdere a campaniei: a grupei (din comanda medie a produselor ei, §13); lipsă = a magazinului
   * (`OptimizerInput.loss_limit`); null = fără limită (fără comandă medie).
   */
  loss_limit?: LossLimit | null
  /** Pornirea poate trece la Performance Max (arborele ar încăpea în limita Google); lipsă = da. */
  can_graduate?: boolean
}

export type OptProduct = {
  item_id: string
  offer_id: string
  title: string
  price: number
  /** Omul l-a inclus explicit: pilotul nu-l mai scoate. */
  included_by_user: boolean
  excluded: boolean
  window: Window
  /** Comenzile din magazin aduse de campaniile Hontrio în aceeași fereastră, în care apare produsul (cumpărat sau pagina de intrare). */
  store?: StoreSales
  /** De câte zile are produsul cifre în campaniile Hontrio (de la primul clic sau prima afișare). */
  days: number
}

export type OptSearchTerm = { campaign_id: string; term: string; cost: number; conversions: number; clicks: number }

export type OptimizerInput = {
  /** Comanda medie: unitatea de măsură pentru căutări (și, prin `loss_limit`, pentru oprire). */
  economics: { aov: number | null }
  /** Conversiile de cumpărare ale contului în 30 de zile (treapta campaniei principale). */
  account: { conversions30: number }
  max_daily_budget: number | null
  /** Limita de pierdere a magazinului (comanda medie); o campanie de grupă are limita ei. */
  loss_limit: LossLimit | null
  campaigns: OptCampaign[]
  products: OptProduct[]
  searchTerms: OptSearchTerm[]
  /** Cuvintele negative existente ale campaniilor Hontrio (litere mici). */
  negatives: Map<string, Set<string>>
  /** Numele magazinului: căutările pe el nu se exclud niciodată. */
  brand: string[]
  /**
   * Ce a respins omul în ultimele 30 de zile (să nu-i propunem la nesfârșit). `kinds`: felul propunerii,
   * pe tot magazinul („graduate") sau pe o campanie („graduate:<id campanie>").
   */
  rejected: { items: Set<string>; terms: Set<string>; kinds: Set<string> }
  /** Campaniile deja judecate de oprirea de siguranță în trecerea asta (oprite sau cu oprirea eșuată): nimic altceva. */
  skip?: Set<string>
}

export type ProposalKind = 'pause_loss_limit' | 'graduate' | 'set_budget' | 'exclude_products' | 'add_negatives'

export type Proposal = {
  kind: ProposalKind
  campaign_id: string | null
  /** Protecție: se aplică și în modul cu aprobare. */
  protective: boolean
  /** Nu se aplică singur nici în modul automat (bugetul: banii îi decide omul). */
  needs_approval?: boolean
  params: Record<string, unknown>
  reason: { key: string; params?: Record<string, string | number> }
}

const roas = (w: Window) => (w.cost > 0 ? w.value / w.cost : null)

export function sumWindows(ws: Window[]): Window {
  return ws.reduce((a, w) => ({ cost: a.cost + w.cost, conversions: a.conversions + w.conversions, value: a.value + w.value, clicks: a.clicks + w.clicks }), EMPTY)
}

/** Comenzile din magazin aduse de o campanie (sursa „hontrio-<ID>”), neanulate: câte și cât valorează, cu TVA. */
export type StoreSales = { orders: number; value: number }

/**
 * Fereastra opririi de siguranță, cu vânzările văzute în magazin: o campanie care a vândut nu e „fără vânzări”,
 * chiar dacă Google n-a numărat vânzarea (conversia măsurată greșit, vizitatorul a refuzat cookie-urile).
 * Cele două surse văd de obicei aceleași comenzi, deci se ia cea mai mare, nu suma lor.
 */
export function withStoreSales(w: Window, sales: StoreSales | undefined): Window {
  if (!sales || (sales.orders <= 0 && sales.value <= 0)) return w
  return { ...w, conversions: Math.max(w.conversions, sales.orders), value: Math.max(w.value, sales.value) }
}

/**
 * Cât din vânzările campaniei a văzut Google în fereastra de evaluare: conversiile Google față de comenzile din
 * magazin aduse de ea. 1 când magazinul nu vede mai mult (sau nu poate spune, ca la Gomag); cel puțin MIN_GOOGLE_COVERAGE.
 */
export function googleCoverage(c: Pick<OptCampaign, 'eval30' | 'store30'>): number {
  const store = c.store30?.orders ?? 0
  if (store <= c.eval30.conversions) return 1
  return Math.max(MIN_GOOGLE_COVERAGE, c.eval30.conversions / store)
}

/** Fereastra dintre două date (incluse), din rândurile pe zi. */
export function windowOf(days: { date: string; cost: number; conversions: number; value: number; clicks: number }[], from: string, to: string): Window {
  return sumWindows(days.filter(d => d.date >= from && d.date <= to))
}

/** Limita de pierdere a unei campanii: a ei (grupa) sau, dacă n-are, a magazinului. */
const limitOf = (c: OptCampaign, store: LossLimit | null): LossLimit | null => (c.loss_limit === undefined ? store : c.loss_limit)

/**
 * 1. Oprirea de siguranță (§5): de la lansare sau de la ultima repornire, campania a cheltuit cât o comandă
 * medie fără nicio vânzare, sau de trei ori cât o comandă medie cu vânzări sub costul reclamei. Vânzările sunt
 * conversiile Google sau comenzile din magazin aduse de campanie, care sunt mai multe. Protecție: se aplică în
 * ambele moduri. Pilotul o rulează înaintea a orice altceva.
 */
export function lossStops(campaigns: OptCampaign[], storeLimit: LossLimit | null): Proposal[] {
  const out: Proposal[] = []
  for (const c of campaigns) {
    const limit = limitOf(c, storeLimit)
    if (c.status !== 'active' || !limit) continue
    const s = c.since_loss_check
    const noConv = s.cost >= limit.no_conversions && s.conversions === 0
    const belowCost = s.cost >= limit.low_roas && (roas(s) ?? 0) < 1
    if (!noConv && !belowCost) continue
    out.push({
      kind: 'pause_loss_limit', campaign_id: c.id, protective: true,
      params: { spend: round1(s.cost), conversions: s.conversions, roas: roas(s) === null ? null : round1(roas(s)!) },
      reason: noConv
        ? { key: 'campaigns.reason_loss_no_conversions', params: { spend: round1(s.cost), limit: limit.no_conversions } }
        : { key: 'campaigns.reason_loss_below_cost', params: { spend: round1(s.cost), value: round1(s.value) } },
    })
  }
  return out
}

/**
 * Cât buget pe zi mai încape pentru o campanie sub bugetul maxim al omului (pentru toate campaniile Hontrio
 * care rulează, la un loc): maximul minus bugetele celorlalte (și ce le-a mai propus deja pilotul). null = fără maxim.
 */
export function budgetRoom(max: number | null, campaignId: string, campaigns: { id: string; status: string; daily_budget: number | null }[], reserved = 0): number | null {
  if (max === null) return null
  const others = campaigns.filter(x => x.id !== campaignId && x.status === 'active').reduce((s, x) => s + (x.daily_budget ?? 0), 0)
  return Math.round((max - others - reserved) * 100) / 100
}

/** Textul fără diacritice, spații și semne („Lumină Design" = „luminadesign"), ca numele magazinului să fie recunoscut oricum e scris. */
export const squash = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export function optimize(input: OptimizerInput): Proposal[] {
  const out: Proposal[] = []
  const active = input.campaigns.filter(c => c.status === 'active' && !input.skip?.has(c.id))
  const stopped = new Set<string>()

  // 1. Oprirea de siguranță: protecție, se aplică oricum; o campanie oprită nu mai primește nimic altceva
  for (const p of lossStops(active, input.loss_limit)) {
    out.push(p)
    stopped.add(p.campaign_id!)
  }

  // Creșterile de buget propuse deja în trecerea asta: împreună nu trec de bugetul maxim
  let reserved = 0
  for (const c of active) {
    if (stopped.has(c.id)) continue
    // Bugetul vede și vânzările din magazin pe care Google nu le-a numărat
    const judged = withStoreSales(c.eval30, c.store30)
    const actual = roas(judged)

    // 2. Pornirea trece la Performance Max: cea principală după cumpărările contului, a unei grupe după ale ei
    if (c.stage === 'starter' && c.can_graduate !== false) {
      const conversions = c.group ? c.eval30.conversions : input.account.conversions30
      const rejected = input.rejected.kinds.has('graduate') || input.rejected.kinds.has(`graduate:${c.id}`)
      if (c.days_live >= STARTER_MIN_DAYS && conversions >= GROWTH_MIN_CONVERSIONS && !rejected) {
        out.push({
          kind: 'graduate', campaign_id: c.id, protective: false,
          params: { daily_budget: c.daily_budget },
          reason: { key: c.group ? 'campaigns.reason_graduate_group' : 'campaigns.reason_graduate', params: { conversions: Math.round(conversions) } },
        })
      }
    }

    // 3. Bugetul: campania își termină bugetul și vinde peste costul reclamei. Doar propunere:
    //    banii îi decide omul. Bugetul maxim e pentru toate campaniile Hontrio care rulează, împreună.
    const limited = !!c.google && (c.google.reasons.includes('BUDGET_CONSTRAINED') || (c.google.recommended_budget ?? 0) > c.daily_budget * 1.05)
    const minAge = c.type === 'performance_max' ? LEARNING_DAYS : STARTER_MIN_DAYS
    if (limited && actual !== null && actual >= 1 && judged.conversions > 0
      && c.days_live >= minAge
      && (c.days_since_budget_change === null || c.days_since_budget_change >= BUDGET_MIN_GAP_DAYS)) {
      const ceiling = budgetRoom(input.max_daily_budget, c.id, input.campaigns, reserved)
      const raised = Math.round(c.daily_budget * (1 + BUDGET_STEP) * 100) / 100
      const next = ceiling !== null ? Math.min(raised, ceiling) : raised
      if (next > c.daily_budget + 0.01) {
        reserved += next - c.daily_budget
        out.push({
          kind: 'set_budget', campaign_id: c.id, protective: false, needs_approval: true,
          params: { from: c.daily_budget, to: next },
          reason: { key: 'campaigns.reason_budget_limited', params: { actual: round1(actual), from: c.daily_budget, to: next } },
        })
      }
    }
  }

  // 4. Produsele care cheltuie fără să vândă sau costă mai mult decât vând (vânzările: Google sau magazinul, care vede mai mult)
  const picks: { item_id: string; offer_id: string; title: string; cost: number; conversions: number; roas: number | null; why: 'no_sales' | 'unprofitable' }[] = []
  for (const p of input.products) {
    if (p.excluded || p.included_by_user || p.days < PRODUCT_MIN_DAYS || input.rejected.items.has(p.item_id)) continue
    // O vânzare aduce cam prețul produsului; fără preț, comanda medie
    const unit = p.price > 0 ? p.price : input.economics.aov ?? 0
    if (unit <= 0) continue
    const w = withStoreSales(p.window, p.store)
    const r = roas(w)
    if (w.conversions === 0 && w.cost >= PRODUCT_NO_SALES_PRICES * unit) {
      picks.push({ item_id: p.item_id, offer_id: p.offer_id, title: p.title, cost: round1(w.cost), conversions: 0, roas: null, why: 'no_sales' })
    } else if (w.conversions > 0 && r !== null && r < 1) {
      picks.push({ item_id: p.item_id, offer_id: p.offer_id, title: p.title, cost: round1(w.cost), conversions: w.conversions, roas: round1(r), why: 'unprofitable' })
    }
  }
  if (picks.length) {
    picks.sort((a, b) => b.cost - a.cost)
    const wasted = round1(picks.reduce((s, x) => s + x.cost, 0))
    out.push({
      kind: 'exclude_products', campaign_id: null, protective: false,
      params: { products: picks },
      reason: { key: 'campaigns.reason_exclude_products', params: { count: picks.length, spend: wasted } },
    })
  }

  // 5. Termenii de căutare care au costat cât o comandă medie, fără vânzări (niciodată numele magazinului).
  //    Când Google n-a numărat toate comenzile din magazin ale campaniei, „fără vânzări” e mai puțin sigur: pragul
  //    crește cu partea pe care n-o vede Google (o căutare nu se poate lega de o comandă din magazin)
  const aov = input.economics.aov
  if (aov !== null && aov > 0) {
    const brands = input.brand.map(squash).filter(Boolean)
    const byCampaign = new Map<string, OptSearchTerm[]>()
    const thresholdOf = new Map(active.map(c => [c.id, TERM_NO_SALES_AOV * aov / googleCoverage(c)]))
    for (const t of input.searchTerms) {
      const term = t.term.toLowerCase().trim()
      if (!term || t.conversions > 0 || t.cost < (thresholdOf.get(t.campaign_id) ?? TERM_NO_SALES_AOV * aov)) continue
      // Numele magazinului, scris oricum (fără diacritice, legat, cu cratimă)
      if (brands.some(b => squash(term).includes(b)) || input.rejected.terms.has(term)) continue
      if (input.negatives.get(t.campaign_id)?.has(term)) continue
      if (!active.some(c => c.id === t.campaign_id && !stopped.has(c.id))) continue
      byCampaign.set(t.campaign_id, [...(byCampaign.get(t.campaign_id) ?? []), { ...t, term }])
    }
    for (const [campaignId, terms] of byCampaign) {
      const top = terms.sort((a, b) => b.cost - a.cost).slice(0, MAX_TERMS_PER_PROPOSAL)
      out.push({
        kind: 'add_negatives', campaign_id: campaignId, protective: false,
        params: { terms: top.map(t => ({ term: t.term, cost: round1(t.cost), clicks: t.clicks })) },
        reason: { key: 'campaigns.reason_negatives', params: { count: top.length, spend: round1(top.reduce((s, t) => s + t.cost, 0)) } },
      })
    }
  }

  return out
}
