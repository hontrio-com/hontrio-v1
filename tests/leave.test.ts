import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { alreadyGone, leaveRemovesCampaigns, LEAVE_REMOVAL_FROM, LEAVE_REMOVAL_TERMS_VERSION } from '@/lib/ads/remove'

// Clientul pleacă (deconectează Google, șterge un magazin sau contul): campaniile create de Hontrio se șterg din
// Google Ads doar după ce intră în vigoare Termenii care o spun (art. 14.5 nou, cu preavizul de 30 de zile).

test('până la Termenii noi, plecarea nu șterge nimic (campaniile rămân ale clientului)', () => {
  assert.equal(LEAVE_REMOVAL_TERMS_VERSION, null)
  assert.equal(LEAVE_REMOVAL_FROM, null)
  assert.equal(leaveRemovesCampaigns('2026-11-16', '2026-12-30'), false)
  assert.equal(leaveRemovesCampaigns(null, '2030-01-01'), false)
})

test('după publicare: cine a acceptat Termenii noi de la acceptare, ceilalți după preaviz', () => {
  const rule = { version: '2026-12-01', from: '2027-01-01' }
  // A acceptat versiunea nouă (sau una mai nouă): regula i se aplică imediat
  assert.equal(leaveRemovesCampaigns('2026-12-01', '2026-12-02', rule), true)
  assert.equal(leaveRemovesCampaigns('2027-03-01', '2026-12-02', rule), true)
  // A acceptat versiunea veche: abia de la data de după preaviz
  assert.equal(leaveRemovesCampaigns('2026-11-16', '2026-12-31', rule), false)
  assert.equal(leaveRemovesCampaigns('2026-11-16', '2027-01-01', rule), true)
  assert.equal(leaveRemovesCampaigns(null, '2027-01-01', rule), true)
  // Doar versiunea publicată, fără dată pentru ceilalți
  assert.equal(leaveRemovesCampaigns('2026-11-16', '2030-01-01', { version: '2026-12-01', from: null }), false)
})

test('o campanie pe care Google n-o mai are se socotește ștearsă; celelalte erori, nu', () => {
  assert.equal(alreadyGone(new GoogleAdsApiError('Resource was not found.', 404, 'mutateError.RESOURCE_NOT_FOUND')), true)
  assert.equal(alreadyGone(new GoogleAdsApiError('Operation is not permitted for removed resources.', 400, 'campaignError.OPERATION_NOT_PERMITTED_FOR_REMOVED_RESOURCE')), true)
  assert.equal(alreadyGone(new GoogleAdsApiError('The caller does not have permission', 403, 'authorizationError.USER_PERMISSION_DENIED')), false)
  assert.equal(alreadyGone(new GoogleAdsApiError('quota', 429, 'quotaError.RESOURCE_EXHAUSTED')), false)
})
