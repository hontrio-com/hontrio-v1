import type { JWT } from 'next-auth/jwt'
import { isLocale, SOURCE_LOCALE, type Locale } from '@/lib/i18n/config'
import { MESSAGES } from '@/lib/i18n/dictionaries'
import { createT } from '@/lib/i18n/translate'

// =============================================
// Ce poartă sesiunea (JWT-ul NextAuth) despre cont, într-un singur loc: la
// intrarea în cont, la întoarcerea administratorului și când administratorul
// intră în contul unui client. Fără dependențe de server (se testează direct).
// =============================================

/** Ce citim din users pentru sesiune. */
export const PROFILE_COLUMNS = 'id, email, name, role, onboarding_completed, ui_locale, session_version, email_verified_at, terms_accepted_at, terms_version'

export type Profile = {
  id: string; email: string; name: string | null; role: string | null; onboarding_completed: boolean | null
  ui_locale: string | null; session_version: number | null; email_verified_at: string | null; terms_accepted_at: string | null
  terms_version: string | null
}

/** Numele unui cont fără nume, în limba lui. */
export function defaultName(locale: unknown): string {
  const l: Locale = isLocale(locale) ? locale : SOURCE_LOCALE
  return createT(l, MESSAGES[l], l === SOURCE_LOCALE ? undefined : MESSAGES[SOURCE_LOCALE])('settings.default_user')
}

export function profileToken(profile: Profile, provider: string, nowMs: number): JWT {
  return {
    sub: profile.id,
    id: profile.id,
    email: profile.email,
    name: profile.name || defaultName(profile.ui_locale),
    role: profile.role === 'admin' ? 'admin' : 'user',
    onboardingCompleted: !!profile.onboarding_completed,
    termsAccepted: !!profile.terms_accepted_at,
    termsVersion: profile.terms_version ?? null,
    locale: profile.ui_locale ?? null,
    sv: profile.session_version ?? 0,
    provider,
    authAt: nowMs,
    refreshedAt: nowMs,
  }
}
