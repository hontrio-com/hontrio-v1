import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { McProduct } from '@/lib/merchant/api'
import { dominantFeed, foreignItems, freeLabelIndex, matchProducts, normalizeLink, shoppingIssues, shoppingStatus, type OfferRef } from '@/lib/merchant/match'
import { wantedLabel } from '@/lib/merchant/sync'

// Potrivirea produselor din Merchant Center cu ofertele magazinului, pe
// formatele de ID ale aplicațiilor de feed, și starea lor la Shopping.

const mc = (offerId: string, over: Partial<McProduct> = {}): McProduct => ({
  name: `accounts/1/products/ro~RO~${offerId}`, offerId, contentLanguage: 'ro', feedLabel: 'RO', dataSource: 'accounts/1/dataSources/10', ...over,
})
const ref = (offer_id: string, over: Partial<OfferRef> = {}): OfferRef => ({ offer_id, external_product_id: offer_id, sku: null, gtin: null, url: null, ...over })

test('Edinio: ID-ul ofertei e chiar ID-ul din Merchant Center', () => {
  const m = matchProducts('edinio', [ref('p1'), ref('p2_v3', { external_product_id: 'p2' })], [mc('p1'), mc('P2_V3')])
  assert.equal(m.get('p1')!.offerId, 'p1')
  assert.equal(m.get('p2_v3')!.offerId, 'P2_V3', 'fără să țină cont de litere mari')
})

test('WooCommerce: gla_{id}, woocommerce_gpf_{id}, SKU', () => {
  const m = matchProducts('woocommerce', [ref('5'), ref('6'), ref('7', { sku: 'LMP-7' })], [mc('gla_5'), mc('woocommerce_gpf_6'), mc('lmp-7')])
  assert.equal(m.get('5')!.offerId, 'gla_5')
  assert.equal(m.get('6')!.offerId, 'woocommerce_gpf_6')
  assert.equal(m.get('7')!.offerId, 'lmp-7')
})

test('Shopify: shopify_{ȚARĂ}_{produs}_{variantă} după variantă', () => {
  const m = matchProducts('shopify', [ref('456', { external_product_id: '123' })], [mc('shopify_RO_123_456'), mc('shopify_RO_123_999')])
  assert.equal(m.get('456')!.offerId, 'shopify_RO_123_456')
})

test('link și GTIN, doar pe ce a rămas; linkul doar la produsele simple', () => {
  const products = [
    mc('x1', { productAttributes: { link: 'https://www.magazin.ro/produs/lampa/?utm=x' } }),
    mc('x2', { productAttributes: { gtins: ['05941234567890'] } }),
    mc('x3', { productAttributes: { link: 'https://magazin.ro/produs/varianta' } }),
  ]
  const m = matchProducts('woocommerce', [
    ref('1', { url: 'http://magazin.ro/produs/lampa' }),
    ref('2', { gtin: '5941234567890' }),
    // Variantă: împarte pagina cu produsul, deci linkul nu o identifică
    ref('3', { external_product_id: '30', url: 'https://magazin.ro/produs/varianta' }),
  ], products)
  assert.equal(m.get('1')!.offerId, 'x1')
  assert.equal(m.get('2')!.offerId, 'x2')
  assert.equal(m.has('3'), false)
  assert.equal(normalizeLink('https://WWW.Magazin.ro/a%C8%99a/'), 'magazin.ro/așa')
})

test('același produs în mai multe feeduri: se ia eticheta magazinului; un produs se potrivește o singură dată', () => {
  const m = matchProducts('edinio', [ref('p1')], [mc('p1', { feedLabel: 'MD', name: 'a' }), mc('p1', { feedLabel: 'RO', name: 'b' })], 'RO')
  assert.equal(m.get('p1')!.feedLabel, 'RO')
  const once = matchProducts('woocommerce', [ref('1', { sku: 'S' }), ref('2', { sku: 'S' })], [mc('s')])
  assert.equal(once.size, 1)
})

test('starea la Shopping în țara campaniei și problemele care contează', () => {
  const p = mc('a', {
    productStatus: {
      destinationStatuses: [
        { reportingContext: 'SHOPPING_ADS', approvedCountries: ['RO'], disapprovedCountries: ['MD'] },
        { reportingContext: 'FREE_LISTINGS', disapprovedCountries: ['RO'] },
      ],
      itemLevelIssues: [
        { code: 'image_too_small', severity: 'DEMOTED', reportingContext: 'SHOPPING_ADS', description: 'Image too small', applicableCountries: ['RO'] },
        { code: 'missing_gtin', severity: 'NOT_IMPACTED', reportingContext: 'SHOPPING_ADS', description: 'Missing GTIN' },
        { code: 'policy', severity: 'DISAPPROVED', reportingContext: 'SHOPPING_ADS', description: 'Policy', applicableCountries: ['MD'] },
      ],
    },
  })
  assert.equal(shoppingStatus(p, 'RO'), 'active')
  assert.equal(shoppingStatus(p, 'MD'), 'disapproved')
  assert.equal(shoppingStatus(mc('b'), 'RO'), null)
  assert.deepEqual(shoppingIssues(p, 'RO').map(i => i.code), ['image_too_small'])
})

test('eticheta liberă pentru Hontrio și feedul dominant', () => {
  assert.equal(freeLabelIndex([mc('a', { productAttributes: { customLabel0: 'x', customLabel1: 'y' } }), mc('b')]), 2)
  assert.equal(freeLabelIndex([mc('a', { productAttributes: { customLabel0: '1', customLabel1: '1', customLabel2: '1', customLabel3: '1', customLabel4: '1' } })]), null)
  assert.deepEqual(dominantFeed([mc('a'), mc('b'), mc('c', { feedLabel: 'MD' })]), { feedLabel: 'RO', contentLanguage: 'ro' })
})

test('eticheta din sursa suplimentară: pusă, scoasă, sau lăsată cum e de cine nu știe ce rulează', () => {
  const labels = new Map([['a', 'hontrio_exclude']])
  assert.equal(wantedLabel(labels, 2, 'a', null), 'hontrio_exclude')
  assert.equal(wantedLabel(labels, 2, 'b', 'hontrio_exclude'), null, 'o ofertă care nu mai e exclusă își pierde eticheta')
  assert.equal(wantedLabel(null, 2, 'a', 'hontrio_exclude'), null, 'niciun arbore n-o mai folosește: se scoate')
  assert.equal(wantedLabel(labels, null, 'a', null), null, 'fără custom_label liber nu se pune nimic')
  // 'keep': o reîmprospătare care nu știe ce campanii rulează nu atinge etichetele
  assert.equal(wantedLabel('keep', 2, 'a', 'hontrio_exclude'), 'hontrio_exclude')
  assert.equal(wantedLabel('keep', 2, 'b', null), null)
})

test('produsele străine din Merchant Center: aceeași etichetă de feed și pot rula în țară', () => {
  const status = (approved: string[] = [], pending: string[] = [], disapproved: string[] = []): Partial<McProduct> => ({
    productStatus: { destinationStatuses: [{ reportingContext: 'SHOPPING_ADS', approvedCountries: approved, pendingCountries: pending, disapprovedCountries: disapproved }] },
  })
  const products = [
    mc('own-1', status(['RO'])),
    mc('old-site-1', status(['RO'])),
    mc('old-site-2', status([], ['RO'])),
    mc('old-site-3', status([], [], ['RO'])),
    mc('other-feed', { ...status(['RO']), feedLabel: 'MD' }),
    mc('other-country', status(['BG'])),
    mc('no-status'),
  ]
  const own = new Set(['own-1'])
  // Doar cele care ar intra în campanie: eticheta RO, aprobate sau în verificare în RO
  assert.deepEqual(foreignItems(products, own, 'RO', 'RO'), ['old-site-1', 'old-site-2'])
  // Eticheta de feed se compară fără majuscule și spații
  assert.deepEqual(foreignItems(products, own, ' ro ', 'RO'), ['old-site-1', 'old-site-2'])
  // Fără etichetă de feed în campanie intră toate etichetele
  assert.deepEqual(foreignItems(products, own, null, 'RO').sort(), ['old-site-1', 'old-site-2', 'other-feed'])
  // Un cont doar cu produsele magazinului: nimic străin
  assert.deepEqual(foreignItems([mc('own-1', status(['RO']))], own, 'RO', 'RO'), [])
})
