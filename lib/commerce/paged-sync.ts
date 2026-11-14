import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { logError, logWarn } from '@/lib/logger'
import { storedMessage } from '@/lib/i18n/stored'
import type { Ctx, LineRow, OfferRow, OrderRow } from './rows'
import { StoreApiError } from './http'
import type { CommerceSyncResult, SyncMode } from './sync-types'

// =============================================
// Sincronizarea în modelul comun pentru platformele citite pe pagini, prin
// chei API: Gomag, MerchantPro și extensia OpenCart. Fiecare platformă dă un
// `PagedConnector` (cererile și maparea); aici e restul, la fel ca la
// WooCommerce:
//
// Completă (la conectare, o dată pe zi, la „Sincronizează acum"): produsele,
// apoi comenzile din ultimele 400 de zile, apoi curățenia. Un magazin mare nu
// încape într-o rulare: poziția se scrie în `stores.sync_cursor`, iar rularea
// următoare continuă de acolo.
//
// Curățenia nu șterge după data sincronizării: paginile se pot decala în
// timpul citirii, iar un produs sărit nu e un produs șters. Ce n-a fost citit
// în trecerea asta se cere din nou, după id: ce vine se reîmprospătează, ce
// lipsește nu mai e de vânzare și se șterge.
//
// Incrementală (cronul, la 15 minute): ce s-a schimbat de la trecerea
// anterioară (minus 5 minute), comenzile din ultimele zile când platforma nu
// poate filtra după modificare, plus produsele vândute între timp (stocul lor
// scade fără ca produsul să pară modificat).
// =============================================

export type StoreRow = {
  id: string; user_id: string; platform: string; store_url: string
  api_key: string | null; api_secret: string | null
  currency: string | null; country: string | null; language: string | null; timezone: string | null
  connection_status: string | null
  products_watermark: string | null; orders_watermark: string | null
  sync_cursor: unknown; platform_data: Record<string, unknown> | null
}

const STORE_COLUMNS = 'id, user_id, platform, store_url, api_key, api_secret, currency, country, language, timezone, connection_status, products_watermark, orders_watermark, sync_cursor, platform_data'

export type PageResult<T> = { items: T[]; more: boolean }

export type StoreInfo = {
  /** Ce spune platforma despre magazin. Null sau lipsă = nu știe (nu șterge ce aveam). */
  fields: { store_name?: string | null; currency?: string | null; country?: string | null; language?: string | null; timezone?: string | null }
  platform_data: Record<string, unknown>
}

export interface PagedConnector<P, O> {
  /**
   * Coloana din commerce_offers care ține id-ul unității citite (produsul din
   * listă): `offer_id` când fiecare produs listat e o singură ofertă (Gomag,
   * OpenCart), `external_product_id` când produsul își aduce variantele (MerchantPro).
   */
  unitColumn: 'offer_id' | 'external_product_id'
  readStore(): Promise<StoreInfo>
  /** Produsele în ordine stabilă (id sau data creării), câte o pagină. */
  products(page: number, opts: { modifiedAfter?: string }): Promise<PageResult<P>>
  /** Produsele după id-ul unității; cele care nu mai sunt de vânzare pot lipsi. */
  productsById(ids: string[]): Promise<P[]>
  unitId(p: P): string
  offers(ctx: Ctx, p: P, syncedAt: string): OfferRow[]
  /** Comenzile, câte o pagină. Cu `createdAfter`, doar cele plasate de atunci încoace. */
  orders(page: number, opts: { createdAfter?: string; modifiedAfter?: string }): Promise<PageResult<O>>
  /** Comenzile după id; null = platforma nu poate căuta după id (curățenia comenzilor se sare). */
  ordersById: ((ids: string[]) => Promise<O[]>) | null
  orderId(o: O): string
  /** Rândul comenzii; null = nu e o comandă (ciornă, plată neterminată): se șterge dacă exista. */
  order(ctx: Ctx, o: O, syncedAt: string): OrderRow | null
  lines(orderId: string, storeId: string, o: O, syncedAt: string): LineRow[]
  /** Unitățile vândute în comandă: stocul lor s-a schimbat. */
  soldUnitIds(o: O): string[]
  incremental: {
    /** Platforma filtrează produsele după data modificării. */
    productsModified: boolean
    /** Platforma filtrează comenzile după data modificării. */
    ordersModified: boolean
    /** Comenzile plasate în ultimele atâtea zile se recitesc la fiecare rulare (0 = deloc). */
    recentOrdersDays: number
    /**
     * Câte produse vândute se recitesc într-o rulare (lipsă = toate). Unde produsele se
     * cer câte unul (Gomag), o zi aglomerată n-ar mai lăsa rularea să se termine; restul
     * se reîmprospătează la trecerea completă zilnică.
     */
    maxSoldRefresh?: number
  }
}

export type ConnectorFactory<P, O> = (
  store: StoreRow,
  credentials: { key: string; secret: string | null },
  opts: { deadline: number },
) => PagedConnector<P, O>

type Cursor = { pass_start: string; phase: 'products' | 'orders' | 'cleanup'; page: number }

const OVERLAP_MS = 5 * 60_000
// O sincronizare „agățată" (funcția a fost oprită de Vercel) se consideră moartă după atât
const LEASE_MS = 10 * 60_000
export const ORDER_WINDOW_DAYS = 400
const UPSERT_CHUNK = 500
// Id-urile ajung în filtre `in(...)` în adresa cererii către Supabase
const ID_CHUNK = 100
// Câte id-uri se verifică deodată la curățenie (conectorul le împarte cum cere platforma)
const VERIFY_CHUNK = 100

class DeadlineReached extends Error {}

type Supabase = ReturnType<typeof createAdminClient>

export function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/**
 * O platformă care ignoră numărul paginii dă mereu aceeași pagină: fără oprire,
 * trecerea s-ar învârti la nesfârșit (și ar continua așa la fiecare rulare).
 * Întoarce true când pagina are exact aceleași id-uri ca precedenta.
 */
export function repeatGuard<T>(idOf: (item: T) => string): (items: T[], page: number) => boolean {
  let previous: string | null = null
  return (items, page) => {
    const key = items.length ? items.map(idOf).join(',') : null
    const repeated = page > 1 && key !== null && key === previous
    previous = key
    return repeated
  }
}

/** Ultimul rând câștigă: aceeași ofertă de două ori într-un upsert e o eroare în Postgres. */
function dedupe<T>(rows: T[], key: (r: T) => string): T[] {
  const map = new Map<string, T>()
  for (const r of rows) map.set(key(r), r)
  return [...map.values()]
}

/** Ofertele unor produse citite acum; ofertele lor care n-au mai venit nu mai există. */
async function saveOffers<P, O>(supabase: Supabase, ctx: Ctx, connector: PagedConnector<P, O>, products: P[]): Promise<number> {
  if (!products.length) return 0
  const syncedAt = new Date().toISOString()
  const rows = dedupe(products.flatMap(p => connector.offers(ctx, p, syncedAt)), r => r.offer_id)
  for (const chunk of chunks(rows, UPSERT_CHUNK)) {
    const { error } = await supabase.from('commerce_offers').upsert(chunk, { onConflict: 'store_id,offer_id' })
    check(error)
  }
  // Ofertele acestor produse care n-au venit acum (ascunse, fără preț, variantă scoasă)
  // au rămas cu `synced_at` mai vechi
  const units = [...new Set(products.map(p => connector.unitId(p)))]
  for (const ids of chunks(units, ID_CHUNK)) {
    const { error } = await supabase.from('commerce_offers').delete()
      .eq('store_id', ctx.storeId).in(connector.unitColumn, ids).lt('synced_at', syncedAt)
    check(error)
  }
  return rows.length
}

/** Comenzile, cu liniile lor. Întoarce și unitățile vândute. */
async function saveOrders<P, O>(supabase: Supabase, ctx: Ctx, connector: PagedConnector<P, O>, list: O[]): Promise<{ saved: number; sold: string[] }> {
  if (!list.length) return { saved: 0, sold: [] }
  const syncedAt = new Date().toISOString()
  const kept = list.map(o => ({ o, row: connector.order(ctx, o, syncedAt) }))
  // O comandă devenită ciornă (sau o plată neterminată) nu mai e comandă
  const dropped = kept.filter(k => !k.row).map(k => connector.orderId(k.o))
  for (const ids of chunks(dropped, ID_CHUNK)) {
    const { error } = await supabase.from('commerce_orders').delete().eq('store_id', ctx.storeId).in('external_id', ids)
    check(error)
  }
  const valid = dedupe(kept.filter(k => k.row) as { o: O; row: OrderRow }[], k => k.row.external_id)
  if (!valid.length) return { saved: 0, sold: [] }

  const idByExternal = new Map<string, string>()
  for (const chunk of chunks(valid, UPSERT_CHUNK)) {
    const { data: saved, error } = await supabase.from('commerce_orders')
      .upsert(chunk.map(k => k.row), { onConflict: 'store_id,external_id' })
      .select('id, external_id')
    check(error)
    for (const s of saved ?? []) idByExternal.set(s.external_id as string, s.id as string)
  }

  const lines = valid.flatMap(({ o, row }) => {
    const id = idByExternal.get(row.external_id)
    return id ? connector.lines(id, ctx.storeId, o, syncedAt) : []
  })
  for (const chunk of chunks(lines, UPSERT_CHUNK)) {
    const { error } = await supabase.from('commerce_order_lines').upsert(chunk, { onConflict: 'order_id,position' })
    check(error)
  }
  // Pozițiile scoase din comandă la o editare (comanda are acum mai puține linii)
  for (const ids of chunks([...idByExternal.values()], ID_CHUNK)) {
    const { error } = await supabase.from('commerce_order_lines').delete().in('order_id', ids).lt('synced_at', syncedAt)
    check(error)
  }
  const sold = [...new Set(valid.flatMap(({ o }) => connector.soldUnitIds(o)))]
  return { saved: valid.length, sold }
}

async function countRows(supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', storeId: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  return count ?? 0
}

/** Valorile distincte ale unei coloane, pentru rândurile magazinului care se potrivesc (citite pe pagini de câte 1000). */
async function staleIds(
  supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', column: string, storeId: string, before: string, placedSince?: string,
): Promise<string[]> {
  const ids = new Set<string>()
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(column).eq('store_id', storeId).lt('synced_at', before)
      .order(column, { ascending: true }).range(from, from + 999)
    if (placedSince) q = q.gte('placed_at', placedSince)
    const { data, error } = await q
    check(error)
    for (const r of (data ?? []) as unknown as Record<string, string>[]) ids.add(r[column])
    if (!data || data.length < 1000) return [...ids]
  }
}

/** Țara magazinului din comenzi, când platforma n-o spune: cea mai des întâlnită. */
async function countryFromOrders(supabase: Supabase, storeId: string): Promise<string | null> {
  const { data } = await supabase.from('commerce_orders').select('country')
    .eq('store_id', storeId).not('country', 'is', null).order('placed_at', { ascending: false }).limit(500)
  const count = new Map<string, number>()
  for (const r of data ?? []) count.set(r.country as string, (count.get(r.country as string) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export async function runPagedSync<P, O>(
  platform: string,
  storeId: string,
  requestedMode: SyncMode,
  opts: { deadline?: number; manual?: boolean },
  factory: ConnectorFactory<P, O>,
): Promise<CommerceSyncResult> {
  const supabase = createAdminClient()
  const deadline = opts.deadline ?? Date.now() + 270_000
  const scope = `${platform}/sync`

  const { data } = await supabase.from('stores').select(STORE_COLUMNS).eq('id', storeId).maybeSingle()
  const store = data as StoreRow | null
  if (!store || store.platform !== platform || !store.api_key) return { ok: false, reason: 'not_found' }
  // Cheia refuzată: cronul nu mai încearcă; „Sincronizează acum" încearcă (omul poate să fi reparat drepturile)
  if (store.connection_status === 'revoked' && !opts.manual) return { ok: false, reason: 'revoked' }

  // Lease: o singură sincronizare pe magazin (cron + buton pornite deodată)
  const startedAt = new Date()
  const staleBefore = new Date(startedAt.getTime() - LEASE_MS).toISOString()
  const { data: claimed } = await supabase.from('stores')
    .update({ sync_status: 'syncing', sync_started_at: startedAt.toISOString() })
    .eq('id', storeId)
    .or(`sync_status.is.null,sync_status.neq.syncing,sync_started_at.lt."${staleBefore}"`)
    .select('id')
  if (!claimed?.length) return { ok: false, reason: 'locked' }

  let cursor = store.sync_cursor as Cursor | null
  // O trecere completă începută se termină înainte de orice altceva
  const mode: SyncMode = cursor || requestedMode === 'full' || !store.products_watermark || !store.orders_watermark ? 'full' : 'incremental'
  const saveCursor = async (c: Cursor | null) => {
    cursor = c
    const { error } = await supabase.from('stores').update({ sync_cursor: c }).eq('id', storeId)
    check(error)
  }
  const writeCounts = async () => {
    const [offersTotal, ordersTotal] = await Promise.all([
      countRows(supabase, 'commerce_offers', storeId),
      countRows(supabase, 'commerce_orders', storeId),
    ])
    await supabase.from('stores').update({ products_count: offersTotal, orders_count: ordersTotal }).eq('id', storeId)
    return { offersTotal, ordersTotal }
  }

  let offers = 0
  let orders = 0
  try {
    const plain = (v: string) => (v.includes(':') ? decrypt(v) : v)
    const connector = factory(store, { key: plain(store.api_key), secret: store.api_secret ? plain(store.api_secret) : null }, { deadline })
    let currency = store.currency || 'RON'
    let country = store.country

    if (mode === 'full' && !cursor) {
      // Trecere nouă: întâi magazinul (moneda, țara, stările comenzilor)
      const info = await connector.readStore()
      const known = Object.fromEntries(Object.entries(info.fields).filter(([, v]) => v !== null && v !== undefined && v !== ''))
      currency = info.fields.currency || currency
      country = info.fields.country || country
      const { error } = await supabase.from('stores').update({ ...known, currency, platform_data: info.platform_data }).eq('id', storeId)
      check(error)
      await saveCursor({ pass_start: startedAt.toISOString(), phase: 'products', page: 1 })
    }
    const ctx: Ctx = { storeId, userId: store.user_id, currency }

    if (mode === 'full') {
      const c = cursor!
      const windowStart = new Date(Date.parse(c.pass_start) - ORDER_WINDOW_DAYS * 86_400_000).toISOString()

      if (c.phase === 'products') {
        const repeats = repeatGuard<P>(p => connector.unitId(p))
        for (let page = c.page; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await connector.products(page, {})
          if (repeats(r.items, page)) { logWarn(scope, 'Pagina de produse o repetă pe cea de dinainte: lista se oprește aici', { storeId, page }); break }
          offers += await saveOffers(supabase, ctx, connector, r.items)
          if (!r.more) break
          await saveCursor({ ...c, page: page + 1 })
        }
        await writeCounts()
        await saveCursor({ ...c, phase: 'orders', page: 1 })
      }

      if (cursor!.phase === 'orders') {
        const repeats = repeatGuard<O>(o => connector.orderId(o))
        for (let page = cursor!.page; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await connector.orders(page, { createdAfter: windowStart })
          if (repeats(r.items, page)) { logWarn(scope, 'Pagina de comenzi o repetă pe cea de dinainte: lista se oprește aici', { storeId, page }); break }
          orders += (await saveOrders(supabase, ctx, connector, r.items)).saved
          if (!r.more) break
          await saveCursor({ ...cursor!, page: page + 1 })
        }
        await writeCounts()
        await saveCursor({ ...cursor!, phase: 'cleanup', page: 1 })
      }

      // Curățenia: ce n-a fost citit în trecerea asta se verifică după id
      const passStart = cursor!.pass_start
      const staleUnits = await staleIds(supabase, 'commerce_offers', connector.unitColumn, storeId, passStart)
      for (const batch of chunks(staleUnits, VERIFY_CHUNK)) {
        if (Date.now() > deadline) throw new DeadlineReached()
        const found = await connector.productsById(batch)
        const asked = new Set(batch)
        // Un API care nu ține cont de filtru (întoarce alte produse) nu poate dovedi o ștergere
        if (found.some(p => !asked.has(connector.unitId(p)))) {
          logWarn(scope, 'Căutarea după id a întors alte produse: curățenia ofertelor se amână', { storeId })
          break
        }
        offers += await saveOffers(supabase, ctx, connector, found)
        const present = new Set(found.map(p => connector.unitId(p)))
        const gone = batch.filter(id => !present.has(id))
        for (const ids of chunks(gone, ID_CHUNK)) {
          const { error } = await supabase.from('commerce_offers').delete().eq('store_id', storeId).in(connector.unitColumn, ids)
          check(error)
        }
      }
      if (connector.ordersById) {
        const staleOrders = await staleIds(supabase, 'commerce_orders', 'external_id', storeId, passStart, windowStart)
        for (const batch of chunks(staleOrders, VERIFY_CHUNK)) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const found = await connector.ordersById(batch)
          const asked = new Set(batch)
          if (found.some(o => !asked.has(connector.orderId(o)))) {
            logWarn(scope, 'Căutarea după id a întors alte comenzi: curățenia comenzilor se amână', { storeId })
            break
          }
          orders += (await saveOrders(supabase, ctx, connector, found)).saved
          const present = new Set(found.map(o => connector.orderId(o)))
          const gone = batch.filter(id => !present.has(id))
          for (const ids of chunks(gone, ID_CHUNK)) {
            const { error } = await supabase.from('commerce_orders').delete().eq('store_id', storeId).in('external_id', ids)
            check(error)
          }
        }
      }

      // Țara: din comenzi, când platforma n-o spune
      if (!country) {
        const fromOrders = await countryFromOrders(supabase, storeId)
        if (fromOrders) await supabase.from('stores').update({ country: fromOrders }).eq('id', storeId)
      }
    } else {
      const since = (w: string) => new Date(Date.parse(w) - OVERLAP_MS).toISOString()
      if (connector.incremental.productsModified) {
        const repeats = repeatGuard<P>(p => connector.unitId(p))
        for (let page = 1; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await connector.products(page, { modifiedAfter: since(store.products_watermark!) })
          if (repeats(r.items, page)) break
          offers += await saveOffers(supabase, ctx, connector, r.items)
          if (!r.more) break
        }
      }
      const sold = new Set<string>()
      const readOrders = async (filter: { createdAfter?: string; modifiedAfter?: string }) => {
        const repeats = repeatGuard<O>(o => connector.orderId(o))
        for (let page = 1; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await connector.orders(page, filter)
          if (repeats(r.items, page)) break
          const res = await saveOrders(supabase, ctx, connector, r.items)
          orders += res.saved
          res.sold.forEach(id => sold.add(id))
          if (!r.more) break
        }
      }
      if (connector.incremental.ordersModified) await readOrders({ modifiedAfter: since(store.orders_watermark!) })
      if (connector.incremental.recentOrdersDays > 0) {
        await readOrders({ createdAfter: new Date(Date.now() - connector.incremental.recentOrdersDays * 86_400_000).toISOString() })
      }
      // Produsele vândute: stocul lor s-a schimbat
      const soldList = [...sold].slice(0, connector.incremental.maxSoldRefresh ?? sold.size)
      for (const batch of chunks(soldList, VERIFY_CHUNK)) {
        if (Date.now() > deadline) throw new DeadlineReached()
        const asked = new Set(batch)
        const found = (await connector.productsById(batch)).filter(p => asked.has(connector.unitId(p)))
        offers += await saveOffers(supabase, ctx, connector, found)
      }
    }

    const { offersTotal, ordersTotal } = await writeCounts()
    const finishedAt = new Date().toISOString()
    const watermark = mode === 'full' ? cursor!.pass_start : startedAt.toISOString()
    const { error } = await supabase.from('stores').update({
      sync_status: 'active',
      connection_status: 'active',
      last_error: null,
      last_sync_at: finishedAt,
      products_watermark: watermark,
      orders_watermark: watermark,
      sync_cursor: null,
      ...(mode === 'full' ? { last_full_sync_at: finishedAt } : {}),
    }).eq('id', storeId)
    check(error)
    return { ok: true, mode, complete: true, offers, orders, offersTotal, ordersTotal }
  } catch (err) {
    // Timpul magazinului s-a terminat, sau platforma cere o pauză lungă: trecerea continuă data viitoare
    if (err instanceof DeadlineReached || (err instanceof StoreApiError && (err.code === 'deadline' || err.code === 'rate_limited'))) {
      // Poziția e deja salvată: rularea următoare continuă de acolo
      await supabase.from('stores').update({ sync_status: 'active', last_error: null }).eq('id', storeId)
      const { offersTotal, ordersTotal } = await writeCounts()
      return { ok: true, mode, complete: false, offers, orders, offersTotal, ordersTotal }
    }
    if (err instanceof StoreApiError && err.code === 'unauthorized') {
      await supabase.from('stores').update({
        sync_status: 'active', connection_status: 'revoked', last_error: err.stored,
      }).eq('id', storeId)
      logWarn(scope, 'Cheie refuzată de platformă', { storeId, error: err.message })
      return { ok: false, reason: 'revoked' }
    }
    // Watermark-urile NU avansează: trecerea următoare reia de unde știm sigur
    const message = (err as Error).message
    await supabase.from('stores').update({
      sync_status: 'error',
      // Omul vede mesajul tradus al erorii magazinului; o eroare de-a noastră (ex. a bazei) rămâne în jurnal
      last_error: err instanceof StoreApiError ? err.stored : storedMessage('sync.failed_internal'),
      // Magazinul nu răspunde sau ne blochează: îl arătăm ca problemă, dar continuăm să încercăm
      ...(err instanceof StoreApiError ? { connection_status: 'error' } : {}),
    }).eq('id', storeId)
    logError(scope, 'Sincronizare eșuată', { storeId, mode, error: message })
    return { ok: false, reason: 'failed', message }
  }
}
