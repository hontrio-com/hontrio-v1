import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetRoom, googleCoverage, lossStops, optimize, squash, windowOf, withStoreSales, type OptCampaign, type OptimizerInput, type OptProduct, type Window } from '@/lib/ads/optimizer'

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

test('oprirea de siguranță numără și vânzările din magazin pe care Google nu le-a numărat', () => {
  // VetDepo, 21.11.2026: o comandă de 29,80 lei din campanie, 0 conversii în Google
  const google = w(160, 0, 0)
  const seen = withStoreSales(google, { orders: 1, value: 29.8 })
  assert.deepEqual(seen, { cost: 160, conversions: 1, value: 29.8, clicks: 100 })
  // Cu vânzarea din magazin, campania nu mai este „fără vânzări”; sub trei comenzi medii nu se oprește
  assert.ok(!kinds(input({ loss_limit: { no_conversions: 155, low_roas: 465 }, campaigns: [campaign({ since_loss_check: seen })] })).includes('pause_loss_limit'))
  // Fără ea, oprirea rămâne cum era
  assert.ok(kinds(input({ loss_limit: { no_conversions: 155, low_roas: 465 }, campaigns: [campaign({ since_loss_check: google })] })).includes('pause_loss_limit'))
  // Peste trei comenzi medii, cu vânzări sub costul reclamei, se oprește oricum
  assert.ok(kinds(input({ loss_limit: { no_conversions: 155, low_roas: 465 }, campaigns: [campaign({ since_loss_check: withStoreSales(w(470, 0, 0), { orders: 1, value: 29.8 }) })] })).includes('pause_loss_limit'))
  // Aceleași comenzi văzute de ambele surse: cea mai mare, nu suma
  assert.deepEqual(withStoreSales(w(300, 2, 400), { orders: 1, value: 250 }), w(300, 2, 400))
  assert.deepEqual(withStoreSales(w(300, 1, 200), { orders: 3, value: 650 }), w(300, 3, 650))
  // Fără comenzi din magazin, fereastra rămâne a Google
  assert.deepEqual(withStoreSales(google, undefined), google)
  assert.deepEqual(withStoreSales(google, { orders: 0, value: 0 }), google)
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

test('produsele care se vând în magazin nu ies din campanii, chiar dacă Google n-a numărat vânzarea', () => {
  const prod = (id: string, over: Partial<OptProduct> = {}): OptProduct => ({
    item_id: id, offer_id: id, title: id, price: 300, included_by_user: false, excluded: false, window: w(0, 0, 0), days: 30, ...over,
  })
  const picks = (products: OptProduct[]) => {
    const p = optimize(input({ products })).find(x => x.kind === 'exclude_products')
    return p ? (p.params.products as { item_id: string; why: string; conversions: number }[]).map(x => `${x.item_id}:${x.why}:${x.conversions}`) : []
  }
  // 320 cheltuiți, 0 conversii Google, dar 2 comenzi din campanie de 700 în magazin: se vinde, rămâne
  assert.deepEqual(picks([prod('sells', { window: w(320, 0, 0), store: { orders: 2, value: 700 } })]), [])
  // O comandă din magazin, dar sub costul reclamei: tot pierdere, iese ca „vinde sub cost”
  assert.deepEqual(picks([prod('cheap', { window: w(320, 0, 0), store: { orders: 1, value: 29.8 } })]), ['cheap:unprofitable:1'])
  // Fără comenzi în magazin, regula rămâne cea de dinainte
  assert.deepEqual(picks([prod('none', { window: w(320, 0, 0), store: { orders: 0, value: 0 } })]), ['none:no_sales:0'])
})

test('bugetul vede și vânzările din magazin, dar trecerea pe Performance Max rămâne pe conversiile Google', () => {
  const limited = { google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null } }
  // Google: 0 conversii; magazinul: 6 comenzi de 2.400 la 2.000 cheltuiți, deci ROAS 1,2
  const unseen = campaign({ ...limited, eval30: w(2000, 0, 0), store30: { orders: 6, value: 2400 } })
  const budget = optimize(input({ campaigns: [unseen] })).find(x => x.kind === 'set_budget')!
  assert.deepEqual(budget.params, { from: 100, to: 120 })
  assert.deepEqual(budget.reason.params, { actual: 1.2, from: 100, to: 120 })
  // Fără vânzările din magazin, Google singur n-ar fi propus nimic
  assert.ok(!kinds(input({ campaigns: [campaign({ ...limited, eval30: w(2000, 0, 0) })] })).includes('set_budget'))
  // O grupă cu 20 de comenzi în magazin, dar 3 conversii Google, nu trece pe PMax: Google licitează după ale lui
  const group = campaign({ id: 'g1', type: 'shopping', stage: 'starter', group: true, days_live: 30, eval30: w(500, 3, 600), store30: { orders: 20, value: 4000 } })
  assert.ok(!kinds(input({ campaigns: [group] })).includes('graduate'))
})

test('căutările: când Google vede doar o parte din comenzi, pragul pentru negative crește pe măsură', () => {
  // Google a numărat 1 din cele 4 comenzi ale campaniei: acoperire 25%, deci pragul este de 4 ori comanda medie
  assert.equal(googleCoverage({ eval30: w(1000, 1, 300), store30: { orders: 4, value: 1200 } }), 0.25)
  assert.equal(googleCoverage({ eval30: w(1000, 2, 300), store30: { orders: 4, value: 1200 } }), 0.5)
  assert.equal(googleCoverage({ eval30: w(1000, 0, 0), store30: { orders: 9, value: 900 } }), 0.25, 'cel puțin 25%')
  assert.equal(googleCoverage({ eval30: w(1000, 5, 900), store30: { orders: 3, value: 900 } }), 1)
  assert.equal(googleCoverage({ eval30: w(1000, 5, 900) }), 1)
  const terms = [
    { campaign_id: 'c1', term: 'lampa ieftina', cost: 610, conversions: 0, clicks: 90 },
    { campaign_id: 'c1', term: 'veioza veche', cost: 1300, conversions: 0, clicks: 120 },
  ]
  // Comanda medie 300, acoperire 50%: pragul este 600, deci ambele
  const half = optimize(input({ campaigns: [campaign({ eval30: w(2000, 2, 8200), store30: { orders: 4, value: 9000 } })], searchTerms: terms })).find(x => x.kind === 'add_negatives')!
  assert.deepEqual((half.params.terms as { term: string }[]).map(t => t.term), ['veioza veche', 'lampa ieftina'])
  // Acoperire 25%: pragul este 1.200, deci doar cea de 1.300
  const quarter = optimize(input({ campaigns: [campaign({ eval30: w(2000, 1, 8200), store30: { orders: 4, value: 9000 } })], searchTerms: terms })).find(x => x.kind === 'add_negatives')!
  assert.deepEqual((quarter.params.terms as { term: string }[]).map(t => t.term), ['veioza veche'])
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

test('oprirea de siguranță a unei grupe vine din comanda medie a grupei, nu a magazinului (§13)', () => {
  // Magazinul: comanda medie 300 → 300 / 900. Grupa de accesorii: comanda medie 40 → 40 / 120
  const cheap = campaign({ id: 'g1', group: true, loss_limit: { no_conversions: 40, low_roas: 120 }, since_loss_check: w(60, 0, 0) })
  assert.deepEqual(optimize(input({ campaigns: [cheap] })).map(p => p.kind), ['pause_loss_limit'])
  // Grupa scumpă (comanda medie 1.200): 400 cheltuiți fără vânzări nu o opresc încă, deși ar opri magazinul
  const premium = campaign({ id: 'g2', group: true, loss_limit: { no_conversions: 1200, low_roas: 3600 }, since_loss_check: w(400, 0, 0) })
  assert.ok(!kinds(input({ campaigns: [premium] })).includes('pause_loss_limit'))
  // Fără limită proprie: a magazinului
  assert.ok(kinds(input({ campaigns: [campaign({ since_loss_check: w(400, 0, 0) })] })).includes('pause_loss_limit'))
  // Limita grupei null (nicio comandă medie): nu se oprește
  assert.ok(!kinds(input({ campaigns: [campaign({ loss_limit: null, since_loss_check: w(5000, 0, 0) })] })).includes('pause_loss_limit'))
  // lossStops e aceeași regulă, folosită de pilot înaintea a orice altceva
  assert.equal(lossStops([cheap, premium], { no_conversions: 300, low_roas: 900 }).length, 1)
})

test('campaniile judecate deja de oprirea de siguranță (skip) nu mai primesc nimic în trecerea asta', () => {
  const limited = campaign({ google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null }, since_loss_check: w(950, 3, 700) })
  assert.deepEqual(optimize(input({ campaigns: [limited], skip: new Set(['c1']) })), [])
})

test('pornirea nu trece la PMax când arborele ar depăși limita Google, iar o respingere ține doar pentru campania ei', () => {
  const starter = campaign({ type: 'shopping', stage: 'starter', days_live: 20, eval30: w(500, 16, 2600) })
  assert.ok(!kinds(input({ campaigns: [{ ...starter, can_graduate: false }], account: { conversions30: 16 } })).includes('graduate'))
  const rejected = (k: string) => ({ items: new Set<string>(), terms: new Set<string>(), kinds: new Set([k]) })
  assert.ok(!kinds(input({ campaigns: [starter], account: { conversions30: 16 }, rejected: rejected('graduate:c1') })).includes('graduate'))
  // A fost respinsă trecerea altei campanii (o grupă): pornirea principală trece
  assert.ok(kinds(input({ campaigns: [starter], account: { conversions30: 16 }, rejected: rejected('graduate:g9') })).includes('graduate'))
})

test('bugetul maxim: propunerile din aceeași trecere nu trec împreună de el', () => {
  const limited = (id: string) => campaign({ id, google_campaign_id: id, daily_budget: 60, google: { reasons: ['BUDGET_CONSTRAINED'], recommended_budget: null } })
  // Maxim 130, două campanii de 60: prima urcă la 70, a doua nu mai are loc
  const p = optimize(input({ campaigns: [limited('a'), limited('b')], max_daily_budget: 130 })).filter(x => x.kind === 'set_budget')
  assert.deepEqual(p.map(x => x.params), [{ from: 60, to: 70 }])
  // budgetRoom: ce încape sub maxim, pentru aprobarea de mai târziu
  const rows = [{ id: 'a', status: 'active', daily_budget: 70 }, { id: 'b', status: 'active', daily_budget: 60 }, { id: 'c', status: 'paused', daily_budget: 500 }]
  assert.equal(budgetRoom(130, 'b', rows), 60)
  assert.equal(budgetRoom(null, 'b', rows), null)
})

test('numele magazinului nu devine negativ nici fără diacritice, legat sau cu cratimă', () => {
  const terms = (list: string[]) => optimize(input({
    brand: ['lumină design'],
    searchTerms: list.map(term => ({ campaign_id: 'c1', term, cost: 400, conversions: 0, clicks: 30 })),
  })).find(x => x.kind === 'add_negatives')?.params.terms as { term: string }[] | undefined
  assert.equal(terms(['lumina design', 'luminadesign.ro', 'Lumina-Design lustre']), undefined)
  assert.deepEqual(terms(['lustra ieftina'])!.map(t => t.term), ['lustra ieftina'])
  assert.equal(squash('Lumină-Design'), 'luminadesign')
})
