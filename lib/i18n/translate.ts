import { INTL_LOCALE, type Locale } from './config'

// =============================================
// Traducerea, aceeași pe server și în browser.
//
// - Cheile au puncte: `catalog.cost_invalid`.
// - Parametrii se scriu {{nume}}: t('x', { nume: 'Ana' }).
// - Pluralul: cu `count` numeric, dacă există `cheie_one` / `cheie_few` /
//   `cheie_other`, se alege forma după regulile limbii (în română: 1 ofertă,
//   2 oferte, 20 de oferte).
// - O cheie lipsă din limba curentă se ia din limba-sursă (română); dacă nu
//   există nicăieri, apare cheia întreagă (și un avertisment în dezvoltare),
//   nu o bucată din ea care să pară text.
// =============================================

export type Messages = { [key: string]: string | Messages }
export type Params = Record<string, string | number>
export type TFunction = ((key: string, params?: Params) => string) & {
  /** Există cheia (pentru chei construite din date, ex. o stare primită de la server)? */
  has: (key: string) => boolean
}

function lookup(dict: Messages | undefined, key: string): string | undefined {
  let node: string | Messages | undefined = dict
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match)
}

const pluralRules = new Map<Locale, Intl.PluralRules>()
function pluralCategory(locale: Locale, count: number): string {
  let rules = pluralRules.get(locale)
  if (!rules) { rules = new Intl.PluralRules(INTL_LOCALE[locale]); pluralRules.set(locale, rules) }
  return rules.select(count)
}

const warned = new Set<string>()
function warnMissing(locale: Locale, key: string) {
  if (process.env.NODE_ENV === 'production' || warned.has(`${locale}:${key}`)) return
  warned.add(`${locale}:${key}`)
  console.warn(`[i18n] Lipsește traducerea „${key}" (${locale})`)
}

export function createT(locale: Locale, messages: Messages, fallback?: Messages): TFunction {
  const find = (key: string, count: number | undefined): string | undefined => {
    if (count !== undefined) {
      const category = pluralCategory(locale, count)
      const forms = [`${key}_${category}`, `${key}_other`]
      for (const form of forms) {
        const hit = lookup(messages, form) ?? lookup(fallback, form)
        if (hit !== undefined) return hit
      }
    }
    return lookup(messages, key) ?? lookup(fallback, key)
  }

  const t = ((key: string, params?: Params) => {
    const count = typeof params?.count === 'number' ? params.count : undefined
    const text = find(key, count)
    if (text === undefined) {
      warnMissing(locale, key)
      return key
    }
    if (lookup(messages, key) === undefined && count === undefined) warnMissing(locale, key)
    return interpolate(text, params)
  }) as TFunction
  t.has = (key: string) => find(key, undefined) !== undefined
    || lookup(messages, `${key}_other`) !== undefined || lookup(fallback, `${key}_other`) !== undefined
  return t
}
