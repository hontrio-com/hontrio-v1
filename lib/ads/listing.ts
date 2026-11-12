import { normalizeItemId, EXCLUDE_LABEL, MAX_LISTING_ITEMS, type ListingSpec } from '@/lib/google/operations'
import { exclusionLabelMap, type Plan } from '@/lib/campaigns/plan'

// =============================================
// Arborele de produse al fiecărei campanii Hontrio și eticheta Hontrio din
// Merchant Center, socotite din plan și din campaniile care rulează. Funcții
// pure (fără Google, fără bază), folosite de lansare, de pilot și de
// reîmprospătarea Merchant Center, ca toate să hotărască la fel.
// =============================================

export type CampaignRow = {
  id: string; user_id: string; store_id: string; type: 'shopping' | 'performance_max'; status: string
  stage: 'starter' | 'growth' | 'segment' | null; segment: string | null; name: string | null
  customer_id: string | null; google_campaign_id: string | null; google_budget_id: string | null
  google_asset_group_id: string | null; google_ad_group_id: string | null
  merchant_center_id: string | null; feed_label: string | null
  daily_budget: number | null; target_roas: number | null; cpc_ceiling: number | null; currency: string | null
  excluded_item_ids: string[]; included_item_ids: string[] | null
  launched_at: string | null; target_changed_at: string | null; budget_changed_at: string | null; loss_check_from: string | null
  /** Grupa omului a cărei campanie e; null = campania principală (sau un segment vechi al ei). */
  product_group_id: string | null
}

export const CAMPAIGN_COLUMNS = 'id, user_id, store_id, type, status, stage, segment, name, customer_id, google_campaign_id, google_budget_id, google_asset_group_id, google_ad_group_id, merchant_center_id, feed_label, daily_budget, target_roas, cpc_ceiling, currency, excluded_item_ids, included_item_ids, launched_at, target_changed_at, budget_changed_at, loss_check_from, product_group_id'

export function parseCampaign(r: Record<string, unknown>): CampaignRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    ...(r as unknown as CampaignRow),
    daily_budget: num(r.daily_budget),
    target_roas: num(r.target_roas),
    cpc_ceiling: num(r.cpc_ceiling),
    excluded_item_ids: (r.excluded_item_ids as string[] | null) ?? [],
    included_item_ids: (r.included_item_ids as string[] | null) ?? null,
    product_group_id: (r.product_group_id as string | null | undefined) ?? null,
  }
}

const running = (c: Pick<CampaignRow, 'status'>) => c.status === 'active' || c.status === 'paused'

/** ID-urile din Merchant Center (litere mici) ale produselor unei grupe, cum le-a împărțit planul. */
export function groupItems(plan: Plan, assigned: Map<string, string>, groupId: string): string[] {
  return [...new Set(plan.offers.filter(o => o.item_id && assigned.get(o.offer_id) === groupId).map(o => normalizeItemId(o.item_id!)))].sort()
}

/**
 * Arborele dorit al unei campanii: lista ei (o grupă, sau un segment vechi pe marje) sau totul minus
 * excluderi și minus produsele campaniilor cu lista lor. `members` = produsele grupei acum (regulile ei
 * pot prinde produse noi), în locul listei salvate.
 */
export function desiredListing(c: CampaignRow, plan: Plan, others: CampaignRow[], labelIndex: number | null, members: string[] | null = null): { listing: ListingSpec; excluded: string[]; included: string[] | null } {
  const excluded = new Set(plan.exclusions.item_ids.map(normalizeItemId))
  const base = members ?? c.included_item_ids
  if (base) {
    // Un segment vechi (lista lui e fixă) lasă afară produsele grupelor lansate după el
    const grouped = c.product_group_id ? new Set<string>() : new Set(others
      .filter(o => o.id !== c.id && o.product_group_id && o.included_item_ids && running(o))
      .flatMap(o => o.included_item_ids!.map(normalizeItemId)))
    const included = [...new Set(base.map(normalizeItemId))].filter(id => !excluded.has(id) && !grouped.has(id)).sort()
    return { listing: { kind: 'include_items', item_ids: included }, excluded: [], included }
  }
  // Campania principală lasă afară produsele grupelor (și ale unui segment vechi)
  let taken = 0
  for (const o of others) {
    if (o.id === c.id || !o.included_item_ids || !running(o)) continue
    for (const id of o.included_item_ids) { excluded.add(normalizeItemId(id)); taken++ }
  }
  const list = [...excluded].sort()
  // Eticheta Hontrio ține doar excluderile planului, nu și produsele celorlalte campanii
  if (c.type === 'performance_max' && list.length > MAX_LISTING_ITEMS && labelIndex !== null && taken === 0) {
    return { listing: { kind: 'exclude_label', index: labelIndex, value: EXCLUDE_LABEL }, excluded: list, included: null }
  }
  return { listing: list.length ? { kind: 'exclude_items', item_ids: list } : { kind: 'all' }, excluded: list, included: null }
}

/** Câte filtre ar avea arborele (lista de ID-uri), ca să nu treacă de limita Google la Performance Max. */
export function listingSize(listing: ListingSpec): number {
  return listing.kind === 'exclude_items' || listing.kind === 'include_items' ? listing.item_ids.length : 0
}

/** Arborele vreunei campanii care rulează (sau al celei care se lansează acum) filtrează după eticheta Hontrio. */
export function usesExclusionLabel(plan: Plan, campaigns: CampaignRow[], labelIndex: number | null, pending: ListingSpec | null = null): boolean {
  if (pending?.kind === 'exclude_label') return true
  return campaigns.some(c => running(c) && c.type === 'performance_max' && !c.included_item_ids && !c.product_group_id
    && desiredListing(c, plan, campaigns, labelIndex).listing.kind === 'exclude_label')
}

/**
 * Ce etichete trebuie să fie în Merchant Center: excluderile planului, cât timp un arbore (al unei campanii
 * care rulează, sau `pending`, al celei care se lansează) filtrează după ele; altfel niciuna (se scot).
 * Singura regulă pentru toți cei care sincronizează Merchant Center (lansarea, pilotul, butonul din Setări),
 * ca etichetele să nu dispară de sub un arbore care încă le folosește.
 */
export function merchantLabels(plan: Plan, campaigns: CampaignRow[], labelIndex: number | null, pending: ListingSpec | null = null): Map<string, string> | null {
  return usesExclusionLabel(plan, campaigns, labelIndex, pending) ? exclusionLabelMap(plan) : null
}
