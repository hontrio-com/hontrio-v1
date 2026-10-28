import { test } from 'node:test'
import assert from 'node:assert/strict'
import { campaignBreakEvens, campaignEconomics, profitByCampaign, segmentSplits } from '@/lib/ads/campaign-economics'
import type { CampaignRow } from '@/lib/ads/apply'
import type { Plan } from '@/lib/campaigns/plan'

// Pragul pe campanie: segmentul de marjă mare și „restul" au pragul produselor lor
// (ponderat cu vânzările), celelalte campanii pe al magazinului.

function plan(breakEven: number | null = 2.8): Plan {
  const o = (item_id: string, break_even: number, revenue: number, reason: string | null = null) => ({ item_id, break_even, revenue, price: 100, reason })
  return {
    goal: 'balanced',
    target_roas: breakEven === null ? null : 3.7,
    economics: { break_even: breakEven },
    offers: [o('A', 2.0, 1000), o('B', 2.2, 1000), o('C', 3.4, 3000), o('D', 3.8, 1000), o('E', 9, 500, 'thin_margin')],
  } as unknown as Plan
}

function campaign(id: string, over: Partial<CampaignRow> = {}): CampaignRow {
  return { id, google_campaign_id: `g-${id}`, status: 'active', segment: 'all', included_item_ids: null, ...over } as unknown as CampaignRow
}

const high = campaign('high', { segment: 'high_margin', included_item_ids: ['a', 'b'] })
const rest = campaign('rest', { segment: 'rest' })
const starter = campaign('starter', { status: 'ended' })

test('segmentele au pragul și ținta produselor lor', () => {
  const p = plan()
  assert.deepEqual(campaignEconomics(high, p, [high, rest]), { break_even: 2.1, goal_target: 2.8 })
  assert.deepEqual(campaignEconomics(rest, p, [high, rest]), { break_even: 3.5, goal_target: 4.7 })
  assert.deepEqual(campaignEconomics(starter, p, [high, rest]), { break_even: 2.8, goal_target: 3.7 })
})

test('pragurile pe campanie, după ID-ul din Google', () => {
  const be = campaignBreakEvens([high, rest, starter], plan())
  assert.equal(be.get('g-high'), 2.1)
  assert.equal(be.get('g-rest'), 3.5)
  assert.equal(be.get('g-starter'), 2.8)
})

test('fără segmentul de marjă mare activ, „restul" are tot catalogul; segmentul încheiat își păstrează pragul', () => {
  const be = campaignBreakEvens([{ ...high, status: 'ended' }, rest], plan())
  assert.equal(be.get('g-rest'), 3)
  assert.equal(be.get('g-high'), 2.1)
})

test('fără prag al magazinului, niciun prag', () => {
  const be = campaignBreakEvens([high, rest], plan(null))
  assert.equal(be.get('g-high'), null)
  assert.equal(be.get('g-rest'), null)
})

test('ziua împărțirii, din jurnal, pe campania care a devenit „restul"', () => {
  const splits = segmentSplits([high, rest], [
    { kind: 'segment', status: 'applied', ad_campaign_id: 'rest', applied_at: '2026-10-04T08:00:00Z' },
    { kind: 'segment', status: 'rejected', ad_campaign_id: 'high', applied_at: null },
    { kind: 'set_target', status: 'applied', ad_campaign_id: 'high', applied_at: '2026-10-10T08:00:00Z' },
  ])
  assert.deepEqual([...splits], [['g-rest', '2026-10-04']])
})

test('profitul pe zi: „restul" are pragul magazinului înainte de împărțire, al lui după', () => {
  const be = campaignBreakEvens([high, rest], plan())
  const splits = new Map([['g-rest', '2026-10-04']])
  const profits = profitByCampaign([
    { google_campaign_id: 'g-rest', date: '2026-10-03', cost: 100, value: 560 }, // 560 / 2,8 − 100 = 100
    { google_campaign_id: 'g-rest', date: '2026-10-04', cost: 100, value: 700 }, // 700 / 3,5 − 100 = 100
    { google_campaign_id: 'g-high', date: '2026-10-05', cost: 100, value: 420 }, // 420 / 2,1 − 100 = 100
    { google_campaign_id: 'g-brand', date: '2026-10-05', cost: 50, value: 280 }, // a omului: pragul magazinului, 50
  ], be, 2.8, splits)!
  assert.equal(Math.round(profits.get('g-rest')!), 200)
  assert.equal(Math.round(profits.get('g-high')!), 100)
  assert.equal(Math.round(profits.get('g-brand')!), 50)
  assert.equal(profitByCampaign([], be, null, splits), null)
})

test('grupele omului: pragul produselor lor, ținta obiectivului lor; campania principală le lasă afară', () => {
  const p = plan()
  const g = campaign('g', { segment: 'group', product_group_id: 'grupa', goal: 'profit', included_item_ids: ['c'] })
  const main = campaign('main')
  // Grupa: doar C (prag 3,4), cu obiectivul ei („profit" păstrează 40%)
  assert.deepEqual(campaignEconomics(g, p, [main, g]), { break_even: 3.4, goal_target: 5.7 })
  // Campania principală care rulează: fără C → A, B, D
  const be = campaignEconomics(main, p, [main, g]).break_even
  assert.equal(be, Math.round(((2.0 * 1000 + 2.2 * 1000 + 3.8 * 1000) / 3000) * 10) / 10)
  // Una încheiată vindea tot catalogul: pragul magazinului
  assert.equal(campaignEconomics({ ...main, status: 'ended' }, p, [main, g]).break_even, 2.8)
})
