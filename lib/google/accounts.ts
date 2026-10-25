import { createAdminClient } from '@/lib/supabase/admin'
import { discoverAccounts } from '@/lib/google/ads'

/**
 * Descoperă conturile Google Ads ale utilizatorului și le salvează.
 * Păstrează contul selectat dacă încă există; dacă e un singur cont
 * de advertiser (non-manager), îl selectează automat.
 */
export async function syncGoogleAdsAccounts(userId: string, connectionId: string, accessToken: string) {
  const supabase = createAdminClient()
  const { accounts, errors } = await discoverAccounts(accessToken)
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('google_ads_accounts')
    .select('customer_id, is_selected')
    .eq('user_id', userId)

  const previouslySelected = existing?.find(a => a.is_selected)?.customer_id
  const advertisers = accounts.filter(a => !a.isManager)
  const selectedId =
    advertisers.find(a => a.customerId === previouslySelected)?.customerId ??
    (advertisers.length === 1 ? advertisers[0].customerId : null)

  // Conturile care nu mai sunt accesibile
  const currentIds = new Set(accounts.map(a => a.customerId))
  const stale = (existing || []).map(a => a.customer_id).filter(id => !currentIds.has(id))
  if (stale.length) {
    await supabase.from('google_ads_accounts').delete().eq('user_id', userId).in('customer_id', stale)
  }

  if (accounts.length) {
    // Deselectăm întâi, ca indexul unic „un singur cont selectat” să nu blocheze upsert-ul
    await supabase.from('google_ads_accounts').update({ is_selected: false }).eq('user_id', userId)

    const { error } = await supabase.from('google_ads_accounts').upsert(
      accounts.map(a => ({
        user_id: userId,
        connection_id: connectionId,
        customer_id: a.customerId,
        login_customer_id: a.loginCustomerId,
        descriptive_name: a.descriptiveName,
        currency_code: a.currencyCode,
        time_zone: a.timeZone,
        is_manager: a.isManager,
        is_test_account: a.isTestAccount,
        is_selected: a.customerId === selectedId,
        status: a.status,
        updated_at: now,
      })),
      { onConflict: 'user_id,customer_id' },
    )
    if (error) throw new Error('Eroare la salvarea conturilor Google Ads: ' + error.message)
  }

  const firstError = errors[0] || null
  await supabase
    .from('google_connections')
    .update({
      status: 'active',
      last_error: firstError ? `${firstError.errorCode || 'error'}: ${firstError.message}` : null,
      updated_at: now,
    })
    .eq('id', connectionId)

  return { count: accounts.length, errorCode: firstError?.errorCode || null }
}
