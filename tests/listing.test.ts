import { test } from 'node:test'
import assert from 'node:assert/strict'
import { desiredListing, type CampaignRow } from '@/lib/ads/apply'
import type { Plan } from '@/lib/campaigns/plan'

// Arborele de produse al fiecărei campanii când omul are grupe: un produs
// ajunge într-o singură campanie, oricum s-ar suprapune listele.

const plan = { exclusions: { item_ids: ['x'] } } as unknown as Plan
const row = (id: string, over: Partial<CampaignRow> = {}): CampaignRow =>
  ({ id, status: 'active', type: 'performance_max', segment: 'all', included_item_ids: null, excluded_item_ids: [], product_group_id: null, ...over }) as CampaignRow

test('grupa ia produsele ei de acum; principala și un segment vechi (pe marje) le lasă afară', () => {
  const group = row('g', { segment: 'group', product_group_id: 'grupa', included_item_ids: ['a'] })
  const high = row('h', { segment: 'high_margin', included_item_ids: ['a', 'b', 'x'] })
  const rest = row('r', { segment: 'rest' })
  // Regulile grupei prind acum și „c"; „x" e scos din toate campaniile
  assert.deepEqual(desiredListing(group, plan, [group, high, rest], null, ['A', 'c', 'x']).included, ['a', 'c'])
  // Segmentul vechi (listă fixă) pierde ce a luat grupa
  assert.deepEqual(desiredListing(high, plan, [group, high, rest], null).included, ['b'])
  // „Restul" lasă afară segmentul și grupa
  assert.deepEqual(desiredListing(rest, plan, [group, high, rest], null).excluded, ['a', 'b', 'x'])
  // O grupă încheiată nu mai ține nimic
  assert.deepEqual(desiredListing(high, plan, [{ ...group, status: 'ended' }, high, rest], null).included, ['a', 'b'])
})
