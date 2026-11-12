import { createHash, randomBytes } from 'node:crypto'

// =============================================
// Jetoanele din e-mailuri (confirmarea adresei, resetarea parolei): 256 de biți
// aleatori; în bază stă doar amprenta SHA-256, deci o scurgere a bazei nu dă
// linkuri valide.
// =============================================

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashToken(token) }
}

/** Forma unui jeton emis de newToken (64 de caractere hex). */
export function isTokenShape(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
