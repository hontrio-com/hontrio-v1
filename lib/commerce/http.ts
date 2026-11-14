import { storedMessage } from '@/lib/i18n/stored'
import type { Params as MessageParams } from '@/lib/i18n/translate'
import { fetchPublic, PublicFetchError } from '@/lib/security/validate-url'

// =============================================
// Cererile spre API-urile magazinelor (Gomag, MerchantPro, extensia OpenCart),
// la fel pentru toate: numai adrese publice (fetchPublic), cel mult `deadline`
// pentru tot magazinul, reîncercări la erorile trecătoare (5xx, rețea, 429 cu
// Retry-After), ritm ținut de un `Pacer`. Interpretarea răspunsului e a
// fiecărei platforme: aici se întoarce doar starea, antetele și textul.
// =============================================

export type StoreApiErrorCode =
  | 'unauthorized' | 'forbidden' | 'blocked' | 'not_found' | 'unavailable' | 'rate_limited' | 'network' | 'bad_response' | 'deadline'

/**
 * O eroare a magazinului. `key` + `params` sunt mesajul pentru om (cheie de traducere),
 * `stored` e același mesaj gata de salvat în bază, `message` e pentru jurnal.
 */
export class StoreApiError extends Error {
  readonly stored: string
  constructor(message: string, public code: StoreApiErrorCode, public status: number | undefined, public key: string, public params?: MessageParams) {
    super(message)
    this.stored = storedMessage(key, params)
  }
}

export const deadlineError = (what: string) =>
  new StoreApiError(`Timpul magazinului s-a terminat (${what})`, 'deadline', undefined, 'sync.deadline_reached')

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Sub atât timp rămas, o cerere nouă nu mai pornește (trecerea continuă la rularea următoare)
export const MIN_LEFT_MS = 5_000

/**
 * Ritmul cererilor spre o platformă: cel puțin `minIntervalMs` între două cereri,
 * plus pauzele cerute de platformă (antetele de limită, Retry-After).
 */
export class Pacer {
  /** Când a plecat ultima cerere (0 = niciuna încă). */
  private last = 0
  /** Până când a cerut platforma o pauză. */
  private pausedUntil = 0
  constructor(private minIntervalMs: number) {}

  /** Așteaptă rândul cererii următoare. Dacă rândul ar veni după termen, se oprește aici. */
  async wait(deadline: number, what: string): Promise<void> {
    const now = Date.now()
    const at = Math.max(now, this.last + this.minIntervalMs, this.pausedUntil)
    if (at + MIN_LEFT_MS > deadline) throw deadlineError(what)
    if (at > now) await sleep(at - now)
    this.last = Date.now()
  }

  /** Nicio cerere în următoarele `ms` milisecunde. */
  pause(ms: number): void {
    if (ms > 0) this.pausedUntil = Math.max(this.pausedUntil, Date.now() + ms)
  }

  /** Ritmul spus de platformă (ex. „1 cerere pe secundă" din antetele de limită); se aplică de la cererea următoare. */
  setMinInterval(ms: number): void {
    if (Number.isFinite(ms) && ms > 0) this.minIntervalMs = ms
  }
}

export type StoreResponse = { status: number; headers: Headers; text: string }

export type RequestPolicy = {
  /** Când trebuie să se termine tot ce face magazinul în rularea asta. */
  deadline: number
  pacer?: Pacer
  timeoutMs?: number
  /** Reîncercări după o eroare trecătoare (la conectare: 0, omul așteaptă răspunsul). */
  retries?: number
  /** Cheile mesajelor pentru om, pe platformă. */
  keys: { noResponse: string; unavailable: string; rateLimited: string }
  /** Pauza după un 429 fără Retry-After. */
  defaultRetryAfterMs?: number
}

/** Retry-After în secunde (sau dată HTTP) → milisecunde; null dacă lipsește. */
export function retryAfterMs(value: string | null): number | null {
  if (!value) return null
  const s = Number(value)
  if (Number.isFinite(s)) return Math.max(0, s * 1000)
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now())
}

export async function storeRequest(url: URL, init: RequestInit, policy: RequestPolicy): Promise<StoreResponse> {
  const retries = policy.retries ?? 2
  const what = url.pathname
  let last: StoreApiError | null = null
  let waitMs = 0

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) {
      const pause = Math.max(waitMs, 1500 * attempt)
      // O pauză care trece de termen: eroarea rămâne (o limită lungă se reia la rularea următoare)
      if (Date.now() + pause + MIN_LEFT_MS > policy.deadline) break
      await sleep(pause)
    }
    waitMs = 0
    const left = policy.deadline - Date.now()
    if (left < MIN_LEFT_MS) {
      if (last) throw last
      throw deadlineError(what)
    }
    if (policy.pacer) await policy.pacer.wait(policy.deadline, what)

    let res: Response
    try {
      res = await fetchPublic(url, {
        ...init,
        signal: AbortSignal.timeout(Math.min(policy.timeoutMs ?? 30_000, Math.max(1000, policy.deadline - Date.now()))),
        cache: 'no-store',
      })
    } catch (err) {
      // Adresă privată sau redirecționare spre alt site: reîncercarea n-ar schimba nimic
      if (err instanceof PublicFetchError) {
        throw new StoreApiError(err.message, err.code === 'redirect' ? 'bad_response' : 'blocked', undefined, err.key, err.params)
      }
      const code = String((err as { cause?: { code?: string } }).cause?.code ?? (err as { name?: string }).name ?? '')
      last = new StoreApiError(`Magazinul nu a răspuns (${what}): ${code || (err as Error).message}`, 'network', undefined, policy.keys.noResponse)
      // Domeniul nu mai există: reîncercarea n-ar schimba nimic acum
      if (code === 'ENOTFOUND') break
      continue
    }

    let text: string
    try {
      text = await res.text()
    } catch (err) {
      last = new StoreApiError(`Răspuns întrerupt (${what}): ${(err as Error).message}`, 'network', res.status, policy.keys.noResponse)
      continue
    }

    if (res.status === 429) {
      const after = retryAfterMs(res.headers.get('retry-after')) ?? policy.defaultRetryAfterMs ?? 5_000
      policy.pacer?.pause(after)
      waitMs = after
      last = new StoreApiError(`Prea multe cereri (429 la ${what}), reîncercare peste ${Math.round(after / 1000)} s`, 'rate_limited', 429, policy.keys.rateLimited)
      continue
    }
    if (res.status >= 500) {
      last = new StoreApiError(`Magazinul e indisponibil (${res.status} la ${what})`, 'unavailable', res.status, policy.keys.unavailable, { status: res.status })
      continue
    }
    return { status: res.status, headers: res.headers, text }
  }
  throw last ?? new StoreApiError(`${what} a eșuat`, 'unavailable', undefined, policy.keys.noResponse)
}

/** JSON-ul răspunsului sau null (text gol, HTML, avertismente PHP...). */
export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
