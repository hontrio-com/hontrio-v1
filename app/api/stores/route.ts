import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'

export async function GET() {
  const ROUTE = '/api/stores'
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logApiError(ROUTE, 401, 'Sesiune lipsă')
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      logApiError(ROUTE, 400, 'userId lipsă din token', { sessionUser: JSON.stringify(session.user) })
      return NextResponse.json({ error: 'ID utilizator lipsă' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      logApiError(ROUTE, 500, 'Eroare DB la încărcarea magazinului', { userId, dbError: error.message })
      return NextResponse.json({ error: 'Eroare la încărcarea magazinului' }, { status: 500 })
    }

    // Dacă store.products_count e 0 dar avem produse, actualizăm din DB.
    // Nu și pe modelul de reclame: acolo numărul e al ofertelor, nu al tabelului vechi
    if (store && store.products_count === 0 && !isCommercePlatform(store.platform)) {
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
    if (store) {
      delete store.api_key
      delete store.api_secret
      delete store.webhook_secret
    }

    return NextResponse.json({ store: store || null })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: String(err) })
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}