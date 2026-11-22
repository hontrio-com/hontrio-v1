import type { JWT } from 'next-auth/jwt'
import type { TFunction } from '@/lib/i18n/translate'
import { profileToken, type Profile } from './session-token'

// =============================================
// Regulile conectării administratorului în contul unui client („Conectare”),
// fără dependențe de server (le folosește și proxy.ts): cât ține, în ce conturi
// se poate intra, sesiunea de atunci și ce cereri rămân ale clientului.
// Cookie-ul, în lib/auth/impersonation.ts.
//
// Acordul clientului: în contul lui, administratorul vede tot ce vede el,
// inclusiv datele din Google Ads. Politica de confidențialitate o permite doar
// cu acordul clientului, dat o dată prin Termenii care o spun (art. 10.5,
// versiunea SUPPORT_ACCESS_TERMS_VERSION): la înscriere sau din anunțul din
// aplicație, pentru conturile vechi. Hotărât de om pe 22.11.2026.
// =============================================

export const IMPERSONATION_MS = 60 * 60 * 1000

/** Versiunea Termenilor (lib/auth/validation.ts, TERMS_VERSION) care cuprinde accesul echipei pentru suport. */
export const SUPPORT_ACCESS_TERMS_VERSION = '2026-11-22'

export type ImpersonationRefusal = 'not_found' | 'self' | 'admin' | 'unverified' | 'terms'

/** Contul a acceptat Termenii care permit accesul echipei Hontrio pentru suport. */
export function allowsSupportAccess(termsVersion: string | null | undefined): boolean {
  return !!termsVersion && termsVersion >= SUPPORT_ACCESS_TERMS_VERSION
}

/** De ce nu poate administratorul intra în cont (null = poate). */
export function impersonationRefusal(adminId: string, target: Pick<Profile, 'id' | 'role' | 'email_verified_at' | 'terms_accepted_at' | 'terms_version'> | null): ImpersonationRefusal | null {
  if (!target) return 'not_found'
  if (target.id === adminId) return 'self'
  if (target.role === 'admin') return 'admin'
  if (!target.email_verified_at) return 'unverified'
  if (!target.terms_accepted_at || !allowsSupportAccess(target.terms_version)) return 'terms'
  return null
}

export type Impersonator = { id: string; name: string; email: string; provider: string }

/** Sesiunea clientului, cu administratorul în spatele ei și ora până la care ține. */
export function impersonationToken(target: Profile, admin: Impersonator, auditId: string, nowMs: number): JWT {
  return { ...profileToken(target, 'impersonation', nowMs), impersonator: admin, impersonation: { id: auditId, until: nowMs + IMPERSONATION_MS } }
}

/**
 * Cererile pe care administratorul nu le poate face din contul clientului (metodele lipsă = toate):
 * parola, ștergerea contului, exportul datelor, datele de profil și de firmă, acordul pentru Termeni,
 * legarea conturilor Google, Edinio și Shopify (s-ar face cu conturile din browserul lui), deconectarea
 * Google și ștergerea unui magazin.
 */
export const IMPERSONATION_BLOCKED: { path: string; exact?: boolean; methods?: string[] }[] = [
  { path: '/api/user/change-password' },
  { path: '/api/user/delete' },
  { path: '/api/user/export' },
  { path: '/api/user/profile', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
  { path: '/api/user/avatar', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
  { path: '/api/auth/accept-terms' },
  { path: '/api/integrations/google/connect' },
  { path: '/api/integrations/google', exact: true, methods: ['DELETE'] },
  { path: '/api/integrations/edinio/connect' },
  { path: '/api/shopify/install' },
  { path: '/api/stores/', methods: ['DELETE'] },
  { path: '/api/billing/profile', methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
]

/** Cererea e una pe care doar clientul o poate face. */
export function blockedWhileImpersonating(pathname: string, method: string): boolean {
  return IMPERSONATION_BLOCKED.some(r =>
    (r.exact ? pathname === r.path : pathname === r.path || pathname.startsWith(r.path.endsWith('/') ? r.path : `${r.path}/`))
    && (!r.methods || r.methods.includes(method.toUpperCase())))
}

/** Ce primește administratorul când încearcă una dintre ele (în limba cererii). */
export const impersonationBlockedMessage = (t: TFunction) => t('api.impersonation_blocked')
