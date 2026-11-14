import { Pacer, StoreApiError, parseJson, storeRequest, type RequestPolicy } from '@/lib/commerce/http'
import type { OcEnvelope, OcInfo, OcMeta, OcOrder, OcProduct } from './types'

// =============================================
// OpenCart — clientul extensiei Hontrio (numai citire), după contractul v1 din
// docs/integrari/OPENCART.md: aceeași rută pe OpenCart 3 și 4
// (index.php?route=extension/hontrio/api&action=…), cheia în antetul
// X-Hontrio-Key (niciodată în adresă). Răspunsul începe cu {"hontrio_api":…};
// unele gazde scriu avertismente PHP înaintea lui, așa că obiectul se caută în text.
// =============================================

const ROUTE = 'extension/hontrio/api'
export const PRODUCT_PAGE = 100
export const ORDER_PAGE = 50
const USER_AGENT = 'Hontrio/1.0 (+https://hontrio.com)'
const KEYS = { noResponse: 'sync.opencart_no_response', unavailable: 'sync.opencart_unavailable', rateLimited: 'sync.opencart_rate_limited' }

type Params = Record<string, string | number | undefined>

const START = /\{\s*"hontrio_api"\s*:/

/** Obiectul extensiei, chiar dacă gazda a scris altceva înainte sau după el. */
export function extractEnvelope<T>(text: string): OcEnvelope<T> | null {
  const m = START.exec(text)
  if (!m) return null
  const rest = text.slice(m.index)
  const direct = parseJson<OcEnvelope<T>>(rest)
  if (direct && typeof direct === 'object') return direct
  const end = rest.lastIndexOf('}')
  const trimmed = end > 0 ? parseJson<OcEnvelope<T>>(rest.slice(0, end + 1)) : null
  return trimmed && typeof trimmed === 'object' ? trimmed : null
}

export type OcPage<T> = { items: T[]; meta: OcMeta | null }

/** Mai sunt pagini după aceasta. */
export function hasMore(page: OcPage<unknown>, limit: number): boolean {
  if (page.meta && page.meta.pages > 0) return page.meta.page < page.meta.pages
  return page.items.length >= limit
}

export class OpenCartApi {
  private pacer = new Pacer(150)

  constructor(private storeUrl: string, private key: string, private opts: { deadline?: number; retries?: number } = {}) {}

  private policy(): RequestPolicy {
    return {
      deadline: this.opts.deadline ?? Date.now() + 120_000,
      pacer: this.pacer,
      retries: this.opts.retries ?? 2,
      keys: KEYS,
      defaultRetryAfterMs: 10_000,
      timeoutMs: 45_000,
    }
  }

  private async call<T>(action: string, params: Params): Promise<{ data: T; meta: OcMeta | null }> {
    const url = new URL(`${this.storeUrl.replace(/\/+$/, '')}/index.php`)
    url.searchParams.set('route', ROUTE)
    url.searchParams.set('action', action)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const res = await storeRequest(url, {
      headers: { 'X-Hontrio-Key': this.key, Accept: 'application/json', 'User-Agent': USER_AGENT },
    }, this.policy())

    const env = extractEnvelope<T>(res.text)
    if (!env) {
      // Altcineva a răspuns (pagina 404 a magazinului, un firewall): extensia nu e instalată sau nu e pornită
      if (res.status === 401 || res.status === 403) {
        throw new StoreApiError(`Magazinul a blocat cererea (${res.status}, fără răspunsul extensiei)`, 'blocked', res.status, 'sync.opencart_blocked', { status: res.status })
      }
      throw new StoreApiError(`Extensia Hontrio nu răspunde (${res.status} la ${action})`, 'not_found', res.status, 'sync.opencart_extension_missing')
    }
    if (env.ok !== true) {
      const code = env.error?.code ?? ''
      const message = (env.error?.message ?? '').slice(0, 200)
      if (code === 'unauthorized') throw new StoreApiError('Extensia Hontrio a refuzat cheia', 'unauthorized', res.status, 'sync.opencart_key_rejected')
      if (code === 'disabled') throw new StoreApiError('API-ul extensiei Hontrio e oprit', 'unauthorized', res.status, 'sync.opencart_disabled')
      if (code === 'server_error') throw new StoreApiError(`Extensia Hontrio a avut o eroare: ${message}`, 'unavailable', res.status, 'sync.opencart_error', { detail: message || code })
      throw new StoreApiError(`Extensia Hontrio a refuzat cererea (${code}): ${message}`, 'bad_response', res.status, 'sync.opencart_error', { detail: message || code || String(res.status) })
    }
    return { data: env.data as T, meta: env.meta ?? null }
  }

  async info(): Promise<OcInfo> {
    const { data } = await this.call<OcInfo>('info', {})
    if (!data || typeof data !== 'object' || !data.store) {
      throw new StoreApiError('Extensia Hontrio a trimis date incomplete (info)', 'bad_response', 200, 'sync.opencart_error', { detail: 'info' })
    }
    return data
  }

  private async list<T>(action: string, params: Params): Promise<OcPage<T>> {
    const { data, meta } = await this.call<T[]>(action, params)
    if (!Array.isArray(data)) {
      throw new StoreApiError(`Extensia Hontrio nu a întors o listă (${action})`, 'bad_response', 200, 'sync.opencart_error', { detail: action })
    }
    return { items: data, meta }
  }

  products(opts: { page: number; limit?: number; modifiedAfter?: string; ids?: string[] }): Promise<OcPage<OcProduct>> {
    return this.list<OcProduct>('products', {
      page: opts.page, limit: opts.limit ?? PRODUCT_PAGE, modified_after: opts.modifiedAfter, ids: opts.ids?.join(','),
    })
  }

  orders(opts: { page: number; limit?: number; createdAfter?: string; modifiedAfter?: string; ids?: string[] }): Promise<OcPage<OcOrder>> {
    return this.list<OcOrder>('orders', {
      page: opts.page, limit: opts.limit ?? ORDER_PAGE, created_after: opts.createdAfter, modified_after: opts.modifiedAfter, ids: opts.ids?.join(','),
    })
  }
}
