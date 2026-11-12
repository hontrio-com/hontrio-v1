import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertPublicHost, fetchPublic, isBlockedAddress, PublicFetchError, validateStoreUrl } from '@/lib/security/validate-url'

// Adresele magazinelor pe care le cheamă serverul: doar HTTPS, doar adrese
// publice, fără redirecționări spre rețeaua internă sau spre alt site (SSRF).

test('adresele IP private, locale și rezervate sunt blocate; cele publice nu', () => {
  const blocked = [
    '10.1.2.3', '127.0.0.1', '127.0.0.2', '0.0.0.0', '169.254.169.254', '100.64.0.1', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '192.0.2.10', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '[::1]', 'fe80::1', 'fe80::1%eth0', 'fd00::1', 'fc00::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe', '2002:c0a8:0101::1', '2001::1',
    'nu-e-ip', '300.1.1.1',
  ]
  for (const ip of blocked) assert.equal(isBlockedAddress(ip), true, ip)
  const allowed = ['8.8.8.8', '93.184.216.34', '172.32.0.1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2606:4700:4700::1111', '2a00:1450:4001::200e']
  for (const ip of allowed) assert.equal(isBlockedAddress(ip), false, ip)
})

test('forma adresei: HTTPS, domeniu public, fără date de logare sau porturi ciudate', () => {
  assert.deepEqual(validateStoreUrl('magazin.ro'), { valid: true, cleaned: 'https://magazin.ro' })
  assert.deepEqual(validateStoreUrl('http://Magazin.RO/shop/?x=1'), { valid: true, cleaned: 'https://magazin.ro' })
  assert.deepEqual(validateStoreUrl('https://magazin.ro:8443/'), { valid: true, cleaned: 'https://magazin.ro:8443' })
  const error = (url: unknown) => validateStoreUrl(url).error
  assert.equal(error('https://localhost'), 'sync.store_url_local')
  assert.equal(error('https://localhost.'), 'sync.store_url_local')
  assert.equal(error('https://printer.local'), 'sync.store_url_local')
  assert.equal(error('https://db.internal'), 'sync.store_url_local')
  assert.equal(error('https://10.0.0.5'), 'sync.store_url_private_ip')
  assert.equal(error('https://127.0.0.1'), 'sync.store_url_private_ip')
  assert.equal(error('https://2130706433'), 'sync.store_url_private_ip')
  assert.equal(error('https://[::1]'), 'sync.store_url_private_ip')
  assert.equal(error('https://user:pass@shop.ro'), 'sync.store_url_credentials')
  assert.equal(error('https://shop'), 'sync.store_url_domain')
  assert.equal(error('https://shop.ro:8080'), 'sync.store_url_port')
  assert.equal(error('ftp://shop.ro'), 'sync.store_url_invalid')
  assert.equal(error(''), 'sync.store_url_invalid')
  assert.equal(error(42), 'sync.store_url_invalid')
})

test('numele care rezolvă la o adresă privată sunt refuzate înainte de orice cerere', async () => {
  const resolveTo = (...ips: string[]) => async () => ips
  await assertPublicHost('magazin.ro', resolveTo('93.184.216.34'))
  for (const ips of [['10.0.0.1'], ['8.8.8.8', '127.0.0.1'], ['::1'], []]) {
    await assert.rejects(assertPublicHost('magazin.ro', resolveTo(...ips)), (err: unknown) =>
      err instanceof PublicFetchError && err.key === 'sync.store_url_private_ip')
  }
  // Un IP scris direct nu ajunge la DNS
  let asked = false
  await assert.rejects(assertPublicHost('169.254.169.254', async () => { asked = true; return ['8.8.8.8'] }), PublicFetchError)
  assert.equal(asked, false)
})

test('fetchPublic: urmează doar redirecționările din aceeași origine', async () => {
  const original = globalThis.fetch
  const publicDns = async () => ['93.184.216.34']
  const calls: string[] = []
  const replies: Response[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push(String(input))
    assert.equal(init?.redirect, 'manual')
    return replies.shift() ?? new Response('{}', { status: 200 })
  }) as typeof fetch
  try {
    // Aceeași origine: se urmează, cu antetele cererii
    replies.push(new Response(null, { status: 301, headers: { location: '/wp-json/wc/v3/orders?page=2' } }))
    const ok = await fetchPublic('https://magazin.ro/wp-json/wc/v3/orders', {}, { resolve: publicDns })
    assert.equal(ok.status, 200)
    assert.deepEqual(calls, ['https://magazin.ro/wp-json/wc/v3/orders', 'https://magazin.ro/wp-json/wc/v3/orders?page=2'])

    // Alt site (aici: spre metadatele cloud, pe HTTP): oprit, cu adresa în mesaj
    for (const location of ['http://169.254.169.254/latest/meta-data/', 'https://www.magazin.ro/', 'http://magazin.ro/']) {
      calls.length = 0
      replies.push(new Response(null, { status: 302, headers: { location } }))
      await assert.rejects(fetchPublic('https://magazin.ro/x', {}, { resolve: publicDns }), (err: unknown) =>
        err instanceof PublicFetchError && err.code === 'redirect' && err.params?.url === new URL(location).origin)
      assert.equal(calls.length, 1)
    }

    // O adresă privată nu pleacă deloc
    calls.length = 0
    await assert.rejects(fetchPublic('https://intern.magazin.ro/', {}, { resolve: async () => ['10.1.1.1'] }), PublicFetchError)
    assert.equal(calls.length, 0)

    // Prea multe redirecționări în cerc
    for (let i = 0; i < 5; i++) replies.push(new Response(null, { status: 302, headers: { location: '/bucla' } }))
    await assert.rejects(fetchPublic('https://magazin.ro/', {}, { resolve: publicDns }), (err: unknown) =>
      err instanceof PublicFetchError && err.key === 'sync.store_redirect_loop')
  } finally {
    globalThis.fetch = original
  }
})
