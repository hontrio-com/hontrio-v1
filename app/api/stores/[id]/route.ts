import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { EdinioClient } from '@/lib/edinio/client'
import { getT } from '@/lib/i18n/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as any).id
    const supabase = createAdminClient()

    // Edinio: jetonul se revocă și la ei, ca legătura să apară oprită și în panoul Edinio.
    // Ofertele și comenzile sincronizate se șterg în cascadă odată cu magazinul.
    const { data: store } = await supabase
      .from('stores')
      .select('platform, api_key')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (store?.platform === 'edinio' && store.api_key) {
      try { await new EdinioClient(decrypt(store.api_key)).revoke() } catch {}
    }

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: t('sync.store_delete_failed') }, { status: 500 })
    }

    return NextResponse.json({ message: t('sync.store_disconnected') })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}