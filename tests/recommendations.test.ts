import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRecommendations, type EngineInput } from '@/lib/recommendations/engine'
import { evaluateAudit } from '@/lib/google/audit'
import { auditRaw, offer, setup } from './fixtures'

// Recomandările noi: din auditul contului, din Merchant Center (probleme și
// piață), despre profitul în Google și despre CSS.

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    store: { connection_status: 'active' },
    setup: setup(),
    google: { connected: true, account_selected: true },
    offers: [offer('a'), offer('b')],
    sales90: new Map([['a', { units: 3, revenue: 300 }]]),
    orders90: { orders: 3, total: 360, items: 300, discount: 0, tax: 62 },
    ...over,
  }
}
const ids = (i: EngineInput) => buildRecommendations(i).map(r => r.id)
const ctx = { storeCurrency: 'RON', storeMerchantId: '555', hontrioCampaignIds: new Set<string>() }

test('auditul: declarația UE și conversia de cumpărare stau printre pașii de pregătire', () => {
  const raw = auditRaw({
    conversionActions: [],
    campaigns: [{ campaign: { id: '1', status: 'ENABLED', advertisingChannelType: 'SEARCH', missingEuPoliticalAdvertisingDeclaration: true } }],
  })
  const recs = buildRecommendations(input({ audit: evaluateAudit(raw, ctx) }))
  const eu = recs.find(r => r.id === 'eu_undeclared')!
  assert.equal(eu.severity, 'high')
  assert.deepEqual(eu.title, { key: 'recs.eu_undeclared_title', params: { count: 1 } })
  const purchase = recs.find(r => r.id === 'purchase_conversion')!
  assert.deepEqual(purchase.title, { key: 'recs.purchase_missing_title' })
  // Conversia lipsă din magazin are deja recomandarea ei: auditul nu o dublează
  assert.ok(!ids(input({ audit: evaluateAudit(raw, ctx), setup: setup({ conversion: { status: 'missing', via: null, href: 'x' } }) })).includes('purchase_conversion'))
})

test('suprapunerile și etichetarea automată', () => {
  const raw = auditRaw({
    customer: [{ customer: { id: '1', currencyCode: 'RON' } }],
    campaigns: [{ campaign: { id: '2', status: 'ENABLED', advertisingChannelType: 'PERFORMANCE_MAX', shoppingSetting: { merchantId: '555' } } }],
  })
  const got = ids(input({ audit: evaluateAudit(raw, ctx) }))
  assert.ok(got.includes('overlap'))
  assert.ok(got.includes('auto_tagging_off'))
})

test('Merchant Center la WooCommerce: respinsele cu mesajul Google, cele retrogradate, netrimisele', () => {
  const woo = setup({ platform: 'woocommerce', platformName: 'WooCommerce', googleStatusKnown: false })
  const recs = buildRecommendations(input({
    setup: woo,
    merchant: { id: '555', from_merchant: true, css_region: false },
    offers: [
      offer('a', { google_status: 'disapproved', merchant_offer_id: 'gla_a', merchant_issues: [{ code: 'x', severity: 'DISAPPROVED', attribute: null, description: 'Missing price', documentation: null }] }),
      offer('b', { google_status: 'active', merchant_offer_id: 'gla_b', merchant_issues: [{ code: 'y', severity: 'DEMOTED', attribute: 'image', description: 'Image too small', documentation: null }] }),
      offer('c', { google_status: null }),
    ],
  }))
  const issues = recs.find(r => r.id === 'google_issues')!
  assert.deepEqual(issues.body, { key: 'recs.google_issues_body_merchant' })
  assert.deepEqual(issues.items[0].note, { key: 'recs.note_issue', params: { issue: 'Missing price' } })
  assert.equal(issues.action!.label_key, 'recs.action_open_merchant')
  assert.ok(recs.some(r => r.id === 'merchant_demoted'))
  assert.deepEqual(recs.find(r => r.id === 'not_sent')!.body, { key: 'recs.not_sent_body_woocommerce' })
})

test('piața: prețuri peste referință, prețuri sugerate, produse căutate', () => {
  const recs = buildRecommendations(input({
    insights: {
      price_competitiveness: [
        { offer_id: 'A', title: 'a', price: 120, benchmark: 100, currency: 'RON' },
        { offer_id: 'b', title: 'b', price: 102, benchmark: 100, currency: 'RON' },
      ],
      price_insights: [
        { offer_id: 'b', title: 'b', price: 100, suggested: 92, conversions_change: 0.18, clicks_change: 0.1, effectiveness: 'HIGH' },
        { offer_id: 'a', title: 'a', price: 100, suggested: 95, conversions_change: 0.04, clicks_change: 0.02, effectiveness: 'HIGH' },
      ],
      best_sellers: [{ title: 'Lampă X', brand: 'Philips', category: 'Corpuri de iluminat', rank: 3, previous_rank: 5, demand: 'HIGH', report_date: '2026-10-19' }],
    },
  }))
  const above = recs.find(r => r.id === 'price_above_market')!
  assert.equal(above.total_items, 1, 'doar peste 5%; ID-ul se potrivește fără litere mari')
  assert.deepEqual(above.items[0].note, { key: 'recs.note_price_benchmark', params: { price: 120, benchmark: 100, pct: 20 }, money: ['price', 'benchmark'] })
  assert.equal(above.severity, 'medium', 'produsul se vinde')
  const suggest = recs.find(r => r.id === 'price_suggestions')!
  assert.equal(suggest.total_items, 1)
  assert.equal(suggest.items[0].offer_id, 'b')
  const best = recs.find(r => r.id === 'best_sellers_missing')!
  assert.equal(best.items[0].title, 'Lampă X')
  assert.equal(best.items[0].variant_title, 'Philips')
})

test('CSS în Europa; nicio recomandare despre costuri, marje sau profit', () => {
  const got = ids(input({ merchant: { id: '555', from_merchant: false, css_region: true } }))
  assert.ok(got.includes('css_partner'))
  const none = ids(input({ merchant: { id: '555', from_merchant: false, css_region: false } }))
  assert.ok(!none.includes('css_partner'))
  for (const id of ['missing_costs', 'negative_margin', 'thin_margin_sellers', 'break_even', 'discounts_over_margin', 'costs_to_google', 'cart_data_missing']) {
    assert.ok(!got.includes(id) && !none.includes(id), id)
  }
})
