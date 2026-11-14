import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Ctx } from '@/lib/commerce/rows'
import { StoreApiError } from '@/lib/commerce/http'
import { extractEnvelope, hasMore, OpenCartApi } from '@/lib/opencart/api'
import { attributionOf, categoryOf, gtinOf, lineRows, offerRows, orderRow, orderState, soldProductIds, statusMap, storeFields } from '@/lib/opencart/mapping'
import { openCartAddress, parseOpenCartKeys } from '@/lib/opencart/connect'
import type { OcInfo, OcOrder, OcProduct } from '@/lib/opencart/types'
import { json, stubNetwork, text } from './store-api-stub'

// Partea Hontrio a conectorului OpenCart, pe contractul extensiei
// (docs/integrari/OPENCART.md): produsele, comenzile cu sumele OpenCart
// (prețuri fără taxe + rânduri de total), sursa salvată de extensie.

const ctx: Ctx = { storeId: 's1', userId: 'u1', currency: 'RON' }
const SYNCED = '2026-11-14T12:00:00.000Z'
const KEY = 'a'.repeat(48)

const STATUSES = statusMap([
  { id: 1, name: 'Pending', processing: false, complete: false },
  { id: 2, name: 'Processing', processing: true, complete: false },
  { id: 3, name: 'Shipped', processing: true, complete: false },
  { id: 5, name: 'Complete', processing: false, complete: true },
  { id: 7, name: 'Canceled', processing: false, complete: false },
  { id: 9, name: 'Canceled Reversal', processing: false, complete: false },
  { id: 10, name: 'Failed', processing: false, complete: false },
  { id: 11, name: 'Refunded', processing: false, complete: false },
  { id: 13, name: 'Chargeback', processing: false, complete: false },
  { id: 16, name: 'Voided', processing: false, complete: false },
  { id: 17, name: 'Expediată', processing: false, complete: false },
])

const PRODUCT: OcProduct = {
  product_id: 42, master_id: 0, variant: null, name: 'Lampă de birou Nordic', model: 'LMP-42', sku: 'LMP-42-NEGRU',
  upc: null, ean: '5941234567890', jan: null, isbn: null, mpn: 'NRD-42',
  url: 'https://magazin.ro/lampa-de-birou-nordic', image: 'https://magazin.ro/image/catalog/lampa.jpg', manufacturer: 'Nordic',
  categories: [['Iluminat', 'Lămpi de birou'], ['Promoții']], price: 121, price_net: 100, regular_price: 145.2, regular_price_net: 120,
  special_ends: '2026-12-01', tax_rate: 21, quantity: 7, subtract: true, available: true, stock_status: null,
  date_added: '2025-02-01T09:00:00+02:00', date_modified: '2026-11-10T12:30:00+02:00',
}

const ORDER: OcOrder = {
  order_id: 1001, invoice: 'INV-2026-00012', status_id: 5, status: 'Complete',
  date_added: '2026-11-12T10:15:00+02:00', date_modified: '2026-11-13T09:00:00+02:00',
  currency: 'RON', currency_code: 'EUR', currency_value: 0.2, total: 245.5,
  totals: [
    { code: 'sub_total', title: 'Sub-Total', value: 200 }, { code: 'shipping', title: 'Curier', value: 15 },
    { code: 'coupon', title: 'Cupon (TOAMNA10)', value: -10 }, { code: 'tax', title: 'TVA 21%', value: 40.5 }, { code: 'total', title: 'Total', value: 245.5 },
  ],
  payment_method: 'Plata la livrare', payment_code: 'cod', shipping_method: 'Curier', country: 'RO', coupon: 'TOAMNA10',
  marketing_id: 0, tracking: null,
  products: [{ order_product_id: 7, product_id: 42, master_id: 0, name: 'Lampă de birou Nordic', model: 'LMP-42', quantity: 2, price: 100, tax: 21, total: 200, options: [{ name: 'Culoare', value: 'Negru' }] }],
  source: {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'hontrio-123', utm_term: null, utm_content: null,
    gclid: 'Cj0KCQ', gbraid: null, wbraid: null, referrer: 'https://www.google.com/search?q=lampa', landing_path: '/lampa-de-birou-nordic',
    captured_at: '2026-11-12T10:02:11+02:00',
  },
}

test('produsul: prețul cu taxe, prețul fără special, codul de bare, categoria, data în UTC', () => {
  const [o] = offerRows(ctx, PRODUCT, SYNCED)
  assert.equal(o.offer_id, '42')
  assert.equal(o.external_product_id, '42')
  assert.equal(o.item_group_id, null)
  assert.equal(o.price, 121)
  assert.equal(o.compare_at_price, 145.2)
  assert.equal(o.sku, 'LMP-42-NEGRU')
  assert.equal(o.gtin, '5941234567890')
  assert.equal(o.mpn, 'NRD-42')
  assert.equal(o.brand, 'Nordic')
  assert.equal(o.category, 'Lămpi de birou')
  assert.equal(o.stock, 7)
  assert.equal(o.available, true)
  assert.equal(o.currency, 'RON')
  assert.equal(o.source_updated_at, '2026-11-10T10:30:00.000Z')
})

test('varianta OpenCart 4 (master_id), stoc nefolosit, fără preț, coduri de bare', () => {
  const [v] = offerRows(ctx, { ...PRODUCT, product_id: 43, master_id: 42, variant: [{ name: 'Culoare', value: 'Alb' }, { name: 'Mărime', value: 'M' }] }, SYNCED)
  assert.equal(v.offer_id, '43')
  assert.equal(v.external_product_id, '42')
  assert.equal(v.item_group_id, '42')
  assert.equal(v.title, 'Lampă de birou Nordic - Alb / M')
  assert.equal(v.variant_title, 'Alb / M')
  const [noStock] = offerRows(ctx, { ...PRODUCT, subtract: false, sku: null, regular_price: null }, SYNCED)
  assert.equal(noStock.stock, null)
  assert.equal(noStock.sku, 'LMP-42', 'modelul când nu e SKU')
  assert.equal(noStock.compare_at_price, null)
  assert.deepEqual(offerRows(ctx, { ...PRODUCT, price: 0 }, SYNCED), [])
  assert.equal(gtinOf({ ean: 'abc', upc: '012345678905', jan: null, isbn: null }), '012345678905')
  assert.equal(gtinOf({ ean: '594-1234-567890', upc: null, jan: null, isbn: null }), '5941234567890')
  assert.equal(gtinOf({ ean: '', upc: null, jan: null, isbn: '123' }), null)
  assert.equal(categoryOf({ categories: [] }), null)
})

test('comanda: sumele cu taxe din prețurile fără taxe și rândurile de total', () => {
  const row = orderRow(ctx, ORDER, SYNCED, STATUSES)!
  assert.equal(row.external_id, '1001')
  assert.equal(row.order_number, '1001')
  assert.equal(row.placed_at, '2026-11-12T08:15:00.000Z')
  assert.equal(row.state, 'fulfilled')
  assert.equal(row.status, 'Complete')
  assert.equal(row.currency, 'RON', 'sumele sunt în moneda magazinului, oricare a fost moneda clientului')
  assert.equal(row.subtotal, 242, '(100 + 21) × 2')
  assert.equal(row.tax, 40.5)
  // TVA-ul produselor e 42; rândul de taxe e 40,5 (cuponul a scăzut taxa): transportul rămâne 15
  assert.equal(row.shipping, 15)
  assert.equal(row.discount, 11.5)
  assert.equal(row.fees, 0)
  assert.equal(Math.round((row.subtotal + row.shipping + row.fees - row.discount) * 100) / 100, row.total)
  assert.equal(row.discount_code, 'TOAMNA10')
  assert.equal(row.payment_method, 'cod')
  assert.equal(row.payment_status, null)
  assert.equal(row.channel, 'store')
  assert.equal(row.country, 'RO')
  assert.deepEqual([row.utm_source, row.utm_medium, row.utm_campaign, row.gclid], ['google', 'cpc', 'hontrio-123', 'Cj0KCQ'])
  assert.equal(row.attribution.referrer, 'https://www.google.com')
  assert.equal(row.attribution.source_type, 'utm')
  const [line] = lineRows('o1', 's1', ORDER, SYNCED)
  assert.deepEqual([line.offer_id, line.external_product_id, line.quantity, line.unit_price, line.variant_title], ['42', '42', 2, 121, 'Negru'])
  assert.deepEqual(soldProductIds(ORDER), ['42'])
})

test('transportul cu TVA: taxa care nu e a produselor merge la transport', () => {
  const order: OcOrder = {
    ...ORDER, coupon: null, total: 260.15,
    totals: [{ code: 'sub_total', title: '', value: 200 }, { code: 'shipping', title: '', value: 15 }, { code: 'tax', title: '', value: 45.15 }, { code: 'total', title: '', value: 260.15 }],
  }
  const row = orderRow(ctx, order, SYNCED, STATUSES)!
  assert.equal(row.subtotal, 242)
  assert.equal(row.shipping, 18.15, '15 + 3,15 TVA')
  assert.equal(row.discount, 0)
  assert.equal(row.fees, 0)
})

test('stările: anulări și rambursări după nume, apoi „în procesare" / „finalizată" din setări', () => {
  const s = (status_id: number) => orderState({ status_id, status: null }, STATUSES)
  assert.equal(s(1), 'pending')
  assert.equal(s(2), 'confirmed')
  assert.equal(s(3), 'confirmed')
  assert.equal(s(5), 'fulfilled')
  assert.equal(s(7), 'cancelled')
  assert.equal(s(9), 'confirmed', 'Canceled Reversal: plata e din nou valabilă')
  assert.equal(s(10), 'cancelled')
  assert.equal(s(11), 'refunded')
  assert.equal(s(13), 'refunded')
  assert.equal(s(16), 'cancelled')
  assert.equal(s(17), 'confirmed', 'o stare a magazinului e o comandă vie')
  assert.equal(orderState({ status_id: 99, status: 'Anulată' }, STATUSES), 'cancelled')
  assert.equal(orderRow(ctx, { ...ORDER, status_id: 0 }, SYNCED, STATUSES), null, 'starea 0 e un coș abandonat')
  assert.equal(orderRow(ctx, { ...ORDER, date_added: 'nu e o dată' }, SYNCED, STATUSES), null)
})

test('sursa: fără parametri, doar clic, marketingul OpenCart', () => {
  assert.deepEqual(attributionOf({ source: null, marketing_id: 0, tracking: null }).attribution, {})
  const click = attributionOf({ source: { ...ORDER.source!, utm_source: null, utm_medium: null, utm_campaign: null, referrer: null }, marketing_id: 3, tracking: 'af1' })
  assert.equal(click.values.source_type, 'click_id')
  assert.equal(click.attribution.oc_marketing_id, '3')
  assert.equal(click.attribution.oc_tracking, 'af1')
  const direct = attributionOf({ source: { ...ORDER.source!, utm_source: null, utm_medium: null, utm_campaign: null, gclid: null, referrer: null }, marketing_id: null, tracking: '' })
  assert.equal(direct.values.source_type, 'direct')
})

test('datele magazinului: limba scurtă, moneda și țara cu litere mari', () => {
  const info: OcInfo = {
    extension_version: '1.0.0', opencart_version: '4.0.2.3', php_version: '8.2.12',
    store: { id: 0, name: 'Magazinul meu', url: 'https://magazin.ro', country: 'ro', language: 'ro-ro', currency: 'ron', timezone: 'Europe/Bucharest', prices_include_tax: true },
    statuses: [{ id: 1, name: 'Pending', processing: false, complete: false }],
    extensions: { feed: ['google_base'], analytics: [], module: ['hontrio'] },
    tracking: { enabled: true, since: '2026-11-14T10:00:00+02:00' },
  }
  const f = storeFields(info)
  assert.deepEqual(f.fields, { store_name: 'Magazinul meu', currency: 'RON', country: 'RO', language: 'ro', timezone: 'Europe/Bucharest' })
  assert.equal(f.platform_data.opencart_version, '4.0.2.3')
  assert.deepEqual(f.platform_data.feed_extensions, ['google_base'])
  assert.equal(f.platform_data.prices_include_tax, true)
})

test('răspunsul extensiei, chiar cu avertismente PHP înainte sau după', () => {
  const body = '{"hontrio_api":1,"ok":true,"data":[1,2],"meta":{"page":1,"limit":2,"total":3,"pages":2}}'
  assert.deepEqual(extractEnvelope<number[]>(body)?.data, [1, 2])
  assert.deepEqual(extractEnvelope<number[]>(`<br />\n<b>Deprecated</b>: ceva în <b>x.php</b><br />\n${body}`)?.data, [1, 2])
  assert.deepEqual(extractEnvelope<number[]>(`${body}\n<b>Notice</b>: după răspuns`)?.data, [1, 2])
  assert.deepEqual(extractEnvelope<number[]>(`{ "hontrio_api" : 1, "ok": true, "data": [3] }`)?.data, [3])
  assert.equal(extractEnvelope('<html>Page not found</html>'), null)
  assert.equal(extractEnvelope('{"hontrio_api":1,"ok":true,"data":[1'), null)
  assert.equal(hasMore({ items: [1, 2], meta: { page: 1, limit: 2, total: 3, pages: 2 } }, 2), true)
  assert.equal(hasMore({ items: [3], meta: { page: 2, limit: 2, total: 3, pages: 2 } }, 2), false)
  assert.equal(hasMore({ items: [1, 2], meta: null }, 2), true)
})

test('formularul: folderul magazinului se păstrează, index.php nu; cheia de 48 de caractere', () => {
  assert.deepEqual(openCartAddress('Magazin.ro'), { ok: true, url: 'https://magazin.ro' })
  assert.deepEqual(openCartAddress('https://magazin.ro/shop/'), { ok: true, url: 'https://magazin.ro/shop' })
  assert.deepEqual(openCartAddress('https://magazin.ro/shop/index.php?route=common/home'), { ok: true, url: 'https://magazin.ro/shop' })
  assert.deepEqual(openCartAddress('http://www.magazin.ro/a/b'), { ok: true, url: 'https://www.magazin.ro/a/b' })
  assert.equal((openCartAddress('https://magazin.ro/sh op') as { key: string }).key, 'sync.store_url_invalid')
  assert.equal((openCartAddress('https://192.168.1.10/shop') as { key: string }).key, 'sync.store_url_private_ip')
  assert.deepEqual(parseOpenCartKeys({ store_url: 'magazin.ro/shop', api_key: KEY }), { ok: true, keys: { storeUrl: 'https://magazin.ro/shop', apiKey: KEY, apiSecret: null } })
  assert.equal((parseOpenCartKeys({ store_url: 'magazin.ro', api_key: 'xyz' }) as { key: string }).key, 'sync.opencart_key_invalid')
  assert.equal((parseOpenCartKeys({ store_url: 'magazin.ro' }) as { key: string }).key, 'sync.fields_required')
})

// ── Clientul, pe rețeaua simulată ───────────────────────────────────────────

test('clientul: ruta, antetul cheii (nu în adresă), parametrii, erorile extensiei', async () => {
  const replies: ((url: URL) => Response)[] = [
    () => json({ hontrio_api: 1, ok: true, data: [PRODUCT], meta: { page: 1, limit: 100, total: 1, pages: 1 } }),
    () => json({ hontrio_api: 1, ok: false, error: { code: 'unauthorized', message: 'Invalid key' } }, 401),
    () => json({ hontrio_api: 1, ok: false, error: { code: 'disabled', message: 'API disabled' } }, 403),
    () => json({ hontrio_api: 1, ok: false, error: { code: 'bad_request', message: 'limit must be 1-250' } }, 400),
    () => text('<html><title>Pagina nu a fost găsită!</title></html>', 404),
    () => text('<html>Access denied</html>', 403),
  ]
  let i = 0
  const net = stubNetwork((_req, url) => replies[i++](url))
  try {
    const make = () => new OpenCartApi('https://magazin.ro/shop', KEY, { deadline: Date.now() + 30_000, retries: 0 })
    const r = await make().products({ page: 1, modifiedAfter: '2026-11-10T00:00:00.000Z', ids: ['42', '43'] })
    assert.equal(r.items.length, 1)
    const c = net.calls[0]
    assert.equal(c.url.origin + c.url.pathname, 'https://magazin.ro/shop/index.php')
    assert.equal(c.url.searchParams.get('route'), 'extension/hontrio/api')
    assert.equal(c.url.searchParams.get('action'), 'products')
    assert.equal(c.url.searchParams.get('modified_after'), '2026-11-10T00:00:00.000Z')
    assert.equal(c.url.searchParams.get('ids'), '42,43')
    assert.equal(c.url.searchParams.get('limit'), '100')
    assert.equal(c.headers.get('x-hontrio-key'), KEY)
    assert.equal([...c.url.searchParams.values()].includes(KEY), false, 'cheia nu ajunge în adresă')
    await assert.rejects(make().info(), (e: StoreApiError) => e.code === 'unauthorized' && e.key === 'sync.opencart_key_rejected')
    await assert.rejects(make().orders({ page: 1 }), (e: StoreApiError) => e.code === 'unauthorized' && e.key === 'sync.opencart_disabled')
    await assert.rejects(make().products({ page: 1, limit: 999 }), (e: StoreApiError) => e.code === 'bad_response' && e.params?.detail === 'limit must be 1-250')
    await assert.rejects(make().info(), (e: StoreApiError) => e.code === 'not_found' && e.key === 'sync.opencart_extension_missing')
    await assert.rejects(make().info(), (e: StoreApiError) => e.code === 'blocked' && e.key === 'sync.opencart_blocked')
  } finally {
    net.restore()
  }
})
