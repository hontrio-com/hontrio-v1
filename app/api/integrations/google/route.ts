import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { revokeToken, clearCachedAccessToken } from '@/lib/google/oauth'
import { logApiError } from '@/lib/logger'

// =============================================
// GET    /api/integrations/google — starea conexiunii, conturile Google Ads și
//                                   contul ales pentru fiecare magazin
// DELETE /api/integrations/google — deconectare (revocă accesul la Google)
// =============================================

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  return NextResponse.json({ connection, accounts: accounts || [], stores, active_store_id: activeStoreId })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('google_connections')
    .select('id, refresh_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle()

  if (!connection) return NextResponse.json({ success: true })

  try {
    await revokeToken(decrypt(connection.refresh_token_encrypted))
  } catch (err) {
    logApiError('/api/integrations/google', 500, 'Revocare token Google eșuată', { error: (err as Error).message })
  }

  // Conturile Google Ads se șterg în cascadă; magazinele rămân fără cont ales
  const { error } = await supabase.from('google_connections').delete().eq('id', connection.id)
  if (error) return NextResponse.json({ error: 'Eroare la deconectare: ' + error.message }, { status: 500 })
  await supabase.from('stores').update({ google_ads_customer_id: null }).eq('user_id', userId).not('google_ads_customer_id', 'is', null)

  clearCachedAccessToken(userId)
  return NextResponse.json({ success: true })
}
