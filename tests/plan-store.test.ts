import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlan, type PlanInput } from '@/lib/campaigns/plan'
import {
  assignGroups, buildGroupPlan, EMPTY_RULES, EMPTY_TOTALS, groupOfferOf, groupPlanFromTotals, groupPlanForPage, groupTotalsOf,
  precedingGroupIds, type ProductGroup,
} from '@/lib/campaigns/groups'
import { groupTotalsFrom, likePattern, planChanges, planOfferOf, planWindows, type PlanPageRow } from '@/lib/campaigns/plan-store'
import { evaluateAudit } from '@/lib/google/audit'
import { auditRaw, offer, setup } from './fixtures'

// Cataloagele mari, pe pagini: ce a hotărât planul se scrie lângă fiecare ofertă
// (doar schimbările), paginile citesc rânduri din baza de date ca oferte din
// plan, iar editorul grupei socotește planul ei din totaluri, ca serverul.

const ctx = { storeCurrency: 'RON', storeMerchantId: '555', hontrioCampaignIds: new Set<string>() }
const audit = evaluateAudit(auditRaw(), ctx)

const offers = [
  offer('l1', { category: 'Lustre', brand: 'Aria', price: 500 }),
  offer('l2', { category: 'Lustre', brand: 'Nova', price: 300 }),
  offer('b1', { category: 'Becuri', brand: 'Ledvance', price: 60 }),
  offer('a1', { category: 'Aplice', brand: 'Nova', price: 180, compare_at_price: 220 }),
  offer('a2', { category: 'Aplice', brand: 'Nova', price: 150, available: false }),
]

const group = (id: string, over: Partial<ProductGroup> = {}): ProductGroup => ({
  id, name: id, rules: EMPTY_RULES, daily_budget: null, campaign_type: 'auto', starts_on: null, ends_on: null,
  position: 1, status: 'draft', launched_at: null, ...over,
})

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    store: { currency: 'RON', connection_status: 'active', name: 'Lampi', url: 'https://lampi.ro' },
    setup: setup(),
    google: { connected: true, account: { customer_id: '1234567890', name: 'Cont', currency: 'RON' } },
    audit,
    merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: 4 },
    offers,
    sales90: new Map([['l1', { units: 4, revenue: 2000, orders: 4 }], ['b1', { units: 30, revenue: 1800, orders: 20 }], ['a1', { units: 6, revenue: 1080, orders: 6 }]]),
    orders90: { orders: 50, total: 15000, items: 13000, discount: 0, tax: 2600 },
    googleAds90: { orders: 0, total: 0 },
    googleAds30: { orders: 0, total: 0 },
    settings: { daily_budget: null, mode: 'approve', max_daily_budget: null },
    ...over,
  }
}

test('ce a hotărât planul: se scriu doar ofertele schimbate', () => {
  const p = buildPlan(input())
  // Nimic salvat încă: toate pleacă, cu `included` pentru cele care intră
  const first = planChanges(offers, p)
  assert.equal(first.length, offers.length)
  assert.deepEqual(first.find(c => c.offer_id === 'l1'), { offer_id: 'l1', reason: 'included', group: null, item: 'l1' })
  assert.equal(first.find(c => c.offer_id === 'a2')?.reason, 'out_of_stock')

  // Salvate exact ca acum: nimic de scris
  const saved = offers.map(o => {
    const c = first.find(x => x.offer_id === o.offer_id)!
    return { ...o, plan_reason: c.reason, plan_group: c.group, plan_item_id: c.item }
  })
  assert.deepEqual(planChanges(saved, p), [])

  // O ofertă scoasă de om: doar ea
  const p2 = buildPlan(input({ offers: saved.map(o => (o.offer_id === 'b1' ? { ...o, ads_mode: 'exclude' as const } : o)) }))
  assert.deepEqual(planChanges(saved, p2), [{ offer_id: 'b1', reason: 'manual', group: null, item: 'b1' }])
})

test('căutarea pentru ILIKE: fără caracterele tiparului, scurtată, goală = fără căutare', () => {
  assert.equal(likePattern('  lustră  '), '%lustră%')
  assert.equal(likePattern('50%_reducere\\'), '%50\\%\\_reducere\\\\%')
  assert.equal(likePattern('   '), null)
  assert.equal(likePattern(undefined), null)
  assert.equal(likePattern(42), null)
  assert.equal(likePattern('x'.repeat(300))!.length, 102)
})

test('rândul din baza de date, ca oferta din plan: motivul, reducerea și cifrele Google ca în buildPlan', () => {
  const row: PlanPageRow = {
    offer_id: 'a1', title: 'Aplică', variant_title: null, image_url: null, category: 'Aplice', brand: 'Nova',
    price: '180.00', compare_at_price: 220, ads_mode: 'include', reason: 'included', group_id: null, in_draft: true, item_id: 'a1',
    units: '6', revenue: 1080, orders: 6, google_orders: 2, google_revenue: 360, ads_cost: '50', ads_conversions: 1, ads_value: 180,
  }
  const o = planOfferOf(row)
  assert.equal(o.reason, null)
  assert.equal(o.price, 180)
  assert.equal(o.on_sale, true)
  assert.equal(o.units, 6)
  assert.equal(o.google30, 2)
  assert.equal(o.mode, 'include')
  assert.equal(o.in_draft, true)
  // Magazinul a văzut mai multe vânzări din Google decât Google: conversiile și valoarea, ale magazinului
  assert.deepEqual(o.ads30, { cost: 50, conversions: 2, value: 360 })

  const fara = planOfferOf({ ...row, reason: 'google_rejected', ads_cost: null, ads_mode: 'altceva', in_draft: undefined })
  assert.equal(fara.reason, 'google_rejected')
  assert.equal(fara.ads30, null)
  assert.equal(fara.mode, 'auto')
  assert.equal(fara.in_draft, false)
})

test('planul grupei din totaluri: aceleași cifre ca din oferte (serverul și editorul din pagină)', () => {
  const lustre = group('g1', { rules: { ...EMPTY_RULES, categories: ['lustre'] } })
  const nova = group('g2', { rules: { ...EMPTY_RULES, brands: ['Nova'] }, position: 2 })
  const assigned = assignGroups(offers.map(groupOfferOf), [lustre, nova])
  const p = buildPlan(input({ groups: { assigned, live: new Set() } }))
  const basis = { plan: p, assigned, otherConversions: 0, otherBudgets: 0, today: '2026-11-24' }

  for (const g of [lustre, nova]) {
    const full = buildGroupPlan(g, basis)
    const { totals } = groupTotalsOf(g, p.offers, assigned)
    const rest: Partial<typeof full> = { ...full }
    delete rest.members
    delete rest.item_ids
    assert.deepEqual(groupPlanFromTotals(g, totals, basis), rest)
  }
  // Nova vrea și lustra l2, dar e a grupei de lustre (dinaintea ei)
  assert.equal(groupTotalsOf(nova, p.offers, assigned).totals.elsewhere, 1)

  // Fără totaluri încă: grupa goală, cu pasul de făcut
  const empty = groupPlanFromTotals(group('x', { rules: { ...EMPTY_RULES, brands: ['Nova'] } }), EMPTY_TOTALS, basis)
  assert.equal(empty.counts.members, 0)
  assert.deepEqual(empty.blockers.map(b => b.id), ['no_products'])

  // Spre pagină: fără liste
  const page = groupPlanForPage(buildGroupPlan(lustre, basis))
  assert.deepEqual(page.members, [])
  assert.deepEqual(page.item_ids, [])
})

test('grupele dinaintea celei în lucru: lansatele (cea mai veche întâi), apoi ciornele; una încheiată, după toate', () => {
  const live1 = group('live-1', { status: 'live', launched_at: '2026-11-01T00:00:00Z', position: 5 })
  const live2 = group('live-2', { status: 'live', launched_at: '2026-11-10T00:00:00Z', position: 1 })
  const d1 = group('d1', { position: 1 })
  const d3 = group('d3', { position: 3 })
  const ended = group('gata', { status: 'ended', position: 2 })
  const others = [d3, live2, ended, d1, live1]

  assert.deepEqual(precedingGroupIds(others, group('nou', { position: 2 })), ['live-1', 'live-2', 'd1'])
  assert.deepEqual(precedingGroupIds(others, group('nou', { position: 9 })), ['live-1', 'live-2', 'd1', 'd3'])
  // O grupă lansată: doar lansatele mai vechi
  assert.deepEqual(precedingGroupIds(others, group('live-3', { status: 'live', launched_at: '2026-11-05T00:00:00Z' })), ['live-1'])
  // Încheiată: ca la relansare, după toate cele deschise
  assert.deepEqual(precedingGroupIds(others, ended), ['live-1', 'live-2', 'd1', 'd3'])
})

test('totalurile din baza de date, ca numere; ferestrele planului ca la loadAdsData', () => {
  const t = groupTotalsFrom({ members: '12', running: 10, matched: '9', items: 9, elsewhere: 0, units: '3.5', revenue: '120.40', orders: 2, price_sum: 1000 })
  assert.equal(t.members, 12)
  assert.equal(t.units, 3.5)
  assert.equal(t.revenue, 120.4)
  assert.equal(t.ads_cost, 0)
  assert.deepEqual(groupTotalsFrom(null), EMPTY_TOTALS)

  const w = planWindows(Date.parse('2026-11-24T10:00:00Z'))
  assert.equal(w.since90, '2026-08-26T10:00:00.000Z')
  assert.equal(w.since30, '2026-10-25T10:00:00.000Z')
  assert.equal(w.day30, '2026-10-25')
})
