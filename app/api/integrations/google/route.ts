import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { revokeToken, clearCachedAccessToken } from '@/lib/google/oauth'
import { leaveRuleFor, removeHontrioCampaigns } from '@/lib/ads/remove'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET    /api/integrations/google — starea conexiunii, conturile Google Ads și
//                                   contul ales pentru fiecare magazin
//                                   (`connection.last_error` e o cheie salvată: translateStored)
// DELETE /api/integrations/google — deconectare (revocă accesul la Google)
// =============================================

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: (await getT())('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const [connectionRes, storesRes, userRes] = await Promise.all([
    supabase.from('google_connections')
      .select('id, google_email, status, last_error, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('stores')
      .select('id, platform, store_name, store_url, currency, google_ads_customer_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase.from('users').select('active_store_id').eq('id', userId).maybeSingle(),
  ])
  const stores = storesRes.data || []
  const activeStoreId = userRes.data?.active_store_id ?? stores[stores.length - 1]?.id ?? null

  const connection = connectionRes.data
  if (!connection) return NextResponse.json({ connection: null, accounts: [], stores, active_store_id: activeStoreId })

  const { data: accounts } = await supabase
    .from('google_ads_accounts')
    .select('customer_id, login_customer_id, descriptive_name, currency_code, time_zone, is_manager, is_test_account, status')
    .eq('user_id', userId)
    .order('is_manager', { ascending: true })
    .order('descriptive_name', { ascending: true })

  return NextResponse.json({ connection, accounts: accounts || [], stores, active_store_id: activeStoreId, leave_removes_campaigns: await leaveRuleFor(supabase, userId) })
}

export async function DELETE() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('google_connections')
    .select('id, refresh_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle()

  if (!connection) return NextResponse.json({ success: true })

  // Campaniile create de Hontrio se șterg din Google Ads înainte (Termeni, art. 14.5), cât accesul mai merge
  const removal = await removeHontrioCampaigns(supabase, userId, { reason: 'google_disconnect' })

  try {
    await revokeToken(decrypt(connection.refresh_token_encrypted))
  } catch (err) {
    logApiError('/api/integrations/google', 500, 'Revocare token Google eșuată', { error: (err as Error).message })
  }

  // Conturile Google Ads se șterg în cascadă; magazinele rămân fără cont ales
  const { error } = await supabase.from('google_connections').delete().eq('id', connection.id)
  if (error) {
    // Detaliul tehnic merge în jurnal, nu la om
    logApiError('/api/integrations/google', 500, 'Deconectare Google eșuată', { error: error.message })
    return NextResponse.json({ error: t('sync.google_disconnect_failed') }, { status: 500 })
  }
  await supabase.from('stores').update({ google_ads_customer_id: null }).eq('user_id', userId).not('google_ads_customer_id', 'is', null)

  clearCachedAccessToken(userId)
  return NextResponse.json({ success: true, campaigns_removed: removal.removed, campaigns_failed: removal.failed })
}
