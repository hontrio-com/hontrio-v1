import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowsSupportAccess, blockedWhileImpersonating, impersonationRefusal, impersonationToken, IMPERSONATION_MS, SUPPORT_ACCESS_TERMS_VERSION,
} from '@/lib/auth/impersonation-rules'
import { profileToken } from '@/lib/auth/session-token'
import { TERMS_VERSION } from '@/lib/auth/validation'

// „Conectare” din panoul de administrare: în ce conturi se poate intra (și doar
// cu acordul clientului, prin Termenii din 22.11.2026, art. 10.5), sesiunea de
// atunci și ce rămâne doar al clientului.

const user = { id: 'u', role: 'user', email_verified_at: '2026-11-18T20:00:00Z', terms_accepted_at: '2026-11-22T12:00:00Z', terms_version: '2026-11-22' }

test('„Conectare”: nu în contul tău, al altui administrator, unul neconfirmat sau fără acordul din Termeni', () => {
  assert.equal(impersonationRefusal('a', user), null)
  assert.equal(impersonationRefusal('a', null), 'not_found')
  assert.equal(impersonationRefusal('u', user), 'self')
  assert.equal(impersonationRefusal('a', { ...user, role: 'admin' }), 'admin')
  assert.equal(impersonationRefusal('a', { ...user, email_verified_at: null }), 'unverified')
  // Termenii de dinainte de 22.11.2026 nu cuprind accesul echipei: VetDepo, până acceptă versiunea nouă
  assert.equal(impersonationRefusal('a', { ...user, terms_version: '2026-11-16' }), 'terms')
  assert.equal(impersonationRefusal('a', { ...user, terms_version: null }), 'terms')
  assert.equal(impersonationRefusal('a', { ...user, terms_accepted_at: null }), 'terms')
  assert.equal(impersonationRefusal('a', { ...user, terms_version: '2027-01-10' }), null, 'o versiune mai nouă îl cuprinde')
  assert.equal(IMPERSONATION_MS, 60 * 60 * 1000)
})

test('acordul pentru accesul echipei vine cu versiunea de acum a Termenilor', () => {
  assert.equal(SUPPORT_ACCESS_TERMS_VERSION, '2026-11-22')
  assert.ok(TERMS_VERSION >= SUPPORT_ACCESS_TERMS_VERSION, 'cine se înscrie acum îl acceptă')
  assert.equal(allowsSupportAccess('2026-11-22'), true)
  assert.equal(allowsSupportAccess('2026-11-16'), false)
  assert.equal(allowsSupportAccess(undefined), false)
})

test('în contul clientului, administratorul nu poate face ce rămâne al clientului', () => {
  // Identitatea, accesul și datele lui
  assert.ok(blockedWhileImpersonating('/api/user/change-password', 'POST'))
  assert.ok(blockedWhileImpersonating('/api/user/delete', 'POST'))
  assert.ok(blockedWhileImpersonating('/api/user/export', 'GET'))
  assert.ok(blockedWhileImpersonating('/api/user/profile', 'PATCH'))
  assert.ok(!blockedWhileImpersonating('/api/user/profile', 'GET'))
  assert.ok(blockedWhileImpersonating('/api/auth/accept-terms', 'POST'))
  // Conturile externe s-ar lega din browserul administratorului
  assert.ok(blockedWhileImpersonating('/api/integrations/google/connect', 'GET'))
  assert.ok(blockedWhileImpersonating('/api/integrations/edinio/connect', 'GET'))
  assert.ok(blockedWhileImpersonating('/api/shopify/install', 'GET'))
  assert.ok(blockedWhileImpersonating('/api/integrations/google', 'DELETE'))
  assert.ok(!blockedWhileImpersonating('/api/integrations/google', 'GET'))
  // Alegerea contului Google Ads și a Merchant Center-ului rămân (ajutorul obișnuit)
  assert.ok(!blockedWhileImpersonating('/api/integrations/google/accounts', 'PATCH'))
  assert.ok(!blockedWhileImpersonating('/api/integrations/google/merchant', 'PATCH'))
  // Ștergerea unui magazin, nu și citirea sau sincronizarea lui
  assert.ok(blockedWhileImpersonating('/api/stores/123', 'DELETE'))
  assert.ok(!blockedWhileImpersonating('/api/stores/123/sync', 'POST'))
  assert.ok(!blockedWhileImpersonating('/api/stores', 'GET'))
  // Datele firmei, pentru facturi
  assert.ok(blockedWhileImpersonating('/api/billing/profile', 'PUT'))
  assert.ok(!blockedWhileImpersonating('/api/billing/profile', 'GET'))
  // Campaniile, da: pentru asta intră
  assert.ok(!blockedWhileImpersonating('/api/campaigns/launch', 'POST'))
  assert.ok(!blockedWhileImpersonating('/api/campaigns/actions', 'POST'))
  // Un prefix asemănător nu se confundă
  assert.ok(!blockedWhileImpersonating('/api/user/deleted-items', 'POST'))
})

test('sesiunea din contul clientului: a lui, cu administratorul în ea, pentru o oră', () => {
  const now = Date.parse('2026-11-22T10:00:00Z')
  const client = {
    id: 'c', email: 'client@example.com', name: 'Client', role: 'user', onboarding_completed: true, ui_locale: 'ro', session_version: 4,
    email_verified_at: 'x', terms_accepted_at: 'y', terms_version: '2026-11-22',
  }
  const token = impersonationToken(client, { id: 'a', name: 'Admin', email: 'admin@example.com', provider: 'credentials' }, 'audit-1', now)
  assert.equal(token.id, 'c')
  assert.equal(token.sub, 'c')
  assert.equal(token.email, 'client@example.com')
  assert.equal(token.role, 'user')
  assert.equal(token.sv, 4)
  assert.equal(token.termsAccepted, true)
  assert.equal(token.termsVersion, '2026-11-22')
  assert.equal(token.provider, 'impersonation')
  assert.deepEqual(token.impersonator, { id: 'a', name: 'Admin', email: 'admin@example.com', provider: 'credentials' })
  assert.deepEqual(token.impersonation, { id: 'audit-1', until: now + IMPERSONATION_MS })
  // Sesiunea obișnuită n-are administrator în ea
  const own = profileToken(client, 'credentials', now)
  assert.equal(own.impersonator, undefined)
  assert.equal(own.name, 'Client')
  assert.equal(profileToken({ ...client, name: null, ui_locale: 'en' }, 'credentials', now).name, 'User')
})
