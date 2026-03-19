// ─── Rate Limiter — Upstash Redis (distributed, survives deploys) ────────────
// Falls back to in-memory if Redis env vars are missing (dev mode)

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─── Redis client (singleton) ────────────────────────────────────────────────
let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// ─── In-memory fallback (dev only) ───────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number }
const memStore = new Map<string, RateLimitEntry>()

// Cleanup every 60s — guarded to prevent multiple intervals on hot-reload
if (typeof setInterval !== 'undefined') {
  const g = global as any
  if (!g._rateLimitCleanupInit) {
    g._rateLimitCleanupInit = true
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of memStore.entries()) {
        if (now > entry.resetAt) memStore.delete(key)
      }
    }, 60000)
  }
}

function memoryRateLimit(
  key: string, limit: number, windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  entry.count++
  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ─── Main rate limit function ────────────────────────────────────────────────
export async function rateLimitAsync(
  key: string, limit: number, windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const r = getRedis()
  if (!r) return memoryRateLimit(key, limit, windowMs)

  const windowSec = Math.ceil(windowMs / 1000)
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: 'hontrio:rl',
  })

  const result = await limiter.limit(key)
  return {
    success: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  }
}

// ─── Sync wrapper (backwards compatible) ─────────────────────────────────────
// For places that can't easily be made async, uses memory fallback
export function rateLimit(
  key: string, limit: number, windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  return memoryRateLimit(key, limit, windowMs)
}

// ─── Pre-configured limiters (async — use these in route handlers) ───────────
export async function rateLimitLogin(identifier: string) {
  return rateLimitAsync(`login:${identifier}`, 5, 10 * 60 * 1000) // 5 per 10 min
}

export async function rateLimitRegister(ip: string) {
  return rateLimitAsync(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per hour
}

export async function rateLimitApi(userId: string, endpoint: string) {
  return rateLimitAsync(`api:${userId}:${endpoint}`, 60, 60 * 1000) // 60 per min
}

export async function rateLimitExpensive(userId: string, endpoint: string) {
  return rateLimitAsync(`expensive:${userId}:${endpoint}`, 10, 60 * 1000) // 10 per min
}

export async function rateLimitSync(userId: string) {
  return rateLimitAsync(`sync:${userId}`, 2, 10 * 60 * 1000) // 2 per 10 min
}

// Agent chat — per IP and per visitor
export async function rateLimitAgentChat(ip: string) {
  return rateLimitAsync(`agent:ip:${ip}`, 30, 60 * 1000) // 30 msg/min/IP
}

export async function rateLimitAgentVisitor(visitorId: string) {
  return rateLimitAsync(`agent:visitor:${visitorId}`, 100, 24 * 60 * 60 * 1000) // 100/day/visitor
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}
