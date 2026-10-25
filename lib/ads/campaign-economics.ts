import { round1 } from '@/lib/ads/economics'
import { normalizeItemId } from '@/lib/google/operations'
import { GOAL_KEEP, type Plan } from '@/lib/campaigns/plan'
import type { CampaignRow } from '@/lib/ads/apply'

// =============================================
// Pragul de profit și ținta pe campanie. Campaniile pe marje (segmentul de
// marjă mare și „restul") au pragul produselor lor; celelalte, pe al
// magazinului. Le folosesc și pilotul (ce propune), și paginile (profitul
// arătat), ca să nu se contrazică.
// =============================================

/** Pragul și ținta pentru produsele unei campanii (segmentul de marjă mare are pragul lui). */
export function campaignEconomics(c: CampaignRow, plan: Plan, all: CampaignRow[]): { break_even: number | null; goal_target: number | null } {
  const be = plan.economics.break_even
  if (be === null) return { break_even: null, goal_target: plan.target_roas }
  const highIds = new Set(all.filter(x => x.included_item_ids).flatMap(x => x.included_item_ids!.map(normalizeItemId)))
  const inCampaign = c.included_item_ids
    ? (o: Plan['offers'][number]) => !!o.item_id && highIds.has(normalizeItemId(o.item_id))
    : c.segment === 'rest' ? (o: Plan['offers'][number]) => !o.item_id || !highIds.has(normalizeItemId(o.item_id)) : null
  if (!inCampaign) return { break_even: be, goal_target: plan.target_roas }
  const list = plan.offers.filter(o => o.reason === null && o.break_even !== null && inCampaign(o))
  const weight = list.reduce((s, o) => s + (o.revenue || o.price), 0)
  if (!list.length || weight <= 0) return { break_even: be, goal_target: plan.target_roas }
  const segBe = list.reduce((s, o) => s + o.break_even! * (o.revenue || o.price), 0) / weight
  return { break_even: round1(segBe), goal_target: round1(segBe / (1 - GOAL_KEEP[plan.goal])) }
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
    const split = splits.get(r.google_campaign_id)
    const be = (split && r.date < split ? null : breakEvens.get(r.google_campaign_id)) ?? storeBreakEven
    out.set(r.google_campaign_id, (out.get(r.google_campaign_id) ?? 0) + r.value / be - r.cost)
  }
  return out
}

/**
 * Pragul fiecărei campanii Hontrio, după ID-ul din Google. Segmentele se socotesc față de
 * campaniile care rulează sau sunt pe pauză, ca în pilot; una încheiată, față de ea însăși.
 */
export function campaignBreakEvens(campaigns: CampaignRow[], plan: Plan): Map<string, number | null> {
  const live = campaigns.filter(c => c.status === 'active' || c.status === 'paused')
  return new Map(campaigns.filter(c => c.google_campaign_id).map(c => [
    c.google_campaign_id!,
    campaignEconomics(c, plan, live.some(x => x.id === c.id) ? live : [...live, c]).break_even,
  ]))
}
