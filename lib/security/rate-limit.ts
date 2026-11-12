// =============================================
// Limitele de cereri. Pe Vercel fiecare instanță are memoria ei, deci limitele
// care apără ceva (autentificare, înscriere, conectări, încărcări) trec prin
// Upstash Redis: rateLimitAsync. Fără UPSTASH_REDIS_REST_URL / _TOKEN (pe
// calculatorul de dezvoltare) se ține minte în memorie, ca până acum.
// =============================================

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = { success: boolean; remaining: number; resetAt: number }

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// ─── În memorie (dezvoltare) ─────────────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number }
const memStore = new Map<string, RateLimitEntry>()

// Curățenia la 60 s; o singură dată, și la reîncărcarea modulului în dezvoltare
if (typeof setInterval !== 'undefined') {
  const g = globalThis as { _rateLimitCleanupInit?: boolean }
  if (!g._rateLimitCleanupInit) {
    g._rateLimitCleanupInit = true
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of memStore.entries()) if (now > entry.resetAt) memStore.delete(key)
    }, 60000)
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  entry.count++
  if (entry.count > limit) return { success: false, remaining: 0, resetAt: entry.resetAt }
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

const limiters = new Map<string, Ratelimit>()

/** Limita comună tuturor instanțelor (Redis). Dacă Redis nu răspunde, cererea trece: o pană nu blochează pe toată lumea. */
export async function rateLimitAsync(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const r = getRedis()
  if (!r) return memoryRateLimit(key, limit, windowMs)

  const windowSec = Math.ceil(windowMs / 1000)
  const id = `${limit}:${windowSec}`
  let limiter = limiters.get(id)
  if (!limiter) {
    limiter = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`), prefix: 'hontrio:rl' })
    limiters.set(id, limiter)
  }
  try {
    const result = await limiter.limit(key)
    return { success: result.success, remaining: result.remaining, resetAt: result.reset }
  } catch (err) {
    console.error('[rate-limit] Redis indisponibil, limita locală', (err as Error).message)
    return memoryRateLimit(key, limit, windowMs)
  }
}

/** Toate limitele trebuie să treacă; se verifică toate (fiecare încercare se numără peste tot). */
export async function rateLimitAll(checks: [key: string, limit: number, windowMs: number][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([key, limit, windowMs]) => rateLimitAsync(key, limit, windowMs)))
  return results.every(r => r.success)
}

/**
 * Doar în memoria instanței: pe Vercel nu apără nimic serios.
 * @deprecated Folosește rateLimitAsync.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return memoryRateLimit(key, limit, windowMs)
}

// ─── Limitele folosite des ───────────────────────────────────────────────────
export async function rateLimitApi(userId: string, endpoint: string) {
  return rateLimitAsync(`api:${userId}:${endpoint}`, 60, 60 * 1000) // 60 pe minut
}

export async function rateLimitExpensive(userId: string, endpoint: string) {
  return rateLimitAsync(`expensive:${userId}:${endpoint}`, 10, 60 * 1000) // 10 pe minut
}

export async function rateLimitSync(userId: string) {
  return rateLimitAsync(`sync:${userId}`, 2, 10 * 60 * 1000) // 2 la 10 minute
}

// ─── Adresa IP a omului ──────────────────────────────────────────────────────
// Pe Vercel, x-forwarded-for e scris de platformă (nu se poate falsifica din afară).

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined

function header(headers: HeaderBag, name: string): string | null {
  if (!headers) return null
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name)
  const v = (headers as Record<string, string | string[] | undefined>)[name]
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

/** IP-ul clientului din antete (Headers sau obiectul de antete al NextAuth). */
export function clientIp(headers: HeaderBag): string {
  const forwarded = header(headers, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return header(headers, 'x-real-ip')?.trim() || 'unknown'
}

export function getClientIp(request: Request): string {
  return clientIp(request.headers)
}
