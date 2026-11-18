import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountBudgetSpent, evaluateAudit, purchaseConversions30, type AuditRaw } from '@/lib/google/audit'

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
  // Fără valoarea comenzii pilotul n-are ROAS (oprirea de siguranță, produsele): oprește lansarea la ambele trepte
  assert.deepEqual(r.checks, [{ id: 'purchase_no_value', level: 'blocker' }])
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
  // Fără interogarea cumpărărilor (sau dacă Google n-a primit-o): null, iar treapta folosește toate conversiile
  assert.deepEqual(r.history, { conversions30: 17, value30: 840, cost30: 125, shopping_conversions30: 11, shopping_value30: 540, shopping_cost30: 105, purchase_conversions30: null })
  assert.equal(r.campaigns.find(c => c.id === '1')!.daily_budget, 50)
  assert.deepEqual(r.checks.map(c => [c.id, c.level]), [['eu_undeclared', 'choice'], ['overlap', 'choice'], ['search_active', 'info']])
})

test('o campanie Search pornită care n-a cheltuit nimic în 30 de zile nu prinde căutările pe brand', () => {
  // Ca la primul client: o campanie Search pornită, fără nicio afișare într-un an
  const idle = evaluateAudit(raw({
    campaigns: [{ campaign: { id: '7', name: 'Brand', status: 'ENABLED', advertisingChannelType: 'SEARCH' } }],
    metrics30: [],
  }), ctx)
  assert.equal(idle.search_active, false)
  assert.ok(!ids(idle).includes('search_active'))
})

test('mai multe conversii de cumpărare principale pe site: aceeași comandă s-ar număra de mai multe ori', () => {
  const action = (id: string, over: Record<string, unknown> = {}) =>
    ({ conversionAction: { id, name: `Cumpărare ${id}`, status: 'ENABLED', category: 'PURCHASE', origin: 'WEBSITE', primaryForGoal: true, ...over } })
  // Tagul magazinului și două importuri din GA4, toate principale
  const three = evaluateAudit(raw({ conversionActions: [action('1'), action('2'), action('3')] }), ctx)
  assert.deepEqual(three.checks, [{ id: 'purchase_duplicate', level: 'warning', params: { count: 3 } }])
  // Una secundară, una din alt loc decât site-ul și una oprită nu se numără
  const one = evaluateAudit(raw({ conversionActions: [
    action('1'), action('2', { primaryForGoal: false }), action('3', { origin: 'STORE' }), action('4', { status: 'REMOVED' }),
  ] }), ctx)
  assert.deepEqual(one.checks, [])
})

test('bugetul de cont cheltuit sau încheiat: Google nu rulează nimic, iar auditul o spune', () => {
  const NOW = Date.parse('2026-11-18T22:00:00Z')
  const budget = (over: Record<string, string> = {}) => ({ accountBudget: {
    status: 'APPROVED', approvedStartDateTime: '2025-01-21 20:53:20', approvedEndTimeType: 'FOREVER',
    approvedSpendingLimitMicros: '199920000', amountServedMicros: '199920000', ...over,
  } })
  const enabled = [{ status: 'ENABLED', serving_status: 'SUSPENDED' }]
  // Ca la primul client: 199,92 lei aprobați, 199,92 lei cheltuiți
  assert.equal(accountBudgetSpent([budget()], enabled, NOW), true)
  // Mai sunt bani, limită infinită, plata automată (fără bugete), bugetele necitite
  assert.equal(accountBudgetSpent([budget({ amountServedMicros: '150000000' })], enabled, NOW), false)
  assert.equal(accountBudgetSpent([budget({ approvedSpendingLimitType: 'INFINITE', approvedSpendingLimitMicros: '' })], enabled, NOW), false)
  assert.equal(accountBudgetSpent([], enabled, NOW), false)
  assert.equal(accountBudgetSpent(null, enabled, NOW), false)
  // Limita mărită după aprobare (ajustată) are întâietate
  assert.equal(accountBudgetSpent([budget({ adjustedSpendingLimitMicros: '500000000' })], enabled, NOW), false)
  // Un buget propus, încă neaprobat, nu contează
  assert.equal(accountBudgetSpent([budget({ status: 'PENDING' })], enabled, NOW), false)
  // Toate bugetele încheiate: doar dacă Google chiar ține campaniile suspendate
  const ended = budget({ approvedEndTimeType: '', approvedEndDateTime: '2026-10-31 23:59:59', amountServedMicros: '10000000' })
  assert.equal(accountBudgetSpent([ended], enabled, NOW), true)
  assert.equal(accountBudgetSpent([ended], [{ status: 'ENABLED', serving_status: 'SERVING' }], NOW), false)
  // Un buget nou, cu bani, după unul cheltuit: contul rulează
  assert.equal(accountBudgetSpent([{ accountBudget: { ...ended.accountBudget, amountServedMicros: '199920000' } }, budget({ approvedStartDateTime: '2026-11-01 00:00:00', amountServedMicros: '0' })], enabled, NOW), false)

  const r = evaluateAudit(raw({ accountBudgets: [budget()] }), { ...ctx, now: NOW })
  assert.deepEqual(r.checks, [{ id: 'account_budget_spent', level: 'warning' }])
})

test('treapta numără doar cumpărările (un „adaugă în coș" principal nu contează); un audit vechi folosește toate conversiile', () => {
  const r = evaluateAudit(raw({
    metrics30: [{ campaign: { id: '50', advertisingChannelType: 'SEARCH' }, metrics: { costMicros: '1000000', conversions: 20, conversionsValue: 800 } }],
    purchase30: [{ metrics: { conversions: 6 } }, { metrics: { conversions: 3.5 } }],
  }), ctx)
  assert.equal(r.history.conversions30, 20)
  assert.equal(r.history.purchase_conversions30, 9.5)
  assert.equal(purchaseConversions30(r), 9.5)
  // Interogarea cumpărărilor n-a mers: totul, ca înainte
  assert.equal(purchaseConversions30(evaluateAudit(raw({ purchase30: null }), ctx)), 2)
  // Un audit salvat înainte de câmpul nou
  assert.equal(purchaseConversions30({ history: { conversions30: 12, value30: 0, cost30: 0, shopping_conversions30: 0, shopping_value30: 0, shopping_cost30: 0 } }), 12)
})
