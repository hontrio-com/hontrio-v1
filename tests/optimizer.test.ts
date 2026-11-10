import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optimize, windowOf, type OptCampaign, type OptimizerInput, type OptProduct, type Window } from '@/lib/ads/optimizer'

// Bucla de optimizare, fără marje: oprirea de siguranță (ROAS sub 1), trecerea
// la Performance Max, bugetul (doar propus), produsele și termenii de căutare,
// cu regulile din specificație (§6).

const w = (cost: number, conversions: number, value: number, clicks = 100): Window => ({ cost, conversions, value, clicks })

function campaign(over: Partial<OptCampaign> = {}): OptCampaign {
  return {
    id: 'c1', google_campaign_id: '11', type: 'performance_max', stage: 'growth', segment: 'all', status: 'active',
    days_live: 60, daily_budget: 100, days_since_budget_change: 10, google: { reasons: [], recommended_budget: null },
    since_loss_check: w(2000, 40, 9000), eval30: w(2000, 40, 8200), recent14: w(1300, 20, 5400),
    ...over,
  }
}

function input(over: Partial<OptimizerInput> = {}): OptimizerInput {
  return {
    economics: { aov: 300 },
    account: { conversions30: 40 },
    max_daily_budget: 150,
    // O comandă medie fără vânzări / trei comenzi medii cu vânzări sub cost
    loss_limit: { no_conversions: 300, low_roas: 900 },
    campaigns: [campaign()],
    products: [],
    searchTerms: [],
    negatives: new Map(),
    brand: ['lampi led'],
    rejected: { items: new Set(), terms: new Set(), kinds: new Set() },
    ...over,
  }
}
const kinds = (i: OptimizerInput) => optimize(i).map(p => p.kind)

test('oprirea de siguranță: o comandă medie fără vânzări, sau vânzări sub costul reclamei — protecție', () => {
  const none = optimize(input({ campaigns: [campaign({ since_loss_check: w(320, 0, 0) })] }))
  assert.equal(none[0].kind, 'pause_loss_limit')
  assert.equal(none[0].protective, true)
  assert.equal(none[0].reason.key, 'campaigns.reason_loss_no_conversions')
  // Sub limită: nimic de oprit
  assert.ok(!kinds(input({ campaigns: [campaign({ since_loss_check: w(250, 0, 0) })] })).includes('pause_loss_limit'))
  // 950 cheltuiți, 700 vânduți: ROAS 0,74, pierdere sigură
  const below = optimize(input({ campaigns: [campaign({ since_loss_check: w(950, 3, 700) })] }))
  assert.equal(below[0].kind, 'pause_loss_limit')
  assert.equal(below[0].reason.key, 'campaigns.reason_loss_below_cost')
  assert.deepEqual(below[0].reason.params, { spend: 950, value: 700 })
  // O campanie oprită nu mai primește nimic altceva în aceeași trecere
  assert.deepEqual(below.filter(p => p.campaign_id === 'c1').map(p => p.kind), ['pause_loss_limit'])
  // Vânzările acoperă reclama (ROAS 1,3): fără marje nu știm dacă e pierdere, deci nu oprim
  assert.ok(!kinds(input({ campaigns: [campaign({ since_loss_check: w(950, 3, 1200) })] })).includes('pause_loss_limit'))
  // Fără comandă medie nu există limită
  assert.ok(!kinds(input({ loss_limit: null, campaigns: [campaign({ since_loss_check: w(5000, 0, 0) })] })).includes('pause_loss_limit'))
})

test('pornirea trece la Performance Max după 14 zile și 15 conversii în cont, fără țintă', () => {
  const starter = campaign({ type: 'shopping', stage: 'starter', days_live: 20, eval30: w(500, 16, 2600) })
  const p = optimize(input({ campaigns: [starter], account: { conversions30: 16 } })).find(x => x.kind === 'graduate')!
  assert.deepEqual(p.params, { daily_budget: 100 })
  assert.equal(p.reason.key, 'campaigns.reason_graduate')
  assert.ok(!kinds(input({ campaigns: [{ ...starter, days_live: 10 }], account: { conversions30: 16 } })).includes('graduate'))
  assert.ok(!kinds(input({ campaigns: [starter], account: { conversions30: 14 } })).includes('graduate'))
  // Respinsă de om în ultimele 30 de zile: nu se repropune
  assert.ok(!kinds(input({ campaigns: [starter], account: { conversions30: 16 }, rejected: { items: new Set(), terms: new Set(), kinds: new Set(['graduate']) } })).includes('graduate'))
})

test('bugetul: limitată de buget și vinde peste cost → +20%, mereu cu aprobarea omului, până la plafon', () => {
  const limited = campaign({ google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null } })
  const p = optimize(input({ campaigns: [limited] })).find(x => x.kind === 'set_budget')!
  assert.deepEqual(p.params, { from: 100, to: 120 })
  // Banii îi decide omul, și cu plafon, și în modul automat
  assert.equal(p.needs_approval, true)
  assert.equal(p.protective, false)
  assert.deepEqual(optimize(input({ campaigns: [limited], max_daily_budget: 110 })).find(x => x.kind === 'set_budget')!.params, { from: 100, to: 110 })
  assert.equal(optimize(input({ campaigns: [limited], max_daily_budget: null })).find(x => x.kind === 'set_budget')!.needs_approval, true)
  // Bugetul recomandat de Google peste cel actual înseamnă tot „limitată"
  assert.ok(kinds(input({ campaigns: [campaign({ google: { reasons: [], recommended_budget: 140 } })] })).includes('set_budget'))
  // Vânzări sub costul reclamei: mai mult buget ar însemna mai multă pierdere
  assert.ok(!kinds(input({ campaigns: [campaign({ ...limited, eval30: w(2000, 40, 1800) })] })).includes('set_budget'))
  // La plafon: nimic
  assert.ok(!kinds(input({ campaigns: [limited], max_daily_budget: 100 })).includes('set_budget'))
  // Un Performance Max în primele 6 săptămâni de învățare: nu se atinge
  assert.ok(!kinds(input({ campaigns: [{ ...limited, days_live: 30 }] })).includes('set_budget'))
  // Schimbat acum câteva zile: cel mult o dată pe săptămână
  assert.ok(!kinds(input({ campaigns: [{ ...limited, days_since_budget_change: 3 }] })).includes('set_budget'))
})

test('produsele: au cheltuit cât prețul lor fără vânzări, sau mai mult decât au vândut; alegerea omului rămâne', () => {
  const prod = (id: string, over: Partial<OptProduct> = {}): OptProduct => ({
    item_id: id, offer_id: id, title: id, price: 300, included_by_user: false, excluded: false, window: w(0, 0, 0), days: 30, ...over,
  })
  const p = optimize(input({ products: [
    prod('spender', { window: w(300, 0, 0) }),
    prod('cheap', { window: w(250, 0, 0) }),
    prod('loser', { window: w(400, 1, 300) }),
    prod('winner', { window: w(400, 5, 1500) }),
    prod('mine', { window: w(500, 0, 0), included_by_user: true }),
    prod('young', { window: w(500, 0, 0), days: 10 }),
    prod('said_no', { window: w(500, 0, 0) }),
    prod('out', { window: w(500, 0, 0), excluded: true }),
  ], rejected: { items: new Set(['said_no']), terms: new Set(), kinds: new Set() } })).find(x => x.kind === 'exclude_products')!
  const picked = (p.params.products as { item_id: string; why: string }[]).map(x => `${x.item_id}:${x.why}`)
  assert.deepEqual(picked, ['loser:unprofitable', 'spender:no_sales'])
  assert.equal(p.campaign_id, null)
  // Fără preț, unitatea e comanda medie
  const noPrice = optimize(input({ products: [prod('free', { price: 0, window: w(310, 0, 0) })] })).find(x => x.kind === 'exclude_products')!
  assert.equal((noPrice.params.products as { item_id: string }[])[0].item_id, 'free')
})

test('termenii de căutare: au costat cât o comandă medie fără vânzări; niciodată numele magazinului sau ce există deja', () => {
  const p = optimize(input({
    searchTerms: [
      { campaign_id: 'c1', term: 'Lampa Ieftina', cost: 310, conversions: 0, clicks: 90 },
      { campaign_id: 'c1', term: 'lampi led magazin', cost: 400, conversions: 0, clicks: 50 },
      { campaign_id: 'c1', term: 'veioza', cost: 320, conversions: 0, clicks: 70 },
      { campaign_id: 'c1', term: 'bec e27', cost: 350, conversions: 2, clicks: 80 },
      { campaign_id: 'c1', term: 'spot', cost: 120, conversions: 0, clicks: 40 },
    ],
    negatives: new Map([['c1', new Set(['veioza'])]]),
  })).find(x => x.kind === 'add_negatives')!
  assert.deepEqual((p.params.terms as { term: string }[]).map(t => t.term), ['lampa ieftina'])
  // Fără comandă medie nu propunem cuvinte negative
  assert.ok(!kinds(input({ economics: { aov: null }, searchTerms: [{ campaign_id: 'c1', term: 'x', cost: 5000, conversions: 0, clicks: 9 }] })).includes('add_negatives'))
})

test('pilotul nu mai propune ținte și nici împărțiri pe marje', () => {
  const all = optimize(input({
    campaigns: [
      campaign({ google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null }, eval30: w(2000, 40, 5000) }),
      campaign({ id: 'c2', google_campaign_id: '12', type: 'shopping', stage: 'starter', days_live: 20, eval30: w(500, 16, 2600) }),
    ],
    products: [{ item_id: 'p', offer_id: 'p', title: 'p', price: 100, included_by_user: false, excluded: false, window: w(150, 0, 0), days: 60 }],
  }))
  assert.ok(all.length > 0)
  assert.ok(all.every(p => ['pause_loss_limit', 'graduate', 'set_budget', 'exclude_products', 'add_negatives'].includes(p.kind)))
})

test('fereastra pe zile include capetele', () => {
  const days = [
    { date: '2026-10-01', cost: 10, conversions: 1, value: 50, clicks: 5 },
    { date: '2026-10-02', cost: 20, conversions: 0, value: 0, clicks: 8 },
    { date: '2026-10-03', cost: 30, conversions: 2, value: 90, clicks: 9 },
  ]
  assert.deepEqual(windowOf(days, '2026-10-02', '2026-10-03'), { cost: 50, conversions: 2, value: 90, clicks: 17 })
})

test('grupele trec la Performance Max după conversiile lor, nu ale contului', () => {
  const starter = campaign({ id: 'g1', type: 'shopping', stage: 'starter', days_live: 20, group: true, eval30: w(500, 16, 2600) })
  const p = optimize(input({ campaigns: [starter], account: { conversions30: 5 } })).find(x => x.kind === 'graduate')!
  assert.equal(p.reason.key, 'campaigns.reason_graduate_group')
  // Contul are multe conversii, dar grupa puține: rămâne la Shopping
  assert.ok(!kinds(input({ campaigns: [{ ...starter, eval30: w(500, 9, 1500) }], account: { conversions30: 40 } })).includes('graduate'))
})

test('bugetul maxim e pentru toate campaniile Hontrio, la un loc', () => {
  const limited = campaign({ daily_budget: 50, google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null } })
  const other = (budget: number) => campaign({ id: 'c2', google_campaign_id: '12', daily_budget: budget, google: { reasons: [], recommended_budget: null } })
  // Plafon 150, cealaltă cheltuie 60: loc de 90 → +20% (60) încape
  assert.deepEqual(optimize(input({ campaigns: [limited, other(60)] })).find(x => x.kind === 'set_budget' && x.campaign_id === 'c1')!.params, { from: 50, to: 60 })
  // Cealaltă cheltuie 95: loc de 55
  assert.deepEqual(optimize(input({ campaigns: [limited, other(95)] })).find(x => x.kind === 'set_budget' && x.campaign_id === 'c1')!.params, { from: 50, to: 55 })
  // Nu mai e loc: nimic
  assert.ok(!optimize(input({ campaigns: [limited, other(100)] })).some(x => x.kind === 'set_budget' && x.campaign_id === 'c1'))
})
