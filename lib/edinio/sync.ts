import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/security/encryption'
import { logError, logWarn } from '@/lib/logger'
import { EdinioClient } from './client'
import { EdinioError } from './config'
import { lineRows, offerRows, orderRow, storeFields, type ExistingLine } from './mapping'

// =============================================
// Edinio — sincronizarea catalogului și a comenzilor în modelul comun
//
// Incremental (cronul, la 15 minute): „ce s-a schimbat de la începutul
// trecerii anterioare, minus 5 minute". Un rând schimbat chiar în timpul
// citirii poate scăpa din trecerea curentă, dar îl aduce sigur următoarea;
// suprapunerea acoperă tranzacțiile încheiate târziu și diferențele de ceas.
//
// Complet (la conectare, o dată pe zi, la „Sincronizează acum"): tot, plus
// ștergerea a ce nu mai există în Edinio. Citirea incrementală nu vede
// ștergerile, de aceea e nevoie de trecerea completă.
// =============================================

export type SyncMode = 'incremental' | 'full'

export type SyncResult =
  | { ok: true; mode: SyncMode; offers: number; orders: number; offersTotal: number; ordersTotal: number }
  | { ok: false; reason: 'not_found' | 'locked' | 'revoked' | 'failed'; message?: string }

const OVERLAP_MS = 5 * 60_000
// O sincronizare „agățată" (funcția a fost oprită de Vercel) se consideră moartă după atât
const LEASE_MS = 10 * 60_000
// Paginile rămân la 100: id-urile lor ajung în filtre `in(...)` în adresa cererii
// către Supabase, iar 100 de UUID-uri înseamnă deja ~3,7 KB de adresă
const PRODUCT_PAGE = 100
const ORDER_PAGE = 100
const UPSERT_CHUNK = 500

class DeadlineReached extends Error {}

type Supabase = ReturnType<typeof createAdminClient>
type Ctx = { storeId: string; userId: string; currency: string }

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function productsPass(client: EdinioClient, supabase: Supabase, ctx: Ctx, since: string | null, deadline: number) {
  let after: string | null = null
  let offers = 0
  do {
    if (Date.now() > deadline) throw new DeadlineReached()
    const page = await client.getProducts({ after, updatedSince: since, limit: PRODUCT_PAGE })
    const syncedAt = new Date().toISOString()
    const rows = page.produse.flatMap(p => offerRows(ctx, p, syncedAt))
    for (const chunk of chunks(rows, UPSERT_CHUNK)) {
      const { error } = await supabase.from('commerce_offers').upsert(chunk, { onConflict: 'store_id,offer_id' })
      check(error)
    }
    // Ofertele acestor produse care n-au mai venit acum (variantă stinsă,
    // produs dezactivat) au rămas cu `synced_at` mai vechi: nu mai există.
    const productIds = page.produse.map(p => p.id)
    if (productIds.length) {
      const { error } = await supabase.from('commerce_offers').delete()
        .eq('store_id', ctx.storeId).in('external_product_id', productIds).lt('synced_at', syncedAt)
      check(error)
    }
    offers += rows.length
    after = page.urmatorul
  } while (after)
  return offers
}

async function ordersPass(client: EdinioClient, supabase: Supabase, ctx: Ctx, since: string | null, deadline: number) {
  let after: string | null = null
  let orders = 0
  do {
    if (Date.now() > deadline) throw new DeadlineReached()
    const page = await client.getOrders({ after, updatedSince: since, limit: ORDER_PAGE })
    const syncedAt = new Date().toISOString()
    if (page.comenzi.length) {
      const { data: saved, error } = await supabase.from('commerce_orders')
        .upsert(page.comenzi.map(o => orderRow(ctx, o, syncedAt)), { onConflict: 'store_id,external_id' })
        .select('id, external_id')
      check(error)
      const idByExternal = new Map((saved ?? []).map(s => [s.external_id as string, s.id as string]))
      const orderIds = [...idByExternal.values()]

      const { data: existing, error: eLines } = await supabase.from('commerce_order_lines')
        .select('order_id, position, external_product_id, name, offer_id').in('order_id', orderIds)
      check(eLines)

      const lines = page.comenzi.flatMap(o => {
        const id = idByExternal.get(o.id)
        return id ? lineRows(id, ctx.storeId, o, (existing ?? []) as ExistingLine[], syncedAt) : []
      })
      for (const chunk of chunks(lines, UPSERT_CHUNK)) {
        const { error: eUp } = await supabase.from('commerce_order_lines').upsert(chunk, { onConflict: 'order_id,position' })
        check(eUp)
      }
      // Pozițiile scoase din comandă la o editare (comanda are acum mai puține linii)
      const { error: eDel } = await supabase.from('commerce_order_lines').delete()
        .in('order_id', orderIds).lt('synced_at', syncedAt)
      check(eDel)
      orders += page.comenzi.length
    }
    after = page.urmatorul
  } while (after)
  return orders
}

async function countRows(supabase: Supabase, table: 'commerce_offers' | 'commerce_orders', storeId: string): Promise<number> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  return count ?? 0
}

export async function syncEdinioStore(
  storeId: string, requestedMode: SyncMode, opts: { deadline?: number } = {},
): Promise<SyncResult> {
  const supabase = createAdminClient()
  const deadline = opts.deadline ?? Date.now() + 270_000

  const { data: store } = await supabase.from('stores')
    .select('id, user_id, platform, api_key, currency, products_watermark, orders_watermark, connection_status')
    .eq('id', storeId)
    .maybeSingle()
  if (!store || store.platform !== 'edinio' || !store.api_key) return { ok: false, reason: 'not_found' }
  if (store.connection_status === 'revoked') return { ok: false, reason: 'revoked' }

  // Lease: o singură sincronizare pe magazin. Condiția e atomică, deci din
  // două porniri simultane (cron + buton) exact una primește magazinul.
  const startedAt = new Date()
  const staleBefore = new Date(startedAt.getTime() - LEASE_MS).toISOString()
  const { data: claimed } = await supabase.from('stores')
    .update({ sync_status: 'syncing', sync_started_at: startedAt.toISOString() })
    .eq('id', storeId)
    .or(`sync_status.is.null,sync_status.neq.syncing,sync_started_at.lt."${staleBefore}"`)
    .select('id')
  if (!claimed?.length) return { ok: false, reason: 'locked' }

  // Fără un punct de plecare, „incremental" n-ar ști de unde să înceapă
  const mode: SyncMode = requestedMode === 'full' || !store.products_watermark || !store.orders_watermark ? 'full' : 'incremental'
  const passStart = startedAt.toISOString()
  const sinceOf = (w: string | null) => (mode === 'full' || !w ? null : new Date(new Date(w).getTime() - OVERLAP_MS).toISOString())

  try {
    const client = new EdinioClient(decrypt(store.api_key))
    const edinioStore = await client.getStore()
    const ctx: Ctx = { storeId, userId: store.user_id, currency: edinioStore.moneda || store.currency || 'RON' }

    const offers = await productsPass(client, supabase, ctx, sinceOf(store.products_watermark), deadline)
    const orders = await ordersPass(client, supabase, ctx, sinceOf(store.orders_watermark), deadline)

    if (mode === 'full') {
      // Tot ce n-a fost atins în trecerea completă a dispărut din Edinio
      const { error: eOff } = await supabase.from('commerce_offers').delete().eq('store_id', storeId).lt('synced_at', passStart)
      check(eOff)
      const { error: eOrd } = await supabase.from('commerce_orders').delete().eq('store_id', storeId).lt('synced_at', passStart)
      check(eOrd)
    }

    const [offersTotal, ordersTotal] = await Promise.all([
      countRows(supabase, 'commerce_offers', storeId),
      countRows(supabase, 'commerce_orders', storeId),
    ])
    const finishedAt = new Date().toISOString()
    await supabase.from('stores').update({
      ...storeFields(edinioStore),
      sync_status: 'active',
      connection_status: 'active',
      last_error: null,
      last_sync_at: finishedAt,
      products_count: offersTotal,
      orders_count: ordersTotal,
      products_watermark: passStart,
      orders_watermark: passStart,
      ...(mode === 'full' ? { last_full_sync_at: finishedAt } : {}),
    }).eq('id', storeId)

    return { ok: true, mode, offers, orders, offersTotal, ordersTotal }
  } catch (err) {
    // Watermark-urile NU avansează: trecerea următoare reia de unde știm sigur
    if (err instanceof EdinioError && err.code === 'unauthorized') {
      await supabase.from('stores').update({
        sync_status: 'active', connection_status: 'revoked', last_error: 'Accesul a fost revocat din Edinio',
      }).eq('id', storeId)
      logWarn('edinio/sync', 'Jeton Edinio revocat', { storeId })
      return { ok: false, reason: 'revoked' }
    }
    const message = err instanceof DeadlineReached
      ? 'Sincronizarea nu s-a terminat în timpul alocat; continuă la următoarea rulare'
      : (err as Error).message
    await supabase.from('stores').update({ sync_status: 'error', last_error: message.slice(0, 500) }).eq('id', storeId)
    logError('edinio/sync', 'Sincronizare Edinio eșuată', { storeId, mode, error: message })
    return { ok: false, reason: 'failed', message }
  }
}
