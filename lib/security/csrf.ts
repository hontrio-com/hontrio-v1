// CSRF protection via Origin/Referer header validation
// Applied to all POST/PUT/DELETE/PATCH requests

// CSRF protection is handled by:
// 1. HttpOnly cookies with SameSite=Lax/Strict (prevents cross-site cookie submission)
// 2. JWT Bearer tokens in Authorization header (not automatically sent cross-site)
// This module is kept for reference or future stateful session use.

const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL || 'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
].filter(Boolean)

export function validateCsrf(request: Request): boolean {
  const method = request.method.toUpperCase()

  // Only check mutative methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true

  // Skip for API routes that need external access (webhooks)
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/stripe/webhook')) return true
  if (url.pathname.startsWith('/api/auth')) return true

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Check origin first
  if (origin) {
    return ALLOWED_ORIGINS.some(allowed => {
      try {
        return new URL(allowed).origin === origin
      } catch { return false }
    })
  }

  // Fallback to referer
  if (referer) {
    return ALLOWED_ORIGINS.some(allowed => {
      try {
        return referer.startsWith(new URL(allowed).origin)
      } catch { return false }
    })
  }

  // No origin or referer — could be same-origin (some browsers don't send)
  // Be permissive in development, strict in production
  return process.env.NODE_ENV !== 'production'
}