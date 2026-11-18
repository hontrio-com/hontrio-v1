import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localToUtcIso, utcToLocal, utcWall, zoneOffsetMinutes } from '@/lib/commerce/time'
import { countryCode } from '@/lib/commerce/country'
import { wwwVariants } from '@/lib/commerce/connect-types'
import { COMMERCE_PLATFORMS, isCommercePlatform, isKeyPlatform, PLATFORM_NAMES, platformName, storeDisplayName } from '@/lib/commerce/platforms'
import { repeatGuard } from '@/lib/commerce/paged-sync'
import { orderState as edinioOrderState } from '@/lib/edinio/mapping'

// Uneltele comune ale conectorilor: ora locală a platformelor românești, țara
// scrisă cu numele ei, adresele cu și fără „www.", lista platformelor.

const TZ = 'Europe/Bucharest'

test('ora României → UTC, iarna (+2) și vara (+3)', () => {
  assert.equal(localToUtcIso('2026-01-15 10:00:00', TZ), '2026-01-15T08:00:00.000Z')
  assert.equal(localToUtcIso('2026-07-15 10:00:00', TZ), '2026-07-15T07:00:00.000Z')
  // Exemplele din documentația Gomag
  assert.equal(localToUtcIso('2022-10-24 14:42:21', TZ), '2022-10-24T11:42:21.000Z')
  assert.equal(localToUtcIso('2022-11-11 16:20:41', TZ), '2022-11-11T14:20:41.000Z')
  // Miezul nopții local e încă ziua de ieri în UTC
  assert.equal(localToUtcIso('2026-03-01 00:30:00', TZ), '2026-02-28T22:30:00.000Z')
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 0, 15), TZ), 120)
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 6, 15), TZ), 180)
})

test('schimbarea orei: 29 martie și 25 octombrie 2026', () => {
  // Înainte și după trecerea la ora de vară (03:00 → 04:00 ora locală, la 01:00 UTC)
  assert.equal(localToUtcIso('2026-03-29 02:59:59', TZ), '2026-03-29T00:59:59.000Z')
  assert.equal(localToUtcIso('2026-03-29 04:00:00', TZ), '2026-03-29T01:00:00.000Z')
  // Înapoi la ora de iarnă (04:00 → 03:00): după schimbare e +2
  assert.equal(localToUtcIso('2026-10-25 05:00:00', TZ), '2026-10-25T03:00:00.000Z')
  assert.equal(localToUtcIso('2026-10-25 02:00:00', TZ), '2026-10-24T23:00:00.000Z')
})

test('date lipsă, invalide sau cu fus orar', () => {
  for (const v of [null, undefined, '', '   ', '0000-00-00 00:00:00', '2026-02-31 10:00:00', '2026-13-01', 'ieri', '1970-01-01 00:00:00']) {
    assert.equal(localToUtcIso(v as string | null | undefined, TZ), null, String(v))
  }
  // Data cu fusul ei se ia ca atare, oricare ar fi fusul magazinului
  assert.equal(localToUtcIso('2026-11-14T15:04:05+02:00', TZ), '2026-11-14T13:04:05.000Z')
  assert.equal(localToUtcIso('2026-11-14 15:04:05+02:00', TZ), '2026-11-14T13:04:05.000Z')
  assert.equal(localToUtcIso('2026-11-14T13:04:05Z', 'America/New_York'), '2026-11-14T13:04:05.000Z')
  // Doar ziua: miezul nopții local
  assert.equal(localToUtcIso('2026-11-14', TZ), '2026-11-13T22:00:00.000Z')
  // Un fus necunoscut nu oprește nimic: UTC
  assert.equal(localToUtcIso('2026-11-14 10:00:00', 'Mars/Olympus'), '2026-11-14T10:00:00.000Z')
})

test('UTC → ora locală și ora UTC pentru filtrele de dată', () => {
  assert.equal(utcToLocal('2026-07-15T07:00:00.000Z', TZ), '2026-07-15 10:00:00')
  assert.equal(utcToLocal('2026-01-15T08:00:00.000Z', TZ), '2026-01-15 10:00:00')
  assert.equal(utcWall('2026-07-15T07:00:00.000Z'), '2026-07-15 07:00:00')
  // Dus-întors
  for (const local of ['2026-01-01 00:00:00', '2026-06-30 23:59:59', '2026-10-25 05:30:00']) {
    assert.equal(utcToLocal(localToUtcIso(local, TZ)!, TZ), local)
  }
})

test('țara după nume: română, engleză, maghiară, cu sau fără diacritice', () => {
  const cases: [string, string][] = [
    ['Romania', 'RO'], ['România', 'RO'], ['ROMANIA', 'RO'], ['  romania ', 'RO'], ['Románia', 'RO'],
    ['Republica Moldova', 'MD'], ['Moldova', 'MD'], ['Ungaria', 'HU'], ['Magyarország', 'HU'], ['Hungary', 'HU'],
    ['Bulgaria', 'BG'], ['Germania', 'DE'], ['Deutschland', 'DE'], ['Franța', 'FR'], ['Franta', 'FR'],
    ['Italia', 'IT'], ['Spania', 'ES'], ['Austria', 'AT'], ['Marea Britanie', 'GB'], ['Regatul Unit', 'GB'],
    ['UK', 'GB'], ['SUA', 'US'], ['Statele Unite ale Americii', 'US'], ['Olanda', 'NL'], ['Țările de Jos', 'NL'],
    ['Cehia', 'CZ'], ['Republica Cehă', 'CZ'], ['Elveția', 'CH'], ['Ucraina', 'UA'], ['Turcia', 'TR'],
    ['RO', 'RO'], ['ro', 'RO'], ['md', 'MD'], ['GB', 'GB'],
  ]
  for (const [name, code] of cases) assert.equal(countryCode(name), code, name)
  for (const v of ['', 'Atlantida', 'XX', 'EU', 'Uniunea Europeană', null, undefined, 42]) {
    assert.equal(countryCode(v as string), null, String(v))
  }
})

test('adresele cu și fără „www.", cu folderul păstrat', () => {
  assert.deepEqual(wwwVariants('https://magazin.ro'), ['https://magazin.ro', 'https://www.magazin.ro'])
  assert.deepEqual(wwwVariants('https://www.magazin.ro'), ['https://www.magazin.ro', 'https://magazin.ro'])
  assert.deepEqual(wwwVariants('https://magazin.ro/shop'), ['https://magazin.ro/shop', 'https://www.magazin.ro/shop'])
  assert.deepEqual(wwwVariants('https://magazin.ro:8443'), ['https://magazin.ro:8443', 'https://www.magazin.ro:8443'])
})

test('platformele: toate au nume; doar cele cu chei sunt „cu chei"', () => {
  assert.equal(COMMERCE_PLATFORMS.length, 6)
  for (const p of COMMERCE_PLATFORMS) assert.ok(PLATFORM_NAMES[p], p)
  assert.equal(platformName('merchantpro'), 'MerchantPro')
  assert.equal(platformName('necunoscut'), 'necunoscut')
  assert.equal(isCommercePlatform('opencart'), true)
  assert.equal(isCommercePlatform('emag'), false)
  assert.equal(isKeyPlatform('gomag'), true)
  assert.equal(isKeyPlatform('shopify'), false)
  assert.equal(isKeyPlatform('edinio'), false)
})

test('paginile repetate (o platformă care ignoră numărul paginii) opresc lista', () => {
  const repeated = repeatGuard<{ id: number }>(x => String(x.id))
  assert.equal(repeated([{ id: 1 }, { id: 2 }], 1), false)
  assert.equal(repeated([{ id: 3 }, { id: 4 }], 2), false)
  assert.equal(repeated([{ id: 3 }, { id: 4 }], 3), true, 'aceeași pagină ca precedenta')
  assert.equal(repeated([], 4), false, 'o pagină goală nu e o repetiție')
  const resumed = repeatGuard<{ id: number }>(x => String(x.id))
  assert.equal(resumed([{ id: 9 }], 7), false, 'o trecere reluată nu are o pagină precedentă')
})

test('numele magazinului pentru pagini: cel dat de platformă, altfel adresa', () => {
  assert.equal(storeDisplayName({ store_name: 'Casa Luminii', store_url: 'https://casa.ro' }), 'Casa Luminii')
  assert.equal(storeDisplayName({ store_name: null, store_url: 'https://www.magazin.ro/' }), 'www.magazin.ro')
  assert.equal(storeDisplayName({ store_name: '  ', store_url: 'https://magazin.ro/shop' }), 'magazin.ro/shop')
  assert.equal(storeDisplayName({ store_name: null, store_url: 'magazin.myshopify.com' }), 'magazin.myshopify.com')
})

test('Edinio: plata rambursată face comanda rambursată, oricare ar fi starea ei', () => {
  assert.equal(edinioOrderState('confirmed', 'refunded'), 'refunded')
  assert.equal(edinioOrderState('delivered', 'refunded'), 'refunded')
  assert.equal(edinioOrderState('pending', 'refunded'), 'refunded')
  assert.equal(edinioOrderState('cancelled', 'refunded'), 'cancelled', 'anulată rămâne anulată')
  assert.equal(edinioOrderState('confirmed', 'paid'), 'confirmed')
  assert.equal(edinioOrderState('delivered', 'unpaid'), 'fulfilled')
  assert.equal(edinioOrderState('shipped', null), 'confirmed')
  assert.equal(edinioOrderState('ceva-nou'), 'pending')
})
