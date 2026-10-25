import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { logError } from '@/lib/logger'
import { GoogleAdsApiError } from '@/lib/google/ads'
import { storeAdsAccount } from '@/lib/google/accounts'
import { evaluateAudit, fetchAuditRaw } from '@/lib/google/audit'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import { merchantIdForStore } from '@/lib/merchant/sync'
import type { StoredAudit } from '@/lib/campaigns/context'

// =============================================
// Rulează auditul contului Google Ads al unui magazin și îl salvează în
// google_audits (unul pe magazin). O eroare se salvează și ea, ca pagina
// să spună de ce nu s-a putut citi contul.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type AuditStore = {
  id: string; user_id: string; platform: string; currency: string | null; platform_data: unknown
  google_ads_customer_id: string | null; merchant_center_id: string | null
}

export async function runAudit(supabase: Supabase, store: AuditStore): Promise<StoredAudit | null> {
  const account = await storeAdsAccount(supabase, store.user_id, store.google_ads_customer_id)
  if (!account) return null

  const { data: ours } = await supabase.from('ad_campaigns')
    .select('google_campaign_id').eq('store_id', store.id).not('google_campaign_id', 'is', null)
  const hontrioCampaignIds = new Set((ours ?? []).map(r => String(r.google_campaign_id)))

  const checkedAt = new Date().toISOString()
  let result: unknown
  let stored: StoredAudit
  try {
    const token = await getAccessTokenForUser(store.user_id)
    const raw = await fetchAuditRaw(token, account.customer_id, account.login_customer_id)
    const audit = evaluateAudit(raw, {
      storeCurrency: store.currency || 'RON',
      // Merchant Center-ul magazinului, dacă îl știm (ales sau din Edinio); altfel îl află auditul
      storeMerchantId: merchantIdForStore({ ...store, merchant_center_id: store.merchant_center_id }, null),
      hontrioCampaignIds,
    })
    result = audit
    stored = { checked_at: checkedAt, customer_id: account.customer_id, result: audit, error: null }
  } catch (err) {
    let error: string
    if (err instanceof GoogleAuthError) error = storedMessage(err.code === 'invalid_grant' ? 'sync.google_access_revoked' : 'sync.google_audit_failed', { code: err.code, detail: '' })
    else if (err instanceof GoogleAdsApiError) {
      error = storedMessage('sync.google_audit_failed', { code: err.errorCode || String(err.httpStatus), detail: err.message.slice(0, 300) })
    } else throw err
    logError('google-audit', 'Auditul contului Google Ads a eșuat', { storeId: store.id, error })
    result = { error }
    stored = { checked_at: checkedAt, customer_id: account.customer_id, result: null, error }
  }

  const { error } = await supabase.from('google_audits').upsert({
    store_id: store.id, user_id: store.user_id, customer_id: account.customer_id, result, checked_at: checkedAt,
  }, { onConflict: 'store_id' })
  if (error) logError('google-audit', 'Auditul nu s-a salvat', { storeId: store.id, error: error.message })
  return stored
}
