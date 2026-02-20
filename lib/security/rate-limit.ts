// Simple in-memory rate limiter
// For production with multiple instances, switch to @upstash/ratelimit with Redis

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 60000) // Every minute

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  entry.count++

  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// Pre-configured limiters
export function rateLimitLogin(ip: string) {
  return rateLimit(`login:${ip}`, 10, 10 * 60 * 1000) // 10 attempts per 10 min
}

export function rateLimitRegister(ip: string) {
  return rateLimit(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per hour
}

export function rateLimitApi(userId: string, endpoint: string) {
  return rateLimit(`api:${userId}:${endpoint}`, 60, 60 * 1000) // 60 per min
}

export function rateLimitExpensive(userId: string, endpoint: string) {
  return rateLimit(`expensive:${userId}:${endpoint}`, 10, 60 * 1000) // 10 per min
}

export function rateLimitSync(userId: string) {
  return rateLimit(`sync:${userId}`, 2, 10 * 60 * 1000) // 2 per 10 min
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}