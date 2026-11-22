import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hontrioCampaignId, isHontrioUtm, salesSource } from '@/lib/commerce/attribution'

// De unde știe Hontrio ce vânzări au adus campaniile lui: sursa comenzii din
// magazin („hontrio-<ID>”), iar la Gomag, care n-o dă, conversiile Google Ads.

test('sursa „hontrio-<ID>” și numărul campaniei din ea', () => {
  assert.equal(isHontrioUtm('hontrio-24490539576'), true)
  assert.equal(isHontrioUtm(' Hontrio-123 '), true)
  assert.equal(isHontrioUtm('120250517787520691'), false)
  assert.equal(isHontrioUtm(null), false)
  assert.equal(hontrioCampaignId('hontrio-24490539576'), '24490539576')
  assert.equal(hontrioCampaignId('HONTRIO-42'), '42')
  assert.equal(hontrioCampaignId('hontrio-'), null)
  assert.equal(hontrioCampaignId('hontrio-abc'), null)
  assert.equal(hontrioCampaignId(undefined), null)
})

test('Gomag numără din Google Ads, celelalte platforme din comenzile magazinului', () => {
  assert.equal(salesSource('gomag'), 'google_ads')
  for (const p of ['edinio', 'woocommerce', 'shopify', 'merchantpro', 'opencart']) assert.equal(salesSource(p), 'store_orders')
  assert.equal(salesSource(null), 'store_orders')
})
