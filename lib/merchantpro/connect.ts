import { field, wwwVariants, type ConnectCheck, type ConnectFailure, type ConnectKeys, type KeyConnector } from '@/lib/commerce/connect-types'
import { StoreApiError } from '@/lib/commerce/http'
import { str } from '@/lib/commerce/rows'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { MerchantProApi } from './api'

// =============================================
// MerchantPro — verificarea utilizatorului API la conectare (aceeași pentru
// „Testează" și „Conectează"): adresa e un magazin MerchantPro, datele sunt
// acceptate și pot citi produsele și comenzile. Adresa fără „www." care trimite
// la cea cu „www." (sau invers) se încearcă și în forma cealaltă. După un 401 nu
// se mai încearcă nimic: MerchantPro blochează încercările repetate (403).
// =============================================

// Utilizatorul și secretul API: caractere vizibile, fără spații
const CREDENTIAL_RE = /^[\x21-\x7e]{4,256}$/

function fail(key: string, params?: ConnectFailure['params']): ConnectFailure {
  return { ok: false, key, status: 400, ...(params ? { params } : {}) }
}

export function parseMerchantProKeys(body: unknown): { ok: true; keys: ConnectKeys } | ConnectFailure {
  const storeUrl = field(body, 'store_url')
  const apiKey = field(body, 'api_key')
  const apiSecret = field(body, 'api_secret')
  if (!storeUrl || !apiKey || !apiSecret) return fail('sync.fields_required')
  if (!CREDENTIAL_RE.test(apiKey) || !CREDENTIAL_RE.test(apiSecret)) return fail('sync.merchantpro_credentials_invalid')
  const url = validateStoreUrl(storeUrl)
  if (!url.valid) return fail(url.error ?? 'sync.store_url_invalid')
  return { ok: true, keys: { storeUrl: url.cleaned, apiKey, apiSecret } }
}

function failureOf(err: unknown, forbiddenKey: string): ConnectFailure {
  if (!(err instanceof StoreApiError)) return fail('sync.merchantpro_no_response')
  if (err.status === 401) return fail('sync.merchantpro_key_rejected')
  if (err.status === 403) return fail(forbiddenKey, err.params)
  if (err.code === 'rate_limited') return fail('sync.merchantpro_rate_limited')
  if (err.code === 'network' || err.code === 'deadline') return fail('sync.merchantpro_no_response')
  if (err.code === 'unavailable') return fail('sync.merchantpro_unavailable', { status: err.status ?? 500 })
  return fail(err.key, err.params)
}

/** Adresa nu e (încă) cea bună: trimite în altă parte sau nu are API-ul MerchantPro. */
const wrongAddress = (err: unknown) => err instanceof StoreApiError && (err.key === 'sync.store_redirects' || err.code === 'not_found')

export async function checkMerchantProKeys(keys: ConnectKeys): Promise<ConnectCheck> {
  const deadline = Date.now() + 40_000
  let api: MerchantProApi | null = null
  let shop: string | null = null
  let lastWrong: unknown = null
  for (const candidate of wwwVariants(keys.storeUrl)) {
    const attempt = new MerchantProApi(candidate, keys.apiKey, keys.apiSecret ?? '', { deadline, retries: 0 })
    try {
      await attempt.products({ start: 0, limit: 1 })
      api = attempt
      shop = candidate
      break
    } catch (err) {
      if (!wrongAddress(err)) return failureOf(err, 'sync.merchantpro_forbidden')
      lastWrong = err
    }
  }
  if (!api || !shop) {
    return lastWrong instanceof StoreApiError && lastWrong.key === 'sync.store_redirects'
      ? fail(lastWrong.key, lastWrong.params)
      : fail('sync.merchantpro_not_detected')
  }

  try {
    const last = await api.orders({ start: 0, limit: 1, sort: 'date_created.desc', fields: 'id,currency' })
    const currency = str(last.items[0]?.currency)?.toUpperCase() ?? null
    return { ok: true, storeUrl: shop, currency, storeName: null, version: null }
  } catch (err) {
    return failureOf(err, 'sync.merchantpro_key_no_orders')
  }
}

export const merchantproConnect: KeyConnector = { parse: parseMerchantProKeys, check: checkMerchantProKeys }
