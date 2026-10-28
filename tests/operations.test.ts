import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toMicros, idFromResourceName } from '@/lib/google/ads'
import {
  buildLaunchOperations, budgetOp, endDateOp, endOfDay, euDeclarationOps, pmaxListingOps, removeNodesOps, shoppingListingOps, startOfDay, targetRoasOp,
  FINAL_URL_SUFFIX, type GrowthSpec, type StarterSpec,
} from '@/lib/google/operations'

// Operațiile trimise la Google Ads API, verificate pe forma din definițiile v26
// și din exemplul oficial add_performance_max_retail_campaign.

const common = {
  customerId: '1234567890',
  name: 'Hontrio · Test',
  merchantId: '555',
  feedLabel: 'RO',
  dailyBudget: 80,
  billableUnitMicros: 10_000,
  geoTargetConstant: 'geoTargetConstants/2642',
  finalUrlSuffix: FINAL_URL_SUFFIX,
  negatives: [],
}

const growth: GrowthSpec = {
  ...common, kind: 'performance_max', targetRoas: 4.5, languageConstant: 'languageConstants/1032',
  finalUrl: 'https://magazin.ro', listing: { kind: 'all' },
  goals: [{ category: 'PURCHASE', origin: 'WEBSITE' }, { category: 'ADD_TO_CART', origin: 'WEBSITE' }],
}

const starter: StarterSpec = { ...common, kind: 'shopping', cpcCeiling: 0.79, campaignPriority: 1, listing: { kind: 'all' } }

const key = (op: Record<string, unknown>) => Object.keys(op)[0]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (op: Record<string, unknown>): any => Object.values(op)[0]

test('micros: multiplu de unitatea facturabilă, rotunjit', () => {
  assert.equal(toMicros(80), '80000000')
  assert.equal(toMicros(0.785), '790000')
  assert.equal(toMicros(12.345), '12350000')
  // O monedă fără subdiviziuni (unitatea = 1): fără bani mărunți
  assert.equal(toMicros(12.6, 1_000_000), '13000000')
  // Niciodată zero: Google refuză un buget sau o ofertă de 0
  assert.equal(toMicros(0.001), '10000')
})

test('ID-ul din numele resursei, inclusiv filtrele „grup~filtru"', () => {
  assert.equal(idFromResourceName('customers/1/campaigns/22'), '22')
  assert.equal(idFromResourceName('customers/1/assetGroupListingGroupFilters/7~9'), '9')
  assert.equal(idFromResourceName(undefined), null)
})

test('PMax doar pe feed: ordinea și câmpurile cerute', () => {
  const ops = buildLaunchOperations(growth)
  assert.deepEqual(ops.map(key), [
    'campaignBudgetOperation', 'campaignOperation', 'campaignCriterionOperation', 'campaignCriterionOperation',
    'assetGroupOperation', 'assetGroupListingGroupFilterOperation',
    'campaignConversionGoalOperation', 'campaignConversionGoalOperation',
  ])
  const budget = body(ops[0]).create
  assert.equal(budget.resourceName, 'customers/1234567890/campaignBudgets/-1')
  assert.equal(budget.amountMicros, '80000000')
  assert.equal(budget.explicitlyShared, false, 'PMax nu acceptă bugete partajate')
  assert.equal(budget.deliveryMethod, 'STANDARD')

  const c = body(ops[1]).create
  assert.equal(c.resourceName, 'customers/1234567890/campaigns/-2')
  assert.equal(c.advertisingChannelType, 'PERFORMANCE_MAX')
  assert.equal(c.campaignBudget, budget.resourceName)
  assert.deepEqual(c.shoppingSetting, { merchantId: '555', feedLabel: 'RO' })
  assert.deepEqual(c.maximizeConversionValue, { targetRoas: 4.5 })
  assert.equal(c.containsEuPoliticalAdvertising, 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING')
  assert.deepEqual(c.geoTargetTypeSetting, { positiveGeoTargetType: 'PRESENCE' })
  assert.equal(c.finalUrlSuffix, FINAL_URL_SUFFIX)
  assert.deepEqual(c.assetAutomationSettings, [{ assetAutomationType: 'FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_OUT' }])
  assert.equal(c.urlExpansionOptOut, undefined, 'câmpul vechi nu mai există în v26')
  assert.equal(c.campaignPriority, undefined)

  assert.deepEqual(body(ops[2]).create, { campaign: c.resourceName, location: { geoTargetConstant: 'geoTargetConstants/2642' } })
  assert.deepEqual(body(ops[3]).create, { campaign: c.resourceName, language: { languageConstant: 'languageConstants/1032' } })

  const group = body(ops[4]).create
  assert.equal(group.resourceName, 'customers/1234567890/assetGroups/-3')
  assert.equal(group.campaign, c.resourceName)
  assert.deepEqual(group.finalUrls, ['https://magazin.ro'])

  // Fără excluderi: o singură rădăcină „tot catalogul", ca în exemplul Google
  assert.deepEqual(body(ops[5]).create, { assetGroup: group.resourceName, type: 'UNIT_INCLUDED', listingSource: 'SHOPPING' })

  // Numai cumpărarea pe site e licitabilă; resursa folosește ID-ul temporar al campaniei
  assert.deepEqual(body(ops[6]), { update: { resourceName: 'customers/1234567890/campaignConversionGoals/-2~PURCHASE~WEBSITE', biddable: true }, updateMask: 'biddable' })
  assert.equal(body(ops[7]).update.biddable, false)
})

test('PMax fără ROAS țintă: licitare pe valoare, fără țintă', () => {
  const ops = buildLaunchOperations({ ...growth, targetRoas: null })
  assert.deepEqual(body(ops[1]).create.maximizeConversionValue, {})
})

test('excluderile: rădăcină SUBDIVISION, câte un nod exclus pe produs și „restul" inclus', () => {
  const ops = pmaxListingOps('1', '-3', { kind: 'exclude_items', item_ids: ['SKU-1', 'sku-1', 'B2'] })
  assert.equal(ops.length, 4, 'rădăcina + 2 produse (SKU-1 = sku-1) + restul')
  const [root, a, b, rest] = ops.map(o => body(o).create)
  assert.equal(root.type, 'SUBDIVISION')
  assert.equal(root.resourceName, 'customers/1/assetGroupListingGroupFilters/-3~-4')
  assert.equal(root.parentListingGroupFilter, undefined)
  assert.equal(a.type, 'UNIT_EXCLUDED')
  assert.deepEqual(a.caseValue, { productItemId: { value: 'sku-1' } })
  assert.equal(a.parentListingGroupFilter, root.resourceName)
  assert.equal(b.caseValue.productItemId.value, 'b2')
  assert.equal(rest.type, 'UNIT_INCLUDED')
  assert.deepEqual(rest.caseValue, { productItemId: {} })
  assert.ok(ops.every(o => body(o).create.listingSource === 'SHOPPING'))
})

test('segmentul de marjă mare: doar lista lui, restul exclus', () => {
  const ops = pmaxListingOps('1', '9', { kind: 'include_items', item_ids: ['a'] }).map(o => body(o).create)
  assert.equal(ops[1].type, 'UNIT_INCLUDED')
  assert.equal(ops[2].type, 'UNIT_EXCLUDED')
})

test('eticheta Hontrio: filtrul pe custom_label, cu indexul ca enum', () => {
  const ops = pmaxListingOps('1', '9', { kind: 'exclude_label', index: 3, value: 'hontrio_exclude' }).map(o => body(o).create)
  assert.deepEqual(ops[1].caseValue, { productCustomAttribute: { index: 'INDEX3', value: 'hontrio_exclude' } })
  assert.equal(ops[1].type, 'UNIT_EXCLUDED')
  assert.deepEqual(ops[2].caseValue, { productCustomAttribute: { index: 'INDEX3' } })
})

test('Shopping standard: campania, grupul, anunțul și arborele cu ofertă pe „restul"', () => {
  const ops = buildLaunchOperations({ ...starter, listing: { kind: 'exclude_items', item_ids: ['x'] }, negatives: [{ text: 'Lampi LED', match: 'PHRASE' }, { text: 'lampi  led', match: 'PHRASE' }] })
  assert.deepEqual(ops.map(key), [
    'campaignBudgetOperation', 'campaignOperation', 'campaignCriterionOperation', 'campaignCriterionOperation',
    'adGroupOperation', 'adGroupAdOperation', 'adGroupCriterionOperation', 'adGroupCriterionOperation', 'adGroupCriterionOperation',
  ])
  const c = body(ops[1]).create
  assert.equal(c.advertisingChannelType, 'SHOPPING')
  assert.deepEqual(c.shoppingSetting, { merchantId: '555', feedLabel: 'RO', campaignPriority: 1 })
  assert.deepEqual(c.manualCpc, { enhancedCpcEnabled: false })
  assert.deepEqual(c.networkSettings, { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false })
  assert.equal(c.containsEuPoliticalAdvertising, 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING')
  assert.equal(c.assetAutomationSettings, undefined)
  // Negativul pe brand: o singură dată (aceeași frază, scrisă diferit), potrivire de frază
  assert.deepEqual(body(ops[3]).create, { campaign: c.resourceName, negative: true, keyword: { text: 'lampi led', matchType: 'PHRASE' } })
  const ag = body(ops[4]).create
  assert.equal(ag.type, 'SHOPPING_PRODUCT_ADS')
  assert.equal(ag.cpcBidMicros, '790000')
  assert.deepEqual(body(ops[5]).create, { adGroup: ag.resourceName, status: 'ENABLED', ad: { shoppingProductAd: {} } })
  const [root, excluded, rest] = ops.slice(6).map(o => body(o).create)
  assert.equal(root.listingGroup.type, 'SUBDIVISION')
  assert.equal(root.resourceName, 'customers/1234567890/adGroupCriteria/-3~-4')
  assert.equal(excluded.negative, true)
  assert.equal(excluded.cpcBidMicros, undefined, 'un nod negativ n-are ofertă')
  assert.equal(excluded.listingGroup.parentAdGroupCriterion, root.resourceName)
  assert.equal(rest.negative, undefined)
  assert.equal(rest.cpcBidMicros, '790000')
  assert.deepEqual(rest.listingGroup.caseValue, { productItemId: {} })
})

test('Shopping fără excluderi: o singură unitate, cu oferta', () => {
  const ops = shoppingListingOps('1', '5', { kind: 'all' }, '100000').map(o => body(o).create)
  assert.equal(ops.length, 1)
  assert.deepEqual(ops[0].listingGroup, { type: 'UNIT' })
  assert.equal(ops[0].cpcBidMicros, '100000')
})

test('modificările de după lansare: măștile câmpurilor în camelCase', () => {
  assert.deepEqual(targetRoasOp('1', '2', 3.3), { campaignOperation: { update: { resourceName: 'customers/1/campaigns/2', maximizeConversionValue: { targetRoas: 3.3 } }, updateMask: 'maximizeConversionValue.targetRoas' } })
  assert.deepEqual(budgetOp('1', '7', 96, 10_000), { campaignBudgetOperation: { update: { resourceName: 'customers/1/campaignBudgets/7', amountMicros: '96000000' }, updateMask: 'amountMicros' } })
  assert.deepEqual(euDeclarationOps('1', ['3'])[0], { campaignOperation: { update: { resourceName: 'customers/1/campaigns/3', containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' }, updateMask: 'containsEuPoliticalAdvertising' } })
})

test('arborele vechi se scoate de la frunze spre rădăcină', () => {
  const ops = removeNodesOps([
    { resourceName: 'r', parent: null },
    { resourceName: 'a', parent: 'r' },
    { resourceName: 's', parent: 'r' },
    { resourceName: 's1', parent: 's' },
  ], 'assetGroupListingGroupFilterOperation')
  const order = ops.map(o => body(o).remove as string)
  assert.equal(order[0], 's1')
  assert.equal(order.at(-1), 'r')
  assert.ok(order.indexOf('s1') < order.indexOf('s'))
})

test('perioada campaniei: începutul și sfârșitul ca dată-oră Google, schimbarea sfârșitului', () => {
  const ops = buildLaunchOperations({ ...starter, startDateTime: startOfDay('2026-11-20'), endDateTime: endOfDay('2026-11-30') })
  const created = body(ops.find(o => key(o) === 'campaignOperation')!).create
  assert.equal(created.startDateTime, '2026-11-20 00:00:00')
  assert.equal(created.endDateTime, '2026-11-30 23:59:59')
  // Fără perioadă: câmpurile lipsesc (Google: de acum, fără sfârșit)
  const plain = body(buildLaunchOperations(starter).find(o => key(o) === 'campaignOperation')!).create
  assert.equal('startDateTime' in plain, false)
  assert.deepEqual(endDateOp('1', '22', endOfDay('2026-12-24')), {
    campaignOperation: { update: { resourceName: 'customers/1/campaigns/22', endDateTime: '2026-12-24 23:59:59' }, updateMask: 'endDateTime' },
  })
  // Golit = fără sfârșit
  assert.deepEqual(endDateOp('1', '22', null), { campaignOperation: { update: { resourceName: 'customers/1/campaigns/22' }, updateMask: 'endDateTime' } })
})
