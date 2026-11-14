import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Ctx } from '@/lib/commerce/rows'
import { StoreApiError } from '@/lib/commerce/http'
import { MerchantProApi, ORDER_FIELDS, PRODUCT_FIELDS } from '@/lib/merchantpro/api'
import { attributionOf, channelOf, isListed, isOrder, lineRows, offerRows, orderRow, orderState, soldProductIds } from '@/lib/merchantpro/mapping'
import { parseMerchantProKeys } from '@/lib/merchantpro/connect'
import type { MproOrder, MproProduct } from '@/lib/merchantpro/types'
import { json, stubNetwork } from './store-api-stub'

// Conectorul MerchantPro, pe exemplele din documentația oficială
// (docs.merchantpro.com: specificația OpenAPI și comanda din exemplul de webhook).

const TZ = 'Europe/Bucharest'
const ctx: Ctx = { storeId: 's1', userId: 'u1', currency: 'RON' }
const SYNCED = '2026-11-14T12:00:00.000Z'

// Produsul simplu din exemplul de webhook (scurtat) și un produs cu variante după specificație
const BASIC: MproProduct = {
  id: 5533, type: 'basic', sku: 'KIL-5533', ean: '1234567890123', name: 'Kilim Naidu Rug [DEMO]', inventory_enabled: 'on', stock: 4,
  allow_backorders: true, category_name: 'Rugs', manufacturer_name: 'nanimarquina', price_on_request: false,
  price_gross: 1263.49, old_price_gross: 1399.9, tax_value: 19, url: 'https://my-shop-domain.com/buy/kilim-naidu-rug-demo-5533',
  image_url: { thumb: 'https://s.cdnmpro.com/t.jpg', medium: 'https://s.cdnmpro.com/m.jpg', large: 'https://s.cdnmpro.com/l.jpg' },
  variants: {}, in_stock: true, visibility: 'visible', status: 'active', date_modified: '2024-05-21 16:21:43',
}
const MULTI: MproProduct = {
  id: 1749, type: 'multi_variant', sku: '6285-PUNT-MAS', name: 'Slats Sideboard [DEMO]', inventory_enabled: 'on', stock: 0,
  category_name: 'Storage & shelving', manufacturer_name: 'Punt', price_gross: 1476.98, url: 'https://my-shop-domain.com/buy?id=1749',
  image_url: { large: 'https://s.cdnmpro.com/670044178/p/t/0/slats-sideboard-demo~3530.jpg' }, in_stock: true, visibility: 'visible',
  status: 'active', date_modified: '2024-05-13 09:45:55',
  variants: [
    { id: 10000470, sku: 'SLAT-DW', ean: '5940000000017', inventory_enabled: 'on', stock: 3, price_gross: 1476.98, old_price_gross: 1641.09,
      visibility: 'visible', in_stock: true, variant_options: [{ id: 2, name: 'Color', value: 'Dark Wood', option_id: 40 }] },
    { id: 10000471, sku: 'SLAT-OAK', inventory_enabled: 'on', stock: 0, price_gross: 1399, visibility: 'visible', in_stock: false,
      variant_image: 'https://s.cdnmpro.com/oak.jpg', variant_options: [{ id: 2, name: 'Color', value: 'Oak' }] },
    { id: 10000472, sku: 'SLAT-OLD', price_gross: 1200, visibility: 'discontinued', in_stock: true, variant_options: [{ name: 'Color', value: 'Old' }] },
  ],
}

// Comanda din exemplul „Payload for order" (fără datele clientului, pe care Hontrio nu le cere)
const ORDER: MproOrder = {
  id: '68685485', payment_status: 'awaiting', shipping_status: 'awaiting', payment_method_code: 'cash_delivery',
  billing_country_code: 'RO', shipping_country_code: 'RO', created_by: 'shop', customer_device: 'desktop',
  traffic_source: null, source_referrer: null, source_type: 'Direct',
  subtotal_including_tax: 1476.98, tax_amount: 0, shipping_amount: 10, shipping_tax_amount: 0, total_amount: 1486.98, currency: 'EUR',
  coupon_code: null, channel_name: null, date_created: '2024-05-13 09:54:46', date_modified: '2024-05-13 09:54:46',
  line_items: [{
    item_type: 'product', product_id: 1749, variant_id: 10000470, variant_name: 'Color: Dark Wood',
    variant_options: [{ name: 'Color', value: 'Dark Wood' }], product_sku: null, product_name: 'Slats Sideboard [DEMO]',
    quantity: 1.0, unit_price_gross: 1476.98, line_subtotal_gross: 1476.98,
  }],
}

test('produsul simplu: prețul cu TVA, prețul vechi, stocul, imaginea mare', () => {
  const [o] = offerRows(ctx, BASIC, SYNCED, TZ)
  assert.equal(o.offer_id, '5533')
  assert.equal(o.external_product_id, '5533')
  assert.equal(o.item_group_id, null)
  assert.equal(o.price, 1263.49)
  assert.equal(o.compare_at_price, 1399.9)
  assert.equal(o.available, true)
  assert.equal(o.stock, 4)
  assert.equal(o.gtin, '1234567890123')
  assert.equal(o.brand, 'nanimarquina')
  assert.equal(o.category, 'Rugs')
  assert.equal(o.image_url, 'https://s.cdnmpro.com/l.jpg')
  assert.equal(o.source_updated_at, '2024-05-21T13:21:43.000Z', 'ora României, vara')
})

test('produsul cu variante: o ofertă pe variantă vizibilă, cu opțiunile în titlu', () => {
  const offers = offerRows(ctx, MULTI, SYNCED, TZ)
  assert.deepEqual(offers.map(o => o.offer_id), ['10000470', '10000471'], 'varianta scoasă din vânzare nu e ofertă')
  const [dark, oak] = offers
  assert.equal(dark.external_product_id, '1749')
  assert.equal(dark.item_group_id, '1749')
  assert.equal(dark.title, 'Slats Sideboard [DEMO] - Dark Wood')
  assert.equal(dark.variant_title, 'Dark Wood')
  assert.equal(dark.compare_at_price, 1641.09)
  assert.equal(dark.gtin, '5940000000017')
  assert.equal(dark.image_url, 'https://s.cdnmpro.com/670044178/p/t/0/slats-sideboard-demo~3530.jpg', 'imaginea produsului când varianta n-are')
  assert.equal(oak.available, false)
  assert.equal(oak.image_url, 'https://s.cdnmpro.com/oak.jpg')
  assert.equal(oak.sku, 'SLAT-OAK')
  // Variantele pot veni și ca obiect
  const asObject = { ...MULTI, variants: Object.fromEntries((MULTI.variants as unknown[]).map((v, i) => [String(i), v])) } as MproProduct
  assert.equal(offerRows(ctx, asObject, SYNCED, TZ).length, 2)
})

test('ce nu e de vânzare: inactiv, ascuns, preț la cerere, digital, card cadou, fără preț', () => {
  assert.equal(isListed(BASIC), true)
  for (const p of [
    { ...BASIC, status: 'inactive' }, { ...BASIC, visibility: 'hidden' }, { ...BASIC, visibility: 'bundle_only' },
    { ...BASIC, price_on_request: true }, { ...BASIC, type: 'digital' }, { ...BASIC, type: 'gift_card' }, { ...BASIC, price_gross: 0 },
  ]) assert.deepEqual(offerRows(ctx, p, SYNCED, TZ), [], JSON.stringify({ status: p.status, visibility: p.visibility, type: p.type }))
  // Fără `in_stock`: după stoc și comanda din urmă
  const [o] = offerRows(ctx, { ...BASIC, in_stock: null, stock: 0, allow_backorders: false }, SYNCED, TZ)
  assert.equal(o.available, false)
  const [noInventory] = offerRows(ctx, { ...BASIC, in_stock: null, inventory_enabled: 'off', stock: 0 }, SYNCED, TZ)
  assert.equal(noInventory.available, true)
  assert.equal(noInventory.stock, null)
})

test('comanda din exemplul oficial: sumele (transportul cu TVA), țara, starea, linia variantei', () => {
  const row = orderRow(ctx, ORDER, SYNCED, TZ)!
  assert.equal(row.external_id, '68685485')
  assert.equal(row.placed_at, '2024-05-13T06:54:46.000Z')
  assert.equal(row.state, 'pending')
  assert.equal(row.status, 'awaiting')
  assert.equal(row.payment_status, 'unpaid')
  assert.equal(row.payment_method, 'cash_delivery')
  assert.equal(row.channel, 'store')
  assert.equal(row.currency, 'EUR')
  assert.equal(row.subtotal, 1476.98)
  assert.equal(row.shipping, 10)
  assert.equal(row.discount, 0)
  assert.equal(row.fees, 0)
  assert.equal(row.total, 1486.98)
  assert.equal(row.country, 'RO')
  assert.deepEqual(row.attribution, { source_type: 'direct', device_type: 'desktop' })
  const [line] = lineRows('o1', 's1', ORDER, SYNCED)
  assert.equal(line.offer_id, '10000470', 'oferta e varianta')
  assert.equal(line.external_product_id, '1749')
  assert.equal(line.variant_title, 'Dark Wood')
  assert.equal(line.unit_price, 1476.98)
  assert.deepEqual(soldProductIds(ORDER), ['1749'])
})

test('reducerea și taxele se deduc din total; liniile care nu sunt produse nu intră', () => {
  // Exemplul din specificație: subtotal 175,99 + transport 25 (cu 5 TVA) = 200,99
  const spec = orderRow(ctx, { ...ORDER, line_items: null, subtotal_including_tax: 175.99, tax_amount: 25.24, shipping_amount: 25, shipping_tax_amount: 5, total_amount: 200.99 }, SYNCED, TZ)!
  assert.equal(spec.subtotal, 175.99)
  assert.equal(spec.discount, 0)
  assert.equal(spec.tax, 30.24)
  // Un cupon (linie de reducere) și plata la livrare (taxă)
  const withCoupon = orderRow(ctx, {
    ...ORDER, coupon_code: 'TOAMNA10', total_amount: 1339.28,
    line_items: [...ORDER.line_items!, { item_type: 'coupon', product_name: 'TOAMNA10', quantity: 1, line_subtotal_gross: -147.7 }],
  }, SYNCED, TZ)!
  assert.equal(withCoupon.subtotal, 1476.98)
  assert.equal(withCoupon.discount, 147.7)
  assert.equal(withCoupon.discount_code, 'TOAMNA10')
  assert.equal(lineRows('o1', 's1', { ...ORDER, line_items: [...ORDER.line_items!, { item_type: 'shipping', quantity: 1, line_subtotal_gross: 10 }] }, SYNCED).length, 1)
  const cod = orderRow(ctx, { ...ORDER, total_amount: 1491.98 }, SYNCED, TZ)!
  assert.equal(cod.fees, 5)
  assert.equal(cod.discount, 0)
})

test('stările: livrarea și plata', () => {
  const s = (shipping_status: string, payment_status: string) => orderState({ shipping_status, payment_status })
  assert.equal(s('awaiting', 'awaiting'), 'pending')
  assert.equal(s('confirmed', 'awaiting'), 'confirmed')
  assert.equal(s('in_process', 'paid'), 'confirmed')
  assert.equal(s('awaiting', 'paid'), 'confirmed')
  assert.equal(s('shipped', 'awaiting'), 'confirmed')
  assert.equal(s('delivered', 'paid'), 'fulfilled')
  assert.equal(s('returned', 'paid'), 'refunded')
  assert.equal(s('delivered', 'refunded'), 'refunded')
  assert.equal(s('cancelled', 'paid'), 'cancelled')
  assert.equal(s('awaiting', 'failed'), 'cancelled')
  assert.equal(s('awaiting', 'rejected'), 'cancelled')
  assert.equal(s('shipped', 'failed'), 'confirmed', 'expediată: plata eșuată nu o anulează')
  // Comanda temporară (plata online neterminată) nu e comandă
  assert.equal(isOrder({ shipping_status: 'temporary', payment_status: 'temporary' }), false)
  assert.equal(orderRow(ctx, { ...ORDER, payment_status: 'temporary' }, SYNCED, TZ), null)
  assert.equal(orderRow(ctx, { ...ORDER, date_created: null }, SYNCED, TZ), null)
})

test('sursa vizitei: UTM-urile din traffic_source, gclid din pagina de intrare', () => {
  const a = attributionOf({
    traffic_source: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'hontrio-123', landing_page: 'https://shop.ro/p/1?gclid=Cj0KCQ&utm_term=lampa' },
    source_type: 'Referral', source_referrer: 'https://www.google.com/search?q=lampa', customer_device: 'mobile',
  })
  assert.equal(a.values.utm_source, 'google')
  assert.equal(a.values.utm_campaign, 'hontrio-123')
  assert.equal(a.values.gclid, 'Cj0KCQ')
  assert.equal(a.values.utm_term, 'lampa')
  assert.equal(a.values.referrer, 'https://www.google.com', 'doar originea, fără căutarea omului')
  assert.equal(a.values.landing_path, '/p/1')
  assert.equal(a.values.source_type, 'referral')
  // Chei scurte sau cu litere mari
  const b = attributionOf({ traffic_source: { Source: 'google', Medium: 'cpc', Campaign: 'hontrio-9' }, source_type: null, source_referrer: null, customer_device: null })
  assert.deepEqual([b.values.utm_source, b.values.utm_medium, b.values.utm_campaign], ['google', 'cpc', 'hontrio-9'])
  const row = orderRow(ctx, { ...ORDER, traffic_source: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'hontrio-123', gclid: 'XYZ' } }, SYNCED, TZ)!
  assert.deepEqual([row.utm_source, row.utm_medium, row.utm_campaign, row.gclid], ['google', 'cpc', 'hontrio-123', 'XYZ'])
  assert.deepEqual(attributionOf({ traffic_source: ['nu e obiect'] as unknown as Record<string, unknown>, source_type: null, source_referrer: 'nu e adresă', customer_device: null }).attribution, {})
})

test('canalele: marketplace-urile nu sunt vitrina', () => {
  assert.equal(channelOf(null), 'store')
  assert.equal(channelOf('Online Store'), 'store')
  assert.equal(channelOf('eMAG Marketplace'), 'emag_marketplace')
  assert.equal(channelOf('Trendyol'), 'trendyol')
})

test('formularul: utilizatorul și secretul, adresa', () => {
  assert.deepEqual(parseMerchantProKeys({ store_url: 'www.Magazin.ro/', api_key: 'hontrio_user', api_secret: 's3cr3t-Valoare' }),
    { ok: true, keys: { storeUrl: 'https://www.magazin.ro', apiKey: 'hontrio_user', apiSecret: 's3cr3t-Valoare' } })
  assert.equal((parseMerchantProKeys({ store_url: 'magazin.ro', api_key: 'u' }) as { key: string }).key, 'sync.fields_required')
  assert.equal((parseMerchantProKeys({ store_url: 'magazin.ro', api_key: 'cu spatiu', api_secret: 'secret123' }) as { key: string }).key, 'sync.merchantpro_credentials_invalid')
})

// ── Clientul API, pe rețeaua simulată ───────────────────────────────────────

test('clientul: Basic auth, câmpurile cerute (fără date personale), paginarea după meta.links.next', async () => {
  const net = stubNetwork((_req, url) => {
    const start = Number(url.searchParams.get('start'))
    return json({
      data: start === 0 ? [BASIC] : [MULTI],
      meta: { count: { total: 2, current: 1, start, limit: 100 }, links: { prev: null, current: url.pathname, next: start === 0 ? '/api/v2/products?start=100&limit=100' : null } },
    }, 200, { 'X-RateLimit-Remaining': '79', 'X-RateLimit-Reset': '30', 'X-RateLimit-Window': 'minute' })
  })
  try {
    const api = new MerchantProApi('https://www.magazin.ro', 'hontrio_user', 's3cr3t', { deadline: Date.now() + 30_000 })
    const p1 = await api.products({ start: 0, activeOnly: true })
    const p2 = await api.products({ start: 100 })
    assert.equal(p1.more, true)
    assert.equal(p2.more, false)
    assert.equal(p1.total, 2)
    const c = net.calls[0]
    assert.equal(c.url.origin + c.url.pathname, 'https://www.magazin.ro/api/v2/products')
    assert.equal(c.headers.get('authorization'), 'Basic ' + Buffer.from('hontrio_user:s3cr3t').toString('base64'))
    assert.equal(c.headers.get('accept'), 'application/json')
    assert.equal(c.url.searchParams.get('fields'), PRODUCT_FIELDS)
    assert.equal(c.url.searchParams.get('status'), 'active')
    assert.equal(c.url.searchParams.get('sort'), 'date_created')
    assert.equal(c.url.searchParams.get('limit'), '100')
    assert.equal(net.calls[1].url.searchParams.has('status'), false)
    // Din comenzi nu se cere nicio dată personală
    for (const f of ['billing_name', 'customer_email', 'billing_phone', 'billing_address', 'shipping_address', 'customer_ip_address', 'customer_data', 'customer_note']) {
      assert.equal(ORDER_FIELDS.split(',').includes(f), false, f)
    }
  } finally {
    net.restore()
  }
})

test('clientul: 401 nu se reîncearcă, 403 e refuz, 429 așteaptă Retry-After, cota pune pauză', async () => {
  const replies: (() => Response)[] = [
    () => json({ error: { name: 'unauthorized', message: 'Authentication required' } }, 401),
    () => json({ error: { name: 'forbidden', message: 'Missing permission: orders' } }, 403),
    () => json({ error: { name: 'rate_limit_exceeded', message: 'You have exceeded your quota', details: { retry_after: 1 } } }, 429, { 'Retry-After': '1' }),
    () => json({ data: [], meta: { links: { next: null } } }, 200, { 'X-RateLimit-Remaining': '1', 'X-RateLimit-Reset': '1' }),
    () => json({ data: [], meta: { links: { next: null } } }),
    () => json({ error: { name: 'not_found', message: 'Not found' } }, 404),
  ]
  let i = 0
  const net = stubNetwork(() => replies[i++]())
  try {
    const make = () => new MerchantProApi('https://magazin.ro', 'u', 's', { deadline: Date.now() + 30_000 })
    await assert.rejects(make().products({ start: 0 }), (e: StoreApiError) => e.code === 'unauthorized' && e.status === 401 && e.key === 'sync.merchantpro_key_rejected')
    assert.equal(i, 1, 'un 401 nu se reîncearcă (MerchantPro ar bloca încercările repetate)')
    await assert.rejects(make().orders({ start: 0 }), (e: StoreApiError) => e.status === 403 && e.key === 'sync.merchantpro_forbidden' && e.params?.detail === 'Missing permission: orders')
    const api = make()
    let started = Date.now()
    await api.orders({ start: 0 })
    assert.ok(Date.now() - started >= 1000, 'a așteptat Retry-After')
    // Cota pe minut aproape terminată: cererea următoare așteaptă resetarea
    started = Date.now()
    await api.orders({ start: 0 })
    assert.ok(Date.now() - started >= 900, 'pauză după X-RateLimit-Remaining')
    await assert.rejects(make().products({ start: 0 }), (e: StoreApiError) => e.code === 'not_found' && e.key === 'sync.merchantpro_not_detected')
  } finally {
    net.restore()
  }
})
