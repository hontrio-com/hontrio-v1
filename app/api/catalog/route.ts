import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { storeSetup } from '@/lib/commerce/setup'

// =============================================
// GET /api/catalog?days=30|90|365
// Ofertele magazinului pe noul model (commerce_offers), cu vânzările de pe
// site din perioada aleasă. Le au Edinio și WooCommerce; Shopify trece pe
// același model mai târziu.
// =============================================

const ROUTE = '/api/catalog'
const PERIOADE = [30, 90, 365]
// PostgREST întoarce cel mult 1000 de rânduri pe cerere
const PAGINA = 1000

const COLOANE = 'offer_id, external_product_id, item_group_id, title, product_name, variant_title, category, url, image_url, price, compare_at_price, currency, available, stock, sku, gtin, brand, google_status, cost_price, synced_at'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = PERIOADE.includes(daysParam) ? daysParam : 30

  const supabase = createAdminClient()
  const { data: store, error: eStore } = await supabase
    .from('stores')
    .select('id, platform, store_name, store_url, currency, country, language, connection_status, sync_status, last_sync_at, last_error, platform_data')
    .eq('user_id', userId)
    .maybeSingle()
  if (eStore) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: eStore.message })
    return NextResponse.json({ error: 'Nu am putut citi magazinul' }, { status: 500 })
  }
  if (!store) return NextResponse.json({ store: null, offers: [], days })

  // Doar platformele mutate pe modelul comun au oferte de arătat
  const setup = storeSetup(store)
  const storeOut = {
    id: store.id,
    platform: store.platform,
    platform_name: setup?.platformName ?? store.platform,
    store_name: store.store_name,
    store_url: store.store_url,
    currency: store.currency || 'RON',
    connection_status: store.connection_status,
    sync_status: store.sync_status,
    last_sync_at: store.last_sync_at,
    last_error: store.last_error,
    prices_include_vat: setup?.pricesIncludeVat ?? null,
    // WooCommerce nu știe ce face Google cu ofertele: starea vine după legarea contului Google
    google_status_known: setup?.googleStatusKnown ?? false,
    supported: !!setup,
  }
  if (!storeOut.supported) return NextResponse.json({ store: storeOut, offers: [], days })

  async function readOffers(): Promise<Record<string, unknown>[] | null> {
    const all: Record<string, unknown>[] = []
    for (let from = 0; ; from += PAGINA) {
      const { data, error } = await supabase
        .from('commerce_offers')
        .select(COLOANE)
        .eq('store_id', store!.id)
        .order('product_name', { ascending: true })
        .order('offer_id', { ascending: true })
        .range(from, from + PAGINA - 1)
      if (error) {
        logApiError(ROUTE, 500, 'Eroare la citirea ofertelor', { userId, error: error.message })
        return null
      }
      all.push(...(data ?? []))
      if (!data || data.length < PAGINA) return all
    }
  }

  // Ofertele și vânzările nu depind una de alta: un singur drum până la bază, nu două
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const [offers, { data: sales, error: eSales }] = await Promise.all([
    readOffers(),
    supabase.rpc('commerce_offer_sales', { p_store_id: store.id, p_since: since }),
  ])
  if (!offers) return NextResponse.json({ error: 'Nu am putut citi produsele' }, { status: 500 })
  if (eSales) logApiError(ROUTE, 500, 'Eroare la vânzările pe ofertă', { userId, error: eSales.message })
  const salesByOffer = new Map(
    ((sales ?? []) as { offer_id: string; units: number; revenue: number; orders: number }[])
      .map(s => [s.offer_id, { units: Number(s.units) || 0, revenue: Number(s.revenue) || 0, orders: Number(s.orders) || 0 }]),
  )

  return NextResponse.json({
    store: storeOut,
    days,
    // Vânzările lipsă (eroare la funcție) apar ca 0, nu opresc pagina; se vede în jurnal
    sales_available: !eSales,
    offers: offers.map(o => ({
      ...o,
      price: Number(o.price),
      compare_at_price: o.compare_at_price === null ? null : Number(o.compare_at_price),
      cost_price: o.cost_price === null ? null : Number(o.cost_price),
      sales: salesByOffer.get(o.offer_id as string) ?? { units: 0, revenue: 0, orders: 0 },
    })),
  })
}
