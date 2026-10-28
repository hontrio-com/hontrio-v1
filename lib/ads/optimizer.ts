import { round1 } from '@/lib/ads/economics'
import { startingTarget } from '@/lib/campaigns/plan'

// =============================================
// Bucla de optimizare — ce ar schimba pilotul azi, din cifrele Google Ads
// și din pragul de profit. Funcție pură: primește campaniile, ferestrele de
// metrici, produsele și termenii de căutare și întoarce propuneri. Ce se
// aplică singur și ce așteaptă aprobarea hotărăște apelantul (modul ales).
// Regulile și protecțiile: docs/campanii/SPECIFICATIE.md §6.
// =============================================

/** Google: o campanie nouă are nevoie de ~6 săptămâni fără schimbări dese. */
export const LEARNING_DAYS = 42
/** Campania de pornire trece la PMax cel mai devreme după atâtea zile. */
export const STARTER_MIN_DAYS = 14
export const GROWTH_MIN_CONVERSIONS = 15
export const TARGET_STEP = 0.12
export const TARGET_MIN_GAP_DAYS = 14
export const TARGET_MIN_CONVERSIONS = 10
export const BUDGET_STEP = 0.2
export const BUDGET_MIN_GAP_DAYS = 7
/** Sub atât din buget cheltuit, ținta e prea strictă și ține campania pe loc. */
export const UNDERSPEND = 0.7
export const PRODUCT_MIN_DAYS = 21
export const PRODUCT_NO_SALES_CPA = 2
export const TERM_NO_SALES_CPA = 2
export const MAX_TERMS_PER_PROPOSAL = 20
export const SEGMENT_MIN_CONVERSIONS = 30
export const SEGMENT_GROUP_MIN_CONVERSIONS = 15

export type Window = { cost: number; conversions: number; value: number; clicks: number }
export const EMPTY: Window = { cost: 0, conversions: 0, value: 0, clicks: 0 }

export type OptCampaign = {
  id: string
  google_campaign_id: string
  type: 'shopping' | 'performance_max'
  stage: 'starter' | 'growth' | 'segment'
  segment: string
  status: 'active' | 'paused'
  days_live: number
  target_roas: number | null
  daily_budget: number
  /** Pragul de profit și ținta obiectivului pentru produsele campaniei (diferite pe segmente și grupe). */
  break_even: number | null
  goal_target: number | null
  /** Campania unei grupe a omului: trece la PMax după conversiile ei, nu ale contului, și nu se împarte pe marje. */
  group?: boolean
  days_since_target_change: number | null
  days_since_budget_change: number | null
  google: { reasons: string[]; recommended_budget: number | null } | null
  /** De la lansare sau de la ultima repornire (limita de pierdere). */
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
  break_even: number | null
  /** Omul l-a inclus explicit: pilotul nu-l mai scoate. */
  included_by_user: boolean
  excluded: boolean
  /** În campania unei grupe a omului: nu intră în împărțirea pe marje a campaniei principale. */
  in_group?: boolean
  window: Window
  days: number
}

export type OptSearchTerm = { campaign_id: string; term: string; cost: number; conversions: number; clicks: number }

export type OptimizerInput = {
  economics: { break_even: number | null; goal_target: number | null; aov: number | null }
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
  segmentation_done: boolean
}

export type Proposal = {
  kind: 'pause_loss_limit' | 'graduate' | 'set_target' | 'set_budget' | 'exclude_products' | 'add_negatives' | 'segment'
  campaign_id: string | null
  /** Protecție: se aplică și în modul cu aprobare. */
  protective: boolean
  /** Nu se aplică singur nici în modul automat (ex. buget fără plafon ales de om). */
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
  const { economics: econ } = input
  const active = input.campaigns.filter(c => c.status === 'active')

  for (const c of active) {
    const be = c.break_even ?? econ.break_even
    const actual = roas(c.eval30)

    // 1. Limita de pierdere: protecție, se aplică oricum
    if (input.loss_limit && be !== null) {
      const s = c.since_loss_check
      const noConv = s.cost >= input.loss_limit.no_conversions && s.conversions === 0
      const lowRoas = s.cost >= input.loss_limit.low_roas && (roas(s) ?? 0) < be / 2
      if (noConv || lowRoas) {
        out.push({
          kind: 'pause_loss_limit', campaign_id: c.id, protective: true,
          params: { spend: round1(s.cost), conversions: s.conversions, roas: roas(s) === null ? null : round1(roas(s)!) },
          reason: noConv
            ? { key: 'campaigns.reason_loss_no_conversions', params: { spend: round1(s.cost), limit: input.loss_limit.no_conversions } }
            : { key: 'campaigns.reason_loss_low_roas', params: { roas: round1(roas(s) ?? 0), break_even: round1(be) } },
        })
        continue
      }
    }

    // 2. Pornirea trece la Performance Max: cea principală după conversiile contului, a unei grupe după ale ei
    if (c.stage === 'starter') {
      const conversions = c.group ? c.eval30.conversions : input.account.conversions30
      if (c.days_live >= STARTER_MIN_DAYS && conversions >= GROWTH_MIN_CONVERSIONS && be !== null && !input.rejected.kinds.has('graduate')) {
        const target = startingTarget(actual, be, c.goal_target)
        out.push({
          kind: 'graduate', campaign_id: c.id, protective: false,
          params: { target_roas: target, daily_budget: c.daily_budget },
          reason: { key: c.group ? 'campaigns.reason_graduate_group' : 'campaigns.reason_graduate', params: { conversions: Math.round(conversions), target } },
        })
      }
    }

    // 3. Ținta ROAS (doar PMax, după învățare, cu destule conversii recente)
    if (c.type === 'performance_max' && c.target_roas !== null && be !== null && actual !== null
      && c.days_live >= LEARNING_DAYS
      && (c.days_since_target_change === null || c.days_since_target_change >= TARGET_MIN_GAP_DAYS)
      && c.recent14.conversions >= TARGET_MIN_CONVERSIONS) {
      const current = c.target_roas
      const goal = c.goal_target ?? be
      let next: number | null = null
      let key = ''
      if (actual < be) {
        next = round1(Math.max(current * (1 + TARGET_STEP), be)); key = 'campaigns.reason_target_below_break_even'
      } else if (current < goal * 0.98 && actual >= current) {
        next = round1(Math.min(current * (1 + TARGET_STEP), goal)); key = 'campaigns.reason_target_toward_goal'
      } else if (current > goal * 1.02 && c.recent14.cost < UNDERSPEND * 14 * c.daily_budget) {
        next = round1(Math.max(current / (1 + TARGET_STEP), goal, be)); key = 'campaigns.reason_target_too_strict'
      }
      if (next !== null && Math.abs(next - current) >= 0.1) {
        out.push({
          kind: 'set_target', campaign_id: c.id, protective: false,
          params: { from: current, to: next },
          reason: { key, params: { actual: round1(actual), from: current, to: next, break_even: round1(be) } },
        })
      }
    }

    // 3b. Un Performance Max pornit fără țintă (prea puține conversii la lansare) primește prima țintă
    //     când strânge destule: din ROAS-ul pe care îl face, dar nu sub prag
    if (c.type === 'performance_max' && c.target_roas === null && be !== null && actual !== null
      && c.days_live >= STARTER_MIN_DAYS && c.eval30.conversions >= GROWTH_MIN_CONVERSIONS && !input.rejected.kinds.has('set_target')) {
      const to = startingTarget(actual, be, c.goal_target)
      out.push({
        kind: 'set_target', campaign_id: c.id, protective: false,
        params: { from: null, to },
        reason: { key: 'campaigns.reason_target_first', params: { conversions: Math.round(c.eval30.conversions), to } },
      })
    }

    // 4. Bugetul: campania e limitată de buget și aduce cel puțin ținta.
    //    Bugetul maxim al omului e pentru toate campaniile Hontrio care rulează, împreună.
    const limited = !!c.google && (c.google.reasons.includes('BUDGET_CONSTRAINED') || (c.google.recommended_budget ?? 0) > c.daily_budget * 1.05)
    const minAge = c.type === 'performance_max' ? LEARNING_DAYS : STARTER_MIN_DAYS
    const bar = Math.max(c.target_roas ?? c.goal_target ?? 0, be ?? Infinity)
    if (limited && be !== null && actual !== null && actual >= bar
      && c.days_live >= minAge
      && (c.days_since_budget_change === null || c.days_since_budget_change >= BUDGET_MIN_GAP_DAYS)) {
      const others = active.filter(x => x.id !== c.id).reduce((s, x) => s + x.daily_budget, 0)
      const ceiling = input.max_daily_budget === null ? null : Math.round((input.max_daily_budget - others) * 100) / 100
      const raised = Math.round(c.daily_budget * (1 + BUDGET_STEP) * 100) / 100
      const next = ceiling !== null ? Math.min(raised, ceiling) : raised
      if (next > c.daily_budget + 0.01) {
        out.push({
          kind: 'set_budget', campaign_id: c.id, protective: false,
          // Fără buget maxim ales de om, creșterea rămâne o propunere
          needs_approval: ceiling === null,
          params: { from: c.daily_budget, to: next },
          reason: { key: 'campaigns.reason_budget_limited', params: { actual: round1(actual), from: c.daily_budget, to: next } },
        })
      }
    }
  }

  // 5. Produsele care cheltuie fără să aducă bani
  if (econ.break_even !== null) {
    const picks: { item_id: string; offer_id: string; title: string; cost: number; conversions: number; roas: number | null; why: 'no_sales' | 'unprofitable' }[] = []
    for (const p of input.products) {
      if (p.excluded || p.included_by_user || p.days < PRODUCT_MIN_DAYS || input.rejected.items.has(p.item_id)) continue
      const be = p.break_even ?? econ.break_even
      // Costul pe vânzare la prag: o vânzare aduce cam prețul produsului
      const cpa = (p.price > 0 ? p.price : econ.aov ?? 0) / be
      if (cpa <= 0) continue
      const r = roas(p.window)
      if (p.window.conversions === 0 && p.window.cost >= PRODUCT_NO_SALES_CPA * cpa) {
        picks.push({ item_id: p.item_id, offer_id: p.offer_id, title: p.title, cost: round1(p.window.cost), conversions: 0, roas: null, why: 'no_sales' })
      } else if (p.window.conversions > 0 && r !== null && r < be && p.window.cost >= cpa) {
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
  }

  // 6. Termenii de căutare scumpi, fără vânzări (niciodată numele magazinului)
  if (econ.break_even !== null && econ.aov !== null) {
    const cpa = econ.aov / econ.break_even
    const byCampaign = new Map<string, OptSearchTerm[]>()
    for (const t of input.searchTerms) {
      const term = t.term.toLowerCase().trim()
      if (!term || t.conversions > 0 || t.cost < TERM_NO_SALES_CPA * cpa) continue
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

  // 7. Segmentarea pe marje: o singură dată, pe campania PMax principală, doar pe produsele ei (fără grupele omului)
  const main = active.find(c => c.type === 'performance_max' && c.segment === 'all' && !c.group)
  if (main && !input.segmentation_done && !input.rejected.kinds.has('segment')
    && main.days_live >= LEARNING_DAYS && main.eval30.conversions >= SEGMENT_MIN_CONVERSIONS) {
    const priced = input.products.filter(p => !p.excluded && !p.in_group && p.break_even !== null)
    const sorted = [...priced].sort((a, b) => a.break_even! - b.break_even!)
    if (sorted.length >= 4) {
      const median = sorted[Math.floor(sorted.length / 2)].break_even!
      const high = sorted.filter(p => p.break_even! < median)
      const rest = sorted.filter(p => p.break_even! >= median)
      const conv = (list: OptProduct[]) => list.reduce((s, p) => s + p.window.conversions, 0)
      const keep = main.goal_target && main.break_even ? 1 - main.break_even / main.goal_target : 0.25
      const beOf = (list: OptProduct[]) => {
        const w = list.reduce((s, p) => s + p.window.value, 0)
        // Pragul grupei, ponderat cu valoarea adusă (altfel media simplă)
        return w > 0 ? list.reduce((s, p) => s + p.break_even! * p.window.value, 0) / w : list.reduce((s, p) => s + p.break_even!, 0) / list.length
      }
      if (high.length && rest.length && conv(high) >= SEGMENT_GROUP_MIN_CONVERSIONS && conv(rest) >= SEGMENT_GROUP_MIN_CONVERSIONS) {
        const highBe = beOf(high)
        const restBe = beOf(rest)
        // Pragurile trebuie să difere de-adevăratelea, altfel două campanii doar împart datele
        if (restBe / highBe >= 1.25) {
          out.push({
            kind: 'segment', campaign_id: main.id, protective: false,
            params: {
              high_item_ids: high.map(p => p.item_id),
              high_target: round1(highBe / (1 - keep)),
              rest_target: round1(restBe / (1 - keep)),
              high_break_even: round1(highBe),
              rest_break_even: round1(restBe),
            },
            reason: { key: 'campaigns.reason_segment', params: { high: high.length, rest: rest.length, high_be: round1(highBe), rest_be: round1(restBe) } },
          })
        }
      }
    }
  }

  return out
}
