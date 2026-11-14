import { Pacer, StoreApiError, parseJson, storeRequest, type RequestPolicy } from '@/lib/commerce/http'
import type { MproErrorBody, MproList, MproOrder, MproProduct } from './types'

// =============================================
// MerchantPro — clientul API-ului REST v2 (numai citire).
//
// - Adresa: {domeniul magazinului}/api/v2/…; utilizatorul și secretul API merg
//   în antetul Basic (niciodată în adresă).
// - O cheie greșită dă 401, iar încercările repetate dau 403: un 401 nu se
//   reîncearcă niciodată.
// - Limitele: 4 cereri/secundă, 80/minut, 3.600/oră, plus timpul de server.
//   Ritmul nostru: o cerere la 0,8 s, cu pauzele cerute de antetele
//   X-RateLimit-* și de Retry-After (la 429).
// - Listele: `start` + `limit` (cel mult 100); `meta.links.next` e null pe
//   ultima pagină.
// =============================================

export const PAGE_SIZE = 100
const USER_AGENT = 'Hontrio/1.0 (+https://hontrio.com)'
const KEYS = { noResponse: 'sync.merchantpro_no_response', unavailable: 'sync.merchantpro_unavailable', rateLimited: 'sync.merchantpro_rate_limited' }

// Doar ce folosește maparea. Din comenzi: niciun nume, e-mail, telefon, adresă (în afară de
// codul țării), IP sau notă a cumpărătorului.
export const PRODUCT_FIELDS = [
  'id', 'type', 'sku', 'ean', 'name', 'inventory_enabled', 'stock', 'allow_backorders', 'category_name', 'manufacturer_name',
  'price_on_request', 'price_gross', 'old_price_gross', 'tax_value', 'url', 'image_url', 'variants', 'in_stock', 'visibility',
  'status', 'date_modified',
].join(',')

export const ORDER_FIELDS = [
  'id', 'payment_status', 'shipping_status', 'payment_method_code', 'billing_country_code', 'shipping_country_code',
  'line_items', 'created_by', 'customer_device', 'traffic_source', 'source_referrer', 'source_type',
  'subtotal_including_tax', 'tax_amount', 'shipping_amount', 'shipping_tax_amount', 'total_amount', 'currency',
  'coupon_code', 'channel_name', 'date_created', 'date_modified',
].join(',')

type Params = Record<string, string | number | undefined>

export type MproPage<T> = { items: T[]; more: boolean; total: number }

export class MerchantProApi {
  private pacer = new Pacer(800)
  private auth: string
  private base: string

  constructor(storeUrl: string, apiUser: string, apiSecret: string, private opts: { deadline?: number; retries?: number } = {}) {
    this.base = `${storeUrl.replace(/\/+$/, '')}/api/v2`
    this.auth = 'Basic ' + Buffer.from(`${apiUser}:${apiSecret}`).toString('base64')
  }

  private policy(): RequestPolicy {
    return {
      deadline: this.opts.deadline ?? Date.now() + 120_000,
      pacer: this.pacer,
      retries: this.opts.retries ?? 2,
      keys: KEYS,
      defaultRetryAfterMs: 30_000,
      timeoutMs: 30_000,
    }
  }

  /** Antetele de cotă: când cererile sau timpul de server se termină, așteptăm resetarea ferestrei. */
  private observeLimits(h: Headers) {
    const remaining = h.get('x-ratelimit-remaining')
    const reset = Number(h.get('x-ratelimit-reset'))
    if (remaining !== null && Number(remaining) <= 1 && reset > 0) this.pacer.pause(reset * 1000)
    const usage = h.get('x-ratelimit-usage-remaining')
    const usageReset = Number(h.get('x-ratelimit-usage-reset'))
    if (usage !== null && Number(usage) <= 2 && usageReset > 0) this.pacer.pause(usageReset * 1000)
  }

  async get<T>(path: string, params: Params): Promise<T> {
    const url = new URL(`${this.base}/${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const res = await storeRequest(url, {
      headers: { Authorization: this.auth, Accept: 'application/json', 'User-Agent': USER_AGENT },
    }, this.policy())
    this.observeLimits(res.headers)

    const body = parseJson<T & MproErrorBody>(res.text)
    const detail = (body?.error?.message ?? '').slice(0, 200)
    if (res.status === 401) throw new StoreApiError(`MerchantPro a refuzat datele API (401 la ${path})`, 'unauthorized', 401, 'sync.merchantpro_key_rejected')
    if (res.status === 403) {
      // Fără drept pe resursă, sau blocat după încercări greșite: omul trebuie să repare utilizatorul API
      throw new StoreApiError(`MerchantPro a refuzat accesul (403 la ${path}): ${detail}`, 'unauthorized', 403, 'sync.merchantpro_forbidden', { detail: detail || path })
    }
    if (res.status === 404) throw new StoreApiError(`MerchantPro: ${path} nu există (404)`, 'not_found', 404, 'sync.merchantpro_not_detected')
    if (res.status >= 400) {
      throw new StoreApiError(`MerchantPro a răspuns ${res.status} la ${path}: ${detail}`, 'bad_response', res.status, 'sync.merchantpro_error', { detail: detail || String(res.status) })
    }
    if (body === null || typeof body !== 'object') {
      throw new StoreApiError(`MerchantPro a trimis un răspuns care nu e JSON (${path})`, 'bad_response', res.status, 'sync.merchantpro_bad_response', { status: res.status })
    }
    return body
  }

  private async list<T>(path: string, params: Params): Promise<MproPage<T>> {
    const body = await this.get<MproList<T>>(path, params)
    if (!Array.isArray(body.data)) {
      throw new StoreApiError(`MerchantPro: ${path} nu a întors o listă`, 'bad_response', 200, 'sync.merchantpro_bad_response', { status: 200 })
    }
    const items = body.data
    const count = body.meta?.count
    const next = body.meta?.links?.next
    // Fără `meta`, o pagină plină înseamnă că mai urmează
    const more = next !== undefined ? !!next : items.length >= (Number(params.limit) || PAGE_SIZE)
    return { items, more, total: Number(count?.total) || 0 }
  }

  /**
   * Produsele, în ordinea creării (cele noi vin la coadă, paginile nu se decalează).
   * Cu `ids`, oricare ar fi starea lor (un produs dezactivat vine, dar fără oferte).
   */
  products(opts: { start: number; limit?: number; modifiedAfter?: string; ids?: string[]; activeOnly?: boolean }): Promise<MproPage<MproProduct>> {
    return this.list<MproProduct>('products', {
      fields: PRODUCT_FIELDS,
      start: opts.start,
      limit: opts.limit ?? PAGE_SIZE,
      sort: 'date_created',
      status: opts.activeOnly ? 'active' : undefined,
      modified_after: opts.modifiedAfter,
      ids: opts.ids?.join(','),
    })
  }

  orders(opts: { start: number; limit?: number; sort?: string; modifiedAfter?: string; ids?: string[]; fields?: string }): Promise<MproPage<MproOrder>> {
    return this.list<MproOrder>('orders', {
      fields: opts.fields ?? ORDER_FIELDS,
      start: opts.start,
      limit: opts.limit ?? PAGE_SIZE,
      sort: opts.sort,
      modified_after: opts.modifiedAfter,
      ids: opts.ids?.join(','),
    })
  }
}
