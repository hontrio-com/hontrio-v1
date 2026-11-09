import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAYS_PER_MONTH, brandTerms, buildPlan, forecastFor, type PlanInput } from '@/lib/campaigns/plan'
import { evaluateAudit } from '@/lib/google/audit'
import { auditRaw, offer, setup } from './fixtures'

// Planul campaniei: treapta, structura, plafonul de CPC, limita de pierdere,
// excluderile după ID-ul din Merchant Center și pașii care blochează lansarea.

const ctx = { storeCurrency: 'RON', storeMerchantId: '555', hontrioCampaignIds: new Set<string>() }
// 17 conversii în 30 de zile, din care 11 pe Shopping/PMax: destule pentru creștere
const growthAudit = evaluateAudit(auditRaw({
  metrics30: [
    { campaign: { id: '1', advertisingChannelType: 'PERFORMANCE_MAX' }, metrics: { costMicros: '105000000', conversions: 11, conversionsValue: 540 } },
    { campaign: { id: '5', advertisingChannelType: 'SEARCH' }, metrics: { costMicros: '20000000', conversions: 6, conversionsValue: 300 } },
  ],
}), ctx)
const starterAudit = evaluateAudit(auditRaw(), ctx)

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    store: { currency: 'RON', connection_status: 'active', name: 'Lampi LED SRL', url: 'https://www.lampi-led.ro' },
    setup: setup(),
    google: { connected: true, account: { customer_id: '1234567890', name: 'Cont', currency: 'RON' } },
    audit: starterAudit,
    merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: 4 },
    offers: [offer('a'), offer('b'), offer('thin', { cost_price: 90 }), offer('mine', { ads_mode: 'exclude' })],
    sales90: new Map([['a', { units: 10, revenue: 1000 }], ['b', { units: 5, revenue: 500 }]]),
    // TVA 21% (2.600 din 12.400), comanda medie 300, valoarea comenzii = 15/13 din produse
    orders90: { orders: 50, total: 15000, items: 13000, discount: 0, tax: 2600 },
    googleAds90: { orders: 0, total: 0 },
    googleAds30: { orders: 0, total: 0 },
    settings: { goal: 'balanced', daily_budget: null, mode: 'approve', max_daily_budget: null },
    ...over,
  }
}

test('pornire: Shopping standard, CPC plafonat din comanda medie și prag, limita de pierdere', () => {
  const p = buildPlan(input())
  assert.equal(p.stage.id, 'starter')
  assert.equal(p.stage.basis, 'google_ads')
  assert.equal(p.structure.type, 'shopping')
  // prag = 1,2097 × (15.000 / 13.000) ÷ 0,5 = 2,79
  assert.equal(p.economics.break_even, 2.8)
  // 300 × 1% ÷ 2,79 = 1,07
  assert.equal(p.structure.cpc_ceiling, 1.07)
  assert.equal(p.structure.cpc_ceiling_low, false)
  // CPA la prag = 300 ÷ 2,79 = 107,5 → 3× / 6×
  assert.deepEqual(p.structure.loss_limit, { no_conversions: 323, low_roas: 645 })
  assert.equal(p.structure.start_target, null)
  assert.equal(p.structure.merchant_id, '555')
  assert.deepEqual(p.blockers, [])
})

test('creștere: PMax cu ținta pornită din ROAS-ul real de Shopping, nu sub prag', () => {
  const p = buildPlan(input({ audit: growthAudit }))
  assert.equal(p.stage.id, 'growth')
  assert.equal(p.structure.type, 'performance_max')
  // 540 ÷ 105 = 5,14
  assert.equal(p.structure.start_target, 5.1)
  assert.equal(p.structure.cpc_ceiling, null)
  // Un cont care pierde bani pornește de la prag, nu de la ROAS-ul lui
  const losing = evaluateAudit(auditRaw({ metrics30: [{ campaign: { id: '1', advertisingChannelType: 'SHOPPING' }, metrics: { costMicros: '1000000000', conversions: 20, conversionsValue: 1000 } }] }), ctx)
  assert.equal(buildPlan(input({ audit: losing })).structure.start_target, 2.8)
})

test('fără audit: treapta din comenzile aduse de Google Ads, iar auditul devine pas de făcut', () => {
  const p = buildPlan(input({ audit: null, googleAds30: { orders: 20, total: 6000 } }))
  assert.equal(p.stage.id, 'growth')
  assert.equal(p.stage.basis, 'store')
  assert.deepEqual(p.blockers.map(b => b.id), ['audit'])
})

test('excluderile: marja mică, alegerea omului și pilotul, după ID-ul din Merchant Center', () => {
  const p = buildPlan(input({
    offers: [
      offer('a'),
      offer('thin', { cost_price: 90 }),
      offer('mine', { ads_mode: 'exclude' }),
      offer('auto', { ads_auto_reason: 'no_sales' }),
      // Omul l-a inclus: nici marja mică, nici pilotul nu-l mai scot
      offer('kept', { cost_price: 95, ads_mode: 'include', ads_auto_reason: 'unprofitable' }),
      offer('gone', { available: false }),
    ],
  }))
  const reason = (id: string) => p.offers.find(o => o.offer_id === id)!.reason
  assert.equal(reason('thin'), 'thin_margin')
  assert.equal(reason('mine'), 'manual')
  assert.equal(reason('auto'), 'ads_no_sales')
  assert.equal(reason('kept'), null)
  assert.equal(reason('gone'), 'out_of_stock')
  // Epuizatul nu se exclude în campanie: Google oricum nu-l arată
  assert.deepEqual([...p.exclusions.item_ids].sort(), ['auto', 'mine', 'thin'])
  assert.equal(p.exclusions.unmatched, 0)
  assert.equal(p.exclusions.mode, 'items')
})

test('WooCommerce: excluderea merge pe ID-ul din feed (gla_…); ofertele nepotrivite se numără', () => {
  const p = buildPlan(input({
    setup: setup({ platform: 'woocommerce', platformName: 'WooCommerce', googleStatusKnown: false }),
    offers: [offer('5', { cost_price: 95, merchant_offer_id: 'gla_5' }), offer('6', { cost_price: 95 }), offer('7')],
  }))
  assert.deepEqual(p.exclusions.item_ids, ['gla_5'])
  assert.equal(p.exclusions.unmatched, 1)
})

test('auditul blochează lansarea: Merchant nelegat, conversie fără valoare doar la creștere', () => {
  const noLink = evaluateAudit(auditRaw({ productLinks: [] }), ctx)
  assert.ok(buildPlan(input({ audit: noLink })).blockers.some(b => b.id === 'merchant_not_linked'))
  const noValueRaw = auditRaw()
  noValueRaw.conversionActions[0].conversionAction!.valueSettings = { alwaysUseDefaultValue: true }
  const noValue = evaluateAudit(noValueRaw, ctx)
  assert.ok(!buildPlan(input({ audit: noValue })).blockers.some(b => b.id === 'purchase_no_value'), 'la pornire (CPC manual) valoarea nu contează')
  const noValueGrowth = { ...noValue, history: growthAudit.history }
  assert.ok(buildPlan(input({ audit: noValueGrowth })).blockers.some(b => b.id === 'purchase_no_value'))
})

test('prea multe excluderi pentru lista din PMax: eticheta Hontrio sau pas de făcut', () => {
  const offers = Array.from({ length: 1000 }, (_, i) => offer(`x${i}`, { cost_price: 99 }))
  const withLabel = buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...offers] }))
  assert.equal(withLabel.exclusions.mode, 'label')
  const noLabel = buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...offers], merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: null } }))
  assert.equal(noLabel.exclusions.mode, 'too_many')
  assert.ok(noLabel.blockers.some(b => b.id === 'too_many_exclusions'))
  // Shopping standard duce 20.000 de noduri: la pornire rămâne lista
  assert.equal(buildPlan(input({ offers: [offer('a'), ...offers] })).exclusions.mode, 'items')
})

test('numele magazinului devine negativ doar când contul are o campanie Search', () => {
  assert.deepEqual(buildPlan(input()).structure.brand_negatives, [])
  const withSearch = { ...starterAudit, search_active: true }
  assert.deepEqual(buildPlan(input({ audit: withSearch })).structure.brand_negatives, ['lampi led'])
  assert.deepEqual(brandTerms('Casa Lumen S.R.L.', 'casalumen.ro'), ['casa lumen', 'casalumen'])
  assert.deepEqual(brandTerms(null, 'https://ab.ro'), [])
})

test('estimarea pe lună (și glisorul de buget din asistent): cheltuiala, vânzările, comenzile, profitul după reclame', () => {
  const f = forecastFor(50, 4.4, 3.1, 220)
  assert.equal(f.spend, 50 * DAYS_PER_MONTH)
  assert.equal(f.revenue, 50 * DAYS_PER_MONTH * 4.4)
  assert.ok(Math.abs((f.orders ?? 0) - (50 * DAYS_PER_MONTH * 4.4) / 220) < 1e-9)
  // Profitul: valoarea ÷ prag = profitul dinaintea reclamei, minus reclama
  assert.ok(Math.abs(f.profit - (f.revenue / 3.1 - f.spend)) < 1e-9)
  // La țintă egală cu pragul, reclama își plătește doar costul: profit 0
  assert.ok(Math.abs(forecastFor(80, 3.1, 3.1, 200).profit) < 1e-9)
  assert.equal(forecastFor(50, 4.4, 3.1, null).orders, null)
})
