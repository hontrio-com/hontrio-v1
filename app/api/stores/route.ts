import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/stores
// Magazinele contului și cel activ (pe care lucrează paginile). `store` e
// magazinul activ, ca pentru paginile scrise când exista unul singur.
// `last_error` e un mesaj salvat ca cheie de traducere (translateStored).
// =============================================

export async function GET() {
  const ROUTE = '/api/stores'
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const supabase = createAdminClient()
    const [{ data: stores, error }, { data: user }] = await Promise.all([
      supabase.from('stores').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('users').select('active_store_id').eq('id', userId).maybeSingle(),
    ])

    if (error) {
      logApiError(ROUTE, 500, 'Eroare DB la încărcarea magazinelor', { userId, dbError: error.message })
      return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
    }

    const list = stores ?? []
    for (const store of list) {
      // Credențialele (chiar criptate) și starea internă a sincronizării nu au ce căuta în browser
      delete store.api_key
      delete store.api_secret
      delete store.webhook_secret
      delete store.sync_cursor
    }

    // Fără alegere (sau magazinul ales a dispărut): cel mai nou
    const active = list.find(s => s.id === user?.active_store_id) ?? list[list.length - 1] ?? null

    return NextResponse.json({ store: active, stores: list, active_store_id: active?.id ?? null })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
