import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pagePath, salesByCampaign, salesByOffer, type HontrioOrder, type OrderLine } from '@/lib/ads/store-sales'

// Vânzările din magazin aduse de campaniile Hontrio, pentru pilot: pe campanie
// (sursa „hontrio-<ID>”), într-o fereastră, și pe ofertă (rândurile comenzii și
// pagina de intrare din reclamă, ca Google).

const order = (id: string, over: Partial<HontrioOrder> = {}): HontrioOrder => ({
  id, utm_campaign: 'hontrio-111', placed_at: '2026-11-21T17:42:54Z', total: 29.8, attribution: null, ...over,
})
const line = (order_id: string, offer_id: string, quantity: number, unit_price: number, is_extra = false): OrderLine => ({ order_id, offer_id, quantity, unit_price, is_extra })

test('pe campanie: de la începutul socotelii ei, până la capătul ferestrei', () => {
  const orders = [
    order('a'),                                                       // 111, după lansare
    order('b', { placed_at: '2026-11-18T10:00:00Z' }),                // 111, înainte de lansare
    order('c', { utm_campaign: 'hontrio-222', total: '100.50' }),     // 222
    order('d', { utm_campaign: 'hontrio-333' }),                      // fără început: nu se numără
    order('e', { placed_at: '2026-11-25T08:00:00Z' }),                // după capătul ferestrei
  ]
  const start = new Map([['111', '2026-11-18T22:11:24.518+00:00'], ['222', '2026-11-01T00:00:00Z']])
  assert.deepEqual(Object.fromEntries(salesByCampaign(orders, start)), {
    '111': { orders: 2, value: 59.6 },
    '222': { orders: 1, value: 100.5 },
  })
  assert.deepEqual(Object.fromEntries(salesByCampaign(orders, start, Date.parse('2026-11-23T00:00:00Z'))), {
    '111': { orders: 1, value: 29.8 },
    '222': { orders: 1, value: 100.5 },
  })
})

test('calea paginii: fără domeniu, parametri și „/” final, cu litere mici', () => {
  assert.equal(pagePath('https://vetdepo.ro/product/sare-brichete-simple-5kg'), '/product/sare-brichete-simple-5kg')
  assert.equal(pagePath('/product/Sare-Brichete-Simple-5kg/?gclid=x'), '/product/sare-brichete-simple-5kg')
  assert.equal(pagePath('https://magazin.ro/produs/lamp%C4%83'), '/produs/lampă')
  assert.equal(pagePath('/'), null, 'prima pagină nu e a niciunui produs')
  assert.equal(pagePath(''), null)
  assert.equal(pagePath(null), null)
})

test('pe ofertă: ce s-a cumpărat, plus oferta paginii de intrare când n-a fost cumpărată', () => {
  const orders = [
    // VetDepo, 21.11.2026: a intrat pe sare și a cumpărat 2 bucăți
    order('o1', { attribution: { landing_path: '/product/sare-brichete-simple-5kg' } }),
    // A intrat pe lampă, a cumpărat un bec și transport
    order('o2', { total: 150, attribution: { landing_path: '/produs/lampa' } }),
    // Fără pagină de intrare: doar ce s-a cumpărat
    order('o3', { total: 40 }),
  ]
  const lines = [
    line('o1', 'sare', 2, 14.9),
    line('o2', 'bec', 1, 120),
    line('o2', 'transport', 1, 30, true),
    line('o3', 'bec', 1, 20),
    line('o3', 'bec', 1, 20),
  ]
  const byPath = new Map([['/product/sare-brichete-simple-5kg', ['sare']], ['/produs/lampa', ['lampa-alba', 'lampa-neagra']]])
  assert.deepEqual(Object.fromEntries(salesByOffer(orders, lines, byPath)), {
    sare: { orders: 1, value: 29.8 },
    bec: { orders: 2, value: 160 },
    // Variantele paginii pe care s-a intrat primesc comanda întreagă, ca la Google
    'lampa-alba': { orders: 1, value: 150 },
    'lampa-neagra': { orders: 1, value: 150 },
  })
})
