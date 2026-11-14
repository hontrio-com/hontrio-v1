import { field, wwwVariants, type ConnectCheck, type ConnectFailure, type ConnectKeys, type KeyConnector } from '@/lib/commerce/connect-types'
import { StoreApiError } from '@/lib/commerce/http'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { GomagApi } from './api'
import { baseCurrency } from './mapping'

// =============================================
// Gomag — verificarea cheii la conectare (aceeași pentru „Testează" și
// „Conectează"): Gomag recunoaște magazinul (antetul ApiShop) și cheia, iar
// cheia poate citi produsele și comenzile. Magazinul se încearcă și cu, și
// fără „www.": Gomag îl știe după adresa lui exactă.
// =============================================

// Cheile Gomag sunt șiruri alfanumerice; primim orice lungime rezonabilă
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/

function fail(key: string, status = 400, params?: ConnectFailure['params']): ConnectFailure {
  return { ok: false, key, status, ...(params ? { params } : {}) }
}

export function parseGomagKeys(body: unknown): { ok: true; keys: ConnectKeys } | ConnectFailure {
  const storeUrl = field(body, 'store_url')
  const apiKey = field(body, 'api_key')
  if (!storeUrl || !apiKey) return fail('sync.fields_required')
  if (!KEY_RE.test(apiKey)) return fail('sync.gomag_key_invalid')
  const url = validateStoreUrl(storeUrl)
  if (!url.valid) return fail(url.error ?? 'sync.store_url_invalid')
  return { ok: true, keys: { storeUrl: url.cleaned, apiKey, apiSecret: null } }
}

/** Eroarea Gomag → mesajul pentru om. */
function failureOf(err: unknown, fallback: string): ConnectFailure {
  if (err instanceof StoreApiError) {
    if (err.code === 'unauthorized') return fail(fallback)
    if (err.code === 'rate_limited') return fail('sync.gomag_rate_limited')
    if (err.code === 'network' || err.code === 'deadline') return fail('sync.gomag_no_response')
    if (err.code === 'unavailable') return fail('sync.gomag_unavailable', 400, { status: err.status ?? 500 })
    return fail(err.key, 400, err.params)
  }
  return fail('sync.gomag_no_response')
}

/**
 * Formele adresei pe care le încercăm în antetul ApiShop: cu https://, cu și fără „www.",
 * apoi doar domeniul (documentația Gomag nu spune forma; o recunoaște pe a magazinului).
 */
export function apiShopCandidates(storeUrl: string): string[] {
  const urls = wwwVariants(storeUrl)
  const hosts = urls.map(u => u.replace(/^https?:\/\//i, ''))
  return [...new Set([...urls, ...hosts])]
}

export async function checkGomagKeys(keys: ConnectKeys): Promise<ConnectCheck> {
  const deadline = Date.now() + 40_000
  let api: GomagApi | null = null
  let shop: string | null = null
  for (const candidate of apiShopCandidates(keys.storeUrl)) {
    const attempt = new GomagApi(candidate, keys.apiKey, { deadline, retries: 0 })
    try {
      await attempt.products({ page: 1, limit: 1 })
      api = attempt
      shop = candidate
      break
    } catch (err) {
      // Magazinul sau cheia nerecunoscute: încercăm forma următoare; orice altă eroare e răspunsul
      if (!(err instanceof StoreApiError && err.code === 'unauthorized')) return failureOf(err, 'sync.gomag_shop_or_key')
    }
  }
  if (!api || !shop) return fail('sync.gomag_shop_or_key')

  try {
    await api.orders({ page: 1, limit: 1 })
  } catch (err) {
    return failureOf(err, 'sync.gomag_key_no_orders')
  }
  const currency = baseCurrency(await api.currencies().catch(() => []))
  // Adresa magazinului rămâne o adresă (pentru om și pentru unicitate); forma care a mers, separat
  const storeUrl = /^https?:\/\//i.test(shop) ? shop : `https://${shop}`
  return { ok: true, storeUrl, currency, storeName: null, version: null, platformData: { api_shop: shop } }
}

export const gomagConnect: KeyConnector = { parse: parseGomagKeys, check: checkGomagKeys }
