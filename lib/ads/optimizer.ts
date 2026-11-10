import { round1 } from '@/lib/ads/economics'

// =============================================
// Bucla de optimizare — ce ar schimba pilotul azi, din cifrele Google Ads.
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

export type Window = { cost: number; conversions: number; value: number; clicks: number }
export const EMPTY: Window = { cost: 0, conversions: 0, value: 0, clicks: 0 }

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
  /** De la lansare sau de la ultima repornire (oprirea de siguranță). */
  since_loss_check: Window
  /** Ultimele 30 de zile, fără ultimele 2 (conversiile întârziate). */
  eval30: Window
  recent14: Window
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
  days: number
}

export type OptSearchTerm = { campaign_id: string; term: string; cost: number; conversions: number; clicks: number }

export type OptimizerInput = {
  /** Comanda medie: unitatea de măsură pentru căutări (și, prin `loss_limit`, pentru oprire). */
  economics: { aov: number | null }
  account: { conversions30: number }
  max_daily_budget: number | null
  loss_limit: { no_conversions: number; low_roas: number } | null
  campaigns: OptCampaign[]
  products: OptProduct[]
  searchTerms: OptSearchTerm[]
  /** Cuvintele negative existente ale campaniilor Hontrio (litere mici). */
  negatives: Map<string, Set<string>>
  /** Numele magazinului: căutările pe el nu se exclud niciodată. */
  brand: string[]
  /** Ce a respins omul în ultimele 30 de zile (să nu-i propunem la nesfârșit). */
  rejected: { items: Set<string>; terms: Set<string>; kinds: Set<string> }
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

/** Fereastra dintre două date (incluse), din rândurile pe zi. */
export function windowOf(days: { date: string; cost: number; conversions: number; value: number; clicks: number }[], from: string, to: string): Window {
  return sumWindows(days.filter(d => d.date >= from && d.date <= to))
}

export function optimize(input: OptimizerInput): Proposal[] {
  const out: Proposal[] = []
  const active = input.campaigns.filter(c => c.status === 'active')

  for (const c of active) {
    const actual = roas(c.eval30)

    // 1. Oprirea de siguranță: protecție, se aplică oricum
    if (input.loss_limit) {
      const s = c.since_loss_check
      const noConv = s.cost >= input.loss_limit.no_conversions && s.conversions === 0
      const belowCost = s.cost >= input.loss_limit.low_roas && (roas(s) ?? 0) < 1
      if (noConv || belowCost) {
        out.push({
          kind: 'pause_loss_limit', campaign_id: c.id, protective: true,
          params: { spend: round1(s.cost), conversions: s.conversions, roas: roas(s) === null ? null : round1(roas(s)!) },
          reason: noConv
            ? { key: 'campaigns.reason_loss_no_conversions', params: { spend: round1(s.cost), limit: input.loss_limit.no_conversions } }
            : { key: 'campaigns.reason_loss_below_cost', params: { spend: round1(s.cost), value: round1(s.value) } },
        })
        continue
      }
    }

    // 2. Pornirea trece la Performance Max: cea principală după conversiile contului, a unei grupe după ale ei
    if (c.stage === 'starter') {
      const conversions = c.group ? c.eval30.conversions : input.account.conversions30
      if (c.days_live >= STARTER_MIN_DAYS && conversions >= GROWTH_MIN_CONVERSIONS && !input.rejected.kinds.has('graduate')) {
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
    if (limited && actual !== null && actual >= 1 && c.eval30.conversions > 0
      && c.days_live >= minAge
      && (c.days_since_budget_change === null || c.days_since_budget_change >= BUDGET_MIN_GAP_DAYS)) {
      const others = active.filter(x => x.id !== c.id).reduce((s, x) => s + x.daily_budget, 0)
      const ceiling = input.max_daily_budget === null ? null : Math.round((input.max_daily_budget - others) * 100) / 100
      const raised = Math.round(c.daily_budget * (1 + BUDGET_STEP) * 100) / 100
      const next = ceiling !== null ? Math.min(raised, ceiling) : raised
      if (next > c.daily_budget + 0.01) {
        out.push({
          kind: 'set_budget', campaign_id: c.id, protective: false, needs_approval: true,
          params: { from: c.daily_budget, to: next },
          reason: { key: 'campaigns.reason_budget_limited', params: { actual: round1(actual), from: c.daily_budget, to: next } },
        })
      }
    }
  }

  // 4. Produsele care cheltuie fără să vândă sau costă mai mult decât vând
  const picks: { item_id: string; offer_id: string; title: string; cost: number; conversions: number; roas: number | null; why: 'no_sales' | 'unprofitable' }[] = []
  for (const p of input.products) {
    if (p.excluded || p.included_by_user || p.days < PRODUCT_MIN_DAYS || input.rejected.items.has(p.item_id)) continue
    // O vânzare aduce cam prețul produsului; fără preț, comanda medie
    const unit = p.price > 0 ? p.price : input.economics.aov ?? 0
    if (unit <= 0) continue
    const r = roas(p.window)
    if (p.window.conversions === 0 && p.window.cost >= PRODUCT_NO_SALES_PRICES * unit) {
      picks.push({ item_id: p.item_id, offer_id: p.offer_id, title: p.title, cost: round1(p.window.cost), conversions: 0, roas: null, why: 'no_sales' })
    } else if (p.window.conversions > 0 && r !== null && r < 1) {
      picks.push({ item_id: p.item_id, offer_id: p.offer_id, title: p.title, cost: round1(p.window.cost), conversions: p.window.conversions, roas: round1(r), why: 'unprofitable' })
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

  // 5. Termenii de căutare care au costat cât o comandă medie, fără vânzări (niciodată numele magazinului)
  const aov = input.economics.aov
  if (aov !== null && aov > 0) {
    const byCampaign = new Map<string, OptSearchTerm[]>()
    for (const t of input.searchTerms) {
      const term = t.term.toLowerCase().trim()
      if (!term || t.conversions > 0 || t.cost < TERM_NO_SALES_AOV * aov) continue
      if (input.brand.some(b => term.includes(b)) || input.rejected.terms.has(term)) continue
      if (input.negatives.get(t.campaign_id)?.has(term)) continue
      if (!active.some(c => c.id === t.campaign_id)) continue
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
