import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandTerms, buildPlan, cpcCeilingOf, lossLimitOf, MIN_AOV_ORDERS, niceBudget, planForPage, reasonCounts, startBudget, type PlanInput } from '@/lib/campaigns/plan'
import { evaluateAudit } from '@/lib/google/audit'
import { MAX_LISTING_ITEMS } from '@/lib/google/operations'
import { auditRaw, offer, setup } from './fixtures'

// Planul campaniei: treapta, structura, plafonul pe click și oprirea de
// siguranță (din comanda medie, fără costuri), bugetul propus, excluderile
// după ID-ul din Merchant Center și pașii care blochează lansarea.

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
    offers: [offer('a'), offer('b'), offer('mine', { ads_mode: 'exclude' })],
    sales90: new Map([['a', { units: 10, revenue: 1000 }], ['b', { units: 5, revenue: 500 }]]),
    // Comanda medie 300, valoarea comenzii = 15/13 din produse
    orders90: { orders: 50, total: 15000, items: 13000, discount: 0, tax: 2600 },
    googleAds90: { orders: 0, total: 0 },
    googleAds30: { orders: 0, total: 0 },
    settings: { daily_budget: null, mode: 'approve', max_daily_budget: null },
    ...over,
  }
}

test('pornire: Shopping standard, plafon de 1% din comanda medie, oprire de siguranță în comenzi medii', () => {
  const p = buildPlan(input())
  assert.equal(p.stage.id, 'starter')
  assert.equal(p.stage.basis, 'google_ads')
  assert.equal(p.structure.type, 'shopping')
  assert.equal(p.economics.aov, 300)
  assert.equal(p.economics.aov_basis, 'orders')
  // 300 × 1% = 3: la o vânzare din 100 de clicuri, vânzarea își acoperă reclama
  assert.equal(p.structure.cpc_ceiling, 3)
  assert.equal(p.structure.cpc_ceiling_low, false)
  // O comandă medie fără nicio vânzare / trei comenzi medii cu vânzări sub cost
  assert.deepEqual(p.structure.loss_limit, { no_conversions: 300, low_roas: 900 })
  assert.equal(p.structure.merchant_id, '555')
  assert.deepEqual(p.blockers, [])
})

test('bugetul propus: o cincime din comanda medie, fără Shopping în cont; alegerea omului câștigă', () => {
  const p = buildPlan(input())
  assert.deepEqual(p.budget, { suggested: 60, basis: 'aov', chosen: null, daily: 60 })
  const chosen = buildPlan(input({ settings: { daily_budget: 25, mode: 'approve', max_daily_budget: null } }))
  assert.deepEqual(chosen.budget, { suggested: 60, basis: 'aov', chosen: 25, daily: 25 })
})

test('creștere: Performance Max fără țintă, iar bugetul propus e cât cheltuie contul acum pe Shopping/PMax', () => {
  const p = buildPlan(input({ audit: growthAudit }))
  assert.equal(p.stage.id, 'growth')
  assert.equal(p.structure.type, 'performance_max')
  assert.equal(p.structure.cpc_ceiling, null)
  // 105 lei în 30 de zile pe PMax → ~3,5 pe zi
  assert.deepEqual(p.budget, { suggested: 4, basis: 'history', chosen: null, daily: 4 })
  // ROAS-ul contului, doar ca informație: 540 ÷ 105
  assert.equal(p.history.roas30, 5.14)
})

test('fără audit: treapta din comenzile aduse de Google Ads, iar auditul devine pas de făcut', () => {
  const p = buildPlan(input({ audit: null, googleAds30: { orders: 20, total: 6000 } }))
  assert.equal(p.stage.id, 'growth')
  assert.equal(p.stage.basis, 'store')
  assert.deepEqual(p.blockers.map(b => b.id), ['audit'])
})

test('fără costuri nu se blochează nimic; fără comenzi, comanda medie vine din prețuri', () => {
  const p = buildPlan(input({ orders90: { orders: 0, total: 0, items: 0, discount: 0, tax: 0 }, sales90: new Map() }))
  assert.deepEqual(p.blockers, [])
  // Prețul mediu al produselor care pot rula (a și b, 100 fiecare)
  assert.equal(p.economics.aov, 100)
  assert.equal(p.economics.aov_basis, 'prices')
  assert.equal(p.structure.cpc_ceiling, 1)
  assert.deepEqual(p.structure.loss_limit, { no_conversions: 100, low_roas: 300 })
  assert.equal(p.budget.suggested, 20)
})

test('câteva comenzi pe site nu spun comanda medie: una mare, neplătită, nu umflă plafonul, oprirea și bugetul', () => {
  // Ca la primul client: o singură comandă de pe site în 90 de zile, de 2.043,80 lei, încă neplătită
  const one = buildPlan(input({ orders90: { orders: 1, total: 2043.8, items: 1700, discount: 0, tax: 354.71 } }))
  assert.equal(one.economics.aov, 100)
  assert.equal(one.economics.aov_basis, 'prices')
  // Nici raportul total / produse dintr-o singură comandă nu se folosește
  assert.equal(one.economics.value_ratio, 1)
  assert.equal(one.structure.cpc_ceiling, 1)
  assert.deepEqual(one.structure.loss_limit, { no_conversions: 100, low_roas: 300 })
  assert.equal(one.budget.suggested, 20)
  // De la MIN_AOV_ORDERS comenzi, comanda medie vine din ele
  const enough = buildPlan(input({ orders90: { orders: MIN_AOV_ORDERS, total: MIN_AOV_ORDERS * 250, items: MIN_AOV_ORDERS * 200, discount: 0, tax: 0 } }))
  assert.equal(enough.economics.aov, 250)
  assert.equal(enough.economics.aov_basis, 'orders')
  assert.equal(enough.economics.value_ratio, 1.25)
  // Fără comenzi și fără produse care pot rula, nu se poate socoti
  const none = buildPlan(input({ orders90: { orders: 0, total: 0, items: 0, discount: 0, tax: 0 }, offers: [offer('x', { available: false })], sales90: new Map() }))
  assert.equal(none.economics.aov, null)
  assert.equal(none.economics.aov_basis, null)
})

test('excluderile: alegerea omului și pilotul, după ID-ul din Merchant Center', () => {
  const p = buildPlan(input({
    offers: [
      offer('a'),
      offer('mine', { ads_mode: 'exclude' }),
      offer('auto', { ads_auto_reason: 'no_sales' }),
      offer('loses', { ads_auto_reason: 'unprofitable' }),
      // Omul l-a inclus: pilotul nu-l mai scoate
      offer('kept', { ads_mode: 'include', ads_auto_reason: 'unprofitable' }),
      offer('gone', { available: false }),
    ],
  }))
  const reason = (id: string) => p.offers.find(o => o.offer_id === id)!.reason
  assert.equal(reason('a'), null)
  assert.equal(reason('mine'), 'manual')
  assert.equal(reason('auto'), 'ads_no_sales')
  assert.equal(reason('loses'), 'ads_unprofitable')
  assert.equal(reason('kept'), null)
  assert.equal(reason('gone'), 'out_of_stock')
  // Epuizatul nu se exclude în campanie: Google oricum nu-l arată
  assert.deepEqual([...p.exclusions.item_ids].sort(), ['auto', 'loses', 'mine'])
  assert.equal(p.exclusions.unmatched, 0)
  assert.equal(p.exclusions.mode, 'items')
})

test('WooCommerce: excluderea merge pe ID-ul din feed (gla_…); ofertele nepotrivite se numără', () => {
  const p = buildPlan(input({
    setup: setup({ platform: 'woocommerce', platformName: 'WooCommerce', googleStatusKnown: false }),
    offers: [offer('5', { ads_mode: 'exclude', merchant_offer_id: 'gla_5' }), offer('6', { ads_mode: 'exclude' }), offer('7')],
  }))
  assert.deepEqual(p.exclusions.item_ids, ['gla_5'])
  assert.equal(p.exclusions.unmatched, 1)
})

test('auditul blochează lansarea: Merchant nelegat, conversie fără valoare la ambele trepte', () => {
  const noLink = evaluateAudit(auditRaw({ productLinks: [] }), ctx)
  assert.ok(buildPlan(input({ audit: noLink })).blockers.some(b => b.id === 'merchant_not_linked'))
  const noValueRaw = auditRaw()
  noValueRaw.conversionActions[0].conversionAction!.valueSettings = { alwaysUseDefaultValue: true }
  const noValue = evaluateAudit(noValueRaw, ctx)
  // Și la pornire: oprirea de siguranță și produsele se judecă după valoarea vânzărilor
  assert.ok(buildPlan(input({ audit: noValue })).blockers.some(b => b.id === 'purchase_no_value'), 'la pornire')
  const noValueGrowth = { ...noValue, history: growthAudit.history }
  assert.ok(buildPlan(input({ audit: noValueGrowth })).blockers.some(b => b.id === 'purchase_no_value'), 'la creștere')
  // Un audit salvat înainte (conversia fără valoare era doar avertisment) blochează la fel
  const oldAudit = { ...noValue, checks: noValue.checks.map(c => ({ ...c, level: 'warning' as const })) }
  assert.equal(buildPlan(input({ audit: oldAudit })).blockers.filter(b => b.id === 'purchase_no_value').length, 1)
})

test('treapta numără cumpărările: un cont cu multe conversii „adaugă în coș" rămâne la pornire', () => {
  const carts = { ...growthAudit, history: { ...growthAudit.history, purchase_conversions30: 9 } }
  const p = buildPlan(input({ audit: carts }))
  assert.equal(p.stage.id, 'starter')
  assert.equal(p.stage.conversions30, 9)
  assert.equal(buildPlan(input({ audit: { ...carts, history: { ...carts.history, purchase_conversions30: 15 } } })).stage.id, 'growth')
})

test('prea multe excluderi pentru lista din PMax: eticheta Hontrio sau pas de făcut', () => {
  const offers = Array.from({ length: 1000 }, (_, i) => offer(`x${i}`, { ads_mode: 'exclude' }))
  const withLabel = buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...offers] }))
  assert.equal(withLabel.exclusions.mode, 'label')
  const noLabel = buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...offers], merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: null } }))
  assert.equal(noLabel.exclusions.mode, 'too_many')
  assert.ok(noLabel.blockers.some(b => b.id === 'too_many_exclusions'))
  // Shopping standard duce 20.000 de noduri: la pornire rămâne lista
  assert.equal(buildPlan(input({ offers: [offer('a'), ...offers] })).exclusions.mode, 'items')
})

test('Performance Max ales de om: de la lansare, fără plafon pe click, cu limitele PMax la excluderi', () => {
  const settings = { daily_budget: null, mode: 'approve' as const, max_daily_budget: null, campaign_type: 'performance_max' as const }
  const p = buildPlan(input({ settings }))
  // Treapta rămâne a contului (sub 15 cumpărări); tipul e alegerea omului
  assert.equal(p.stage.id, 'starter')
  assert.equal(p.structure.type, 'performance_max')
  assert.equal(p.settings.campaign_type, 'performance_max')
  assert.equal(p.structure.cpc_ceiling, null)
  assert.equal(p.structure.cpc_ceiling_low, false)
  // Oprirea de siguranță rămâne
  assert.deepEqual(p.structure.loss_limit, { no_conversions: 300, low_roas: 900 })
  // Lista din PMax ține cel mult 1.000 de produse: peste ele, eticheta Hontrio sau pas de făcut, chiar și la pornire
  const offers = Array.from({ length: 1000 }, (_, i) => offer(`x${i}`, { ads_mode: 'exclude' }))
  assert.equal(buildPlan(input({ settings, offers: [offer('a'), ...offers] })).exclusions.mode, 'label')
  const noLabel = buildPlan(input({ settings, offers: [offer('a'), ...offers], merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: null } }))
  assert.equal(noLabel.exclusions.mode, 'too_many')
  assert.ok(noLabel.blockers.some(b => b.id === 'too_many_exclusions'))
  // Textul pasului spune că „Automat" n-are limita asta
  assert.deepEqual(noLabel.blockers.find(b => b.id === 'too_many_exclusions'), {
    id: 'too_many_exclusions', href: '/campaigns?tab=plan', external: false, variant: 'chosen', params: { count: 1000, limit: MAX_LISTING_ITEMS },
  })
  // Automat (sau nimic ales): după treaptă, ca înainte
  assert.equal(buildPlan(input()).settings.campaign_type, 'auto')
  assert.equal(buildPlan(input({ settings: { ...settings, campaign_type: 'auto' } })).structure.type, 'shopping')
  assert.equal(buildPlan(input({ audit: growthAudit, settings: { ...settings, campaign_type: 'auto' } })).structure.type, 'performance_max')
})

test('PMax cu grupe lansate: lista lasă afară și produsele grupelor, iar eticheta nu ajută', () => {
  // 600 de produse scoase de om și 500 într-o grupă lansată: 1.100 de ID-uri, peste cele 990 din PMax
  const out = Array.from({ length: 600 }, (_, i) => offer(`x${i}`, { ads_mode: 'exclude' }))
  const inGroup = Array.from({ length: 500 }, (_, i) => offer(`g${i}`))
  const groups = { assigned: new Map(inGroup.map(o => [o.offer_id, 'grupa'])), live: new Set(['grupa']) }
  const offers = [offer('a'), ...out, ...inGroup]
  // Creștere (Automat = PMax): eticheta există, dar cu grupe lansate arborele merge doar pe listă (ca la lansare)
  const growth = buildPlan(input({ audit: growthAudit, offers, groups }))
  assert.equal(growth.exclusions.mode, 'too_many')
  assert.equal(growth.exclusions.count, 600)
  const blocker = growth.blockers.find(b => b.id === 'too_many_exclusions')!
  assert.equal(blocker.variant, 'groups')
  assert.deepEqual(blocker.params, { count: 1100, limit: MAX_LISTING_ITEMS })
  // Sub 15, cu PMax ales: textul trimite la „Automat"
  const settings = { daily_budget: null, mode: 'approve' as const, max_daily_budget: null, campaign_type: 'performance_max' as const }
  assert.equal(buildPlan(input({ offers, groups, settings })).blockers.find(b => b.id === 'too_many_exclusions')?.variant, 'chosen')
  // Shopping standard (Automat, sub 15) duce lista întreagă
  assert.equal(buildPlan(input({ offers, groups })).exclusions.mode, 'items')
  // Fără grupe lansate, cele 600 de excluderi încap în listă
  assert.equal(buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...out] })).exclusions.mode, 'items')
})

test('numele magazinului devine negativ doar când contul are o campanie Search', () => {
  assert.deepEqual(buildPlan(input()).structure.brand_negatives, [])
  const withSearch = { ...starterAudit, search_active: true }
  assert.deepEqual(buildPlan(input({ audit: withSearch })).structure.brand_negatives, ['lampi led'])
  assert.deepEqual(brandTerms('Casa Lumen S.R.L.', 'casalumen.ro'), ['casa lumen', 'casalumen'])
  assert.deepEqual(brandTerms(null, 'https://ab.ro'), [])
  // Magazinul găzduit la platformă: domeniul este al platformei, nu brandul magazinului
  assert.deepEqual(brandTerms('MH Tools', 'https://www.edinio.com/itp-blk'), ['mh tools'])
  assert.deepEqual(brandTerms('Casa Lumen', 'casa-lumen.myshopify.com'), ['casa lumen'])
  assert.deepEqual(brandTerms(null, 'https://magazin.gomag.ro'), [])
  assert.deepEqual(brandTerms('MH Tools', 'https://mhtools.ro'), ['mh tools', 'mhtools'])
})

test('unitățile din comanda medie: plafonul pe click, oprirea, bugetul de start', () => {
  assert.equal(cpcCeilingOf(250), 2.5)
  // Sub 5 bani pe click, campania abia ar primi trafic
  assert.equal(cpcCeilingOf(4), 0.04)
  assert.equal(buildPlan(input({ orders90: { orders: 10, total: 40, items: 40, discount: 0, tax: 0 } })).structure.cpc_ceiling_low, true)
  assert.equal(cpcCeilingOf(null), null)
  assert.deepEqual(lossLimitOf(250), { no_conversions: 250, low_roas: 750 })
  assert.equal(lossLimitOf(0), null)
  assert.equal(startBudget(250), 50)
  assert.equal(startBudget(null), null)
  assert.equal(niceBudget(137), 140)
  assert.equal(niceBudget(23), 25)
  assert.equal(niceBudget(0.3), 1)
})

test('produsele din Merchant Center care nu sunt ale magazinului se exclud; pe etichetă devin pas de făcut', () => {
  const p = buildPlan(input({ merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: 4, foreign_ids: ['old-1', 'old-2', 'A'] } }))
  // „A” este ID-ul unei oferte a magazinului (litere mari în Merchant Center): nu e străin
  assert.deepEqual([...p.exclusions.item_ids].sort(), ['mine', 'old-1', 'old-2'])
  assert.equal(p.exclusions.foreign, 2)
  assert.equal(p.exclusions.mode, 'items')
  assert.ok(!p.blockers.some(b => b.id === 'merchant_foreign'))

  // Peste 990 de excluderi la Performance Max, eticheta Hontrio nu ajunge la produsele străine
  const many = Array.from({ length: 1000 }, (_, i) => offer(`x${i}`, { ads_mode: 'exclude' }))
  const label = buildPlan(input({ audit: growthAudit, offers: [offer('a'), ...many], merchant: { id: '555', feed_label: 'RO', statuses_known: true, label_index: 4, foreign_ids: ['old-1'] } }))
  assert.equal(label.exclusions.mode, 'label')
  const b = label.blockers.find(x => x.id === 'merchant_foreign')
  assert.ok(b)
  assert.equal(b!.params?.count, 1)

  // Fără produse străine nu se schimbă nimic
  const clean = buildPlan(input())
  assert.equal(clean.exclusions.foreign, 0)
})

test('cifrele planului: câte oferte pe fiecare motiv, și planul fără listă pentru Dashboard', () => {
  const p = buildPlan(input({ offers: [offer('a'), offer('b'), offer('mine', { ads_mode: 'exclude' }), offer('gone', { available: false })] }))
  assert.equal(p.summary.offers, 4)
  assert.deepEqual(p.summary.by_reason, reasonCounts(p.offers))
  assert.equal(p.summary.by_reason.included, 2)
  assert.equal(p.summary.by_reason.manual, 1)
  assert.equal(p.summary.by_reason.out_of_stock, 1)
  assert.equal(p.exclusions.count, p.exclusions.item_ids.length)

  // Ce poate alege omul într-o grupă, din tot catalogul
  assert.equal(p.summary.facets.price_min, Math.min(...p.offers.map(o => o.price).filter(x => x > 0)))
  assert.equal(p.summary.facets.price_max, Math.max(...p.offers.map(o => o.price)))
  assert.equal(p.summary.facets.on_sale, p.offers.filter(o => o.on_sale).length)
  assert.equal(p.summary.facets.categories.reduce((s, [, n]) => s + n, 0), p.offers.filter(o => o.category).length)

  // Spre pagină: fără oferte și fără ID-urile excluse (la un catalog mare, zeci de MB), dar cu aceleași cifre
  const lite = planForPage(p)
  assert.deepEqual(lite.offers, [])
  assert.deepEqual(lite.exclusions.item_ids, [])
  assert.equal(lite.exclusions.count, p.exclusions.count)
  assert.deepEqual(lite.summary, p.summary)
  assert.deepEqual(lite.counts, p.counts)
})
