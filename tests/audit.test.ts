import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAudit, type AuditRaw } from '@/lib/google/audit'

// Auditul contului: rândurile vin cum le dă API-ul REST (camelCase, int64 ca text,
// valorile implicite lipsesc).

function raw(over: Partial<AuditRaw> = {}): AuditRaw {
  return {
    customer: [{ customer: { id: '1234567890', descriptiveName: 'Magazin', currencyCode: 'RON', timeZone: 'Europe/Bucharest', autoTaggingEnabled: true } }],
    productLinks: [{ productLink: { type: 'MERCHANT_CENTER', merchantCenter: { merchantCenterId: '555' } } }],
    conversionActions: [{ conversionAction: { id: '9', name: 'Cumpărare', status: 'ENABLED', category: 'PURCHASE', origin: 'WEBSITE', primaryForGoal: true, valueSettings: { defaultValue: 1 } } }],
    goals: [
      { customerConversionGoal: { category: 'PURCHASE', origin: 'WEBSITE', biddable: true } },
      { customerConversionGoal: { category: 'ADD_TO_CART', origin: 'WEBSITE' } },
    ],
    campaigns: [],
    // Câteva conversii recente: tagul se declanșează
    metrics30: [{ campaign: { id: '50', advertisingChannelType: 'SEARCH' }, metrics: { costMicros: '1000000', conversions: 2, conversionsValue: 80 } }],
    ...over,
  }
}
const ctx = { storeCurrency: 'RON', storeMerchantId: null as string | null, hontrioCampaignIds: new Set<string>() }
const ids = (r: ReturnType<typeof evaluateAudit>) => r.checks.map(c => c.id)

test('un cont pregătit nu are nimic de semnalat', () => {
  const r = evaluateAudit(raw(), ctx)
  assert.deepEqual(r.checks, [])
  assert.equal(r.merchant_id, '555')
  assert.equal(r.customer.auto_tagging, true)
  assert.deepEqual(r.goals, [{ category: 'PURCHASE', origin: 'WEBSITE', biddable: true }, { category: 'ADD_TO_CART', origin: 'WEBSITE', biddable: false }])
})

test('contul de manager și moneda greșită blochează', () => {
  const r = evaluateAudit(raw({ customer: [{ customer: { id: '1', currencyCode: 'EUR', manager: true } }] }), ctx)
  assert.deepEqual(r.checks.filter(c => c.level === 'blocker').map(c => c.id).sort(), ['account_manager', 'currency_mismatch'])
  assert.ok(ids(r).includes('auto_tagging_off'), 'lipsa etichetării automate (implicit false) e semnalată')
})

test('Merchant Center: legat, al altcuiva, mai multe, niciunul', () => {
  assert.deepEqual(ids(evaluateAudit(raw(), { ...ctx, storeMerchantId: '777' })), ['merchant_other'])
  const two = evaluateAudit(raw({ productLinks: [
    { productLink: { type: 'MERCHANT_CENTER', merchantCenter: { merchantCenterId: '1' } } },
    { productLink: { type: 'MERCHANT_CENTER', merchantCenter: { merchantCenterId: '2' } } },
  ] }), ctx)
  assert.deepEqual(ids(two), ['merchant_choose'])
  assert.equal(two.merchant_id, null)
  // Cu Merchant-ul magazinului știut (Edinio), dintre mai multe se ia al lui
  assert.equal(evaluateAudit(raw({ productLinks: two.merchant_ids.map(id => ({ productLink: { type: 'MERCHANT_CENTER', merchantCenter: { merchantCenterId: id } } })) }), { ...ctx, storeMerchantId: '2' }).merchant_id, '2')
  assert.deepEqual(ids(evaluateAudit(raw({ productLinks: [] }), ctx)), ['merchant_not_linked'])
})

test('conversia de cumpărare: lipsă, secundară, fără valoare', () => {
  assert.deepEqual(ids(evaluateAudit(raw({ conversionActions: [] }), ctx)), ['purchase_missing'])
  const secondary = raw()
  secondary.conversionActions[0].conversionAction!.primaryForGoal = false
  assert.deepEqual(ids(evaluateAudit(secondary, ctx)), ['purchase_not_primary'])
  const noValue = raw()
  noValue.conversionActions[0].conversionAction!.valueSettings = { defaultValue: 1, alwaysUseDefaultValue: true }
  const r = evaluateAudit(noValue, ctx)
  assert.deepEqual(r.checks, [{ id: 'purchase_no_value', level: 'warning' }])
  // O conversie de alt fel (ex. abonare) nu e cumpărare
  assert.deepEqual(ids(evaluateAudit(raw({ conversionActions: [{ conversionAction: { id: '1', status: 'ENABLED', category: 'SIGNUP', primaryForGoal: true } }] }), ctx)), ['purchase_missing'])
})

test('declarația UE, suprapunerile și campania Search', () => {
  const r = evaluateAudit(raw({
    campaigns: [
      { campaign: { id: '1', name: 'PMax vechi', status: 'ENABLED', advertisingChannelType: 'PERFORMANCE_MAX', shoppingSetting: { merchantId: '555' }, missingEuPoliticalAdvertisingDeclaration: true }, campaignBudget: { amountMicros: '50000000' } },
      { campaign: { id: '2', name: 'Shopping pe alt Merchant', status: 'ENABLED', advertisingChannelType: 'SHOPPING', shoppingSetting: { merchantId: '999' } } },
      { campaign: { id: '3', name: 'Shopping oprit', status: 'PAUSED', advertisingChannelType: 'SHOPPING', shoppingSetting: { merchantId: '555' } } },
      { campaign: { id: '4', name: 'Hontrio', status: 'ENABLED', advertisingChannelType: 'SHOPPING', shoppingSetting: { merchantId: '555' } } },
      { campaign: { id: '5', name: 'Brand', status: 'ENABLED', advertisingChannelType: 'SEARCH' } },
    ],
    metrics30: [
      { campaign: { id: '1', advertisingChannelType: 'PERFORMANCE_MAX' }, metrics: { costMicros: '100000000', conversions: 10, conversionsValue: 500 } },
      { campaign: { id: '5', advertisingChannelType: 'SEARCH' }, metrics: { costMicros: '20000000', conversions: 6, conversionsValue: 300 } },
      // O campanie ștearsă contează la conversiile contului
      { campaign: { id: '77', advertisingChannelType: 'SHOPPING' }, metrics: { costMicros: '5000000', conversions: 1, conversionsValue: 40 } },
    ],
  }), { ...ctx, hontrioCampaignIds: new Set(['4']) })
  assert.deepEqual(r.eu_undeclared, ['1'])
  assert.deepEqual(r.overlap, ['1'], 'doar campaniile active, pe același Merchant, care nu sunt ale noastre')
  assert.equal(r.search_active, true)
  assert.deepEqual(r.history, { conversions30: 17, value30: 840, cost30: 125, shopping_conversions30: 11, shopping_value30: 540, shopping_cost30: 105 })
  assert.equal(r.campaigns.find(c => c.id === '1')!.daily_budget, 50)
  assert.deepEqual(r.checks.map(c => [c.id, c.level]), [['eu_undeclared', 'choice'], ['overlap', 'choice'], ['search_active', 'info']])
})
