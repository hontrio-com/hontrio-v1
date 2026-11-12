import { createHash, timingSafeEqual } from 'node:crypto'
import { GoogleAdsApiError } from '@/lib/google/ads'

// =============================================
// Ritmul pilotului, în funcții pure: ce zile se recitesc din Google la fiecare
// trecere, când o propunere a expirat, ce eroare Google trece singură
// (reîncercăm la ora următoare) și ce eroare rămâne (o spunem omului).
// =============================================

export const DAY_MS = 86_400_000

export const dayStr = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => dayStr(new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY_MS))
/** Zilele dintre două date YYYY-MM-DD (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/** Prima citire a unui cont: 90 de zile de istoric. */
export const FIRST_SYNC_DAYS = 90
/**
 * Google trece conversiile pe ziua clicului, chiar dacă sosesc zile mai târziu: fiecare trecere recitește
 * cel puțin ultimele 33 de zile (fereastra de evaluare de 30 de zile, plus cele 2 lăsate deoparte, plus azi),
 * ca o vânzare raportată târziu să ajungă în cifre.
 */
export const REFRESH_DAYS = 33
/** Peste ziua ultimei treceri recitim și câteva zile din urmă (o trecere care n-a citit tot). */
const OVERLAP_DAYS = 3

/** De la ce zi se recitesc metricile la trecerea de azi (`yesterday` = ultima zi completă). */
export function refreshFrom(lastSync: string | null, yesterday: string): string {
  const window = addDays(yesterday, -(REFRESH_DAYS - 1))
  if (!lastSync) return addDays(yesterday, -(FIRST_SYNC_DAYS - 1))
  const sinceLast = addDays(lastSync.slice(0, 10), -OVERLAP_DAYS)
  return sinceLast < window ? sinceLast : window
}

/** Propunerile nedecise expiră: cifrele de sub ele s-au schimbat. */
export const PROPOSAL_TTL_DAYS = 7

export function isExpired(createdAt: string, nowMs: number = Date.now()): boolean {
  const t = Date.parse(createdAt)
  return Number.isFinite(t) && nowMs - t > PROPOSAL_TTL_DAYS * DAY_MS
}

/** O aprobare în lucru „ține" propunerea atât; după, se socotește abandonată (cererea a căzut). */
export const CLAIM_TTL_MS = 10 * 60_000

/**
 * O eroare Google care trece singură: limită de cereri, cotă, serverul lor. Pentru ele reîncercăm la ora
 * următoare; celelalte (o interogare greșită, un drept lipsă) rămân până le rezolvă cineva.
 */
export function isTransientGoogleError(err: GoogleAdsApiError): boolean {
  if (err.httpStatus === 429 || err.httpStatus >= 500) return true
  const code = err.errorCode ?? ''
  return /^(quotaError|internalError|databaseError)\./.test(code) || /RESOURCE_EXHAUSTED|RESOURCE_TEMPORARILY_EXHAUSTED|TRANSIENT_ERROR|DEADLINE_EXCEEDED/.test(code)
}

/** Pilotul n-a mai trecut de atâta timp: oprirea de siguranță a pierdut deja o zi (omul trebuie să afle). */
export const MISSED_PASS_MS = 26 * 60 * 60_000

/**
 * Comparația secretului cronului fără să dezvăluie, prin timp, cât din el s-a nimerit (amprentele au
 * aceeași lungime, oricât de lung ar fi textul primit).
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}
