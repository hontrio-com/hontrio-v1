import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitSync } from '@/lib/security/rate-limit'
import { isCommercePlatform, syncCommerceStore } from '@/lib/commerce/sync'

// =============================================
// POST /api/stores/[id]/sync — „Sincronizează acum"
// Edinio, WooCommerce și Shopify: ofertele și comenzile, în modelul comun de reclame.
// =============================================

// Vercel: permite până la 5 minute pentru sincronizare
export const maxDuration = 300

const PLATFORM_NAMES: Record<string, string> = { edinio: 'Edinio', woocommerce: 'WooCommerce', shopify: 'Shopify' }

/** Ce face omul când platforma nu mai dă acces. */
const REVOKED: Record<string, string> = {
  edinio: 'Accesul la Edinio a fost revocat. Reconectează magazinul.',
  woocommerce: 'WooCommerce nu mai acceptă cheia API. Deconectează magazinul și conectează-l cu o cheie nouă.',
  shopify: 'Shopify nu mai dă acces aplicației Hontrio (a fost dezinstalată?). Reconectează magazinul.',
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const { id } = await params
    const userId = session.user.id

    // Rate limit: max 2 syncs per 10 minutes
    const limit = await rateLimitSync(userId)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Sincronizare prea frecventă. Așteaptă câteva minute.' },
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
      return NextResponse.json({ error: 'Magazin negăsit' }, { status: 404 })
    }
    if (!isCommercePlatform(store.platform)) {
      return NextResponse.json({ error: 'Platformă nesuportată' }, { status: 400 })
    }

    // Un magazin mare continuă la sincronizările următoare (`complete: false`)
    const result = await syncCommerceStore(store.id, store.platform, 'full', { deadline: Date.now() + 240_000 })
    if (!result.ok) {
      const error = result.reason === 'locked' ? 'O sincronizare e deja în curs. Revino peste câteva minute.'
        : result.reason === 'revoked' ? REVOKED[store.platform]
        : `Sincronizarea cu ${PLATFORM_NAMES[store.platform]} a eșuat. Încearcă din nou.`
      return NextResponse.json({ error }, { status: result.reason === 'locked' ? 409 : result.reason === 'revoked' ? 401 : 502 })
    }
    return NextResponse.json({ synced: result.offersTotal, total: result.offersTotal, orders: result.ordersTotal, complete: result.complete })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Eroare la sincronizare' }, { status: 500 })
  }
}
