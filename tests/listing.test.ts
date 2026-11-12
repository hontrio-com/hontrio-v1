import { test } from 'node:test'
import assert from 'node:assert/strict'
import { desiredListing, graduatedTwin, graduateListing, merchantLabels, type CampaignRow } from '@/lib/ads/apply'
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

test('eticheta Hontrio rămâne cât timp un arbore care rulează filtrează după ea, oricum s-ar schimba treapta planului', () => {
  // 1.000 de excluderi: peste lista din PMax, deci campania principală PMax filtrează după etichetă
  const ids = Array.from({ length: 1000 }, (_, i) => `x${i}`)
  const offers = ids.map(id => ({ offer_id: id, item_id: id, reason: 'manual' }))
  // Planul e la pornire (contul a scăzut sub 15 conversii), dar PMax-ul principal încă rulează
  const big = { exclusions: { item_ids: ids, mode: 'items' }, offers } as unknown as Plan
  const pmax = row('main')
  const labels = merchantLabels(big, [pmax], 2)
  assert.equal(labels?.size, 1000)
  assert.equal(labels?.get('x5'), 'hontrio_exclude')
  // Fără campanii care să o folosească (sau cu Shopping standard, care duce lista): se scot
  assert.equal(merchantLabels(big, [], 2), null)
  assert.equal(merchantLabels(big, [row('s', { type: 'shopping' })], 2), null)
  assert.equal(merchantLabels(big, [{ ...pmax, status: 'ended' }], 2), null)
  // Fără un custom_label liber nu există etichetă
  assert.equal(merchantLabels(big, [pmax], null), null)
  // Lansarea unei campanii care filtrează după etichetă: o cere înainte să existe campania
  assert.equal(merchantLabels(big, [], 2, { kind: 'exclude_label', index: 2, value: 'hontrio_exclude' })?.size, 1000)
})

test('trecerea la PMax: arborele ei și campania creată deja de o trecere care n-a terminat', () => {
  const assigned = new Map([['a', 'grupa'], ['b', 'grupa']])
  const p = { exclusions: { item_ids: ['b'] }, offers: [{ offer_id: 'a', item_id: 'A' }, { offer_id: 'b', item_id: 'b' }] } as unknown as Plan
  const starter = row('st', { type: 'shopping', stage: 'starter', product_group_id: 'grupa', included_item_ids: ['a', 'b'] })
  assert.deepEqual(graduateListing(starter, p, [starter], null, assigned).listing, { kind: 'include_items', item_ids: ['a'] })
  // Pornirea principală: PMax pe tot catalogul, fără produsele grupei
  const main = row('m', { type: 'shopping', stage: 'starter' })
  const group = row('g', { product_group_id: 'grupa', included_item_ids: ['a'] })
  assert.deepEqual(graduateListing(main, p, [main, group], null, assigned).listing, { kind: 'exclude_items', item_ids: ['a', 'b'] })
  // O campanie PMax a aceleiași grupe există deja: trecerea doar oprește pornirea
  const twin = row('pm', { product_group_id: 'grupa', included_item_ids: ['a'] })
  assert.equal(graduatedTwin(starter, [starter, twin])?.id, 'pm')
  assert.equal(graduatedTwin(main, [main, group]), null, 'campania unei grupe nu ține locul celei principale')
  assert.equal(graduatedTwin(main, [main, row('pm2')])?.id, 'pm2')
})
