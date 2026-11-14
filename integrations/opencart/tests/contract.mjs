#!/usr/bin/env node
// =============================================
// Verifică un magazin OpenCart cu extensia Hontrio față de contract
// (docs/integrari/OPENCART.md): plicul, cheia, erorile, paginarea, fiecare câmp
// și fiecare regulă. Fără dependențe; Node 18+.
//
//   node integrations/opencart/tests/contract.mjs <adresa magazinului> <cheie>
//   node integrations/opencart/tests/contract.mjs <adresa> <cheie> --expect-disabled
//
// Cu --expect-disabled, API-ul trebuie să fie oprit din panoul extensiei (403).
// Iese cu codul 1 dacă vreo verificare pică.
// =============================================

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const [baseArg, key] = args.filter(a => !a.startsWith('--'))
if (!baseArg || !key) {
  console.error('Folosire: node contract.mjs <adresa magazinului> <cheie> [--expect-disabled] [--quiet]')
  process.exit(2)
}
const BASE = baseArg.replace(/\/+$/, '')
const QUIET = flags.has('--quiet')

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'referrer', 'landing_path', 'captured_at']
// Chei care ar însemna date de identificare ale cumpărătorului
const PII = /^(e-?mail|telephone|phone|fax|firstname|lastname|first_name|last_name|name_?customer|customer|customer_id|company|address|address_1|address_2|address_format|street|city|postcode|zip|zone|ip|forwarded_ip|user_agent|accept_language|custom_field|comment|payment_address.*|shipping_address.*|payment_firstname|shipping_firstname)$/i

let passed = 0
const failures = []

function check(name, cond, detail) {
  if (cond) {
    passed++
    if (!QUIET) console.log(`  ok   ${name}`)
  } else {
    failures.push(`${name}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`)
    console.log(`  FAIL ${name}${detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`)
  }
}

function section(title) {
  if (!QUIET) console.log(`\n${title}`)
}

async function call(action, params = {}, opts = {}) {
  const url = new URL(`${BASE}/index.php`)
  url.searchParams.set('route', 'extension/hontrio/api')
  if (action !== null) url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const headers = { Accept: 'application/json' }
  const sent = 'key' in opts ? opts.key : key
  if (sent !== undefined && sent !== null) headers['X-Hontrio-Key'] = sent
  const res = await fetch(url, { headers, redirect: 'manual' })
  const text = await res.text()
  const at = text.indexOf('{"hontrio_api":')
  let json = null
  try { json = at >= 0 ? JSON.parse(text.slice(at)) : null } catch { json = null }
  return { status: res.status, text, json, headers: res.headers, clean: at === 0 }
}

const isInt = v => Number.isInteger(v)
const isNum = v => typeof v === 'number' && Number.isFinite(v)
const isStrOrNull = v => v === null || (typeof v === 'string' && v !== '')
const close = (a, b) => Math.abs(a - b) <= 0.011

/** Niciun șir gol: lipsa unei valori e null. */
function emptyStrings(value, path = '$') {
  if (value === '') return [path]
  if (Array.isArray(value)) return value.flatMap((v, i) => emptyStrings(v, `${path}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => emptyStrings(v, `${path}.${k}`))
  return []
}

function piiKeys(value, path = '$') {
  if (Array.isArray(value)) return value.flatMap((v, i) => piiKeys(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(PII.test(k) ? [`${path}.${k}`] : []), ...piiKeys(v, `${path}.${k}`)])
  }
  return []
}

function expectError(name, res, status, code) {
  check(`${name}: HTTP ${status}`, res.status === status, `primit ${res.status}`)
  check(`${name}: plicul începe cu {"hontrio_api":1`, res.text.startsWith('{"hontrio_api":1,'), res.text.slice(0, 80))
  check(`${name}: ok=false, error.code=${code}`, res.json?.ok === false && res.json?.error?.code === code && typeof res.json?.error?.message === 'string', res.json)
}

/** Toate paginile unei liste, cu verificarea meta și a ordinii. */
async function pages(action, params, limit, label) {
  const all = []
  let page = 1
  let total = null
  for (;;) {
    const res = await call(action, { ...params, page, limit })
    if (res.status !== 200 || !res.json?.ok) {
      check(`${label}: pagina ${page} răspunde 200`, false, res.text.slice(0, 200))
      return { all, total }
    }
    const { data, meta } = res.json
    if (total === null) total = meta?.total
    const okMeta = meta && meta.page === page && meta.limit === limit && meta.total === total && meta.pages === (total > 0 ? Math.ceil(total / limit) : 0)
    check(`${label}: meta corectă la pagina ${page}`, okMeta, meta)
    check(`${label}: pagina ${page} are cel mult ${limit} rânduri`, Array.isArray(data) && data.length <= limit, data?.length)
    all.push(...data)
    if (page >= meta.pages || data.length === 0) break
    page++
    if (page > 1000) break
  }
  return { all, total }
}

function ascending(ids) {
  return ids.every((id, i) => i === 0 || id > ids[i - 1])
}

async function main() {
  console.log(`Contract Hontrio OpenCart v1 — ${BASE}`)

  // ── Cheia și plicul ────────────────────────────────────────────────────────
  section('Cheia')
  expectError('fără antet', await call('info', {}, { key: null }), 401, 'unauthorized')
  expectError('antet gol', await call('info', {}, { key: '' }), 401, 'unauthorized')
  expectError('cheie greșită', await call('info', {}, { key: '0'.repeat(48) }), 401, 'unauthorized')
  if (/[a-f]/.test(key)) expectError('cheia cu litere mari', await call('info', {}, { key: key.toUpperCase() }), 401, 'unauthorized')
  expectError('cheia trunchiată', await call('info', {}, { key: key.slice(0, -1) }), 401, 'unauthorized')

  if (flags.has('--expect-disabled')) {
    section('API oprit din panou')
    for (const action of ['info', 'products', 'product_ids', 'orders', 'order_ids']) {
      expectError(`${action} cu API-ul oprit`, await call(action), 403, 'disabled')
    }
    return
  }

  // ── info ───────────────────────────────────────────────────────────────────
  section('info')
  const infoRes = await call('info')
  check('info: HTTP 200', infoRes.status === 200, infoRes.status)
  check('info: plicul începe exact cu {"hontrio_api":1,"ok":true', infoRes.text.startsWith('{"hontrio_api":1,"ok":true,'), infoRes.text.slice(0, 80))
  check('info: Content-Type JSON', /^application\/json/.test(infoRes.headers.get('content-type') ?? ''), infoRes.headers.get('content-type'))
  check('info: Cache-Control no-store', /no-store/.test(infoRes.headers.get('cache-control') ?? ''), infoRes.headers.get('cache-control'))
  const info = infoRes.json?.data
  if (!info) { check('info: data', false, infoRes.text.slice(0, 200)); return }
  check('info.extension_version', typeof info.extension_version === 'string' && /^\d+\.\d+\.\d+$/.test(info.extension_version), info.extension_version)
  check('info.opencart_version', typeof info.opencart_version === 'string' && /^[34]\.\d/.test(info.opencart_version), info.opencart_version)
  check('info.php_version', typeof info.php_version === 'string' && /^\d+\.\d+/.test(info.php_version), info.php_version)
  const st = info.store ?? {}
  check('info.store.id', isInt(st.id) && st.id >= 0, st.id)
  check('info.store.name', isStrOrNull(st.name), st.name)
  check('info.store.url (absolută, fără / la final)', typeof st.url === 'string' && /^https?:\/\/[^/]+/.test(st.url) && !st.url.endsWith('/'), st.url)
  check('info.store.country (ISO 2 sau null)', st.country === null || /^[A-Z]{2}$/.test(st.country), st.country)
  check('info.store.language (cod scurt)', st.language === null || /^[a-z]{2,3}$/.test(st.language), st.language)
  check('info.store.currency (ISO 3)', /^[A-Z]{3}$/.test(st.currency ?? ''), st.currency)
  check('info.store.timezone', typeof st.timezone === 'string' && st.timezone.length > 0, st.timezone)
  check('info.store.prices_include_tax (bool)', typeof st.prices_include_tax === 'boolean', st.prices_include_tax)
  check('info.store.customer_group_id', isInt(st.customer_group_id), st.customer_group_id)
  check('info.counts', isInt(info.counts?.products) && isInt(info.counts?.orders) && info.counts.products >= 0 && info.counts.orders >= 0, info.counts)
  check('info.statuses', Array.isArray(info.statuses) && info.statuses.length > 0 && info.statuses.every(s => isInt(s.id) && isStrOrNull(s.name) && typeof s.processing === 'boolean' && typeof s.complete === 'boolean'), info.statuses)
  const ex = info.extensions ?? {}
  check('info.extensions (feed/analytics/module, liste de coduri)', ['feed', 'analytics', 'module'].every(k => Array.isArray(ex[k]) && ex[k].every(c => typeof c === 'string' && c !== '')), ex)
  check('info.extensions.module conține hontrio', Array.isArray(ex.module) && ex.module.includes('hontrio'), ex.module)
  check('info.tracking', typeof info.tracking?.enabled === 'boolean' && (info.tracking.since === null || ISO.test(info.tracking.since)) && (info.tracking.enabled || info.tracking.since === null), info.tracking)
  check('info.server_time (ISO cu fus)', ISO.test(info.server_time ?? ''), info.server_time)
  check('info: niciun șir gol', emptyStrings(info).length === 0, emptyStrings(info))
  const statusById = new Map((info.statuses ?? []).map(s => [s.id, s.name]))

  // ── Erori de cerere ────────────────────────────────────────────────────────
  section('Cereri greșite (400)')
  expectError('fără action', await call(null), 400, 'bad_request')
  {
    const url = `${BASE}/index.php?route=extension/hontrio/api&action=info`
    const res = await fetch(url, { method: 'POST', headers: { 'X-Hontrio-Key': key, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text.slice(Math.max(0, text.indexOf('{"hontrio_api":')))) } catch { json = null }
    expectError('POST în loc de GET', { status: res.status, text, json }, 400, 'bad_request')
  }
  expectError('action necunoscută', await call('delete_everything'), 400, 'bad_request')
  for (const page of ['0', '-1', 'abc', '1.5']) expectError(`products page=${page}`, await call('products', { page }), 400, 'bad_request')
  for (const [action, max] of [['products', 250], ['orders', 100], ['product_ids', 5000], ['order_ids', 5000]]) {
    expectError(`${action} limit=0`, await call(action, { limit: 0 }), 400, 'bad_request')
    expectError(`${action} limit=${max + 1}`, await call(action, { limit: max + 1 }), 400, 'bad_request')
    expectError(`${action} limit=x`, await call(action, { limit: 'x' }), 400, 'bad_request')
    const atMax = await call(action, { limit: max })
    check(`${action} limit=${max} (maximul) e acceptat`, atMax.status === 200 && atMax.json?.ok === true && atMax.json.meta.limit === max, atMax.text.slice(0, 120))
  }
  for (const bad of ['ieri', '2026-13-45', '2026-02-30', '2026-11-14T25:00:00Z', "2026-01-01' OR 1=1"]) {
    expectError(`products modified_after=${bad}`, await call('products', { modified_after: bad }), 400, 'bad_request')
    expectError(`orders created_after=${bad}`, await call('orders', { created_after: bad }), 400, 'bad_request')
  }
  expectError('products ids=abc', await call('products', { ids: 'abc' }), 400, 'bad_request')
  expectError('products ids=1,-2', await call('products', { ids: '1,-2' }), 400, 'bad_request')
  expectError('products 251 de ids', await call('products', { ids: Array.from({ length: 251 }, (_, i) => i + 1).join(',') }), 400, 'bad_request')
  expectError('orders 101 ids', await call('orders', { ids: Array.from({ length: 101 }, (_, i) => i + 1).join(',') }), 400, 'bad_request')
  const defaults = await call('products')
  check('products: limita implicită 100', defaults.json?.meta?.limit === 100, defaults.json?.meta)
  const defaultOrders = await call('orders')
  check('orders: limita implicită 50', defaultOrders.json?.meta?.limit === 50, defaultOrders.json?.meta)
  const defaultIds = await call('product_ids')
  check('product_ids: limita implicită 5000', defaultIds.json?.meta?.limit === 5000, defaultIds.json?.meta)

  // ── Produsele ──────────────────────────────────────────────────────────────
  section('products')
  const { all: products, total: productTotal } = await pages('products', {}, 7, 'products')
  check('products: total = info.counts.products', productTotal === info.counts.products, { productTotal, counts: info.counts.products })
  check('products: toate rândurile primite', products.length === productTotal, products.length)
  const productIds = products.map(p => p.product_id)
  check('products: id-uri strict crescătoare pe toate paginile', ascending(productIds), productIds)
  check('products: niciun șir gol', emptyStrings(products).length === 0, emptyStrings(products).slice(0, 5))
  const beyond = await call('products', { page: Math.max(1, Math.ceil(productTotal / 7)) + 1, limit: 7 })
  check('products: pagina de după ultima e goală', beyond.status === 200 && Array.isArray(beyond.json?.data) && beyond.json.data.length === 0 && beyond.json.meta.total === productTotal, beyond.json?.meta)

  for (const p of products) {
    const tag = `produs ${p.product_id}`
    const problems = []
    if (!isInt(p.product_id) || p.product_id <= 0) problems.push('product_id')
    if (!isInt(p.master_id) || p.master_id < 0) problems.push('master_id')
    if (!(p.variant === null || (Array.isArray(p.variant) && p.variant.length > 0 && p.variant.every(v => typeof v.name === 'string' && typeof v.value === 'string')))) problems.push('variant')
    if (typeof p.name !== 'string' || p.name === '') problems.push('name')
    for (const k of ['model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'manufacturer', 'stock_status']) if (!isStrOrNull(p[k])) problems.push(k)
    if (typeof p.url !== 'string' || !/^https?:\/\//.test(p.url) || p.url.includes('&amp;')) problems.push('url')
    if (!(p.image === null || (typeof p.image === 'string' && /^https?:\/\/.+\/image\//.test(p.image)))) problems.push('image')
    if (!(Array.isArray(p.categories) && p.categories.every(path => Array.isArray(path) && path.length > 0 && path.every(n => typeof n === 'string' && n !== '')))) problems.push('categories')
    if (!isNum(p.price) || p.price < 0 || !isNum(p.price_net) || p.price_net < 0) problems.push('price')
    if (p.price + 0.0001 < p.price_net) problems.push('price < price_net')
    if (!(p.regular_price === null || (isNum(p.regular_price) && p.regular_price > p.price))) problems.push('regular_price')
    if (!(p.regular_price_net === null || (isNum(p.regular_price_net) && p.regular_price_net > p.price_net))) problems.push('regular_price_net')
    if ((p.regular_price === null) !== (p.regular_price_net === null)) problems.push('regular_price pereche')
    if (!(p.special_ends === null || DAY.test(p.special_ends))) problems.push('special_ends')
    if (!isNum(p.tax_rate) || p.tax_rate < 0) problems.push('tax_rate')
    if (p.price_net > 0 && Math.abs(p.tax_rate - Math.round((p.price / p.price_net - 1) * 10000) / 100) > 0.011) problems.push('tax_rate ≠ price/price_net')
    if (!isInt(p.quantity)) problems.push('quantity')
    if (typeof p.subtract !== 'boolean' || typeof p.available !== 'boolean') problems.push('subtract/available')
    if (p.quantity > 0 && (p.available !== true || p.stock_status !== null)) problems.push('stoc pozitiv: available/stock_status')
    if (!ISO.test(p.date_added ?? '') || !ISO.test(p.date_modified ?? '')) problems.push('date')
    const keys = Object.keys(p).sort().join(',')
    const expected = ['product_id', 'master_id', 'variant', 'name', 'model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'url', 'image', 'manufacturer', 'categories', 'price', 'price_net', 'regular_price', 'regular_price_net', 'special_ends', 'tax_rate', 'quantity', 'subtract', 'available', 'stock_status', 'date_added', 'date_modified'].sort().join(',')
    if (keys !== expected) problems.push('cheile: ' + keys)
    check(`${tag}: câmpuri și tipuri`, problems.length === 0, problems)
  }

  const idsRes = await pages('product_ids', {}, 5, 'product_ids')
  check('product_ids = id-urile din products', JSON.stringify(idsRes.all) === JSON.stringify(productIds), { ids: idsRes.all.slice(0, 20) })
  check('product_ids: numere întregi', idsRes.all.every(isInt))

  if (productIds.length >= 3) {
    const pick = [productIds[productIds.length - 1], productIds[0], productIds[1]]
    const missing = productIds[productIds.length - 1] + 100000
    const byIds = await call('products', { ids: [...pick, missing].join(',') })
    const got = (byIds.json?.data ?? []).map(p => p.product_id)
    check('products ids=: doar cele listate, în ordine crescătoare', JSON.stringify(got) === JSON.stringify([...pick].sort((a, b) => a - b)), got)
    check('products ids=: meta.total = câte s-au găsit', byIds.json?.meta?.total === pick.length, byIds.json?.meta)
  }

  const future = new Date(Date.now() + 10 * 365 * 86400000).toISOString().slice(0, 19) + 'Z'
  const none = await call('products', { modified_after: future })
  check('products modified_after în viitor → 0', none.json?.meta?.total === 0 && none.json.data.length === 0, none.json?.meta)
  const allSince = await call('products', { modified_after: '2000-01-01' })
  check('products modified_after=2000-01-01 → toate', allSince.json?.meta?.total === productTotal, allSince.json?.meta)
  if (products.length) {
    const sorted = [...products].sort((a, b) => Date.parse(a.date_modified) - Date.parse(b.date_modified))
    const pivot = sorted[Math.floor(sorted.length / 2)]
    const since = await call('products', { modified_after: pivot.date_modified, limit: 250 })
    const expectedIds = products.filter(p => Date.parse(p.date_modified) >= Date.parse(pivot.date_modified)).map(p => p.product_id)
    check('products modified_after=<o dată din listă> → exact cele modificate de atunci', since.json?.meta?.total === expectedIds.length && JSON.stringify((since.json?.data ?? []).map(p => p.product_id)) === JSON.stringify(expectedIds.slice(0, 250)), { pivot: pivot.date_modified, expected: expectedIds.length, got: since.json?.meta })
    // Aceeași clipă scrisă în UTC trebuie să dea același rezultat
    const utc = new Date(Date.parse(pivot.date_modified)).toISOString().replace('.000Z', 'Z')
    const sinceUtc = await call('products', { modified_after: utc, limit: 250 })
    check('products modified_after în UTC = același rezultat', sinceUtc.json?.meta?.total === expectedIds.length, { utc, got: sinceUtc.json?.meta })
  }

  // ── Comenzile ──────────────────────────────────────────────────────────────
  section('orders')
  const { all: orders, total: orderTotal } = await pages('orders', {}, 2, 'orders')
  check('orders: total = info.counts.orders', orderTotal === info.counts.orders, { orderTotal, counts: info.counts.orders })
  check('orders: toate rândurile primite', orders.length === orderTotal, orders.length)
  const orderIds = orders.map(o => o.order_id)
  check('orders: id-uri strict crescătoare', ascending(orderIds), orderIds)
  check('orders: niciun șir gol', emptyStrings(orders).length === 0, emptyStrings(orders).slice(0, 5))
  check('orders: nicio cheie cu date de identificare', piiKeys(orders).length === 0, piiKeys(orders).slice(0, 10))

  for (const o of orders) {
    const tag = `comanda ${o.order_id}`
    const problems = []
    if (!isInt(o.order_id) || o.order_id <= 0) problems.push('order_id')
    if (!isStrOrNull(o.invoice)) problems.push('invoice')
    if (!isInt(o.status_id) || o.status_id <= 0 || !statusById.has(o.status_id)) problems.push('status_id')
    if (o.status !== (statusById.get(o.status_id) ?? null)) problems.push('status ≠ info.statuses')
    if (!ISO.test(o.date_added ?? '') || !ISO.test(o.date_modified ?? '')) problems.push('date')
    if (Date.parse(o.date_modified) < Date.parse(o.date_added) - 1000) problems.push('date_modified < date_added')
    if (o.currency !== info.store.currency) problems.push('currency ≠ moneda magazinului')
    if (!/^[A-Z]{3}$/.test(o.currency_code ?? '') || !isNum(o.currency_value) || o.currency_value <= 0) problems.push('currency_code/value')
    if (!isNum(o.total)) problems.push('total')
    if (!Array.isArray(o.totals) || !o.totals.every(t => typeof t.code === 'string' && isStrOrNull(t.title) && isNum(t.value))) problems.push('totals')
    const totalRow = (o.totals ?? []).find(t => t.code === 'total')
    if (!totalRow || !close(totalRow.value, o.total)) problems.push('rândul total ≠ total')
    const sum = (o.totals ?? []).filter(t => t.code !== 'total').reduce((s, t) => s + t.value, 0)
    if (!close(sum, o.total)) problems.push(`suma rândurilor ${sum} ≠ total ${o.total}`)
    for (const k of ['payment_method', 'payment_code', 'shipping_method', 'coupon', 'tracking']) if (!isStrOrNull(o[k])) problems.push(k)
    if (!(o.country === null || /^[A-Z]{2}$/.test(o.country))) problems.push('country')
    if (!isInt(o.marketing_id) || o.marketing_id < 0) problems.push('marketing_id')
    if (!Array.isArray(o.products) || o.products.length === 0) problems.push('products')
    for (const p of o.products ?? []) {
      if (!isInt(p.order_product_id) || !isInt(p.product_id) || !isInt(p.master_id) || !isInt(p.quantity) || p.quantity <= 0) problems.push(`linia ${p.order_product_id}: id/cantitate`)
      if (typeof p.name !== 'string' || p.name === '' || !isStrOrNull(p.model)) problems.push(`linia ${p.order_product_id}: nume/model`)
      if (!isNum(p.price) || !isNum(p.tax) || !isNum(p.total)) problems.push(`linia ${p.order_product_id}: sume`)
      else if (!close(p.total, p.price * p.quantity)) problems.push(`linia ${p.order_product_id}: total ${p.total} ≠ ${p.price}×${p.quantity}`)
      if (!Array.isArray(p.options) || !p.options.every(x => typeof x.name === 'string' && isStrOrNull(x.value))) problems.push(`linia ${p.order_product_id}: options`)
      const lineKeys = Object.keys(p).sort().join(',')
      if (lineKeys !== ['order_product_id', 'product_id', 'master_id', 'name', 'model', 'quantity', 'price', 'tax', 'total', 'options'].sort().join(',')) problems.push('cheile liniei: ' + lineKeys)
    }
    if (o.source !== null) {
      if (typeof o.source !== 'object' || Object.keys(o.source).sort().join(',') !== [...SOURCE_KEYS].sort().join(',')) problems.push('source: cheile')
      else {
        if (!SOURCE_KEYS.every(k => isStrOrNull(o.source[k]) && (o.source[k] === null || o.source[k].length <= 200))) problems.push('source: valori')
        if (!(o.source.captured_at === null || ISO.test(o.source.captured_at))) problems.push('source.captured_at')
        if (!(o.source.referrer === null || /^https?:\/\/[^/?#]+$/.test(o.source.referrer))) problems.push('source.referrer (doar originea)')
        if (!(o.source.landing_path === null || (o.source.landing_path.startsWith('/') && !o.source.landing_path.includes('?')))) problems.push('source.landing_path')
        if (!['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'].some(k => o.source[k] !== null)) problems.push('source fără niciun parametru')
      }
    }
    const keys = Object.keys(o).sort().join(',')
    const expected = ['order_id', 'invoice', 'status_id', 'status', 'date_added', 'date_modified', 'currency', 'currency_code', 'currency_value', 'total', 'totals', 'payment_method', 'payment_code', 'shipping_method', 'country', 'coupon', 'marketing_id', 'tracking', 'products', 'source'].sort().join(',')
    if (keys !== expected) problems.push('cheile: ' + keys)
    check(`${tag}: câmpuri, tipuri și sume`, problems.length === 0, problems)
  }

  const orderIdsRes = await pages('order_ids', {}, 3, 'order_ids')
  check('order_ids = id-urile din orders', JSON.stringify(orderIdsRes.all) === JSON.stringify(orderIds), orderIdsRes.all.slice(0, 20))

  const noneOrders = await call('orders', { created_after: future })
  check('orders created_after în viitor → 0', noneOrders.json?.meta?.total === 0, noneOrders.json?.meta)
  const noneModified = await call('orders', { modified_after: future })
  check('orders modified_after în viitor → 0', noneModified.json?.meta?.total === 0, noneModified.json?.meta)
  const allOrders = await call('orders', { created_after: '2000-01-01T00:00:00Z' })
  check('orders created_after=2000 → toate', allOrders.json?.meta?.total === orderTotal, allOrders.json?.meta)
  const noneIds = await call('order_ids', { created_after: future })
  check('order_ids created_after în viitor → 0', noneIds.json?.meta?.total === 0, noneIds.json?.meta)

  if (orders.length) {
    const sorted = [...orders].sort((a, b) => Date.parse(a.date_added) - Date.parse(b.date_added))
    const pivot = sorted[Math.floor(sorted.length / 2)]
    const since = await call('orders', { created_after: pivot.date_added, limit: 100 })
    const expectedIds = orders.filter(o => Date.parse(o.date_added) >= Date.parse(pivot.date_added)).map(o => o.order_id)
    check('orders created_after=<o dată din listă> → exact cele de atunci', since.json?.meta?.total === expectedIds.length && JSON.stringify((since.json?.data ?? []).map(o => o.order_id)) === JSON.stringify(expectedIds.slice(0, 100)), { pivot: pivot.date_added, expected: expectedIds.length, got: since.json?.meta })
    const sortedMod = [...orders].sort((a, b) => Date.parse(a.date_modified) - Date.parse(b.date_modified))
    const pivotMod = sortedMod[Math.floor(sortedMod.length / 2)]
    const sinceMod = await call('orders', { modified_after: pivotMod.date_modified, limit: 100 })
    const expectedMod = orders.filter(o => Date.parse(o.date_modified) >= Date.parse(pivotMod.date_modified)).map(o => o.order_id)
    check('orders modified_after=<o dată din listă> → exact cele modificate de atunci', sinceMod.json?.meta?.total === expectedMod.length && JSON.stringify((sinceMod.json?.data ?? []).map(o => o.order_id)) === JSON.stringify(expectedMod.slice(0, 100)), { pivot: pivotMod.date_modified, expected: expectedMod.length, got: sinceMod.json?.meta })
    const sinceIds = await call('order_ids', { created_after: pivot.date_added })
    check('order_ids created_after = aceleași id-uri', JSON.stringify(sinceIds.json?.data) === JSON.stringify(expectedIds.slice(0, 5000)) && sinceIds.json?.meta?.total === expectedIds.length, sinceIds.json?.meta)

    const pick = orderIds.slice(0, 2)
    const byIds = await call('orders', { ids: [...pick, orderIds[orderIds.length - 1] + 100000].join(',') })
    check('orders ids=: doar cele existente', JSON.stringify((byIds.json?.data ?? []).map(o => o.order_id)) === JSON.stringify(pick), byIds.json?.meta)
  } else {
    console.log('  (magazinul n-are comenzi: verificările pe comenzi s-au făcut doar pe liste goale)')
  }
}

main()
  .catch(err => {
    failures.push(`excepție: ${err.stack ?? err}`)
    console.log(`  FAIL excepție: ${err.stack ?? err}`)
  })
  .finally(() => {
    console.log(`\n${passed} verificări trecute, ${failures.length} picate — ${BASE}`)
    if (failures.length) {
      for (const f of failures) console.log(`  - ${f}`)
      process.exitCode = 1
    }
  })
