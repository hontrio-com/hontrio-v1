import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { addDays, daysBetween, isExpired, isTransientGoogleError, lastFiguresDay, refreshFrom, safeEqual, todayWindow, DAY_MS, REFRESH_DAYS } from '@/lib/ads/schedule'

// Ritmul pilotului: ce zile se recitesc, când expiră o propunere, ce eroare
// Google se reia singură, cum se compară secretul cronului.

test('fiecare trecere recitește cel puțin ultimele 33 de zile (vânzările raportate târziu ajung pe ziua clicului)', () => {
  const yesterday = '2026-11-11'
  // Trecerea de ieri: tot ultimele 33 de zile, nu doar ultimele 4
  assert.equal(refreshFrom('2026-11-11T03:15:00.000Z', yesterday), '2026-10-10')
  assert.equal(daysBetween('2026-10-10', yesterday) + 1, REFRESH_DAYS)
  // Pilotul n-a trecut de mult: de la ultima trecere, cu 3 zile în plus
  assert.equal(refreshFrom('2026-09-01T03:15:00.000Z', yesterday), '2026-08-29')
  // Prima citire: 90 de zile
  assert.equal(refreshFrom(null, yesterday), addDays(yesterday, -89))
})

test('cifrele de azi, din oră în oră: de la ultima trecere zilnică (cel puțin de ieri) până mâine, în fusul contului', () => {
  const now = Date.parse('2026-11-19T09:30:00Z')
  // Trecerea de aseară a citit până alaltăieri: ieri și azi rămân de citit
  assert.deepEqual(todayWindow('2026-11-18T21:15:10.418+00:00', now), { from: '2026-11-18', to: '2026-11-20' })
  // Trecerea de azi a citit până ieri: ieri se recitește oricum (ziua se încheie și după miezul nopții)
  assert.deepEqual(todayWindow('2026-11-19T02:15:00.000Z', now), { from: '2026-11-18', to: '2026-11-20' })
  // Trecerea zilnică întârzie: zilele de după ea
  assert.deepEqual(todayWindow('2026-11-16T10:00:00.000Z', now), { from: '2026-11-16', to: '2026-11-20' })
  // Cel mult 33 de zile în urmă
  const far = todayWindow('2026-09-01T10:00:00.000Z', now)
  assert.equal(far.from, '2026-10-18')
  assert.equal(daysBetween(far.from, '2026-11-19') + 1, REFRESH_DAYS)
})

test('paginile arată cifrele până în ultima zi citită: azi, cu citirea din oră în oră, altfel ziua dinaintea trecerii zilnice', () => {
  const now = Date.parse('2026-11-19T09:30:00Z')
  // VetDepo dimineața: trecerea de aseară a citit până alaltăieri, iar citirea din oră în oră n-a rulat încă
  assert.equal(lastFiguresDay('2026-11-18T21:15:10.418+00:00', null, now), '2026-11-17')
  // După prima citire din oră în oră: și ziua de azi
  assert.equal(lastFiguresDay('2026-11-18T21:15:10.418+00:00', '2026-11-19T09:15:40.000+00:00', now), '2026-11-19')
  // Campaniile oprite de zile: citirea din oră în oră a rămas în urmă, trecerea zilnică merge mai departe
  assert.equal(lastFiguresDay('2026-11-19T02:15:00.000Z', '2026-11-15T10:15:00.000Z', now), '2026-11-18')
  // Fără nicio trecere: ieri (prima citire vine la ora următoare)
  assert.equal(lastFiguresDay(null, null, now), '2026-11-18')
})

test('o propunere expiră după 7 zile, chiar dacă pilotul n-a apucat s-o treacă așa', () => {
  const now = Date.parse('2026-11-12T12:00:00Z')
  assert.equal(isExpired(new Date(now - 6 * DAY_MS).toISOString(), now), false)
  assert.equal(isExpired(new Date(now - 7 * DAY_MS - 1000).toISOString(), now), true)
  assert.equal(isExpired('nu e o dată', now), false)
})

test('erorile Google care trec singure se reiau la ora următoare; celelalte se spun omului', () => {
  assert.equal(isTransientGoogleError(new GoogleAdsApiError('quota', 429, 'quotaError.RESOURCE_EXHAUSTED')), true)
  assert.equal(isTransientGoogleError(new GoogleAdsApiError('down', 503, null)), true)
  assert.equal(isTransientGoogleError(new GoogleAdsApiError('internal', 400, 'internalError.TRANSIENT_ERROR')), true)
  assert.equal(isTransientGoogleError(new GoogleAdsApiError('denied', 403, 'authorizationError.USER_PERMISSION_DENIED')), false)
  assert.equal(isTransientGoogleError(new GoogleAdsApiError('bad query', 400, 'queryError.UNRECOGNIZED_FIELD')), false)
})

test('secretul cronului: comparat fără să depindă de lungime', () => {
  assert.equal(safeEqual('Bearer abc', 'Bearer abc'), true)
  assert.equal(safeEqual('Bearer abd', 'Bearer abc'), false)
  assert.equal(safeEqual('', 'Bearer abc'), false)
  assert.equal(safeEqual('Bearer abc-mult-mai-lung', 'Bearer abc'), false)
})
