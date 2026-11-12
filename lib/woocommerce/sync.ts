import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { logError, logWarn } from '@/lib/logger'
import { storedMessage } from '@/lib/i18n/stored'
import type { Ctx } from '@/lib/commerce/rows'
import { PAGE_SIZE, WooApi, WooError } from './api'
import { isListed, isVariable, lineRows, offerRows, orderRow, storeFields, type WooStoreInfo } from './mapping'
import type { WooOrder, WooProduct, WooVariation } from './types'

// =============================================
// WooCommerce — sincronizarea catalogului și a comenzilor în modelul comun
//
// Completă (la conectare, o dată pe zi, la „Sincronizează acum"): produsele
// publicate și comenzile din ultimele 400 de zile. Un magazin mare nu încape
// într-o rulare: trecerea își scrie poziția în `stores.sync_cursor`, iar
// rularea următoare continuă de acolo. La final se șterge ce nu mai există,
// după lista id-urilor din magazin (nu după data sincronizării: paginile se
// pot decala în timpul citirii, iar un produs sărit nu e un produs șters).
//
// Incrementală (cronul, la 15 minute): ce s-a schimbat de la începutul
// trecerii anterioare, minus 5 minute, plus produsele vândute între timp:
// stocul lor scade fără ca produsul să pară modificat.
// =============================================

export type SyncMode = 'incremental' | 'full'

export type SyncResult =
  | { ok: true; mode: SyncMode; complete: boolean; offers: number; orders: number; offersTotal: number; ordersTotal: number }
  | { ok: false; reason: 'not_found' | 'locked' | 'revoked' | 'failed'; message?: string }

type Cursor = { pass_start: string; phase: 'products' | 'orders' | 'cleanup'; page: number }

const OVERLAP_MS = 5 * 60_000
// O sincronizare „agățată" (funcția a fost oprită de Vercel) se consideră moartă după atât
const LEASE_MS = 10 * 60_000
const ORDER_WINDOW_DAYS = 400
const VARIATION_CONCURRENCY = 4
const UPSERT_CHUNK = 500
// Id-urile ajung în filtre `in(...)` în adresa cererii către Supabase
const ID_CHUNK = 100

class DeadlineReached extends Error {}

type Supabase = ReturnType<typeof createAdminClient>

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/** WooCommerce filtrează după data modificării de la 5.8; înainte, parametrul e ignorat. */
function filtersByModified(version: unknown): boolean {
  const [major, minor] = String(version ?? '').split('.').map(Number)
  return major > 5 || (major === 5 && minor >= 8)
}

/** Ofertele unei pagini de produse; variațiile se cer câte patru produse deodată. */
async function saveProducts(api: WooApi, supabase: Supabase, ctx: Ctx, products: WooProduct[], deadline: number): Promise<number> {
  const syncedAt = new Date().toISOString()
  const variable = products.filter(p => isListed(p) && isVariable(p))
  const variations = new Map<number, WooVariation[]>()
  for (const batch of chunks(variable, VARIATION_CONCURRENCY)) {
    if (Date.now() > deadline) throw new DeadlineReached()
    const lists = await Promise.all(batch.map(p => api.variations(p.id)))
    batch.forEach((p, i) => variations.set(p.id, lists[i]))
  }

  const rows = products.flatMap(p => offerRows(ctx, p, variations.get(p.id) ?? [], syncedAt))
  for (const chunk of chunks(rows, UPSERT_CHUNK)) {
    const { error } = await supabase.from('commerce_offers').upsert(chunk, { onConflict: 'store_id,offer_id' })
    check(error)
  }
  // Ofertele acestor produse care n-au mai venit acum (variație dezactivată,
  // produs ascuns sau fără preț) au rămas cu `synced_at` mai vechi: nu mai există
  for (const ids of chunks(products.map(p => String(p.id)), ID_CHUNK)) {
    const { error } = await supabase.from('commerce_offers').delete()
      .eq('store_id', ctx.storeId).in('external_product_id', ids).lt('synced_at', syncedAt)
    check(error)
  }
  return rows.length
}

/** Comenzile unei pagini, cu liniile lor. Întoarce și produsele vândute. */
async function saveOrders(supabase: Supabase, ctx: Ctx, list: WooOrder[]): Promise<{ saved: number; productIds: number[] }> {
  const syncedAt = new Date().toISOString()
  const kept = list.map(o => ({ o, row: orderRow(ctx, o, syncedAt) }))
  // O comandă devenită ciornă sau aruncată la gunoi nu mai e comandă
  const dropped = kept.filter(k => !k.row).map(k => String(k.o.id))
  if (dropped.length) {
    const { error } = await supabase.from('commerce_orders').delete().eq('store_id', ctx.storeId).in('external_id', dropped)
    check(error)
  }
  const valid = kept.filter(k => k.row)
  if (!valid.length) return { saved: 0, productIds: [] }

  const { data: saved, error } = await supabase.from('commerce_orders')
    .upsert(valid.map(k => k.row!), { onConflict: 'store_id,external_id' })
    .select('id, external_id')
  check(error)
  const idByExternal = new Map((saved ?? []).map(s => [s.external_id as string, s.id as string]))

  const lines = valid.flatMap(({ o }) => {
    const id = idByExternal.get(String(o.id))
    return id ? lineRows(id, ctx.storeId, o, syncedAt) : []
  })
  for (const chunk of chunks(lines, UPSERT_CHUNK)) {
    const { error: eUp } = await supabase.from('commerce_order_lines').upsert(chunk, { onConflict: 'order_id,position' })
    check(eUp)
  }
  // Pozițiile scoase din comandă la o editare (comanda are acum mai puține linii)
  for (const ids of chunks([...idByExternal.values()], ID_CHUNK)) {
    const { error: eDel } = await supabase.from('commerce_order_lines').delete().in('order_id', ids).lt('synced_at', syncedAt)
    check(eDel)
  }

  const productIds = [...new Set(valid.flatMap(({ o }) => (o.line_items ?? []).map(l => l.product_id).filter(id => id > 0)))]
  return { saved: valid.length, productIds }
}

async function readStoreInfo(api: WooApi): Promise<WooStoreInfo> {
  // Setările sunt obligatorii (fără ele nu știm moneda și TVA-ul); restul e bun de avut
  const [site, status, general, tax, taxRates] = await Promise.all([
    api.siteInfo().catch(() => ({})),
    api.systemStatus().catch(() => null),
    api.settings('general'),
    api.settings('tax'),
    api.taxRateCount(),
  ])
  const hasGla = !!status?.active_plugins?.some(p => p.plugin.startsWith('google-listings-and-ads/'))
  const gla = hasGla ? { merchant: await api.glaConnection('mc'), ads: await api.glaConnection('ads') } : null
  return { site, status, general, tax, taxRates, gla }
}

async function countRows(supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', storeId: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  return count ?? 0
}

/** Ce avem în Hontrio și nu mai e în magazin. Listele noastre se citesc pe pagini (Supabase dă câte 1000). */
async function ourIds(supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', column: 'external_product_id' | 'external_id', storeId: string, since?: string): Promise<string[]> {
  const ids: string[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(column).eq('store_id', storeId).order(column, { ascending: true }).range(from, from + 999)
    if (since) q = q.gte('placed_at', since)
    const { data, error } = await q
    check(error)
    for (const r of (data ?? []) as Record<string, string>[]) ids.push(r[column])
    if (!data || data.length < 1000) return ids
  }
}

export async function syncWooStore(
  storeId: string, requestedMode: SyncMode, opts: { deadline?: number } = {},
): Promise<SyncResult> {
  const supabase = createAdminClient()
  const deadline = opts.deadline ?? Date.now() + 270_000

  const { data: store } = await supabase.from('stores')
    .select('id, user_id, platform, store_url, api_key, api_secret, currency, country, connection_status, products_watermark, orders_watermark, sync_cursor, platform_data')
    .eq('id', storeId)
    .maybeSingle()
  if (!store || store.platform !== 'woocommerce' || !store.api_key || !store.api_secret) return { ok: false, reason: 'not_found' }
  if (store.connection_status === 'revoked') return { ok: false, reason: 'revoked' }

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

  let offers = 0
  let orders = 0
  try {
    const plain = (v: string) => (v.includes(':') ? decrypt(v) : v)
    const api = new WooApi(store.store_url, plain(store.api_key), plain(store.api_secret), { deadline })
    let pd = (store.platform_data ?? {}) as Record<string, unknown>
    let currency = store.currency || 'RON'

    if (mode === 'full' && !cursor) {
      // Trecere nouă: întâi magazinul (moneda, TVA-ul, pluginurile)
      const { platform_data, ...fields } = storeFields(await readStoreInfo(api))
      currency = fields.currency || currency
      pd = platform_data
      // Ce nu știe magazinul (nume, țară) nu șterge ce aveam
      const known = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))
      const { error } = await supabase.from('stores').update({ ...known, currency, platform_data }).eq('id', storeId)
      check(error)
      await saveCursor({ pass_start: startedAt.toISOString(), phase: 'products', page: 1 })
    }
    const ctx: Ctx = { storeId, userId: store.user_id, currency }

    if (mode === 'full') {
      const c = cursor!
      const windowStart = new Date(Date.parse(c.pass_start) - ORDER_WINDOW_DAYS * 86_400_000).toISOString()

      if (c.phase === 'products') {
        for (let page = c.page; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await api.products({ page })
          offers += await saveProducts(api, supabase, ctx, r.items, deadline)
          if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
          await saveCursor({ ...c, page: page + 1 })
        }
        await saveCursor({ ...c, phase: 'orders', page: 1 })
      }

      if (cursor!.phase === 'orders') {
        for (let page = cursor!.page; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await api.orders({ page, createdAfter: windowStart })
          orders += (await saveOrders(supabase, ctx, r.items)).saved
          if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
          await saveCursor({ ...cursor!, page: page + 1 })
        }
        await saveCursor({ ...cursor!, phase: 'cleanup', page: 1 })
      }

      // Curățenia: produsele și comenzile care nu mai sunt în magazin
      if (Date.now() > deadline) throw new DeadlineReached()
      const listed = new Set<string>()
      for (let page = 1; ; page++) {
        const r = await api.productIds(page)
        for (const p of r.items) if (isListed(p)) listed.add(String(p.id))
        if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
      }
      // ⚠ O listă goală nu înseamnă un magazin gol: o gazdă care răspunde ciudat ne-ar
      // face să ștergem toate ofertele, cu prețurile de cost puse de om cu tot
      const goneProducts = listed.size
        ? [...new Set(await ourIds(supabase, 'commerce_offers', 'external_product_id', storeId))].filter(id => !listed.has(id))
        : []
      for (const ids of chunks(goneProducts, ID_CHUNK)) {
        const { error } = await supabase.from('commerce_offers').delete().eq('store_id', storeId).in('external_product_id', ids)
        check(error)
      }
      const present = new Set<string>()
      for (let page = 1; ; page++) {
        const r = await api.orderIds({ page, createdAfter: windowStart })
        for (const o of r.items) present.add(String(o.id))
        if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
      }
      const goneOrders = present.size
        ? (await ourIds(supabase, 'commerce_orders', 'external_id', storeId, windowStart)).filter(id => !present.has(id))
        : []
      for (const ids of chunks(goneOrders, ID_CHUNK)) {
        const { error } = await supabase.from('commerce_orders').delete().eq('store_id', storeId).in('external_id', ids)
        check(error)
      }
    } else {
      const since = (w: string) => new Date(Date.parse(w) - OVERLAP_MS).toISOString()
      if (filtersByModified(pd.wc_version)) {
        for (let page = 1; ; page++) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const r = await api.products({ page, modifiedAfter: since(store.products_watermark!) })
          offers += await saveProducts(api, supabase, ctx, r.items, deadline)
          if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
        }
      }
      const sold = new Set<number>()
      for (let page = 1; ; page++) {
        if (Date.now() > deadline) throw new DeadlineReached()
        const r = await api.orders({ page, modifiedAfter: since(store.orders_watermark!) })
        const res = await saveOrders(supabase, ctx, r.items)
        orders += res.saved
        res.productIds.forEach(id => sold.add(id))
        if (page >= r.totalPages || r.items.length < PAGE_SIZE) break
      }
      // Produsele vândute: stocul lor s-a schimbat
      for (const ids of chunks([...sold], PAGE_SIZE)) {
        if (Date.now() > deadline) throw new DeadlineReached()
        const r = await api.products({ page: 1, include: ids })
        offers += await saveProducts(api, supabase, ctx, r.items, deadline)
      }
    }

    const [offersTotal, ordersTotal] = await Promise.all([
      countRows(supabase, 'commerce_offers', storeId),
      countRows(supabase, 'commerce_orders', storeId),
    ])
    const finishedAt = new Date().toISOString()
    const watermark = mode === 'full' ? cursor!.pass_start : startedAt.toISOString()
    const { error } = await supabase.from('stores').update({
      sync_status: 'active',
      connection_status: 'active',
      last_error: null,
      last_sync_at: finishedAt,
      products_count: offersTotal,
      orders_count: ordersTotal,
      products_watermark: watermark,
      orders_watermark: watermark,
      sync_cursor: null,
      ...(mode === 'full' ? { last_full_sync_at: finishedAt } : {}),
    }).eq('id', storeId)
    check(error)
    return { ok: true, mode, complete: true, offers, orders, offersTotal, ordersTotal }
  } catch (err) {
    // Timpul magazinului s-a terminat între cereri (nu o pană a lui): trecerea continuă data viitoare
    if (err instanceof DeadlineReached || (err instanceof WooError && err.code === 'deadline')) {
      // Poziția e deja salvată: rularea următoare continuă de acolo
      await supabase.from('stores').update({ sync_status: 'active', last_error: null }).eq('id', storeId)
      const [offersTotal, ordersTotal] = await Promise.all([
        countRows(supabase, 'commerce_offers', storeId),
        countRows(supabase, 'commerce_orders', storeId),
      ])
      return { ok: true, mode, complete: false, offers, orders, offersTotal, ordersTotal }
    }
    if (err instanceof WooError && err.code === 'unauthorized') {
      // Cheia refuzată sau fără drept de citire (sync.woo_key_rejected / sync.woo_key_no_read)
      await supabase.from('stores').update({
        sync_status: 'active', connection_status: 'revoked', last_error: err.stored,
      }).eq('id', storeId)
      logWarn('woocommerce/sync', 'Cheie WooCommerce refuzată', { storeId })
      return { ok: false, reason: 'revoked' }
    }
    // Watermark-urile NU avansează: trecerea următoare reia de unde știm sigur
    const message = (err as Error).message
    await supabase.from('stores').update({
      sync_status: 'error',
      // Omul vede mesajul tradus al erorii magazinului; o eroare de-a noastră (ex. a bazei) rămâne în jurnal
      last_error: err instanceof WooError ? err.stored : storedMessage('sync.failed_internal'),
      // Magazinul nu răspunde sau ne blochează: îl arătăm ca problemă, dar continuăm să încercăm
      ...(err instanceof WooError ? { connection_status: 'error' } : {}),
    }).eq('id', storeId)
    logError('woocommerce/sync', 'Sincronizare WooCommerce eșuată', { storeId, mode, error: message })
    return { ok: false, reason: 'failed', message }
  }
}
