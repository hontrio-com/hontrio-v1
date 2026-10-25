import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveStore } from '@/lib/stores/active'
import { syncMerchant } from '@/lib/merchant/sync'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/merchant/sync — reîmprospătează acum datele din Merchant Center
// pentru magazinul activ: stările produselor, costurile trimise, rapoartele
// de piață. Cronul o face zilnic.
// =============================================

export const maxDuration = 300

const MIN_GAP_MS = 60_000

export async function POST() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: store } = await getActiveStore<{ id: string; merchant_synced_at: string | null }>(supabase, userId, 'id, merchant_synced_at')
  if (!store) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })
  if (store.merchant_synced_at && Date.now() - Date.parse(store.merchant_synced_at) < MIN_GAP_MS) {
    return NextResponse.json({ error: t('campaigns.audit_too_soon') }, { status: 429 })
  }

  const result = await syncMerchant(store.id, { deadline: Date.now() + 250_000 })
  if (!result.ok) {
    const key = result.reason === 'no_merchant' ? 'settings.merchant_none' : result.reason === 'google_not_connected' ? 'settings.merchant_google_missing' : 'settings.merchant_sync_failed'
    return NextResponse.json({ error: t(key), reason: result.reason }, { status: result.reason === 'no_merchant' || result.reason === 'google_not_connected' ? 409 : 502 })
  }
  return NextResponse.json(result)
}
