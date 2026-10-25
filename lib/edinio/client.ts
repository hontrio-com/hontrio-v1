import { EdinioError, getEdinioConfig } from './config'
import type { EdinioOrder, EdinioPage, EdinioProduct, EdinioStore } from './types'

// =============================================
// Edinio — clientul API-ului de citire (/api/hontrio/v1/*)
// =============================================

type PageParams = { after?: string | null; updatedSince?: string | null; limit?: number }

export class EdinioClient {
  private baseUrl: string

  constructor(private token: string, baseUrl?: string) {
    this.baseUrl = baseUrl || getEdinioConfig().baseUrl
  }

  private async get<T>(path: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/hontrio/v1/${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, String(v))

    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
      })
    } catch (err) {
      throw new EdinioError(`Edinio nu a răspuns (${path}): ${(err as Error).message}`, 'network')
    }

    // ⚠ Doar 401 înseamnă „legătura e moartă". 503 e o pană trecătoare
    // (sau legătura oprită temporar din Edinio): se reîncearcă, nu se deconectează.
    if (res.status === 401) throw new EdinioError('Jetonul Edinio a fost revocat', 'unauthorized', 401)
    if (res.status === 429) throw new EdinioError('Edinio: prea multe cereri', 'rate_limited', 429)
    if (res.status >= 500) throw new EdinioError(`Edinio indisponibil (${res.status})`, 'unavailable', res.status)

    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      throw new EdinioError(`Edinio a răspuns ${res.status} la ${path}: ${data?.eroare || 'fără corp'}`, 'bad_response', res.status)
    }
    return data as T
  }

  getStore(): Promise<EdinioStore> {
    return this.get<EdinioStore>('magazin')
  }

  getProducts({ after, updatedSince, limit = 100 }: PageParams = {}) {
    return this.get<EdinioPage<'produse', EdinioProduct>>('produse', { dupa: after, actualizate_dupa: updatedSince, limita: limit })
  }

  getOrders({ after, updatedSince, limit = 200 }: PageParams = {}) {
    return this.get<EdinioPage<'comenzi', EdinioOrder>>('comenzi', { dupa: after, actualizate_dupa: updatedSince, limita: limit })
  }

  /** Revocă jetonul la Edinio (best effort: la deconectare, ștergem oricum legătura). */
  async revoke(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/hontrio/v1/revocare`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(10000),
      })
    } catch {}
  }
}
