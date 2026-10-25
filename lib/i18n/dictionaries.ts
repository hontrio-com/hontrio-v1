import ro from './messages/ro'
import en from './messages/en'
import { SOURCE_LOCALE, type Locale } from './config'
import type { Messages } from './translate'

// =============================================
// Dicționarele ambelor limbi. Se încarcă pe server; în browser ajunge doar
// limba curentă (plus limba-sursă, ca rezervă, când nu e aceeași).
// =============================================

export const MESSAGES: Record<Locale, Messages> = { ro, en }

/** Ce primește browserul: dicționarul limbii și, pentru engleză, rezerva în română. */
export function clientMessages(locale: Locale): { messages: Messages; fallback: Messages | null } {
  return { messages: MESSAGES[locale], fallback: locale === SOURCE_LOCALE ? null : MESSAGES[SOURCE_LOCALE] }
}
