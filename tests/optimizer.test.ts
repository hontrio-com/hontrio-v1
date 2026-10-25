import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optimize, windowOf, type OptCampaign, type OptimizerInput, type OptProduct, type Window } from '@/lib/ads/optimizer'

// Bucla de optimizare: protecțiile, treptele, ținta, bugetul, produsele,
// termenii de căutare și segmentarea, cu regulile din specificație (§6).

const w = (cost: number, conversions: number, value: number, clicks = 100): Window => ({ cost, conversions, value, clicks })

function campaign(over: Partial<OptCampaign> = {}): OptCampaign {
  return {
    id: 'c1', google_campaign_id: '11', type: 'performance_max', stage: 'growth', segment: 'all', status: 'active',
    days_live: 60, target_roas: 4, daily_budget: 100, break_even: 3, goal_target: 4,
    days_since_target_change: 20, days_since_budget_change: 10, google: { reasons: [], recommended_budget: null },
    since_loss_check: w(2000, 40, 9000), eval30: w(2000, 40, 8200), recent14: w(1300, 20, 5400),
    ...over,
  }
}

function input(over: Partial<OptimizerInput> = {}): OptimizerInput {
  return {
    economics: { break_even: 3, goal_target: 4, aov: 300 },
    account: { conversions30: 40 },
    max_daily_budget: 150,
    loss_limit: { no_conversions: 300, low_roas: 600 },
    campaigns: [campaign()],
    products: [],
    searchTerms: [],
    negatives: new Map(),
    brand: ['lampi led'],
    rejected: { items: new Set(), terms: new Set(), kinds: new Set() },
    segmentation_done: false,
    ...over,
  }
}
const kinds = (i: OptimizerInput) => optimize(i).map(p => p.kind)

test('limita de pierdere: fără nicio vânzare, sau cu ROAS sub jumătate din prag — protecție', () => {
  const none = optimize(input({ campaigns: [campaign({ since_loss_check: w(320, 0, 0) })] }))
  assert.equal(none[0].kind, 'pause_loss_limit')
  assert.equal(none[0].protective, true)
  assert.equal(none[0].reason.key, 'campaigns.reason_loss_no_conversions')
  // Sub limită: nimic de oprit
  assert.ok(!kinds(input({ campaigns: [campaign({ since_loss_check: w(250, 0, 0) })] })).includes('pause_loss_limit'))
  const low = optimize(input({ campaigns: [campaign({ since_loss_check: w(700, 3, 700) })] }))
  assert.equal(low[0].kind, 'pause_loss_limit')
  assert.equal(low[0].reason.key, 'campaigns.reason_loss_low_roas')
  // O campanie oprită nu mai primește nimic altceva în aceeași trecere
  assert.deepEqual(low.filter(p => p.campaign_id === 'c1').map(p => p.kind), ['pause_loss_limit'])
})

test('pornirea trece la PMax: după 14 zile, cu 15 conversii în cont, ținta din ROAS-ul real', () => {
  const starter = campaign({ type: 'shopping', stage: 'starter', target_roas: null, days_live: 20, eval30: w(500, 16, 2600) })
  const p = optimize(input({ campaigns: [starter], account: { conversions30: 16 } })).find(x => x.kind === 'graduate')!
  assert.deepEqual(p.params, { target_roas: 5.2, daily_budget: 100 })
  assert.ok(!kinds(input({ campaigns: [{ ...starter, days_live: 10 }], account: { conversions30: 16 } })).includes('graduate'))
  assert.ok(!kinds(input({ campaigns: [starter], account: { conversions30: 14 } })).includes('graduate'))
  // Respinsă de om în ultimele 30 de zile: nu se repropune
  assert.ok(!kinds(input({ campaigns: [starter], account: { conversions30: 16 }, rejected: { items: new Set(), terms: new Set(), kinds: new Set(['graduate']) } })).includes('graduate'))
})

test('ținta: sub prag urcă, spre obiectiv urcă cu cel mult 12%, prea strictă coboară', () => {
  // ROAS real 2,5 < prag 3: urcă la max(4 × 1,12, 3) = 4,5
  const below = optimize(input({ campaigns: [campaign({ eval30: w(2000, 40, 5000) })] })).find(p => p.kind === 'set_target')!
  assert.deepEqual(below.params, { from: 4, to: 4.5 })
  assert.equal(below.reason.key, 'campaigns.reason_target_below_break_even')
  // Ținta 3,4 sub obiectiv (4), atinsă (ROAS 4,1): urcă la 3,8
  const up = optimize(input({ campaigns: [campaign({ target_roas: 3.4 })] })).find(p => p.kind === 'set_target')!
  assert.deepEqual(up.params, { from: 3.4, to: 3.8 })
  // Ținta 5 peste obiectiv, campania cheltuie sub 70% din buget: coboară la 4,5
  const down = optimize(input({ campaigns: [campaign({ target_roas: 5, recent14: w(800, 20, 4400) })] })).find(p => p.kind === 'set_target')!
  assert.deepEqual(down.params, { from: 5, to: 4.5 })
  assert.equal(down.reason.key, 'campaigns.reason_target_too_strict')
})

test('ținta nu se mișcă în învățare, prea des sau cu prea puține conversii', () => {
  const below = { eval30: w(2000, 40, 5000) }
  assert.ok(!kinds(input({ campaigns: [campaign({ ...below, days_live: 30 })] })).includes('set_target'), 'primele 6 săptămâni')
  assert.ok(!kinds(input({ campaigns: [campaign({ ...below, days_since_target_change: 7 })] })).includes('set_target'), 'la cel puțin 14 zile')
  assert.ok(!kinds(input({ campaigns: [campaign({ ...below, recent14: w(1300, 6, 3000) })] })).includes('set_target'), 'cel puțin 10 conversii în 14 zile')
  // Shopping standard (CPC manual) n-are țintă
  assert.ok(!kinds(input({ campaigns: [campaign({ ...below, type: 'shopping', stage: 'starter' })] })).includes('set_target'))
})

test('bugetul: limitată de buget și peste țintă → +20%, până la plafon; fără plafon doar propunere', () => {
  const limited = campaign({ google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null } })
  const p = optimize(input({ campaigns: [limited] })).find(x => x.kind === 'set_budget')!
  assert.deepEqual(p.params, { from: 100, to: 120 })
  assert.equal(p.needs_approval, false)
  assert.deepEqual(optimize(input({ campaigns: [limited], max_daily_budget: 110 })).find(x => x.kind === 'set_budget')!.params, { from: 100, to: 110 })
  assert.equal(optimize(input({ campaigns: [limited], max_daily_budget: null })).find(x => x.kind === 'set_budget')!.needs_approval, true)
  // Bugetul recomandat de Google peste cel actual înseamnă tot „limitată"
  assert.ok(kinds(input({ campaigns: [campaign({ google: { reasons: [], recommended_budget: 140 } })] })).includes('set_budget'))
  // Sub țintă: mai mult buget ar însemna mai multă pierdere
  assert.ok(!kinds(input({ campaigns: [campaign({ ...limited, eval30: w(2000, 40, 7000) })] })).includes('set_budget'))
  // La plafon: nimic
  assert.ok(!kinds(input({ campaigns: [limited], max_daily_budget: 100 })).includes('set_budget'))
})

test('produsele: fără vânzări peste 2 × CPA-ul lor, sau sub pragul lor; alegerea omului rămâne', () => {
  const prod = (id: string, over: Partial<OptProduct> = {}): OptProduct => ({
    item_id: id, offer_id: id, title: id, price: 300, break_even: 3, included_by_user: false, excluded: false, window: w(0, 0, 0), days: 30, ...over,
  })
  // CPA la prag = 300 ÷ 3 = 100
  const p = optimize(input({ products: [
    prod('spender', { window: w(250, 0, 0) }),
    prod('cheap', { window: w(150, 0, 0) }),
    prod('loser', { window: w(400, 2, 600) }),
    prod('winner', { window: w(400, 5, 1800) }),
    prod('mine', { window: w(500, 0, 0), included_by_user: true }),
    prod('young', { window: w(500, 0, 0), days: 10 }),
    prod('said_no', { window: w(500, 0, 0) }),
  ], rejected: { items: new Set(['said_no']), terms: new Set(), kinds: new Set() } })).find(x => x.kind === 'exclude_products')!
  const picked = (p.params.products as { item_id: string; why: string }[]).map(x => `${x.item_id}:${x.why}`)
  assert.deepEqual(picked, ['loser:unprofitable', 'spender:no_sales'])
  assert.equal(p.campaign_id, null)
})

test('termenii de căutare: scumpi și fără vânzări, niciodată numele magazinului sau ce există deja', () => {
  // CPA la prag la nivel de magazin = 300 ÷ 3 = 100 → pragul termenului: 200
  const p = optimize(input({
    searchTerms: [
      { campaign_id: 'c1', term: 'Lampa Ieftina', cost: 250, conversions: 0, clicks: 90 },
      { campaign_id: 'c1', term: 'lampi led magazin', cost: 400, conversions: 0, clicks: 50 },
      { campaign_id: 'c1', term: 'veioza', cost: 260, conversions: 0, clicks: 70 },
      { campaign_id: 'c1', term: 'bec e27', cost: 300, conversions: 2, clicks: 80 },
      { campaign_id: 'c1', term: 'spot', cost: 120, conversions: 0, clicks: 40 },
    ],
    negatives: new Map([['c1', new Set(['veioza'])]]),
  })).find(x => x.kind === 'add_negatives')!
  assert.deepEqual((p.params.terms as { term: string }[]).map(t => t.term), ['lampa ieftina'])
})

test('segmentarea: o singură dată, doar cu praguri diferite și destule conversii în fiecare grupă', () => {
  const prod = (id: string, be: number, conversions: number): OptProduct => ({
    item_id: id, offer_id: id, title: id, price: 100, break_even: be, included_by_user: false, excluded: false, window: w(100, conversions, conversions * 100), days: 60,
  })
  const products = [prod('a', 2, 10), prod('b', 2.2, 8), prod('c', 4, 9), prod('d', 4.5, 8)]
  const p = optimize(input({ products })).find(x => x.kind === 'segment')!
  assert.deepEqual(p.params.high_item_ids, ['a', 'b'])
  assert.ok((p.params.rest_target as number) > (p.params.high_target as number))
  assert.ok(!kinds(input({ products, segmentation_done: true })).includes('segment'))
  // Praguri apropiate: două campanii doar ar împărți datele
  assert.ok(!kinds(input({ products: [prod('a', 3, 10), prod('b', 3.1, 8), prod('c', 3.2, 9), prod('d', 3.3, 8)] })).includes('segment'))
  // Prea puține conversii într-o grupă
  assert.ok(!kinds(input({ products: [prod('a', 2, 3), prod('b', 2.2, 3), prod('c', 4, 15), prod('d', 4.5, 15)] })).includes('segment'))
})

test('fereastra pe zile include capetele', () => {
  const days = [
    { date: '2026-10-01', cost: 10, conversions: 1, value: 50, clicks: 5 },
    { date: '2026-10-02', cost: 20, conversions: 0, value: 0, clicks: 8 },
    { date: '2026-10-03', cost: 30, conversions: 2, value: 90, clicks: 9 },
  ]
  assert.deepEqual(windowOf(days, '2026-10-02', '2026-10-03'), { cost: 50, conversions: 2, value: 90, clicks: 17 })
})
