import { runPagedSync, chunks, type PagedConnector, type StoreInfo, type StoreRow } from '@/lib/commerce/paged-sync'
import type { CommerceSyncResult, SyncMode } from '@/lib/commerce/sync-types'
import { hasMore, OpenCartApi, ORDER_PAGE, PRODUCT_PAGE } from './api'
import { lineRows, offerRows, orderRow, soldProductIds, statusMap, storeFields } from './mapping'
import type { OcOrder, OcProduct, OcStatus } from './types'

// =============================================
// OpenCart — sincronizarea în modelul comun, prin extensia Hontrio
// (motorul din lib/commerce/paged-sync). Extensia filtrează după data
// modificării și caută după id-uri, deci trecerea incrementală e exactă.
// =============================================

export type OpenCartData = {
  opencart_version?: string | null
  extension_version?: string | null
  statuses?: OcStatus[]
  feed_extensions?: string[]
  analytics_extensions?: string[]
  tracking?: { enabled: boolean; since: string | null } | null
  [key: string]: unknown
}

export function opencartConnector(store: StoreRow, credentials: { key: string }, opts: { deadline: number }): PagedConnector<OcProduct, OcOrder> {
  const api = new OpenCartApi(store.store_url, credentials.key, { deadline: opts.deadline })
  const pd = (store.platform_data ?? {}) as OpenCartData
  let statuses = statusMap(pd.statuses)

  return {
    unitColumn: 'offer_id',

    async readStore(): Promise<StoreInfo> {
      const info = await api.info()
      statuses = statusMap(info.statuses)
      return storeFields(info)
    },

    async products(page, { modifiedAfter }) {
      const r = await api.products({ page, modifiedAfter })
      return { items: r.items, more: hasMore(r, PRODUCT_PAGE) }
    },

    async productsById(ids) {
      const out: OcProduct[] = []
      for (const batch of chunks(ids, PRODUCT_PAGE)) out.push(...(await api.products({ page: 1, limit: batch.length, ids: batch })).items)
      return out
    },

    unitId: p => String(p.product_id),
    offers: offerRows,

    async orders(page, { createdAfter, modifiedAfter }) {
      const r = await api.orders({ page, createdAfter, modifiedAfter })
      return { items: r.items, more: hasMore(r, ORDER_PAGE) }
    },

    async ordersById(ids) {
      const out: OcOrder[] = []
      for (const batch of chunks(ids, 100)) out.push(...(await api.orders({ page: 1, limit: batch.length, ids: batch })).items)
      return out
    },

    orderId: o => String(o.order_id),
    order: (ctx, o, syncedAt) => orderRow(ctx, o, syncedAt, statuses),
    lines: lineRows,
    soldUnitIds: soldProductIds,
    incremental: { productsModified: true, ordersModified: true, recentOrdersDays: 0 },
  }
}

export function syncOpenCartStore(storeId: string, mode: SyncMode, opts: { deadline?: number; manual?: boolean } = {}): Promise<CommerceSyncResult> {
  return runPagedSync('opencart', storeId, mode, opts, opencartConnector)
}
