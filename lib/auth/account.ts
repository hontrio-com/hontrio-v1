import { createAdminClient } from '@/lib/supabase/admin'
import { buildVerifyEmail, sendEmail } from '@/lib/email'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { logError } from '@/lib/logger'
import { newToken } from './tokens'

// =============================================
// Contul: versiunea sesiunii și confirmarea adresei de e-mail.
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

const APP_URL = process.env.NEXTAUTH_URL || 'https://app.hontrio.com'
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Retrage toate sesiunile contului: crește users.session_version, iar un JWT
 * cu versiunea veche nu mai e valabil (verificat la cel mult un minut).
 * Întoarce versiunea nouă (null dacă n-a mers).
 */
export async function bumpSessionVersion(supabase: Supabase, userId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('bump_session_version', { p_user_id: userId })
  if (error) {
    logError('auth/session', 'Versiunea sesiunii n-a putut fi crescută', { userId, error: error.message })
    return null
  }
  return typeof data === 'number' ? data : Number(data) || null
}

/** Limba e-mailurilor unui cont: cea aleasă în cont, altfel limba cererii. */
export function accountLocale(stored: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(stored) ? stored : fallback
}

/**
 * Un link nou de confirmare (cel vechi nu mai merge) și e-mailul cu el. Linkul
 * duce la /api/auth/verify-email, care mută jetonul într-un cookie: pagina
 * unde omul își scrie parola nu are jetonul în adresă.
 */
export async function sendEmailVerification(supabase: Supabase, userId: string, email: string, locale: Locale): Promise<boolean> {
  const { token, hash } = newToken()
  const { error } = await supabase.from('users').update({
    email_verify_token_hash: hash,
    email_verify_expires_at: new Date(Date.now() + VERIFY_TTL_MS).toISOString(),
  }).eq('id', userId)
  if (error) {
    logError('auth/verify', 'Jetonul de confirmare n-a putut fi salvat', { userId, error: error.message })
    return false
  }
  return sendEmail({ to: email, ...buildVerifyEmail(`${APP_URL}/api/auth/verify-email?token=${token}`, locale) })
}
