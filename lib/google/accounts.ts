import { createAdminClient } from '@/lib/supabase/admin'
import { storedMessage } from '@/lib/i18n/stored'
import { discoverAccounts, MAX_ACCOUNTS } from '@/lib/google/ads'
import { getActiveStore } from '@/lib/stores/active'

type Supabase = ReturnType<typeof createAdminClient>

export type StoreAdsAccount = { customer_id: string; descriptive_name: string | null; currency_code: string | null; login_customer_id: string | null }

/**
 * Contul Google Ads ales pentru un magazin (`stores.google_ads_customer_id`),
 * dacă e încă printre conturile omului și poate rula campanii (nu e manager).
 */
export async function storeAdsAccount(supabase: Supabase, userId: string, customerId: string | null | undefined): Promise<StoreAdsAccount | null> {
  if (!customerId) return null
  const { data } = await supabase
    .from('google_ads_accounts')
    .select('customer_id, descriptive_name, currency_code, login_customer_id, is_manager')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .maybeSingle()
  if (!data || data.is_manager) return null
  return { customer_id: data.customer_id, descriptive_name: data.descriptive_name, currency_code: data.currency_code, login_customer_id: data.login_customer_id }
}

/**
 * Descoperă conturile Google Ads ale utilizatorului și le salvează.
 * Fiecare magazin își păstrează contul cât timp acesta e încă accesibil; dacă
 * omul are un singur cont de advertiser (non-manager), îl primește magazinul
 * activ, când n-are încă unul.
 */
export async function syncGoogleAdsAccounts(userId: string, connectionId: string, accessToken: string) {
  const supabase = createAdminClient()
  const { accounts, errors } = await discoverAccounts(accessToken)
  const now = new Date().toISOString()

  // ⚠ O descoperire cu erori (API indisponibil, acces refuzat) sau oprită la plafon
  // nu spune că un cont a dispărut: atunci nu se șterge nimic și magazinele își păstrează contul
  if (!errors.length && accounts.length < MAX_ACCOUNTS) {
    const { data: existing } = await supabase.from('google_ads_accounts').select('customer_id').eq('user_id', userId)
    const currentIds = new Set(accounts.map(a => a.customerId))
    const stale = (existing || []).map(a => a.customer_id).filter(id => !currentIds.has(id))
    if (stale.length) {
      await supabase.from('google_ads_accounts').delete().eq('user_id', userId).in('customer_id', stale)
      // Alt cont (sau niciunul): pilotul trece pe magazin la ora următoare, nu peste o zi
      await supabase.from('stores').update({ google_ads_customer_id: null, ads_synced_at: null }).eq('user_id', userId).in('google_ads_customer_id', stale)
    }
  }

  if (accounts.length) {
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
        status: a.status,
        updated_at: now,
      })),
      { onConflict: 'user_id,customer_id' },
    )
    if (error) throw new Error('Eroare la salvarea conturilor Google Ads: ' + error.message)
  }

  const advertisers = accounts.filter(a => !a.isManager)
  if (advertisers.length === 1) {
    const { data: store } = await getActiveStore<{ id: string; google_ads_customer_id: string | null }>(supabase, userId, 'id, google_ads_customer_id')
    if (store && !store.google_ads_customer_id) {
      // Prima citire a contului nou: la următoarea oră a cronului (magazinele netrecute sunt primele)
      await supabase.from('stores').update({ google_ads_customer_id: advertisers[0].customerId, ads_synced_at: null }).eq('id', store.id)
    }
  }

  const firstError = errors[0] || null
  await supabase
    .from('google_connections')
    .update({
      status: 'active',
      // Codul și mesajul lui Google (în engleză) intră ca detaliu în mesajul tradus
      last_error: firstError
        ? storedMessage('sync.google_accounts_partial', { code: firstError.errorCode || 'error', detail: firstError.message.slice(0, 500) })
        : null,
      updated_at: now,
    })
    .eq('id', connectionId)

  return { count: accounts.length, errorCode: firstError?.errorCode || null }
}
