import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessTokenForUser, GoogleAuthError } from '@/lib/google/oauth'
import { syncGoogleAdsAccounts } from '@/lib/google/accounts'
import { normalizeCustomerId } from '@/lib/google/ads'
import { rateLimit } from '@/lib/security/rate-limit'
import { logApiError } from '@/lib/logger'

// =============================================
// POST  /api/integrations/google/accounts — reîmprospătează lista de conturi
// PATCH /api/integrations/google/accounts — selectează contul folosit { customer_id }
// =============================================

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const rl = rateLimit(`google-accounts-refresh:${userId}`, 5, 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: 'Prea multe cereri. Încearcă din nou.' }, { status: 429 })

  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('google_connections')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!connection) return NextResponse.json({ error: 'Contul Google nu este conectat' }, { status: 404 })

  try {
    const accessToken = await getAccessTokenForUser(userId)
    const result = await syncGoogleAdsAccounts(userId, connection.id, accessToken)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof GoogleAuthError && err.code === 'invalid_grant') {
      return NextResponse.json({ error: 'Accesul Google a fost revocat. Reconectează contul.', code: 'revoked' }, { status: 401 })
    }
    logApiError('/api/integrations/google/accounts', 502, 'Eroare reîmprospătare conturi Google Ads', {
      error: (err as Error).message,
    })
    return NextResponse.json({ error: 'Nu am putut citi conturile Google Ads.' }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => ({}))
  const customerId = typeof body.customer_id === 'string' ? normalizeCustomerId(body.customer_id) : ''
  if (!/^\d{10}$/.test(customerId)) return NextResponse.json({ error: 'customer_id invalid' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: account } = await supabase
    .from('google_ads_accounts')
    .select('id, is_manager')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Contul nu a fost găsit' }, { status: 404 })
  if (account.is_manager) {
    return NextResponse.json({ error: 'Un cont de manager nu poate rula campanii. Alege un cont de advertiser.' }, { status: 400 })
  }

  await supabase.from('google_ads_accounts').update({ is_selected: false }).eq('user_id', userId)
  const { error } = await supabase
    .from('google_ads_accounts')
    .update({ is_selected: true, updated_at: new Date().toISOString() })
    .eq('id', account.id)
  if (error) return NextResponse.json({ error: 'Eroare la selectare: ' + error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
