import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { EdinioClient } from '@/lib/edinio/client'
import { ShopifyApi } from '@/lib/shopify/api'
import { getT } from '@/lib/i18n/server'

// =============================================
// DELETE /api/stores/{id} — deconectează un magazin al contului.
// Accesul se retrage și la platformă (jetonul Edinio, aplicația din Shopify),
// ca legătura să apară oprită și acolo. Ofertele, comenzile și campaniile
// Hontrio ale magazinului se șterg în cascadă; campaniile din Google Ads rămân.
// =============================================

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })

    const { id } = await params
    const userId = session.user.id
    const supabase = createAdminClient()

    const { data: store } = await supabase
      .from('stores')
      .select('platform, store_url, api_key')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!store) return NextResponse.json({ error: t('sync.store_not_found') }, { status: 404 })

    if (store.api_key) {
      try {
        if (store.platform === 'edinio') await new EdinioClient(decrypt(store.api_key)).revoke()
        else if (store.platform === 'shopify') {
          const token = store.api_key.includes(':') ? decrypt(store.api_key) : store.api_key
          await new ShopifyApi(store.store_url, token).revokeAccess()
        }
      } catch { /* platforma nu răspunde: legătura se șterge oricum din Hontrio */ }
    }

    const { error } = await supabase.from('stores').delete().eq('id', id).eq('user_id', userId)
    if (error) return NextResponse.json({ error: t('sync.store_delete_failed') }, { status: 500 })

    return NextResponse.json({ message: t('sync.store_disconnected') })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
