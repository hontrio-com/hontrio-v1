import { StoreApiError } from '@/lib/commerce/http'
import { runPagedSync, type PagedConnector, type StoreInfo, type StoreRow } from '@/lib/commerce/paged-sync'
import type { CommerceSyncResult, SyncMode } from '@/lib/commerce/sync-types'
import { ROMANIA_TZ } from '@/lib/commerce/time'
import { GomagApi, gomagDay, hasMore } from './api'
import { baseCurrency, lineRows, offerRows, orderRow, soldProductIds, statusMap } from './mapping'
import type { GomagOrder, GomagProduct, GomagStatus } from './types'

// =============================================
// Gomag — sincronizarea în modelul comun (motorul din lib/commerce/paged-sync).
//
// - Produsele și comenzile vin câte 100, cu o citire pe secundă.
// - Filtrele de dată ale Gomag (`startDate`, `updated`) se trimit ca zi: o zi
//   întreagă în plus se recitește, niciuna nu se pierde, oricum le-ar
//   interpreta Gomag. La fiecare rulare se recitesc și comenzile din ultimele
//   3 zile (stările lor se schimbă des).
// - Gomag nu caută comenzile după id: curățenia comenzilor se sare (o comandă
//   Gomag nu se șterge, se anulează). Produsele se caută câte unul (`id`).
// =============================================

const NOT_FOUND = /not found|nu exist|inexistent|no (product|result)|nu a fost g[aă]sit|0 result/i

export type GomagData = {
  /** Valoarea antetului ApiShop pe care Gomag a recunoscut-o la conectare. */
  api_shop?: string
  base_currency?: string | null
  currencies?: string[]
  order_statuses?: GomagStatus[]
  /** Ora în care Gomag scrie datele (fără fus orar în API). */
  timezone?: string
  /** Gomag nu dă sursa comenzilor (UTM, gclid). */
  order_attribution?: 'unavailable'
  [key: string]: unknown
}

export function gomagConnector(store: StoreRow, credentials: { key: string }, opts: { deadline: number }): PagedConnector<GomagProduct, GomagOrder> {
  const pd = (store.platform_data ?? {}) as GomagData
  // Forma adresei pe care Gomag a recunoscut-o la conectare (cu sau fără https://, www.)
  const apiShop = typeof pd.api_shop === 'string' && pd.api_shop ? pd.api_shop : store.store_url
  const api = new GomagApi(apiShop, credentials.key, { deadline: opts.deadline })
  const timeZone = pd.timezone || ROMANIA_TZ
  let statuses = statusMap(pd.order_statuses)

  return {
    unitColumn: 'offer_id',

    async readStore(): Promise<StoreInfo> {
      // Stările comenzilor și monedele; fără ele încă merge (stările se judecă după nume)
      const list = await api.statuses().catch(() => null)
      if (list) statuses = statusMap(list)
      const currencies = await api.currencies().catch(() => [])
      const base = baseCurrency(currencies)
      const platform_data: GomagData = {
        api_shop: apiShop,
        base_currency: base,
        currencies: currencies.map(c => String(c.currency ?? c.name ?? '')).filter(Boolean),
        order_statuses: list ?? pd.order_statuses ?? [],
        timezone: timeZone,
        order_attribution: 'unavailable',
      }
      return { fields: { currency: base, timezone: timeZone }, platform_data }
    },

    async products(page, { modifiedAfter }) {
      const r = await api.products({ page, updated: modifiedAfter ? gomagDay(modifiedAfter) : undefined })
      return { items: r.items, more: hasMore(r) }
    },

    async productsById(ids) {
      const out: GomagProduct[] = []
      for (const id of ids) {
        try {
          // Tot ce vine, nefiltrat: un filtru ignorat (prima pagină a catalogului) se vede în motor și oprește curățenia
          out.push(...(await api.products({ page: 1, id })).items)
        } catch (err) {
          // „Nu există" spus ca eroare: produsul nu mai e în magazin. Orice altă eroare oprește trecerea.
          if (err instanceof StoreApiError && err.code === 'bad_response' && NOT_FOUND.test(err.message)) continue
          throw err
        }
      }
      return out
    },

    unitId: p => String(p.id),
    offers: (ctx, p, syncedAt) => offerRows(ctx, p, syncedAt, timeZone),

    async orders(page, { createdAfter, modifiedAfter }) {
      const r = await api.orders({
        page,
        startDate: createdAfter ? gomagDay(createdAfter) : undefined,
        updated: modifiedAfter ? gomagDay(modifiedAfter) : undefined,
      })
      return { items: r.items, more: hasMore(r) }
    },

    ordersById: null,
    orderId: o => String(o.id),
    order: (ctx, o, syncedAt) => orderRow(ctx, o, syncedAt, statuses, timeZone),
    lines: lineRows,
    soldUnitIds: soldProductIds,
    incremental: { productsModified: true, ordersModified: true, recentOrdersDays: 3, maxSoldRefresh: 25 },
  }
}

export function syncGomagStore(storeId: string, mode: SyncMode, opts: { deadline?: number; manual?: boolean } = {}): Promise<CommerceSyncResult> {
  return runPagedSync('gomag', storeId, mode, opts, gomagConnector)
}
