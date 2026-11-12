import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkEmail, checkName, checkPassword } from '@/lib/auth/validation'
import { hashToken, isTokenShape, newToken } from '@/lib/auth/tokens'
import { contentMatchesType, cleanFileName } from '@/lib/security/upload'
import { attributionOf } from '@/lib/edinio/mapping'

// Înscrierea (numele, parola, adresa), jetoanele din e-mailuri, fișierele
// încărcate și ce păstrăm din sursa unei comenzi Edinio.

test('numele: 2–60 de litere, fără adrese web, cifre sau e-mail', () => {
  assert.deepEqual(checkName('  Ana-Maria   Popescu '), { ok: true, name: 'Ana-Maria Popescu' })
  assert.equal(checkName("O'Brien").ok, true)
  assert.equal(checkName('Ștefan Țepeș').ok, true)
  assert.deepEqual(checkName('A'), { ok: false, error: 'auth.name_length' })
  assert.deepEqual(checkName('x'.repeat(61)), { ok: false, error: 'auth.name_length' })
  for (const spam of ['Câștigi 1000 de lei', 'Vezi evil.com acum', 'mail@evil.ro', 'https://x.ro', '<b>Ana</b>']) {
    assert.deepEqual(checkName(spam), { ok: false, error: 'auth.name_invalid' }, spam)
  }
  assert.deepEqual(checkName(undefined), { ok: false, error: 'auth.name_required' })
})

test('parola: 8–72 de octeți; adresa: cu litere mici', () => {
  assert.deepEqual(checkPassword('1234567'), { ok: false, error: 'auth.password_min_error' })
  assert.equal(checkPassword('12345678').ok, true)
  assert.deepEqual(checkPassword('ă'.repeat(37)), { ok: false, error: 'auth.password_too_long' })
  assert.deepEqual(checkEmail(' Ana@Magazin.RO '), { ok: true, email: 'ana@magazin.ro' })
  assert.equal(checkEmail('ana@magazin').ok, false)
  assert.equal(checkEmail('a b@magazin.ro').ok, false)
})

test('jetoanele: 256 de biți, în bază doar amprenta', () => {
  const { token, hash } = newToken()
  assert.equal(isTokenShape(token), true)
  assert.equal(hash, hashToken(token))
  assert.notEqual(hash, token)
  assert.equal(isTokenShape('abc'), false)
  assert.notEqual(newToken().token, token)
})

test('fișierele: tipul declarat se verifică după conținut', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  assert.equal(contentMatchesType(png, 'image/png'), true)
  assert.equal(contentMatchesType(png, 'image/jpeg'), false)
  const html = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>')
  assert.equal(contentMatchesType(html, 'text/plain'), false)
  assert.equal(contentMatchesType(html, 'image/png'), false)
  assert.equal(contentMatchesType(new TextEncoder().encode('Comanda 123 nu a ajuns.'), 'text/plain'), true)
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd')
  assert.equal(cleanFileName('C:\\poze\\factură.pdf'), 'factură.pdf')
  assert.equal(cleanFileName(''), 'file')
})

test('Edinio: din sursa comenzii rămân doar UTM-urile, clicul și calea paginii de intrare', () => {
  const kept = attributionOf({
    utm_source: 'google', utm_medium: 'cpc', gclid: 'Cj0K', landing: '/produs/geaca?email=ana@x.ro', captured_at: '2026-11-12T10:00:00Z',
    referrer: 'https://www.google.com/search?q=geaca', consimtamant_marketing: 'da', telefon: '0712345678',
  })
  assert.deepEqual(kept, {
    utm_source: 'google', utm_medium: 'cpc', gclid: 'Cj0K', captured_at: '2026-11-12T10:00:00Z',
    landing_path: '/produs/geaca', referrer: 'https://www.google.com',
  })
  assert.deepEqual(attributionOf(null), {})
})
