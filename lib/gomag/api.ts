import { Pacer, StoreApiError, parseJson, storeRequest, type RequestPolicy } from '@/lib/commerce/http'
import type { GomagCurrency, GomagOrder, GomagPage, GomagProduct, GomagStatus } from './types'

// =============================================
// Gomag — clientul API-ului public (numai citire), https://apidocs.gomag.ro
//
// - Adresa e mereu api.gomag.ro; magazinul se spune în antetul `ApiShop`
//   (adresa lui), cheia în `Apikey`. User-Agent-ul trebuie să fie al nostru
//   (Gomag refuză agentul Postman).
// - Limita: „leaky bucket" pe magazin, implicit o citire pe secundă; ritmul
//   real vine în antetele Api-RateLimit-Read*. Listele au cel mult 100 de rânduri.
// - Gomag răspunde la multe erori cu HTTP 200: un JSON cu `error`
//   ({"error":100,"message":"Missing Api User"}) sau un text („Nothing Here!")
//   când nu recunoaște magazinul sau cheia (văzut pe API-ul real, 14.11.2026).
//   Un `error` "200" înseamnă reușită (așa răspund scrierile).
// =============================================

export const GOMAG_API = 'https://api.gomag.ro/api/v1'
export const PAGE_SIZE = 100
const USER_AGENT = 'Hontrio/1.0 (+https://hontrio.com)'
const KEYS = { noResponse: 'sync.gomag_no_response', unavailable: 'sync.gomag_unavailable', rateLimited: 'sync.gomag_rate_limited' }

type Params = Record<string, string | number | undefined>

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Listele Gomag vin ca obiect cu id-ul drept cheie (sau ca listă). */
export function listOf<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') return Object.values(value as Record<string, T>)
  return []
}

/** O dată pentru filtrele Gomag: ziua (în UTC, deci cel mult câteva ore mai devreme decât ora României). */
export function gomagDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

const AUTH_MESSAGE = /api ?(user|key|shop)|apikey|apishop|unauthori|forbidden|not allowed|permission|drept/i

export class GomagApi {
  private pacer = new Pacer(1000)
  private deadline: number

  constructor(private shopUrl: string, private apiKey: string, private opts: { deadline?: number; retries?: number } = {}) {
    this.deadline = opts.deadline ?? Number.POSITIVE_INFINITY
  }

  private policy(): RequestPolicy {
    return {
      deadline: Number.isFinite(this.deadline) ? this.deadline : Date.now() + 120_000,
      pacer: this.pacer,
      retries: this.opts.retries ?? 2,
      keys: KEYS,
      defaultRetryAfterMs: 2000,
      timeoutMs: 30_000,
    }
  }

  /** Antetele de limită: ritmul (cereri pe secundă) și câte mai merg imediat. */
  private observeLimits(headers: Headers) {
    const rate = Number(headers.get('api-ratelimit-read'))
    if (rate > 0) this.pacer.setMinInterval(Math.ceil(1000 / rate))
    const remaining = headers.get('api-ratelimit-read-remaining')
    if (remaining !== null && Number(remaining) <= 0) this.pacer.pause(Math.ceil(1000 / (rate > 0 ? rate : 1)))
  }

  /** O citire. `listKey` = câmpul cu rezultatele (products, orders); fără el, răspunsul e o listă. */
  async get<T>(path: string, params: Params, listKey?: string): Promise<T> {
    const url = new URL(`${GOMAG_API}/${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const res = await storeRequest(url, {
      headers: { Apikey: this.apiKey, ApiShop: this.shopUrl, Accept: 'application/json', 'User-Agent': USER_AGENT },
    }, this.policy())
    this.observeLimits(res.headers)

    if (res.status === 401 || res.status === 403) throw new StoreApiError(`Gomag a refuzat cheia (${res.status} la ${path})`, 'unauthorized', res.status, 'sync.gomag_key_rejected')
    if (res.status === 404) throw new StoreApiError(`Gomag: ${path} nu există (404)`, 'not_found', 404, 'sync.gomag_bad_response', { status: 404 })
    if (res.status >= 400) throw new StoreApiError(`Gomag a răspuns ${res.status} la ${path}`, 'bad_response', res.status, 'sync.gomag_bad_response', { status: res.status })

    const body = parseJson<unknown>(res.text)
    if (body === null || typeof body !== 'object') {
      // „Nothing Here!": Gomag nu recunoaște magazinul (ApiShop) sau cheia
      if (/nothing here/i.test(res.text)) throw new StoreApiError(`Gomag nu recunoaște magazinul sau cheia (${path})`, 'unauthorized', res.status, 'sync.gomag_shop_or_key')
      throw new StoreApiError(`Gomag a trimis un răspuns care nu e JSON (${path})`, 'bad_response', res.status, 'sync.gomag_bad_response', { status: res.status })
    }
    if (!Array.isArray(body)) {
      const b = body as Record<string, unknown>
      const failed = 'error' in b && b.error !== null && b.error !== false && !['200', '0', ''].includes(String(b.error))
      if (failed && (!listKey || !(listKey in b))) {
        const message = typeof b.message === 'string' ? b.message : JSON.stringify(b.message ?? b.error)
        if (String(b.error) === '100' || AUTH_MESSAGE.test(message)) {
          throw new StoreApiError(`Gomag a refuzat cererea: ${message}`, 'unauthorized', res.status, 'sync.gomag_key_rejected')
        }
        throw new StoreApiError(`Gomag a răspuns cu eroarea ${String(b.error)}: ${message}`, 'bad_response', res.status, 'sync.gomag_error', { detail: message.slice(0, 200) })
      }
    }
    return body as T
  }

  private async page<T>(path: string, params: Params, listKey: string): Promise<GomagPage<T>> {
    const body = await this.get<Record<string, unknown>>(path, { ...params, limit: params.limit ?? PAGE_SIZE }, listKey)
    const items = listOf<T>(body[listKey])
    const page = num(body.page) || Number(params.page) || 1
    const pages = num(body.pages)
    return { items, total: num(body.total), page, pages }
  }

  /** Produsele (fiecare variantă e un produs, cu `parent` = produsul grupului). */
  products(opts: { page: number; updated?: string; id?: string; limit?: number }): Promise<GomagPage<GomagProduct>> {
    return this.page<GomagProduct>('product/read/json', { page: opts.page, updated: opts.updated, id: opts.id, limit: opts.limit }, 'products')
  }

  orders(opts: { page: number; startDate?: string; updated?: string; limit?: number }): Promise<GomagPage<GomagOrder>> {
    return this.page<GomagOrder>('order/read/json', { page: opts.page, startDate: opts.startDate, updated: opts.updated, limit: opts.limit }, 'orders')
  }

  async statuses(): Promise<GomagStatus[]> {
    return listOf<GomagStatus>(await this.get<unknown>('order/status/read/json', {}))
  }

  async currencies(): Promise<GomagCurrency[]> {
    return listOf<GomagCurrency>(await this.get<unknown>('currency/read/json', {}))
  }
}

/** Mai sunt pagini după aceasta. */
export function hasMore(p: GomagPage<unknown>): boolean {
  if (p.pages > 0) return p.page < p.pages
  return p.items.length >= PAGE_SIZE
}
