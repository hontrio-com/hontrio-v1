// AI request deduplication and cost guard
// Prevents paying multiple times for identical requests

import { createAdminClient } from '@/lib/supabase/admin'

const MAX_PROMPT_CHARS = 10000 // Max chars in a single prompt input
const MAX_TITLE_CHARS = 500
const MAX_DESCRIPTION_CHARS = 50000

// Simple hash function for dedup keys
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Generate dedup key from operation context
export function dedupKey(
  userId: string,
  operation: string,
  productId: string,
  inputHash: string,
): string {
  return `${userId}:${operation}:${productId}:${inputHash}`
}

// Check if we already have a cached result for this exact request
export async function checkDedup(
  userId: string,
  operation: string,
  productId: string,
  inputData: string,
): Promise<{ cached: boolean; result?: any }> {
  const hash = simpleHash(inputData)
  const key = dedupKey(userId, operation, productId, hash)

  const supabase = createAdminClient()

  // Check if product already has optimized content matching this input
  if (operation === 'text_full') {
    const { data: product } = await supabase
      .from('products')
      .select('optimized_title, meta_description, optimized_short_description, optimized_long_description, benefits, seo_score, seo_suggestions, status')
      .eq('id', productId)
      .eq('user_id', userId)
      .single()

    // If already optimized, return cached result
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

// In-memory tracking of running jobs to prevent duplicate concurrent requests
const runningJobs = new Map<string, number>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, startedAt] of runningJobs.entries()) {
    if (now - startedAt > 5 * 60 * 1000) runningJobs.delete(key)
  }
}, 5 * 60 * 1000)

export function markJobRunning(key: string): boolean {
  if (runningJobs.has(key)) return false // Already running
  runningJobs.set(key, Date.now())
  return true
}

export function markJobDone(key: string): void {
  runningJobs.delete(key)
}

// Cost guard — validate input sizes before calling AI
export function validateAiInput(input: {
  title?: string
  description?: string
  prompt?: string
}): { valid: boolean; error?: string } {
  if (input.title && input.title.length > MAX_TITLE_CHARS) {
    return { valid: false, error: `Titlul depășește ${MAX_TITLE_CHARS} caractere` }
  }
  if (input.description && input.description.length > MAX_DESCRIPTION_CHARS) {
    return { valid: false, error: `Descrierea depășește ${MAX_DESCRIPTION_CHARS} caractere` }
  }
  if (input.prompt && input.prompt.length > MAX_PROMPT_CHARS) {
    return { valid: false, error: `Input-ul depășește ${MAX_PROMPT_CHARS} caractere` }
  }
  return { valid: true }
}

// Count active jobs for a user
export function countUserJobs(userId: string): number {
  let count = 0
  for (const key of runningJobs.keys()) {
    if (key.startsWith(userId + ':')) count++
  }
  return count
}

// Max concurrent AI jobs per user
export const MAX_CONCURRENT_JOBS_PER_USER = 2
export const MAX_CONCURRENT_JOBS_GLOBAL = 10

export function canStartJob(userId: string): { allowed: boolean; reason?: string } {
  const userJobs = countUserJobs(userId)
  if (userJobs >= MAX_CONCURRENT_JOBS_PER_USER) {
    return { allowed: false, reason: `Ai deja ${userJobs} operații active. Așteaptă să se finalizeze.` }
  }

  if (runningJobs.size >= MAX_CONCURRENT_JOBS_GLOBAL) {
    return { allowed: false, reason: 'Sistemul este ocupat. Încearcă din nou în câteva secunde.' }
  }

  return { allowed: true }
}