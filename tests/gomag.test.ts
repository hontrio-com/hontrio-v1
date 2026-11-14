import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Ctx } from '@/lib/commerce/rows'
import { StoreApiError } from '@/lib/commerce/http'
import { GomagApi, gomagDay, hasMore, listOf } from '@/lib/gomag/api'
import { availableOf, baseCurrency, categoryOf, channelOf, grossPrice, lineRows, offerRows, orderRow, orderState, soldProductIds, statusMap } from '@/lib/gomag/mapping'
import { apiShopCandidates, parseGomagKeys } from '@/lib/gomag/connect'
import type { GomagOrder, GomagProduct } from '@/lib/gomag/types'
import { json, stubNetwork, text } from './store-api-stub'

// Conectorul Gomag, pe exemplele din documentația oficială (apidocs.gomag.ro):
// produsele (variantele sunt produse cu `parent`), comenzile (stări, sume,
// țara scrisă cu numele), clientul API (erorile întoarse cu HTTP 200, limita).

const TZ = 'Europe/Bucharest'
const ctx: Ctx = { storeId: 's1', userId: 'u1', currency: 'RON' }
const SYNCED = '2026-11-14T12:00:00.000Z'

// Produsele „2", „7" și „9" din exemplul „Lista de produse" (scurtate)
const P2: GomagProduct = {
  id: '2', sku: '1245', name: 'Rachetă Babolat', url: 'http://tennisshop.gomag.ro/racheta-babolat.html',
  canonical_url: 'http://tennisshop.gomag.ro/produse-1/racheta-babolat.html', brand: 'Babolat',
  categories: { 1: [{ id: '1', name: 'Produse' }, { id: '3', name: 'Echipament' }], 3: [{ id: '196', name: 'categorie pentru redirect' }] },
  enabled: '1', parent: '2', parent_sku: '1245', stockManagement: '1', stock: '7.000', stock_status: 'instock',
  base_price: '1000.0000', price: '1000.0000', vat_included: 1, vat: '19', currency: 'RON', allowOrdersWhenOutOfStock: '0',
  images: ['https://stage.gomagcdn.ro/domains/tennisshop/files/product/original/racheta-babolat-2-9255.jpg?s=aaaaa'],
  ean: '', group_key: '1245', updated: '2025-02-19 16:19:46', created: '2019-10-02 09:44:26',
}
const P7: GomagProduct = {
  ...P2, id: '7', sku: '7854-s', name: 'Pantaloni Nike', brand: 'Nike', parent: '7', stockManagement: 1, stock: '0.000',
  stock_status: 'notinstock', base_price: '25.3407', price: '25.3407', allowOrdersWhenOutOfStock: 0, updated: '2025-01-22 13:24:19',
}
const P9: GomagProduct = {
  ...P2, id: '9', sku: '1545-negru', name: 'Racheta Dunlop', brand: 'Dunlop', parent: '10', parent_sku: '1545', stock: '111.000',
  base_price: '0.1000', price: '0.1000', allowOrdersWhenOutOfStock: '1', ean: '5941234567890', updated: '2025-01-09 13:22:49',
}

// Comenzile „2799" și „2974" din exemplul „Lista de comenzi" (fără datele cumpărătorului)
const O2799: GomagOrder = {
  id: '2799', number: '4040544895', date: '2022-10-24 14:42:21', total: '552.49', status: 'Anulata', statusId: '7',
  sales_channel: 'EasySales', currency: 'RON', payment: { name: 'Termen de Plata', online: '0', completed: '0' },
  delivery: { name: 'Gratuuuiiit', total: 0 }, shipping: { country: 'Romania' }, billing: { country: 'Romania' },
  items: [
    { id: '544', type: 'product', sku: '33590001', ean: '', name: 'Baterie dus Eurostyle', price: '1005', baseprice: '1200', vat: '19', quantity: '1.00' },
    { id: '52', type: 'product', sku: 'ALP-1568622-7155-XL', ean: '8059175959134', name: 'Manusi Alpinestars XL', price: '49.99', baseprice: '100', vat: '19', quantity: '1.00' },
  ],
  discounts: [{ value: '502.5', name: 'voucher', voucher: 'voucher' }],
}
const O2974: GomagOrder = {
  id: '2974', number: '4040548418', date: '2022-11-11 16:20:41', total: '990.5', status: 'Platita', statusId: '8',
  sales_channel: 'Website', currency: 'RON', payment: { name: 'Termen de Plata', online: '0', completed: '0' },
  delivery: { name: 'Transport National', total: 0.5 }, shipping: { country: 'Romania' }, billing: { country: 'Romania' },
  items: [{ id: '544', type: 'product', sku: '33590001', name: 'Baterie dus Eurostyle', price: '1100', baseprice: '1200', vat: '19', quantity: '1.00' }],
  discounts: [{ value: '110', name: 'Scoala 10', voucher: '' }],
}

// Stările din exemplul „Citire de statusuri pentru comenzi"
const STATUSES = statusMap([
  { id: 1, name: 'Comanda noua' }, { id: 2, name: 'Comanda telefonica' }, { id: 18, name: 'Livrata' }, { id: 8, name: 'Platita' },
  { id: 3, name: 'Comanda Finalizata (Facturata)' }, { id: 4, name: 'Neplatita' }, { id: 5, name: 'Returnata' },
  { id: 6, name: 'Comanda preluata' }, { id: 7, name: 'Anulata' },
])

test('produsul simplu: oferta lui, cu TVA, categoria, stocul și data în UTC', () => {
  const [o] = offerRows(ctx, P2, SYNCED, TZ)
  assert.equal(o.offer_id, '2')
  assert.equal(o.external_product_id, '2')
  assert.equal(o.item_group_id, null, 'un produs simplu e propriul părinte')
  assert.equal(o.title, 'Rachetă Babolat')
  assert.equal(o.price, 1000)
  assert.equal(o.compare_at_price, null)
  assert.equal(o.available, true)
  assert.equal(o.stock, 7)
  assert.equal(o.brand, 'Babolat')
  assert.equal(o.category, 'Echipament', 'ultima categorie din prima ramură')
  assert.equal(o.url, 'http://tennisshop.gomag.ro/racheta-babolat.html')
  assert.match(o.image_url!, /racheta-babolat-2-9255\.jpg/)
  assert.equal(o.gtin, null, 'EAN gol')
  assert.equal(o.currency, 'RON')
  assert.equal(o.source_updated_at, '2025-02-19T14:19:46.000Z')
  assert.equal(o.google_status, null)
})

test('varianta e un produs cu părinte; stocul epuizat sau „se aduce la comandă"', () => {
  const [v] = offerRows(ctx, P9, SYNCED, TZ)
  assert.equal(v.offer_id, '9')
  assert.equal(v.external_product_id, '10')
  assert.equal(v.item_group_id, '10')
  assert.equal(v.available, true, 'allowOrdersWhenOutOfStock')
  assert.equal(v.gtin, '5941234567890')
  assert.equal(v.price, 0.1)
  const [p7] = offerRows(ctx, P7, SYNCED, TZ)
  assert.equal(p7.available, false, 'notinstock, fără comandă la furnizor')
  assert.equal(p7.stock, 0)
  assert.equal(p7.price, 25.34, 'rotunjit la bani')
})

test('produs dezactivat sau fără preț: nicio ofertă; preț fără TVA → cu TVA; reducere', () => {
  assert.deepEqual(offerRows(ctx, { ...P2, enabled: '0' }, SYNCED, TZ), [])
  assert.deepEqual(offerRows(ctx, { ...P2, price: '0' }, SYNCED, TZ), [])
  const [net] = offerRows(ctx, { ...P2, price: '100', base_price: '120', vat_included: '0', vat: '19' }, SYNCED, TZ)
  assert.equal(net.price, 119)
  assert.equal(net.compare_at_price, 142.8)
  assert.equal(grossPrice('100', { vat_included: 1, vat: 19 }), 100)
  assert.equal(grossPrice('100', { vat_included: undefined, vat: 19 }), 100, 'fără câmp: prețul e cel afișat')
  // Categoriile ca listă de ramuri, și fără categorii
  assert.equal(categoryOf({ categories: [[{ name: 'Baie' }, { name: 'Cabine de dus' }]] }), 'Cabine de dus')
  assert.equal(categoryOf({ categories: null }), null)
  // Starea stocului: precomanda se poate cumpăra; fără stare, după stoc
  assert.equal(availableOf({ stock_status: 'preorder' }), true)
  assert.equal(availableOf({ stockStatus: 'notinstock', allowOrdersWhenOutOfStock: '1' }), true)
  assert.equal(availableOf({ stockManagement: '1', stock: '0' }), false)
  assert.equal(availableOf({ stockManagement: '0', stock: '0' }), true)
})

test('comanda anulată din EasySales: starea, sumele, voucherul, țara, canalul', () => {
  const row = orderRow(ctx, O2799, SYNCED, STATUSES, TZ)!
  assert.equal(row.external_id, '2799')
  assert.equal(row.order_number, '4040544895')
  assert.equal(row.placed_at, '2022-10-24T11:42:21.000Z')
  assert.equal(row.state, 'cancelled')
  assert.equal(row.status, 'Anulata')
  assert.equal(row.channel, 'easysales', 'marketplace-ul nu e vitrina magazinului')
  assert.equal(row.subtotal, 1054.99)
  assert.equal(row.discount, 502.5)
  assert.equal(row.shipping, 0)
  assert.equal(row.total, 552.49)
  assert.equal(round2(row.subtotal - row.discount + row.shipping + row.fees), row.total, 'sumele se potrivesc cu totalul')
  assert.equal(row.tax, 88.21, 'TVA-ul produselor, după reducere')
  assert.equal(row.discount_code, 'voucher')
  assert.equal(row.country, 'RO')
  assert.equal(row.payment_status, 'unpaid')
  assert.equal(row.payment_method, 'Termen de Plata')
  assert.equal(row.gclid, null)
  assert.deepEqual(row.attribution, {}, 'Gomag nu dă sursa comenzii')
})

test('comanda plătită de pe site: transportul și reducerea fără cod', () => {
  const row = orderRow(ctx, O2974, SYNCED, STATUSES, TZ)!
  assert.equal(row.state, 'confirmed')
  assert.equal(row.channel, 'store')
  assert.equal(row.subtotal, 1100)
  assert.equal(row.discount, 110)
  assert.equal(row.shipping, 0.5)
  assert.equal(row.total, 990.5)
  assert.equal(row.tax, 158.07)
  assert.equal(row.discount_code, null)
  const lines = lineRows('o1', 's1', O2974, SYNCED)
  assert.deepEqual(lines.map(l => [l.offer_id, l.quantity, l.unit_price, l.is_extra]), [['544', 1, 1100, false]])
})

test('liniile: produsele, apoi serviciile ca „extra"; lista poate veni ca obiect', () => {
  const o: GomagOrder = {
    ...O2974,
    items: {
      'item 1': { id: '7', type: 'product', name: 'Pantaloni Nike', price: '25.34', quantity: '2.00', vat: '19' },
      'item 2': { id: '0', type: 'service', name: 'Montaj', price: '50', quantity: '1', vat: '19' },
    },
    discounts: [], total: '100.68', delivery: { total: 0 },
  }
  const lines = lineRows('o1', 's1', o, SYNCED)
  assert.deepEqual(lines.map(l => [l.position, l.offer_id, l.quantity, l.unit_price, l.is_extra]), [[0, '7', 2, 25.34, false], [1, null, 1, 50, true]])
  const row = orderRow(ctx, o, SYNCED, STATUSES, TZ)!
  assert.equal(row.subtotal, 50.68)
  assert.equal(row.fees, 50)
  assert.deepEqual(soldProductIds(o), ['7'])
})

test('stările: tipul din Gomag, apoi numele (inclusiv cele redenumite)', () => {
  const s = (statusId: number | string, name?: string) => orderState(statusId, name ?? null, STATUSES)
  assert.equal(s(1), 'pending')
  assert.equal(s(2), 'pending')
  assert.equal(s(6), 'confirmed')
  assert.equal(s(8), 'confirmed')
  assert.equal(s(4), 'pending')
  assert.equal(s(18), 'fulfilled')
  assert.equal(s(3), 'fulfilled')
  assert.equal(s(5), 'refunded')
  assert.equal(s(7), 'cancelled')
  assert.equal(s(99, 'În pregătire'), 'confirmed', 'o stare a magazinului e o comandă vie')
  assert.equal(s(99, 'Comandă anulată de client'), 'cancelled')
  const typed = statusMap([{ id: 40, name: 'Refuzată la livrare', type: 'return' }, { id: 41, name: 'X', type: 'cancel' }, { id: 42, name: 'Livrare', type: 'sale' }])
  assert.equal(orderState(40, null, typed), 'refunded', 'tipul are întâietate')
  assert.equal(orderState(41, null, typed), 'cancelled')
  assert.equal(orderState(42, null, typed), 'confirmed')
})

test('comanda fără dată validă nu e comandă; canalele', () => {
  assert.equal(orderRow(ctx, { ...O2974, date: '0000-00-00 00:00:00' }, SYNCED, STATUSES, TZ), null)
  assert.equal(channelOf('Website'), 'store')
  assert.equal(channelOf(''), 'store')
  assert.equal(channelOf(null), 'store')
  assert.equal(channelOf('eMAG Marketplace'), 'emag_marketplace')
  assert.equal(baseCurrency([{ name: 'EUR', currency: 'EUR', multiplier: '5.02677' }, { name: 'RON', currency: 'RON', multiplier: '1' }]), 'RON')
  assert.equal(baseCurrency([]), null)
  assert.deepEqual(listOf({ a: 1, b: 2 }), [1, 2])
  assert.deepEqual(listOf(null), [])
  assert.equal(gomagDay('2026-11-14T23:30:00.000Z'), '2026-11-14')
})

test('formularul: adresa curățată, cheia verificată', () => {
  assert.deepEqual(parseGomagKeys({ store_url: 'Magazin.ro/', api_key: 'abcDEF1234567890abcd' }),
    { ok: true, keys: { storeUrl: 'https://magazin.ro', apiKey: 'abcDEF1234567890abcd', apiSecret: null } })
  assert.equal((parseGomagKeys({ store_url: 'magazin.ro' }) as { key: string }).key, 'sync.fields_required')
  assert.equal((parseGomagKeys({ store_url: 'magazin.ro', api_key: 'scurt' }) as { key: string }).key, 'sync.gomag_key_invalid')
  assert.equal((parseGomagKeys({ store_url: 'magazin.ro', api_key: 'are spatii in ea 123456' }) as { key: string }).key, 'sync.gomag_key_invalid')
  assert.equal((parseGomagKeys({ store_url: 'https://localhost', api_key: 'abcDEF1234567890abcd' }) as { key: string }).key, 'sync.store_url_local')
})

// ── Clientul API, pe rețeaua simulată ───────────────────────────────────────

test('clientul: antetele, paginarea, listele ca obiect, ritmul din antete', async () => {
  const net = stubNetwork((_req, url) => {
    const page = Number(url.searchParams.get('page'))
    return json({ total: '3', page, pages: 2, products: page === 1 ? { 2: P2, 7: P7 } : { 9: P9 } },
      200, { 'Api-RateLimit-Read': '20', 'Api-RateLimit-Read-Remaining': '5' })
  })
  try {
    const api = new GomagApi('https://www.magazin.ro', 'cheie-de-proba-1234567890', { deadline: Date.now() + 30_000 })
    const started = Date.now()
    const p1 = await api.products({ page: 1 })
    const p2 = await api.products({ page: 2, updated: '2026-11-13' })
    assert.deepEqual(p1.items.map(p => p.id), ['2', '7'])
    assert.equal(hasMore(p1), true)
    assert.equal(hasMore(p2), false)
    assert.ok(Date.now() - started < 900, 'ritmul de 20 de citiri pe secundă din antete')
    const first = net.calls[0]
    assert.equal(first.url.origin + first.url.pathname, 'https://api.gomag.ro/api/v1/product/read/json')
    assert.equal(first.url.searchParams.get('limit'), '100')
    assert.equal(first.headers.get('apikey'), 'cheie-de-proba-1234567890')
    assert.equal(first.headers.get('apishop'), 'https://www.magazin.ro')
    assert.match(first.headers.get('user-agent') ?? '', /^Hontrio\//)
    assert.equal(net.calls[1].url.searchParams.get('updated'), '2026-11-13')
    assert.equal(first.url.searchParams.has('apikey'), false, 'cheia nu ajunge niciodată în adresă')
  } finally {
    net.restore()
  }
})

test('clientul: erorile Gomag întoarse cu HTTP 200 și cele trecătoare', async () => {
  const replies: (() => Response)[] = [
    () => json({ error: 100, message: 'Missing Api User', data: [] }),
    () => text('Nothing Here! (3)'),
    () => json({ error: '1503', message: 'interval invalid' }),
    () => new Response('', { status: 429, headers: { 'Retry-After': '1' } }),
    () => json({ total: 0, page: 1, pages: 0, products: [] }, 200, { 'Api-RateLimit-Read': '50' }),
    () => new Response('', { status: 500 }),
    () => new Response('', { status: 500 }),
  ]
  let i = 0
  const net = stubNetwork(() => replies[i++]())
  try {
    const api = () => new GomagApi('https://magazin.ro', 'cheie-de-proba-1234567890', { deadline: Date.now() + 30_000, retries: 1 })
    await assert.rejects(api().products({ page: 1 }), (e: StoreApiError) => e.code === 'unauthorized' && e.key === 'sync.gomag_key_rejected')
    await assert.rejects(api().products({ page: 1 }), (e: StoreApiError) => e.code === 'unauthorized' && e.key === 'sync.gomag_shop_or_key')
    await assert.rejects(api().products({ page: 1 }), (e: StoreApiError) => e.code === 'bad_response' && e.key === 'sync.gomag_error' && e.params?.detail === 'interval invalid')
    // 429 cu Retry-After: se așteaptă și se reîncearcă
    const started = Date.now()
    const empty = await api().products({ page: 1 })
    assert.deepEqual(empty.items, [])
    assert.ok(Date.now() - started >= 1000, 'a așteptat Retry-After')
    // 500 de două ori: indisponibil, după reîncercare
    await assert.rejects(api().products({ page: 1 }), (e: StoreApiError) => e.code === 'unavailable' && e.key === 'sync.gomag_unavailable')
    assert.equal(i, replies.length)
  } finally {
    net.restore()
  }
})

test('clientul: stările și monedele vin ca listă', async () => {
  const net = stubNetwork((_req, url) => url.pathname.endsWith('/order/status/read/json')
    ? json([{ id: 1, name: 'Comanda noua' }, { id: 7, name: 'Anulata', type: 'cancel' }], 200, { 'Api-RateLimit-Read': '50' })
    : json([{ name: 'EUR', currency: 'EUR', multiplier: '5.0' }, { name: 'RON', currency: 'RON', multiplier: '1' }], 200, { 'Api-RateLimit-Read': '50' }))
  try {
    const api = new GomagApi('https://magazin.ro', 'cheie-de-proba-1234567890', { deadline: Date.now() + 30_000 })
    const statuses = await api.statuses()
    assert.equal(statuses.length, 2)
    assert.equal(orderState(7, null, statusMap(statuses)), 'cancelled')
    assert.equal(baseCurrency(await api.currencies()), 'RON')
  } finally {
    net.restore()
  }
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}

test('ApiShop: adresa cu https://, cu și fără www., apoi doar domeniul', () => {
  assert.deepEqual(apiShopCandidates('https://magazin.ro'), ['https://magazin.ro', 'https://www.magazin.ro', 'magazin.ro', 'www.magazin.ro'])
  assert.deepEqual(apiShopCandidates('https://www.magazin.ro'), ['https://www.magazin.ro', 'https://magazin.ro', 'www.magazin.ro', 'magazin.ro'])
})
