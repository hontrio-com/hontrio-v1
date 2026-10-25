import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { logError, logWarn } from '@/lib/logger'
import { standardVatRate } from '@/lib/ads/vat'
import type { Ctx } from '@/lib/commerce/rows'
import { ShopifyApi, ShopifyError, shopifyDate } from './api'
import { costRow, lineRows, offerRow, orderRow, storeFields, type ShopifyStoreInfo } from './mapping'
import type { ShopifyOrder, ShopifyVariant } from './types'

// =============================================
// Shopify — sincronizarea catalogului și a comenzilor în modelul comun
//
// Completă (la conectare, o dată pe zi, la „Sincronizează acum"): toate
// variantele și comenzile din ultimele 400 de zile (fără `read_all_orders`,
// Shopify dă doar ultimele 60). Paginile merg pe cursor, în ordinea id-ului,
// deci nu se decalează: ce n-a fost atins în toată trecerea nu mai există.
// Un magazin mare continuă la rularea următoare (`stores.sync_cursor`).
//
// Incrementală (cronul, la 15 minute): produsele modificate de la trecerea
// anterioară, minus 5 minute, plus cele vândute între timp (stocul lor scade
// fără ca produsul să pară modificat), și comenzile modificate.
// =============================================

export type SyncMode = 'incremental' | 'full'

export type SyncResult =
  | { ok: true; mode: SyncMode; complete: boolean; offers: number; orders: number; offersTotal: number; ordersTotal: number }
  | { ok: false; reason: 'not_found' | 'locked' | 'revoked' | 'failed'; message?: string }

type Cursor = { pass_start: string; phase: 'products' | 'orders' | 'cleanup'; after: string | null }

const OVERLAP_MS = 5 * 60_000
// O sincronizare „agățată" (funcția a fost oprită de Vercel) se consideră moartă după atât
const LEASE_MS = 10 * 60_000
const ORDER_WINDOW_DAYS = 400
// Cât din istoric arată Shopify fără `read_all_orders` (60 de zile), cu o zi de siguranță
const VISIBLE_DAYS = 59
const UPSERT_CHUNK = 500
// Id-urile ajung în filtre `in(...)` în adresa cererii către Supabase
const ID_CHUNK = 100
// Produse într-o căutare de variante („product_id:1 OR product_id:2 ...")
const PRODUCTS_PER_QUERY = 25

class DeadlineReached extends Error {}

type Supabase = ReturnType<typeof createAdminClient>
/** `costMultiplier` aduce costul din Shopify (fără TVA) pe baza prețului. */
type SyncCtx = Ctx & { costMultiplier: number }
/** Câmpurile la care Shopify poate refuza accesul; se încearcă din nou la fiecare trecere completă. */
type Access = { cost: boolean; country: boolean; orders: boolean }

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/** Ofertele și costurile unor variante; cele nelistate nu se scriu (curățenia le scoate). */
async function saveVariants(supabase: Supabase, ctx: SyncCtx, variants: ShopifyVariant[]): Promise<number> {
  const syncedAt = new Date().toISOString()
  const rows = variants.map(v => offerRow(ctx, v, syncedAt)).filter(r => r !== null)
  for (const chunk of chunks(rows, UPSERT_CHUNK)) {
    const { error } = await supabase.from('commerce_offers').upsert(chunk, { onConflict: 'store_id,offer_id' })
    check(error)
  }
  // Costurile din „Cost per item": completează golurile și înlocuiesc estimările;
  // costul scris de om în Hontrio rămâne
  const costs = variants.map(v => costRow(v, ctx.costMultiplier)).filter(c => c !== null)
  for (const chunk of chunks(costs, UPSERT_CHUNK)) {
    const { error } = await supabase.rpc('commerce_import_costs', { p_store_id: ctx.storeId, p_costs: chunk, p_source: 'shopify' })
    check(error)
  }
  return rows.length
}

/** Toate variantele unor produse, apoi ce nu mai e ofertă la ele (variantă ștearsă, produs arhivat). */
async function refreshProducts(api: ShopifyApi, supabase: Supabase, ctx: SyncCtx, access: Access, productIds: string[], deadline: number): Promise<number> {
  let saved = 0
  for (const ids of chunks(productIds, PRODUCTS_PER_QUERY)) {
    if (Date.now() > deadline) throw new DeadlineReached()
    const startedAt = new Date().toISOString()
    const variants: ShopifyVariant[] = []
    const query = ids.map(id => `product_id:${id}`).join(' OR ')
    for (let after: string | null = null; ;) {
      const page = await api.variants({ after, query, withCost: access.cost })
      if (page.costDenied) access.cost = false
      variants.push(...page.items)
      if (!page.hasNext) break
      after = page.endCursor
    }
    saved += await saveVariants(supabase, ctx, variants)
    const { error } = await supabase.from('commerce_offers').delete()
      .eq('store_id', ctx.storeId).in('external_product_id', ids).lt('synced_at', startedAt)
    check(error)
  }
  return saved
}

/** Comenzile unei pagini, cu liniile lor. Întoarce și produsele vândute. */
async function saveOrders(supabase: Supabase, ctx: Ctx, list: ShopifyOrder[]): Promise<{ saved: number; productIds: string[] }> {
  const syncedAt = new Date().toISOString()
  const kept = list.map(o => ({ o, row: orderRow(ctx, o, syncedAt) }))
  // O comandă de test nu e vânzare
  const dropped = kept.filter(k => !k.row).map(k => k.o.legacyResourceId)
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
    const id = idByExternal.get(o.legacyResourceId)
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

  const productIds = [...new Set(valid.flatMap(({ o }) => (o.lineItems?.nodes ?? []).map(l => l.product?.legacyResourceId).filter((id): id is string => !!id)))]
  return { saved: valid.length, productIds }
}

async function readStoreInfo(api: ShopifyApi): Promise<ShopifyStoreInfo> {
  const [{ shop, scopes }, locale] = await Promise.all([api.shop(), api.primaryLocale()])
  return { shop, scopes, locale }
}

async function countRows(supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', storeId: string, syncedSince?: string): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  if (syncedSince) q = q.gte('synced_at', syncedSince)
  const { count } = await q
  return count ?? 0
}

export async function syncShopifyStore(
  storeId: string, requestedMode: SyncMode, opts: { deadline?: number } = {},
): Promise<SyncResult> {
  const supabase = createAdminClient()
  const deadline = opts.deadline ?? Date.now() + 270_000

  const { data: store } = await supabase.from('stores')
    .select('id, user_id, platform, store_url, api_key, currency, country, connection_status, products_watermark, orders_watermark, sync_cursor, platform_data')
    .eq('id', storeId)
    .maybeSingle()
  if (!store || store.platform !== 'shopify' || !store.api_key) return { ok: false, reason: 'not_found' }
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
  let pd = (store.platform_data ?? {}) as Record<string, unknown>
  const access: Access = { cost: pd.cost_access !== false, country: pd.order_country_access !== false, orders: pd.orders_access !== false }
  // Ce a aflat rularea despre drepturi rămâne pe magazin, ca rulările următoare să nu reîncerce degeaba
  const accessData = () => ({ ...pd, cost_access: access.cost, order_country_access: access.country, orders_access: access.orders })
  try {
    const token = store.api_key.includes(':') ? decrypt(store.api_key) : store.api_key
    const api = new ShopifyApi(store.store_url, token)
    let currency = store.currency || 'RON'
    let country: string | null = store.country

    if (mode === 'full' && !cursor) {
      // Trecere nouă: întâi magazinul (moneda, TVA-ul, drepturile aplicației)
      const { platform_data, ...fields } = storeFields(await readStoreInfo(api))
      currency = fields.currency || currency
      country = fields.country || country
      pd = platform_data
      Object.assign(access, { cost: true, country: true, orders: true })
      // Ce nu știe magazinul (limba fără `read_locales`) nu șterge ce aveam
      const known = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null))
      const { error } = await supabase.from('stores').update({ ...known, currency, platform_data }).eq('id', storeId)
      check(error)
      await saveCursor({ pass_start: startedAt.toISOString(), phase: 'products', after: null })
    }
    // Costul din Shopify e fără TVA: cu prețuri care îl includ (sau când nu știm), îl adăugăm
    const costMultiplier = pd.prices_include_vat === false ? 1 : 1 + (standardVatRate(country) ?? 0)
    const ctx: SyncCtx = { storeId, userId: store.user_id, currency, costMultiplier }

    /** Comenzile unui filtru, pagină cu pagină. Fără acces la comenzi, se trece mai departe. */
    const eachOrders = async (query: string, from: string | null, onPage: (r: { saved: number; productIds: string[] }, next: string | null) => Promise<void>) => {
      if (!access.orders) return
      for (let after = from; ;) {
        if (Date.now() > deadline) throw new DeadlineReached()
        let page
        try {
          page = await api.orders({ after, query, withCountry: access.country })
        } catch (err) {
          if (err instanceof ShopifyError && err.code === 'access_denied') {
            // Comenzile cer aprobarea Shopify pentru datele clienților: catalogul merge și fără ele
            access.orders = false
            logWarn('shopify/sync', 'Shopify nu dă acces la comenzi', { storeId, error: err.message })
            return
          }
          throw err
        }
        if (page.countryDenied) access.country = false
        const res = await saveOrders(supabase, ctx, page.items)
        orders += res.saved
        await onPage(res, page.hasNext ? page.endCursor : null)
        if (!page.hasNext) return
        after = page.endCursor
      }
    }

    if (mode === 'full') {
      const c = cursor!
      const windowStart = new Date(Date.parse(c.pass_start) - ORDER_WINDOW_DAYS * 86_400_000).toISOString()

      if (c.phase === 'products') {
        for (let after = c.after; ;) {
          if (Date.now() > deadline) throw new DeadlineReached()
          const page = await api.variants({ after, withCost: access.cost })
          if (page.costDenied) access.cost = false
          offers += await saveVariants(supabase, ctx, page.items)
          if (!page.hasNext) break
          after = page.endCursor
          await saveCursor({ ...c, after })
        }
        await saveCursor({ ...c, phase: 'orders', after: null })
      }

      if (cursor!.phase === 'orders') {
        await eachOrders(`created_at:>=${shopifyDate(windowStart)}`, cursor!.after, async (_, next) => {
          if (next) await saveCursor({ ...cursor!, after: next })
        })
        await saveCursor({ ...cursor!, phase: 'cleanup', after: null })
      }

      // Curățenia: ce n-a fost atins în toată trecerea nu mai e în magazin.
      // ⚠ O trecere care n-a văzut nimic nu șterge nimic: un răspuns ciudat ne-ar
      // face să pierdem toate ofertele, cu prețurile de cost puse de om cu tot
      if (Date.now() > deadline) throw new DeadlineReached()
      const passStart = cursor!.pass_start
      if (await countRows(supabase, 'commerce_offers', storeId, passStart) > 0) {
        const { error } = await supabase.from('commerce_offers').delete().eq('store_id', storeId).lt('synced_at', passStart)
        check(error)
      }
      // Comenzile doar cât le arată Shopify aplicației: istoricul mai vechi rămâne
      const visibleStart = pd.all_orders === true ? windowStart
        : new Date(Math.max(Date.parse(windowStart), Date.parse(passStart) - VISIBLE_DAYS * 86_400_000)).toISOString()
      if (access.orders && await countRows(supabase, 'commerce_orders', storeId, passStart) > 0) {
        const { error } = await supabase.from('commerce_orders').delete()
          .eq('store_id', storeId).gte('placed_at', visibleStart).lt('synced_at', passStart)
        check(error)
      }
    } else {
      const since = (w: string) => shopifyDate(new Date(Date.parse(w) - OVERLAP_MS).toISOString())
      const changed = new Set<string>()
      for (let after: string | null = null; ;) {
        if (Date.now() > deadline) throw new DeadlineReached()
        const page = await api.productIds({ after, query: `updated_at:>${since(store.products_watermark!)}` })
        page.items.forEach(p => changed.add(p.legacyResourceId))
        if (!page.hasNext) break
        after = page.endCursor
      }
      // Produsele vândute: stocul lor s-a schimbat
      await eachOrders(`updated_at:>${since(store.orders_watermark!)}`, null, async res => {
        res.productIds.forEach(id => changed.add(id))
      })
      offers += await refreshProducts(api, supabase, ctx, access, [...changed], deadline)
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
      platform_data: accessData(),
      ...(mode === 'full' ? { last_full_sync_at: finishedAt } : {}),
    }).eq('id', storeId)
    check(error)
    return { ok: true, mode, complete: true, offers, orders, offersTotal, ordersTotal }
  } catch (err) {
    if (err instanceof DeadlineReached) {
      // Poziția e deja salvată: rularea următoare continuă de acolo
      await supabase.from('stores').update({ sync_status: 'active', last_error: null, platform_data: accessData() }).eq('id', storeId)
      const [offersTotal, ordersTotal] = await Promise.all([
        countRows(supabase, 'commerce_offers', storeId),
        countRows(supabase, 'commerce_orders', storeId),
      ])
      return { ok: true, mode, complete: false, offers, orders, offersTotal, ordersTotal }
    }
    if (err instanceof ShopifyError && err.code === 'unauthorized') {
      await supabase.from('stores').update({
        sync_status: 'active', connection_status: 'revoked', last_error: 'Shopify nu mai acceptă accesul aplicației (dezinstalată?)',
      }).eq('id', storeId)
      logWarn('shopify/sync', 'Acces Shopify refuzat', { storeId })
      return { ok: false, reason: 'revoked' }
    }
    // Watermark-urile NU avansează: trecerea următoare reia de unde știm sigur
    const message = (err as Error).message
    await supabase.from('stores').update({
      sync_status: 'error',
      last_error: message.slice(0, 500),
      // Magazinul nu răspunde sau e închis: îl arătăm ca problemă, dar continuăm să încercăm
      ...(err instanceof ShopifyError && ['network', 'unavailable', 'not_found'].includes(err.code) ? { connection_status: 'error' } : {}),
    }).eq('id', storeId)
    logError('shopify/sync', 'Sincronizare Shopify eșuată', { storeId, mode, error: message })
    return { ok: false, reason: 'failed', message }
  }
}
