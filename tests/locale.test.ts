import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLocale } from '@/lib/i18n/config'

// Limba de pornire, fără o alegere făcută în Setări: după țara din care vine
// omul (antetul Vercel), iar fără țară (de exemplu local), după limba browserului.

test('din România și din Moldova, română; din orice altă țară, engleză, oricare ar fi limba browserului', () => {
  assert.equal(detectLocale('RO', 'en-US,en;q=0.9'), 'ro')
  assert.equal(detectLocale('ro', null), 'ro')
  assert.equal(detectLocale('MD', 'ru-RU,ru;q=0.9'), 'ro')
  for (const country of ['US', 'GB', 'DE', 'IT', 'ES', 'FR', 'HU', 'BG']) {
    assert.equal(detectLocale(country, 'ro-RO,ro;q=0.9'), 'en', country)
  }
})

test('fără țară: limba browserului; o limbă străină primește engleza; fără nimic, română', () => {
  assert.equal(detectLocale(null, 'ro-RO,ro;q=0.9,en;q=0.8'), 'ro')
  assert.equal(detectLocale(undefined, 'en-GB,en;q=0.9'), 'en')
  assert.equal(detectLocale('', 'de-DE,de;q=0.9'), 'en')
  assert.equal(detectLocale(null, null), 'ro')
  assert.equal(detectLocale(null, ''), 'ro')
})
