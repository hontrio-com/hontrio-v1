import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { runAudit, type AuditStore } from '@/lib/ads/audit-run'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/campaigns/audit — citește acum contul Google Ads al magazinului
// activ (campanii, conversii, Merchant Center, declarația UE) și salvează
// rezultatul. Cronul îl reface zilnic; aici îl cere omul.
// =============================================

const ROUTE = '/api/campaigns/audit'
/** Auditul costă 6 operații Google: nu mai des de atât, la cerere. */
const MIN_GAP_MS = 60_000

export async function POST() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: store, error } = await getActiveStore<AuditStore>(supabase, userId,
    'id, user_id, platform, currency, platform_data, google_ads_customer_id, merchant_center_id')
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })
  if (!store.google_ads_customer_id) return NextResponse.json({ error: t('campaigns.audit_no_account') }, { status: 400 })

  const { data: last } = await supabase.from('google_audits').select('checked_at').eq('store_id', store.id).maybeSingle()
  if (last && Date.now() - Date.parse(last.checked_at) < MIN_GAP_MS) {
    return NextResponse.json({ error: t('campaigns.audit_too_soon') }, { status: 429 })
  }

  const audit = await runAudit(supabase, store)
  if (!audit) return NextResponse.json({ error: t('campaigns.audit_no_account') }, { status: 400 })
  return NextResponse.json({ audit })
}
