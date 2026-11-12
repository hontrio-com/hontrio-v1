import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { addDays, daysBetween, isExpired, isTransientGoogleError, refreshFrom, safeEqual, DAY_MS, REFRESH_DAYS } from '@/lib/ads/schedule'

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
