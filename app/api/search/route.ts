import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { storeSetup } from '@/lib/commerce/setup'
import { getActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/search?q=
// Căutarea din antet: produsele magazinului activ, din ofertele modelului
// comun (Edinio, WooCommerce, Shopify).
// =============================================

const ROUTE = '/api/search'
const MAX_PRODUCTS = 6

type Supabase = ReturnType<typeof createAdminClient>
type ActiveStore = { id: string; platform: string; store_url: string | null; country: string | null; language: string | null; platform_data: unknown }
type FoundProduct = { id: string; title: string; category: string | null; thumbnail_url: string | null }

/** Câte un rând pe produs: variațiile aceluiași produs apar o singură dată. */
async function offerProducts(supabase: Supabase, storeId: string, like: string): Promise<FoundProduct[]> {
  const { data, error } = await supabase.from('commerce_offers')
    .select('external_product_id, title, product_name, category, image_url')
    .eq('store_id', storeId)
    .or(['title', 'product_name', 'sku', 'gtin', 'brand', 'category'].map(c => `${c}.ilike.${like}`).join(','))
    .order('product_name')
    .limit(40)
  if (error) throw error
  const found = new Map<string, FoundProduct>()
  for (const o of data ?? []) {
    if (found.size >= MAX_PRODUCTS) break
    if (!found.has(o.external_product_id)) {
      found.set(o.external_product_id, { id: o.external_product_id, title: o.product_name || o.title, category: o.category, thumbnail_url: o.image_url })
    }
  }
  return [...found.values()]
}

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const q = new URL(request.url).searchParams.get('q')?.trim() || ''
  // În filtrul PostgREST valoarea stă între ghilimele; ghilimelele, backslash-ul și
  // wildcard-urile omului ar strica filtrul, deci devin spații
  const term = q.replace(/["\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
  if (term.length < 2) return NextResponse.json({ products: [] })
  const like = `"%${term}%"`

  const supabase = createAdminClient()
  try {
    const { data: store, error: eStore } = await getActiveStore<ActiveStore>(supabase, userId, 'id, platform, store_url, country, language, platform_data')
    if (eStore) throw eStore
    const products = store && storeSetup(store) ? await offerProducts(supabase, store.id, like) : []
    return NextResponse.json({ products })
  } catch (e) {
    logApiError(ROUTE, 500, 'Eroare la căutare', { userId, error: (e as Error).message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
