import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitSync } from '@/lib/security/rate-limit'
import { isCommercePlatform, syncCommerceStore } from '@/lib/commerce/sync'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/stores/[id]/sync — „Sincronizează acum"
// Edinio, WooCommerce și Shopify: ofertele și comenzile, în modelul comun de reclame.
// =============================================

// Vercel: permite până la 5 minute pentru sincronizare
export const maxDuration = 300

const PLATFORM_NAMES: Record<string, string> = { edinio: 'Edinio', woocommerce: 'WooCommerce', shopify: 'Shopify' }

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const userId = session.user.id

    // Rate limit: max 2 syncs per 10 minutes
    const limit = await rateLimitSync(userId)
    if (!limit.success) {
      return NextResponse.json(
        { error: t('sync.too_frequent') },
        { status: 429 }
      )
    }

    const supabase = createAdminClient()
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, platform')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (storeError || !store) {
      return NextResponse.json({ error: t('sync.store_not_found') }, { status: 404 })
    }
    if (!isCommercePlatform(store.platform)) {
      return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })
    }

    // Un magazin mare continuă la sincronizările următoare (`complete: false`)
    const result = await syncCommerceStore(store.id, store.platform, 'full', { deadline: Date.now() + 240_000 })
    if (!result.ok) {
      // Revocat: ce face omul când platforma nu mai dă acces (sync.revoked_edinio / _woocommerce / _shopify)
      const error = result.reason === 'locked' ? t('sync.already_running')
        : result.reason === 'revoked' ? t(`sync.revoked_${store.platform}`)
        : t('sync.platform_sync_failed', { platform: PLATFORM_NAMES[store.platform] })
      return NextResponse.json({ error }, { status: result.reason === 'locked' ? 409 : result.reason === 'revoked' ? 401 : 502 })
    }
    return NextResponse.json({ synced: result.offersTotal, total: result.offersTotal, orders: result.ordersTotal, complete: result.complete })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: t('catalog.sync_error') }, { status: 500 })
  }
}
