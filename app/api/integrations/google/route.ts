import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { revokeToken, clearCachedAccessToken } from '@/lib/google/oauth'
import { logApiError } from '@/lib/logger'

// =============================================
// GET    /api/integrations/google — starea conexiunii + conturile Google Ads
// DELETE /api/integrations/google — deconectare (revocă accesul la Google)
// =============================================

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('google_connections')
    .select('id, google_email, status, last_error, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!connection) return NextResponse.json({ connection: null, accounts: [] })

  const { data: accounts } = await supabase
    .from('google_ads_accounts')
    .select('customer_id, login_customer_id, descriptive_name, currency_code, time_zone, is_manager, is_test_account, is_selected, status')
    .eq('user_id', userId)
    .order('is_manager', { ascending: true })
    .order('descriptive_name', { ascending: true })

  return NextResponse.json({ connection, accounts: accounts || [] })
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

  // Conturile Google Ads se șterg în cascadă
  const { error } = await supabase.from('google_connections').delete().eq('id', connection.id)
  if (error) return NextResponse.json({ error: 'Eroare la deconectare: ' + error.message }, { status: 500 })

  clearCachedAccessToken(userId)
  return NextResponse.json({ success: true })
}
