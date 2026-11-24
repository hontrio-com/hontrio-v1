import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { storeSetup } from '@/lib/commerce/setup'
import { getActiveStore } from '@/lib/stores/active'
import { getT } from '@/lib/i18n/server'
import { storeDisplayName } from '@/lib/commerce/platforms'
import { likePattern } from '@/lib/campaigns/plan-store'

// =============================================
// GET /api/catalog?days=30|90|365&quick=all|out|google_issue&q=&sort=sales|revenue|price|name&page=1
// O pagină din ofertele magazinului (commerce_offers), cu vânzările de pe site
// din perioada aleasă și cifrele filtrelor rapide (pe tot magazinul). Filtrarea,
// căutarea și ordinea se fac în baza de date (catalog_page, migrations/037): un
// catalog de zeci de mii de oferte nu mai pleacă întreg spre pagină.
// `store.last_error` e un mesaj salvat ca cheie de traducere (translateStored).
// =============================================

const ROUTE = '/api/catalog'
const PERIOADE = [30, 90, 365]
const QUICKS = ['all', 'out', 'google_issue']
const SORTS = ['sales', 'revenue', 'price', 'name']
const PE_PAGINA = 50
const MAX_PAGINA = 10_000

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  const params = new URL(request.url).searchParams
  const daysParam = Number(params.get('days'))
  const days = PERIOADE.includes(daysParam) ? daysParam : 30
  const quick = QUICKS.includes(params.get('quick') ?? '') ? params.get('quick')! : 'all'
  const sort = SORTS.includes(params.get('sort') ?? '') ? params.get('sort')! : 'sales'
  const page = Math.min(MAX_PAGINA, Math.max(1, Math.floor(Number(params.get('page')) || 1)))

  const supabase = createAdminClient()
  const { data: store, error: eStore } = await getActiveStore<{
    id: string; platform: string; store_name: string | null; store_url: string; currency: string | null
    country: string | null; language: string | null; connection_status: string | null; sync_status: string | null
    last_sync_at: string | null; last_error: string | null; platform_data: unknown
  }>(supabase, userId, 'id, platform, store_name, store_url, currency, country, language, connection_status, sync_status, last_sync_at, last_error, platform_data')
  if (eStore) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: eStore.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  const empty = { offers: [], total: 0, counts: { all: 0, out: 0, google_issue: 0 }, page: 1, per_page: PE_PAGINA, days }
  if (!store) return NextResponse.json({ store: null, ...empty })

  // Doar platformele mutate pe modelul comun au oferte de arătat
  const setup = storeSetup(store)
  const storeOut = {
    id: store.id,
    platform: store.platform,
    platform_name: setup?.platformName ?? store.platform,
    store_name: storeDisplayName(store),
    store_url: store.store_url,
    currency: store.currency || 'RON',
    connection_status: store.connection_status,
    sync_status: store.sync_status,
    last_sync_at: store.last_sync_at,
    last_error: store.last_error,
    // WooCommerce nu știe ce face Google cu ofertele: starea vine după legarea contului Google
    google_status_known: setup?.googleStatusKnown ?? false,
    supported: !!setup,
  }
  if (!storeOut.supported) return NextResponse.json({ store: storeOut, ...empty })

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase.rpc('catalog_page', {
    p_store_id: store.id, p_since: since, p_quick: quick, p_q: likePattern(params.get('q')), p_sort: sort,
    p_offset: (page - 1) * PE_PAGINA, p_limit: PE_PAGINA,
  })
  if (error) {
    logApiError(ROUTE, 500, 'Eroare la citirea ofertelor', { userId, error: error.message })
    return NextResponse.json({ error: t('sync.products_read_failed') }, { status: 500 })
  }
  const res = (data ?? {}) as { total?: unknown; counts?: Record<string, unknown>; rows?: Record<string, unknown>[] }
  const n = (v: unknown) => Number(v) || 0

  return NextResponse.json({
    store: storeOut,
    days,
    page,
    per_page: PE_PAGINA,
    total: n(res.total),
    counts: { all: n(res.counts?.all), out: n(res.counts?.out), google_issue: n(res.counts?.google_issue) },
    offers: (Array.isArray(res.rows) ? res.rows : []).map(o => {
      const sales = (o.sales ?? {}) as Record<string, unknown>
      return {
        ...o,
        price: n(o.price),
        compare_at_price: o.compare_at_price === null || o.compare_at_price === undefined ? null : n(o.compare_at_price),
        sales: { units: n(sales.units), revenue: n(sales.revenue), orders: n(sales.orders) },
      }
    }),
  })
}
