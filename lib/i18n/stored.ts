import type { Params, TFunction } from './translate'

// =============================================
// Mesajele salvate în bază ca să fie afișate mai târziu (ex. stores.last_error,
// google_connections.last_error) nu se scriu în nicio limbă: se scrie cheia de
// traducere, cu parametri dacă trebuie, iar interfața o traduce în limba omului
// care se uită.
//
//   salvare:  last_error: storedMessage('sync.woo_unavailable', { status: 503 })
//             → "sync.woo_unavailable|{"status":503}"
//   afișare:  translateStored(t, store.last_error)
//
// Un text vechi, scris direct (sau un detaliu tehnic de la platformă), se arată
// așa cum e.
// =============================================

const SEPARATOR = '|'

export function storedMessage(key: string, params?: Params): string {
  return params && Object.keys(params).length ? `${key}${SEPARATOR}${JSON.stringify(params)}` : key
}

/**
 * `formatNumber`: cum se scriu numerele din parametri în limba omului (3,5 în
 * română, 3.5 în engleză). `count` rămâne număr: alege forma de plural.
 */
export function translateStored(t: TFunction, value: string | null | undefined, formatNumber?: (n: number) => string): string | null {
  if (!value) return null
  const at = value.indexOf(SEPARATOR)
  const key = at === -1 ? value : value.slice(0, at)
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(key) || !t.has(key)) return value
  let params: Params | undefined
  if (at !== -1) {
    try { params = JSON.parse(value.slice(at + 1)) as Params } catch { params = undefined }
  }
  if (params && formatNumber) {
    for (const [k, v] of Object.entries(params)) if (typeof v === 'number' && k !== 'count') params[k] = formatNumber(v)
  }
  return t(key, params)
}
