import { round1 } from '@/lib/ads/economics'
import { normalizeItemId } from '@/lib/google/operations'
import { GOAL_KEEP, GOALS, type Goal, type Plan } from '@/lib/campaigns/plan'
import { canRun, weightedBreakEven } from '@/lib/campaigns/groups'
import type { CampaignRow } from '@/lib/ads/apply'

// =============================================
// Pragul de profit și ținta pe campanie. Campaniile cu lista lor de produse
// (segmentul de marjă mare, grupele omului) au pragul produselor lor; „restul"
// și campania principală, pe al produselor care le rămân; o grupă, ținta
// obiectivului ei. Le folosesc și pilotul (ce propune), și paginile (profitul
// arătat), ca să nu se contrazică.
// =============================================

const live = (c: CampaignRow) => c.status === 'active' || c.status === 'paused'
const idsOf = (list: CampaignRow[]) => new Set(list.flatMap(x => (x.included_item_ids ?? []).map(normalizeItemId)))

/** Pragul și ținta pentru produsele unei campanii. */
export function campaignEconomics(c: CampaignRow, plan: Plan, all: CampaignRow[]): { break_even: number | null; goal_target: number | null } {
  const be = plan.economics.break_even
  // O grupă are obiectivul ei; celelalte campanii, pe al magazinului
  const goal: Goal = c.product_group_id && GOALS.includes(c.goal as Goal) ? (c.goal as Goal) : plan.goal
  const storeTarget = be === null ? plan.target_roas : round1(be / (1 - GOAL_KEEP[goal]))
  if (be === null) return { break_even: null, goal_target: storeTarget }

  type Offer = Plan['offers'][number]
  let inCampaign: ((o: Offer) => boolean) | null = null
  if (c.included_item_ids) {
    // Segmentul de marjă mare, fără produsele grupelor lansate (au campaniile lor)
    const grouped = c.product_group_id ? new Set<string>() : idsOf(all.filter(x => x.id !== c.id && x.product_group_id && x.included_item_ids && live(x)))
    const own = new Set(c.included_item_ids.map(normalizeItemId).filter(id => !grouped.has(id)))
    inCampaign = o => !!o.item_id && own.has(normalizeItemId(o.item_id))
  } else if (c.segment === 'rest') {
    // „Restul": fără produsele campaniilor cu lista lor (marjă mare, grupe)
    const taken = idsOf(all.filter(x => x.id !== c.id && x.included_item_ids))
    inCampaign = o => !o.item_id || !taken.has(normalizeItemId(o.item_id))
  } else if (live(c)) {
    // Campania principală care rulează: fără produsele grupelor lansate (cea încheiată vindea tot catalogul)
    const taken = idsOf(all.filter(x => x.id !== c.id && x.product_group_id && x.included_item_ids && live(x)))
    if (taken.size) inCampaign = o => !o.item_id || !taken.has(normalizeItemId(o.item_id))
  }
  if (!inCampaign) return { break_even: be, goal_target: storeTarget }
  const segBe = weightedBreakEven(plan.offers.filter(o => canRun(o) && inCampaign!(o)))
  if (segBe === null) return { break_even: be, goal_target: storeTarget }
  return { break_even: round1(segBe), goal_target: round1(segBe / (1 - GOAL_KEEP[goal])) }
}

/** Ziua împărțirii pe marje, pe campania care a devenit „restul" (din jurnal), după ID-ul din Google. */
export function segmentSplits(
  campaigns: Pick<CampaignRow, 'id' | 'google_campaign_id'>[],
  actions: { kind: string; status: string; ad_campaign_id: string | null; applied_at: string | null }[],
): Map<string, string> {
  const googleOf = new Map(campaigns.map(c => [c.id, c.google_campaign_id]))
  const out = new Map<string, string>()
  for (const a of actions) {
    if (a.kind !== 'segment' || a.status !== 'applied' || !a.ad_campaign_id || !a.applied_at) continue
    const g = googleOf.get(a.ad_campaign_id)
    if (g) out.set(g, a.applied_at.slice(0, 10))
  }
  return out
}

/**
 * Profitul pe campanie din cifrele pe zi, fiecare zi cu pragul ei. „Restul" vindea, înainte de
 * împărțire, tot catalogul: zilele acelea se socotesc cu pragul magazinului. Fără prag, null.
 */
export function profitByCampaign(
  rows: { google_campaign_id: string; date: string; cost: number; value: number }[],
  breakEvens: Map<string, number | null>,
  storeBreakEven: number | null,
  splits: Map<string, string>,
): Map<string, number> | null {
  if (storeBreakEven === null) return null
  const out = new Map<string, number>()
  for (const r of rows) {
    out.set(r.google_campaign_id, (out.get(r.google_campaign_id) ?? 0) + profitOfRow(r, breakEvens, storeBreakEven, splits))
  }
  return out
}

/** Profitul unei zile a unei campanii: valoarea împărțită la pragul ei din ziua aceea, minus cheltuiala. */
export function profitOfRow(
  r: { google_campaign_id: string; date: string; cost: number; value: number },
  breakEvens: Map<string, number | null>,
  storeBreakEven: number,
  splits: Map<string, string>,
): number {
  const split = splits.get(r.google_campaign_id)
  const be = (split && r.date < split ? null : breakEvens.get(r.google_campaign_id)) ?? storeBreakEven
  return r.value / be - r.cost
}

/**
 * Pragul fiecărei campanii Hontrio, după ID-ul din Google. Segmentele se socotesc față de
 * campaniile care rulează sau sunt pe pauză, ca în pilot; una încheiată, față de ea însăși.
 */
export function campaignBreakEvens(campaigns: CampaignRow[], plan: Plan): Map<string, number | null> {
  const running = campaigns.filter(live)
  return new Map(campaigns.filter(c => c.google_campaign_id).map(c => [
    c.google_campaign_id!,
    campaignEconomics(c, plan, running.some(x => x.id === c.id) ? running : [...running, c]).break_even,
  ]))
}
