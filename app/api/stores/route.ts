import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
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
    if (!session?.user) {
      logApiError(ROUTE, 401, 'Sesiune lipsă')
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      logApiError(ROUTE, 400, 'userId lipsă din token', { sessionUser: JSON.stringify(session.user) })
      return NextResponse.json({ error: t('sync.session_invalid') }, { status: 400 })
    }

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
      // Dacă store.products_count e 0 dar avem produse, actualizăm din DB.
      // Nu și pe modelul de reclame: acolo numărul e al ofertelor, nu al tabelului vechi
      if (store.products_count === 0 && !isCommercePlatform(store.platform)) {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', store.id)
        if (count && count > 0) {
          store.products_count = count
          // Actualizăm și în DB
          await supabase.from('stores').update({ products_count: count }).eq('id', store.id)
        }
      }

      // Credențialele (chiar criptate) nu au ce căuta în browser
      delete store.api_key
      delete store.api_secret
      delete store.webhook_secret
    }

    // Fără alegere (sau magazinul ales a dispărut): cel mai nou
    const active = list.find(s => s.id === user?.active_store_id) ?? list[list.length - 1] ?? null

    return NextResponse.json({ store: active, stores: list, active_store_id: active?.id ?? null })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
