import 'server-only'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, SOURCE_LOCALE, detectLocale, isLocale, type Locale } from './config'
import { MESSAGES } from './dictionaries'
import { createT, type TFunction } from './translate'

// =============================================
// Traducerea pe server: pagini, metadate, rute API (mesajele trimise în
// browser sunt deja în limba omului) și e-mailuri.
// =============================================

/** Limba cererii: alegerea omului (cookie), altfel țara și limba browserului. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(chosen)) return chosen
  const h = await headers()
  return detectLocale(h.get('x-vercel-ip-country'), h.get('accept-language'))
}

/** Traducerea pentru o limbă știută (ex. limba salvată în contul omului, la e-mailuri). */
export function tFor(locale: Locale): TFunction {
  return createT(locale, MESSAGES[locale], locale === SOURCE_LOCALE ? undefined : MESSAGES[SOURCE_LOCALE])
}

/** Traducerea în limba cererii curente. */
export async function getT(): Promise<TFunction> {
  return tFor(await getLocale())
}
