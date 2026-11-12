import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { bearerMatches, safeEqual } from '@/lib/security/compare'
import { isShopDomain, oauthHmac, oauthMessage, verifyOAuthHmac, verifyWebhookHmac, webhookHmac } from '@/lib/shopify/hmac'

// Semnăturile Shopify și secretele comparate în timp constant.

const SECRET = 'hush'

test('safeEqual și bearerMatches', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'abcd'), false)
  assert.equal(safeEqual(null, 'abc'), false)
  assert.equal(bearerMatches('Bearer s3cret', 's3cret'), true)
  assert.equal(bearerMatches('Bearer s3cre', 's3cret'), false)
  assert.equal(bearerMatches(null, 's3cret'), false)
  // Fără secret configurat, nimic nu trece (nici un antet gol)
  assert.equal(bearerMatches('Bearer ', ''), false)
  assert.equal(bearerMatches('Bearer undefined', undefined), false)
})

test('întoarcerea din OAuth: mesajul sortat, fără hmac, verificat în timp constant', () => {
  const params = new URLSearchParams({ state: 'abc', shop: 'magazin.myshopify.com', code: '0907a6', timestamp: '1337178173', host: 'YWRtaW4=' })
  assert.equal(oauthMessage(params), 'code=0907a6&host=YWRtaW4=&shop=magazin.myshopify.com&state=abc&timestamp=1337178173')
  const expected = createHmac('sha256', SECRET).update(oauthMessage(params)).digest('hex')
  assert.equal(oauthHmac(params, SECRET), expected)

  const signed = new URLSearchParams(params)
  signed.set('hmac', expected)
  assert.equal(verifyOAuthHmac(signed, SECRET), true)
  assert.equal(verifyOAuthHmac(new URLSearchParams(signed.toString().replace('abc', 'abd')), SECRET), false)
  signed.set('hmac', expected.slice(0, 10))
  assert.equal(verifyOAuthHmac(signed, SECRET), false)
  assert.equal(verifyOAuthHmac(params, SECRET), false) // fără hmac
  signed.set('hmac', expected)
  assert.equal(verifyOAuthHmac(signed, ''), false) // fără secret
})

test('webhook-urile: HMAC base64 peste corpul brut', () => {
  const body = '{"shop_domain":"magazin.myshopify.com","shop_id":1}'
  const header = createHmac('sha256', SECRET).update(body, 'utf8').digest('base64')
  assert.equal(webhookHmac(body, SECRET), header)
  assert.equal(verifyWebhookHmac(body, header, SECRET), true)
  assert.equal(verifyWebhookHmac(body.replace('1}', '2}'), header, SECRET), false)
  assert.equal(verifyWebhookHmac(body, 'scurt', SECRET), false)
  assert.equal(verifyWebhookHmac(body, null, SECRET), false)
  assert.equal(verifyWebhookHmac(body, header, undefined), false)
})

test('domeniul unui magazin Shopify', () => {
  assert.equal(isShopDomain('magazin-1.myshopify.com'), true)
  for (const bad of ['magazin.myshopify.com.evil.ro', 'evil.ro', '-x.myshopify.com', 'MAGAZIN.myshopify.com', 'a.b.myshopify.com', 42]) {
    assert.equal(isShopDomain(bad), false, String(bad))
  }
})
