import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compară două secrete în timp constant: nici lungimea, nici primul caracter
 * diferit nu se văd din cât durează răspunsul. Se compară amprentele SHA-256,
 * care au mereu aceeași lungime.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/** Antetul `Authorization: Bearer <secret>`, verificat în timp constant. Fără secret configurat: refuzat. */
export function bearerMatches(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret) return false
  return safeEqual(header ?? '', `Bearer ${secret}`)
}
