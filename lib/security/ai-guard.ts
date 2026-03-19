// AI request deduplication and cost guard
// Prevents paying multiple times for identical requests
// FIX: Job tracking cu Redis (fallback in-memory cu TTL strict)

import { createAdminClient } from '@/lib/supabase/admin'

const MAX_PROMPT_CHARS = 10000
const MAX_TITLE_CHARS = 500
const MAX_DESCRIPTION_CHARS = 50000

// ─── Redis job tracking (optional, falls back to in-memory) ──────────────────
let redisClient: any = null
async function getRedis() {
  if (redisClient) return redisClient
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null
    const { Redis } = await import('@upstash/redis')
    redisClient = new Redis({ url, token })
    return redisClient
  } catch { return null }
}

// ─── In-memory fallback with strict TTL ──────────────────────────────────────
const runningJobs = new Map<string, number>()

// Cleanup stale jobs every 60s — guarded to prevent multiple intervals on hot-reload
if (typeof setInterval !== 'undefined') {
  const g = global as any
  if (!g._aiGuardCleanupInit) {
    g._aiGuardCleanupInit = true
    setInterval(() => {
      const now = Date.now()
      for (const [key, startedAt] of runningJobs.entries()) {
        if (now - startedAt > 5 * 60 * 1000) runningJobs.delete(key)
      }
    }, 60 * 1000)
  }
}

export async function markJobRunningAsync(key: string): Promise<boolean> {
  const redis = await getRedis()
  if (redis) {
    // SET NX with 5-minute TTL — atomic, distributed
    const result = await redis.set(`hontrio:job:${key}`, Date.now(), { nx: true, ex: 300 })
    return result === 'OK'
  }
  // Fallback in-memory
  if (runningJobs.has(key)) return false
  runningJobs.set(key, Date.now())
  return true
}

export async function markJobDoneAsync(key: string): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    await redis.del(`hontrio:job:${key}`)
    return
  }
  runningJobs.delete(key)
}

// Sync wrappers (backward compat — for code that can't be async)
export function markJobRunning(key: string): boolean {
  if (runningJobs.has(key)) return false
  runningJobs.set(key, Date.now())
  return true
}

export function markJobDone(key: string): void {
  runningJobs.delete(key)
}

// Simple hash function for dedup keys
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function dedupKey(
  userId: string, operation: string, productId: string, inputHash: string,
): string {
  return `${userId}:${operation}:${productId}:${inputHash}`
}

export async function checkDedup(
  userId: string, operation: string, productId: string, inputData: string,
): Promise<{ cached: boolean; result?: any }> {
  const hash = simpleHash(inputData)

  if (operation === 'text_full') {
    const supabase = createAdminClient()
    const { data: product } = await supabase
      .from('products')
      .select('optimized_title, meta_description, optimized_short_description, optimized_long_description, benefits, seo_score, seo_suggestions, status')
      .eq('id', productId)
      .eq('user_id', userId)
      .single()

    if (product && product.status === 'optimized' && product.optimized_title) {
      return {
        cached: true,
        result: {
          optimized_title: product.optimized_title,
          meta_description: product.meta_description,
          optimized_short_description: product.optimized_short_description,
          optimized_long_description: product.optimized_long_description,
          benefits: product.benefits,
          seo_score: product.seo_score,
          seo_suggestions: product.seo_suggestions,
        }
      }
    }
  }

  return { cached: false }
}

export function validateAiInput(input: {
  title?: string
  description?: string
  prompt?: string
}): { valid: boolean; error?: string } {
  if (input.title && input.title.length > MAX_TITLE_CHARS) {
    return { valid: false, error: `Title exceeds ${MAX_TITLE_CHARS} characters` }
  }
  if (input.description && input.description.length > MAX_DESCRIPTION_CHARS) {
    return { valid: false, error: `Description exceeds ${MAX_DESCRIPTION_CHARS} characters` }
  }
  if (input.prompt && input.prompt.length > MAX_PROMPT_CHARS) {
    return { valid: false, error: `Input exceeds ${MAX_PROMPT_CHARS} characters` }
  }
  return { valid: true }
}

export async function countUserJobsAsync(userId: string): Promise<number> {
  const redis = await getRedis()
  if (redis) {
    const keys = await redis.keys(`hontrio:job:${userId}:*`)
    return keys?.length || 0
  }
  let count = 0
  for (const key of runningJobs.keys()) {
    if (key.startsWith(userId + ':')) count++
  }
  return count
}

export function countUserJobs(userId: string): number {
  let count = 0
  for (const key of runningJobs.keys()) {
    if (key.startsWith(userId + ':')) count++
  }
  return count
}

export const MAX_CONCURRENT_JOBS_PER_USER = 2
export const MAX_CONCURRENT_JOBS_GLOBAL = 10

export function canStartJob(userId: string): { allowed: boolean; reason?: string } {
  const userJobs = countUserJobs(userId)
  if (userJobs >= MAX_CONCURRENT_JOBS_PER_USER) {
    return { allowed: false, reason: `You already have ${userJobs} active operations. Wait for them to finish.` }
  }
  if (runningJobs.size >= MAX_CONCURRENT_JOBS_GLOBAL) {
    return { allowed: false, reason: 'The system is busy. Try again in a few seconds.' }
  }
  return { allowed: true }
}
