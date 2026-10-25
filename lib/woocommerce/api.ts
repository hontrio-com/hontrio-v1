import { storedMessage } from '@/lib/i18n/stored'
import type { Params as MessageParams } from '@/lib/i18n/translate'
import type { GlaConnection, WooOrder, WooProduct, WooSetting, WooSiteInfo, WooSystemStatus, WooVariation } from './types'

// =============================================
// WooCommerce — clientul API-ului REST pentru modelul de reclame (numai
// citire). Cheia comerciantului merge în antetul Basic, niciodată în adresă:
// adresele ajung în jurnalele serverelor.
// =============================================

export type WooErrorCode = 'unauthorized' | 'blocked' | 'not_found' | 'unavailable' | 'network' | 'bad_response'

export class WooError extends Error {
  /** Ce vede omul (în stores.last_error): cheia de traducere, cu parametri. `message` e pentru jurnal. */
  readonly stored: string
  constructor(message: string, public code: WooErrorCode, public status: number | undefined, key: string, params?: MessageParams) {
    super(message)
    this.stored = storedMessage(key, params)
  }
}

export type WooPage<T> = { items: T[]; total: number; totalPages: number }

const TIMEOUT_MS = 30_000
const RETRIES = 2
export const PAGE_SIZE = 100

type Params = Record<string, string | number | undefined>

/** Datele trimise WooCommerce-ului: ISO în UTC, fără milisecunde (cu dates_are_gmt). */
export function wooDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19)
}

export class WooApi {
  private base: string
  private auth: string

  constructor(storeUrl: string, consumerKey: string, consumerSecret: string) {
    this.base = storeUrl.replace(/\/+$/, '')
    this.auth = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  }

  private async request<T>(path: string, params: Params = {}, auth = true): Promise<{ data: T; total: number; totalPages: number }> {
    const url = new URL(`${this.base}/wp-json/${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))

    let last: WooError | null = null
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt) await new Promise(r => setTimeout(r, 1500 * attempt))
      let res: Response
      try {
        res = await fetch(url, {
          headers: { ...(auth ? { Authorization: this.auth } : {}), Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        })
      } catch (err) {
        const code = String((err as { cause?: { code?: string } }).cause?.code ?? '')
        last = new WooError(`Magazinul nu a răspuns (${path}): ${code || (err as Error).message}`, 'network', undefined, 'sync.woo_no_response')
        // Domeniul nu mai există: reîncercarea n-ar schimba nimic acum
        if (code === 'ENOTFOUND') break
        continue
      }

      if (res.status === 429 || res.status >= 500) {
        last = new WooError(`Magazinul e indisponibil (${res.status} la ${path})`, 'unavailable', res.status, 'sync.woo_unavailable', { status: res.status })
        continue
      }
      const body = await res.json().catch(() => null) as { code?: string } | null
      if (res.status === 401) throw new WooError('WooCommerce a refuzat cheia API', 'unauthorized', 401, 'sync.woo_key_rejected')
      if (res.status === 403) {
        // Un refuz al WooCommerce înseamnă cheie fără drepturi; altul (firewall, Cloudflare) e o blocare
        if (body?.code?.startsWith('woocommerce_rest_')) throw new WooError('Cheia API nu are drept de citire', 'unauthorized', 403, 'sync.woo_key_no_read')
        throw new WooError(`Magazinul a blocat cererea (403 la ${path})`, 'blocked', 403, 'sync.woo_blocked')
      }
      if (res.status === 404) throw new WooError(`WooCommerce: ${path} nu există (404)`, 'not_found', 404, 'sync.woo_not_found', { path })
      if (!res.ok || body === null) throw new WooError(`WooCommerce a răspuns ${res.status} la ${path}`, 'bad_response', res.status, 'sync.woo_bad_response', { status: res.status })

      return {
        data: body as T,
        total: Number(res.headers.get('x-wp-total')) || 0,
        totalPages: Number(res.headers.get('x-wp-totalpages')) || 0,
      }
    }
    throw last ?? new WooError(`WooCommerce: ${path} a eșuat`, 'unavailable', undefined, 'sync.woo_no_response')
  }

  private async page<T>(path: string, params: Params): Promise<WooPage<T>> {
    const r = await this.request<T[]>(path, params)
    return { items: Array.isArray(r.data) ? r.data : [], total: r.total, totalPages: r.totalPages }
  }

  /** Numele și fusul orar ale site-ului (indexul REST, public). */
  async siteInfo(): Promise<WooSiteInfo> {
    return (await this.request<WooSiteInfo>('', { _fields: 'name,timezone_string' }, false)).data
  }

  /** Versiunile și pluginurile active. Lent pe unele gazde: se cere o dată pe trecerea completă. */
  async systemStatus(): Promise<WooSystemStatus> {
    return (await this.request<WooSystemStatus>('wc/v3/system_status', { _fields: 'environment,active_plugins' })).data
  }

  async settings(group: 'general' | 'tax'): Promise<WooSetting[]> {
    return (await this.request<WooSetting[]>(`wc/v3/settings/${group}`, { _fields: 'id,value' })).data
  }

  /**
   * Câte cote de TVA are magazinul. Cu taxele „pornite" dar fără nicio cotă,
   * la plată nu se adaugă nimic: prețul din catalog e cel final. Null = n-am putut afla.
   */
  async taxRateCount(): Promise<number | null> {
    try {
      return (await this.request<unknown[]>('wc/v3/taxes', { per_page: 1, _fields: 'id' })).total
    } catch {
      return null
    }
  }

  /** Produsele publicate, în ordinea id-ului: paginile nu se amestecă dacă apar produse noi. */
  products(opts: { page: number; modifiedAfter?: string; include?: number[] }): Promise<WooPage<WooProduct>> {
    return this.page<WooProduct>('wc/v3/products', {
      page: opts.page, per_page: PAGE_SIZE, orderby: 'id', order: 'asc', status: 'publish',
      modified_after: opts.modifiedAfter ? wooDate(opts.modifiedAfter) : undefined,
      dates_are_gmt: opts.modifiedAfter ? 'true' : undefined,
      include: opts.include?.join(','),
    })
  }

  /** Toate variațiile unui produs. */
  async variations(productId: number): Promise<WooVariation[]> {
    const all: WooVariation[] = []
    for (let page = 1; ; page++) {
      const r = await this.page<WooVariation>(`wc/v3/products/${productId}/variations`, { page, per_page: PAGE_SIZE, orderby: 'id', order: 'asc' })
      all.push(...r.items)
      if (page >= r.totalPages || r.items.length < PAGE_SIZE) return all
    }
  }

  /** Id-urile produselor publicate, cu cât trebuie ca să știm dacă ajung în reclame. */
  productIds(page: number): Promise<WooPage<Pick<WooProduct, 'id' | 'type' | 'catalog_visibility'>>> {
    return this.page('wc/v3/products', { page, per_page: PAGE_SIZE, orderby: 'id', order: 'asc', status: 'publish', _fields: 'id,type,catalog_visibility' })
  }

  orders(opts: { page: number; createdAfter?: string; modifiedAfter?: string }): Promise<WooPage<WooOrder>> {
    return this.page<WooOrder>('wc/v3/orders', {
      page: opts.page, per_page: PAGE_SIZE, orderby: 'id', order: 'asc',
      after: opts.createdAfter ? wooDate(opts.createdAfter) : undefined,
      modified_after: opts.modifiedAfter ? wooDate(opts.modifiedAfter) : undefined,
      dates_are_gmt: opts.createdAfter || opts.modifiedAfter ? 'true' : undefined,
    })
  }

  orderIds(opts: { page: number; createdAfter: string }): Promise<WooPage<Pick<WooOrder, 'id'>>> {
    return this.page('wc/v3/orders', {
      page: opts.page, per_page: PAGE_SIZE, orderby: 'id', order: 'asc',
      after: wooDate(opts.createdAfter), dates_are_gmt: 'true', _fields: 'id',
    })
  }

  /**
   * Legătura Google for WooCommerce cu Merchant Center (`mc`) sau Google Ads (`ads`),
   * citită cu aceeași cheie. Null dacă pluginul nu răspunde: atunci nu știm.
   */
  async glaConnection(kind: 'mc' | 'ads'): Promise<GlaConnection | null> {
    try {
      const { data } = await this.request<{ id?: number | string; status?: string }>(`wc/gla/${kind}/connection`)
      const id = data?.id ? String(data.id) : null
      return { connected: data?.status === 'connected' && !!id && id !== '0', account_id: id && id !== '0' ? id : null }
    } catch {
      return null
    }
  }
}
