import { runPagedSync, chunks, type PagedConnector, type StoreInfo, type StoreRow } from '@/lib/commerce/paged-sync'
import { str } from '@/lib/commerce/rows'
import type { CommerceSyncResult, SyncMode } from '@/lib/commerce/sync-types'
import { localToUtcIso, ROMANIA_TZ, utcWall } from '@/lib/commerce/time'
import { MerchantProApi, PAGE_SIZE } from './api'
import { lineRows, offerRows, orderRow, soldProductIds } from './mapping'
import type { MproOrder, MproProduct } from './types'

// =============================================
// MerchantPro — sincronizarea în modelul comun (motorul din lib/commerce/paged-sync).
//
// - Produsele: în ordinea creării; trecerea completă cere doar pe cele active,
//   cea incrementală pe toate cele modificate (unul dezactivat își pierde ofertele).
// - Comenzile: API-ul nu filtrează după data plasării, deci trecerea completă
//   le citește de la cea mai nouă și se oprește la începutul ferestrei de 400 de
//   zile; cea incrementală, după data modificării.
// - Filtrele de dată se trimit în ora UTC: dacă MerchantPro le citește ca oră a
//   României, recitim câteva ore în plus; invers am pierde schimbări.
// =============================================

export type MerchantProData = {
  /** Ora în care MerchantPro scrie datele (fără fus orar în API). */
  timezone?: string
  [key: string]: unknown
}

export function merchantproConnector(store: StoreRow, credentials: { key: string; secret: string | null }, opts: { deadline: number }): PagedConnector<MproProduct, MproOrder> {
  const api = new MerchantProApi(store.store_url, credentials.key, credentials.secret ?? '', { deadline: opts.deadline })
  const pd = (store.platform_data ?? {}) as MerchantProData
  const timeZone = pd.timezone || ROMANIA_TZ

  return {
    unitColumn: 'external_product_id',

    async readStore(): Promise<StoreInfo> {
      // MerchantPro n-are în API setările magazinului: moneda o spune ultima comandă
      const last = await api.orders({ start: 0, limit: 1, sort: 'date_created.desc', fields: 'id,currency' }).catch(() => null)
      const currency = str(last?.items[0]?.currency)?.toUpperCase() ?? null
      return { fields: { currency, timezone: timeZone }, platform_data: { timezone: timeZone, api_version: 'v2' } }
    },

    async products(page, { modifiedAfter }) {
      const r = await api.products({
        start: (page - 1) * PAGE_SIZE,
        modifiedAfter: modifiedAfter ? utcWall(modifiedAfter) : undefined,
        activeOnly: !modifiedAfter,
      })
      return { items: r.items, more: r.more }
    },

    async productsById(ids) {
      const out: MproProduct[] = []
      for (const batch of chunks(ids, PAGE_SIZE)) out.push(...(await api.products({ start: 0, limit: PAGE_SIZE, ids: batch })).items)
      return out
    },

    unitId: p => String(p.id),
    offers: (ctx, p, syncedAt) => offerRows(ctx, p, syncedAt, timeZone),

    async orders(page, { createdAfter, modifiedAfter }) {
      const start = (page - 1) * PAGE_SIZE
      if (modifiedAfter) {
        const r = await api.orders({ start, sort: 'date_modified', modifiedAfter: utcWall(modifiedAfter) })
        return { items: r.items, more: r.more }
      }
      // Cele mai noi întâi, până la începutul ferestrei
      const r = await api.orders({ start, sort: 'date_created.desc' })
      if (!createdAfter) return { items: r.items, more: r.more }
      const placed = (o: MproOrder) => localToUtcIso(o.date_created, timeZone)
      const items = r.items.filter(o => { const p = placed(o); return p === null || p >= createdAfter })
      const reachedStart = r.items.some(o => { const p = placed(o); return p !== null && p < createdAfter })
      return { items, more: r.more && !reachedStart }
    },

    async ordersById(ids) {
      const out: MproOrder[] = []
      for (const batch of chunks(ids, PAGE_SIZE)) out.push(...(await api.orders({ start: 0, limit: PAGE_SIZE, ids: batch })).items)
      return out
    },

    orderId: o => String(o.id),
    order: (ctx, o, syncedAt) => orderRow(ctx, o, syncedAt, timeZone),
    lines: lineRows,
    soldUnitIds: soldProductIds,
    incremental: { productsModified: true, ordersModified: true, recentOrdersDays: 0 },
  }
}

export function syncMerchantProStore(storeId: string, mode: SyncMode, opts: { deadline?: number; manual?: boolean } = {}): Promise<CommerceSyncResult> {
  return runPagedSync('merchantpro', storeId, mode, opts, merchantproConnector)
}
