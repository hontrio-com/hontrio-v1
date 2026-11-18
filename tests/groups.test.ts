import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlan, type PlanInput } from '@/lib/campaigns/plan'
import {
  accountBlockers, assignGroups, buildGroupPlan, buildGroupPlans, EMPTY_RULES, groupOfferOf, matchesFilters, parseRules,
  type GroupRules, type ProductGroup,
} from '@/lib/campaigns/groups'
import { parseGroupFields } from '@/lib/campaigns/group-input'
import { evaluateAudit } from '@/lib/google/audit'
import { auditRaw, offer, setup } from './fixtures'

// Grupele de produse făcute de om: ce produse prind regulile, cine are
// întâietate la un produs, comanda medie, treapta, bugetul și ce oprește lansarea.

const ctx = { storeCurrency: 'RON', storeMerchantId: '555', hontrioCampaignIds: new Set<string>() }
const audit = evaluateAudit(auditRaw(), ctx)

// Lustre, becuri, o aplică la reducere și una epuizată
const offers = [
  offer('l1', { category: 'Lustre', brand: 'Aria', price: 500 }),
  offer('l2', { category: 'Lustre', brand: 'Nova', price: 300 }),
  offer('b1', { category: 'Becuri', brand: 'Ledvance', price: 60 }),
  offer('b2', { category: 'Becuri', brand: 'ledvance', price: 40 }),
  offer('a1', { category: 'Aplice', brand: 'Nova', price: 180, compare_at_price: 220 }),
  offer('a2', { category: 'Aplice', brand: 'Nova', price: 150, available: false }),
]

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    store: { currency: 'RON', connection_status: 'active', name: 'Lampi', url: 'https://lampi.ro' },
    setup: setup(),
    google: { connected: true, account: { customer_id: '1234567890', name: 'Cont', currency: 'RON' } },
    audit,
    merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: 4 },
    offers,
    sales90: new Map([
      ['l1', { units: 4, revenue: 2000, orders: 4 }], ['l2', { units: 5, revenue: 1500, orders: 5 }],
      ['b1', { units: 30, revenue: 1800, orders: 20 }], ['b2', { units: 20, revenue: 800, orders: 15 }],
      ['a1', { units: 6, revenue: 1080, orders: 6 }],
    ]),
    orders90: { orders: 50, total: 9000, items: 7200, discount: 0, tax: 1500 },
    googleAds90: { orders: 0, total: 0 },
    googleAds30: { orders: 0, total: 0 },
    googleSales30: new Map([['b1', { units: 12, revenue: 720, orders: 9 }], ['b2', { units: 9, revenue: 360, orders: 8 }], ['l1', { units: 2, revenue: 1000, orders: 2 }]]),
    settings: { daily_budget: null, mode: 'approve', max_daily_budget: null },
    ...over,
  }
}

function group(id: string, rules: Partial<GroupRules>, over: Partial<ProductGroup> = {}): ProductGroup {
  return {
    id, name: id, rules: { ...EMPTY_RULES, ...rules }, daily_budget: null, campaign_type: 'auto',
    starts_on: null, ends_on: null, position: 1, status: 'draft', launched_at: null, ...over,
  }
}

const groupOffers = offers.map(groupOfferOf)
const TODAY = '2026-10-28'

test('regulile: curățate, cu prețurile în ordine și fără dubluri', () => {
  const r = parseRules({ categories: [' Lustre ', 'Lustre', 3], price_min: '300', price_max: 100, on_sale: 'da', include: ['x', 'x'] })
  assert.deepEqual(r, { categories: ['Lustre'], brands: [], price_min: 100, price_max: 300, on_sale: false, include: ['x'], exclude: [] })
})

test('filtrele: oricare din listă, toate criteriile deodată, fără litere mari/mici', () => {
  const nova = groupOfferOf(offers[4])
  assert.ok(matchesFilters(nova, { ...EMPTY_RULES, categories: ['aplice', 'Lustre'] }))
  assert.ok(matchesFilters(nova, { ...EMPTY_RULES, brands: ['NOVA'], on_sale: true, price_max: 200 }))
  assert.ok(!matchesFilters(nova, { ...EMPTY_RULES, brands: ['Nova'], price_min: 200 }))
  assert.ok(!matchesFilters(groupOfferOf(offers[1]), { ...EMPTY_RULES, on_sale: true }))
  // Fără niciun criteriu, filtrele nu prind nimic (doar produsele alese de mână)
  assert.ok(!matchesFilters(nova, EMPTY_RULES))
})

test('un produs stă într-o singură grupă: întâi cele lansate (cea mai veche), apoi ciornele, în ordinea lor', () => {
  const lustre = group('lustre', { categories: ['Lustre'] }, { position: 3 })
  const nova = group('nova', { brands: ['Nova'] }, { position: 1, status: 'live', launched_at: '2026-10-20T10:00:00Z' })
  const mine = group('mine', { include: ['l2', 'b1'], exclude: [] }, { position: 2 })
  const old = group('old', { categories: ['Becuri'] }, { status: 'ended' })
  const a = assignGroups(groupOffers, [lustre, nova, mine, old])
  // l2 e și „Nova", lansată: rămâne ei; l1 merge la „lustre"; b1 e ales de mână; becurile grupei încheiate sunt libere
  assert.equal(a.get('l2'), 'nova')
  assert.equal(a.get('l1'), 'lustre')
  assert.equal(a.get('b1'), 'mine')
  assert.equal(a.get('b2'), undefined)
  // Scos de mână: nu mai e al grupei, chiar dacă îl prind filtrele
  const b = assignGroups(groupOffers, [group('becuri', { categories: ['Becuri'], exclude: ['b2'] })])
  assert.deepEqual([...b.keys()], ['b1'])
})

test('planul magazinului: produsele grupelor lansate ies din campania principală, comanda medie rămâne a magazinului', () => {
  const base = buildPlan(input())
  const assigned = assignGroups(groupOffers, [group('becuri', { categories: ['Becuri'] }, { status: 'live', launched_at: '2026-10-20T10:00:00Z' })])
  const withGroup = buildPlan(input({ groups: { assigned, live: new Set(['becuri']) } }))
  assert.equal(withGroup.offers.find(o => o.offer_id === 'b1')!.reason, 'in_group')
  // Epuizatul rămâne epuizat, nu „în grupă"
  assert.equal(withGroup.offers.find(o => o.offer_id === 'a2')!.reason, 'out_of_stock')
  assert.equal(withGroup.counts.in_groups, 2)
  assert.equal(withGroup.counts.included, base.counts.included - 2)
  assert.equal(withGroup.economics.aov, base.economics.aov)
  // Nu se exclud „pentru totdeauna": doar campania principală le lasă afară
  assert.ok(!withGroup.exclusions.item_ids.includes('b1'))
  // O ciornă nu scoate nimic din campania principală
  const draft = buildPlan(input({ groups: { assigned, live: new Set() } }))
  assert.equal(draft.offers.find(o => o.offer_id === 'b1')!.reason, null)
  assert.equal(draft.offers.find(o => o.offer_id === 'b1')!.group_id, 'becuri')
})

test('grupa: comanda medie a produselor ei dă plafonul, oprirea și bugetul; Shopping sub 15 conversii', () => {
  const plan = buildPlan(input())
  const g = group('becuri', { categories: ['Becuri'] })
  const p = buildGroupPlan(g, { plan, assigned: assignGroups(groupOffers, [g]), otherConversions: 0, otherBudgets: 0, today: TODAY })
  assert.deepEqual(p.members.sort(), ['b1', 'b2'])
  assert.equal(p.counts.included, 2)
  // 9 + 8 comenzi din Google în 30 de zile: destule pentru Performance Max
  assert.equal(p.conversions30, 17)
  assert.equal(p.auto_type, 'performance_max')
  assert.equal(p.cpc_ceiling, null)
  // 2.600 în 35 de comenzi, cu TVA și transport ca la magazin (9.000 / 7.200): 92,86
  assert.equal(p.economics.aov, 92.86)
  assert.equal(p.economics.aov_basis, 'orders')
  assert.equal(p.budget.suggested, 19)
  // Lustrele, cu 2: Shopping standard cu „Maximizează clicurile"
  const small = group('lustre', { categories: ['Lustre'] })
  const s = buildGroupPlan(small, { plan, assigned: assignGroups(groupOffers, [small]), otherConversions: 0, otherBudgets: 0, today: TODAY })
  assert.equal(s.conversions30, 2)
  assert.equal(s.type, 'shopping')
  assert.equal(s.stage, 'starter')
  // Doar 9 comenzi (sub 10): comanda medie se estimează după prețuri, (500 + 300) / 2 × 1,25 = 500;
  // plafon 1%, oprire la 1× / 3×, buget o cincime
  assert.equal(s.economics.aov, 500)
  assert.equal(s.economics.aov_basis, 'prices')
  assert.equal(s.cpc_ceiling, 5)
  assert.deepEqual(s.loss_limit, { no_conversions: 500, low_roas: 1500 })
  assert.deepEqual(s.budget, { suggested: 100, chosen: null, daily: 100 })
  assert.deepEqual(s.blockers, [])
})

test('grupa: Performance Max ales de om, cu puține conversii, are avertisment', () => {
  const plan = buildPlan(input())
  const g = group('lustre', { categories: ['Lustre'] }, { campaign_type: 'performance_max' })
  const p = buildGroupPlan(g, { plan, assigned: assignGroups(groupOffers, [g]), otherConversions: 0, otherBudgets: 0, today: TODAY })
  assert.equal(p.type, 'performance_max')
  assert.equal(p.cpc_ceiling, null)
  assert.ok(p.warnings.some(w => w.id === 'pmax_low_data'))
})

test('grupa: ce oprește lansarea și ce trebuie știut', () => {
  const plan = buildPlan(input())
  const run = (g: ProductGroup, others: ProductGroup[] = [], extra: Partial<Parameters<typeof buildGroupPlan>[1]> = {}) =>
    buildGroupPlan(g, { plan, assigned: assignGroups(groupOffers, [...others, g]), otherConversions: 0, otherBudgets: 0, today: TODAY, ...extra })
  assert.deepEqual(run(group('gol', {})).blockers.map(b => b.id), ['empty'])
  // Doar aplica epuizată: nimic nu poate rula
  assert.deepEqual(run(group('epuizat', { include: ['a2'] })).blockers.map(b => b.id), ['no_products'])
  // Perioada în trecut
  assert.ok(run(group('vara', { categories: ['Lustre'] }, { ends_on: '2026-08-31' })).blockers.some(b => b.id === 'period'))
  // Un produs epuizat în grupă, unul prins și de altă grupă, puține produse
  const aplice = run(group('aplice', { categories: ['Aplice'] }), [group('nova', { brands: ['Nova'] }, { status: 'live', launched_at: '2026-10-01T00:00:00Z' })])
  assert.equal(aplice.counts.members, 0)
  assert.ok(aplice.warnings.some(w => w.id === 'in_other_group' && w.params?.count === 2))
  const few = run(group('l1', { include: ['l1', 'a2'] }))
  assert.ok(few.warnings.some(w => w.id === 'few_products'))
  assert.ok(few.warnings.some(w => w.id === 'excluded_members'))
  // Peste bugetul maxim al omului, cu celelalte campanii
  const capped = buildPlan(input({ settings: { daily_budget: null, mode: 'approve', max_daily_budget: 50 } }))
  const big = group('becuri', { categories: ['Becuri'] }, { daily_budget: 30 })
  const over = buildGroupPlan(big, { plan: capped, assigned: assignGroups(groupOffers, [big]), otherConversions: 0, otherBudgets: 40, today: TODAY })
  assert.ok(over.warnings.some(w => w.id === 'over_max_budget' && w.params?.total === 70))
})

test('grupele: fiecare vede conversiile și bugetele celorlalte', () => {
  const plan = buildPlan(input({ audit: { ...audit, history: { ...audit.history, conversions30: 20 } } }))
  const becuri = group('becuri', { categories: ['Becuri'] }, { daily_budget: 20, position: 1 })
  const lustre = group('lustre', { categories: ['Lustre'] }, { daily_budget: 15, position: 2 })
  const assigned = assignGroups(groupOffers, [becuri, lustre])
  const plans = buildGroupPlans([becuri, lustre], plan, assigned, [{ group_id: null, daily_budget: 40 }], TODAY)
  // Campania principală rămâne cu 20 − 17 − 2 = 1 conversie: sub 15
  assert.ok(plans[0].warnings.some(w => w.id === 'main_low_data' && w.params?.remaining === 1))
})

test('ce trimite pagina: nume, reguli, perioadă', () => {
  assert.deepEqual(parseGroupFields({ name: '  Lustre   vara ', rules: { categories: ['Lustre'] }, ends_on: '2026-11-30' }, TODAY), {
    fields: { name: 'Lustre vara', rules: { ...EMPTY_RULES, categories: ['Lustre'] }, ends_on: '2026-11-30' },
  })
  assert.deepEqual(parseGroupFields({ rules: {} }, TODAY), { error: 'campaigns.group_empty' })
  assert.deepEqual(parseGroupFields({ ends_on: '2026-10-01' }, TODAY), { error: 'campaigns.group_period_past' })
  assert.deepEqual(parseGroupFields({ starts_on: '2026-12-10', ends_on: '2026-12-01' }, TODAY), { error: 'campaigns.group_period_invalid' })
  assert.deepEqual(parseGroupFields({ daily_budget: -5 }, TODAY), { error: 'campaigns.budget_invalid' })
  assert.deepEqual(parseGroupFields({ campaign_type: 'search' }, TODAY), { error: 'campaigns.group_type_invalid' })
})

test('o grupă încheiată nu mai ține produse, dar planul ei arată ce ar prinde la relansare', () => {
  const plan = buildPlan(input())
  const ended = group('becuri', { categories: ['Becuri'] }, { status: 'ended' })
  const nova = group('nova', { brands: ['Ledvance'] }, { position: 2 })
  const assigned = assignGroups(groupOffers, [ended, nova])
  // Încheiată: produsele ei sunt ale ciornei „nova" (Ledvance) sau ale campaniei principale
  assert.equal(assigned.get('b1'), 'nova')
  const [endedPlan] = buildGroupPlans([ended, nova], plan, assigned, [], TODAY)
  // La relansare ar lua ce rămâne după celelalte: nimic din becuri (ambele sunt Ledvance)
  assert.equal(endedPlan.counts.members, 0)
  assert.equal(endedPlan.counts.elsewhere, 2)
  const alone = buildGroupPlans([ended], plan, assignGroups(groupOffers, [ended]), [], TODAY)[0]
  assert.deepEqual(alone.members.sort(), ['b1', 'b2'])
  assert.deepEqual(alone.blockers, [])
})

test('conversia fără valoarea comenzii oprește și grupele, la ambele tipuri de campanie', () => {
  const plan = buildPlan(input())
  assert.deepEqual(accountBlockers(plan, false), [])
  // Planul n-o are încă (audit vechi), dar auditul o semnalează: o adăugăm o singură dată
  assert.deepEqual(accountBlockers(plan, true).map(b => b.id), ['purchase_no_value'])
  const noValueRaw = auditRaw()
  noValueRaw.conversionActions[0].conversionAction!.valueSettings = { alwaysUseDefaultValue: true }
  const withNoValue = buildPlan(input({ audit: evaluateAudit(noValueRaw, ctx) }))
  assert.deepEqual(accountBlockers(withNoValue, true).map(b => b.id), ['purchase_no_value'])
})
