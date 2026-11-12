import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getActiveStore } from '@/lib/stores/active'
import { merchantIdForStore } from '@/lib/merchant/sync'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET   /api/integrations/google/merchant — contul Merchant Center al
//       magazinului activ și de unde îl știm
// PATCH /api/integrations/google/merchant — { merchant_center_id?: string|null }
// =============================================

const ROUTE = '/api/integrations/google/merchant'

type StoreRow = {
  id: string; platform: string; platform_data: unknown; merchant_center_id: string | null
  merchant_synced_at: string | null; merchant_error: string | null
}
const COLUMNS = 'id, platform, platform_data, merchant_center_id, merchant_synced_at, merchant_error'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const supabase = createAdminClient()
  const { data: store, error } = await getActiveStore<StoreRow>(supabase, userId, COLUMNS)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store) return NextResponse.json({ store: null })

  const [{ data: audit }, { count: matched }] = await Promise.all([
    supabase.from('google_audits').select('result').eq('store_id', store.id).maybeSingle(),
    supabase.from('commerce_offers').select('offer_id', { count: 'exact', head: true }).eq('store_id', store.id).not('merchant_offer_id', 'is', null),
  ])
  const linked = ((audit?.result as { merchant_ids?: string[] } | null)?.merchant_ids) ?? []
  const auditMerchant = (audit?.result as { merchant_id?: string | null } | null)?.merchant_id ?? null
  const edinio = store.platform === 'edinio' ? merchantIdForStore({ ...store, merchant_center_id: null }, null) : null

  return NextResponse.json({
    store: {
      merchant_center_id: merchantIdForStore(store, auditMerchant),
      chosen: store.merchant_center_id,
      // De unde îl știm: din Edinio, legat de contul Google Ads, sau ales de om
      edinio,
      linked,
      synced_at: store.merchant_synced_at,
      error: store.merchant_error,
      matched: matched ?? 0,
    },
  })
}

export async function PATCH(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const body = await request.json().catch(() => ({})) as { merchant_center_id?: unknown }
  const patch: Record<string, unknown> = {}
  if (body.merchant_center_id !== undefined) {
    const id = body.merchant_center_id === null ? null : String(body.merchant_center_id).trim()
    if (id !== null && !/^\d{5,20}$/.test(id)) return NextResponse.json({ error: t('settings.merchant_id_invalid') }, { status: 400 })
    patch.merchant_center_id = id
    // Alt cont: ce știam despre ofertele de acolo nu mai e valabil
    patch.merchant_synced_at = null
    patch.merchant_data_source = null
    patch.merchant_label_index = null
    patch.merchant_error = null
    // Merchant Center se citește în trecerea pilotului: la următoarea oră a cronului, nu peste o zi
    patch.ads_synced_at = null
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: t('sync.nothing_to_save') }, { status: 400 })

  const supabase = createAdminClient()
  const { data: store } = await getActiveStore<{ id: string }>(supabase, userId, 'id')
  if (!store) return NextResponse.json({ error: t('sync.store_not_found') }, { status: 404 })
  const { error } = await supabase.from('stores').update(patch).eq('id', store.id).eq('user_id', userId)
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la salvarea contului Merchant', { userId, error: error.message })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }
  if ('merchant_center_id' in patch) {
    await supabase.from('commerce_offers').update({ merchant_offer_id: null, merchant_issues: null, merchant_cogs_pushed: null, merchant_label_pushed: null }).eq('store_id', store.id)
  }
  return NextResponse.json({ ok: true })
}
