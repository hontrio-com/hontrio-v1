// =============================================
// Ce se verifică la înscriere și la schimbarea datelor de cont, la fel pe
// server și în pagini. Fiecare eroare e o cheie de traducere (secțiunea `auth`).
// =============================================

export const NAME_MIN = 2
export const NAME_MAX = 60
export const PASSWORD_MIN = 8
// bcrypt (Supabase Auth) folosește doar primii 72 de octeți
export const PASSWORD_MAX = 72
export const EMAIL_MAX = 254

/** Versiunea Termenilor, a Politicii de confidențialitate și a DPA-ului acceptate la înscriere (sau pe /accept-terms, după Google). */
export const TERMS_VERSION = '2026-11-16'

/**
 * Numele: 2–60 de litere (cu spații, cratimă, apostrof, punct), fără cifre,
 * adrese web sau e-mail. Înscrierea e publică: numele nu e loc de reclame.
 */
export function checkName(value: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: 'auth.name_required' }
  const name = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!name) return { ok: false, error: 'auth.name_required' }
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, error: 'auth.name_length' }
  if (!/^\p{L}[\p{L}\p{M} '’.-]*$/u.test(name) || /\.\p{L}{2,}/u.test(name)) return { ok: false, error: 'auth.name_invalid' }
  return { ok: true, name }
}

/** Parola nouă: 8–72 de caractere. */
export function checkPassword(value: unknown): { ok: true; password: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value) return { ok: false, error: 'auth.password_required' }
  if (value.length < PASSWORD_MIN) return { ok: false, error: 'auth.password_min_error' }
  if (new TextEncoder().encode(value).length > PASSWORD_MAX) return { ok: false, error: 'auth.password_too_long' }
  return { ok: true, password: value }
}

/** Adresa de e-mail, cu litere mici. */
export function checkEmail(value: unknown): { ok: true; email: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, error: 'auth.email_required' }
  const email = value.trim().toLowerCase()
  if (email.length > EMAIL_MAX || !/^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/.test(email)) return { ok: false, error: 'auth.email_invalid' }
  return { ok: true, email }
}
