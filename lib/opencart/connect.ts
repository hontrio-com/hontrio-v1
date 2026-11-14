import { field, wwwVariants, type ConnectCheck, type ConnectFailure, type ConnectKeys, type KeyConnector } from '@/lib/commerce/connect-types'
import { StoreApiError } from '@/lib/commerce/http'
import { validateStoreUrl } from '@/lib/security/validate-url'
import { OpenCartApi } from './api'

// =============================================
// OpenCart — verificarea cheii extensiei Hontrio la conectare (aceeași pentru
// „Testează" și „Conectează"): extensia răspunde, cheia e acceptată, API-ul e
// pornit și comenzile se pot citi. OpenCart stă des într-un folder
// (magazin.ro/shop): calea adresei se păstrează.
// =============================================

// Cheia generată de extensie: 48 de caractere hexazecimale (primim 32–128)
const KEY_RE = /^[A-Fa-f0-9]{32,128}$/

function fail(key: string, params?: ConnectFailure['params']): ConnectFailure {
  return { ok: false, key, status: 400, ...(params ? { params } : {}) }
}

/** Adresa magazinului OpenCart: originea verificată, plus folderul (fără index.php, parametri sau / la final). */
export function openCartAddress(input: string): { ok: true; url: string } | ConnectFailure {
  const origin = validateStoreUrl(input)
  if (!origin.valid) return fail(origin.error ?? 'sync.store_url_invalid')
  let path = ''
  try {
    const u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
    path = decodeURIComponent(u.pathname).replace(/\/index\.php$/i, '').replace(/\/+$/, '')
  } catch {
    return fail('sync.store_url_invalid')
  }
  // Doar un folder obișnuit: litere, cifre, - _ . și /
  if (path && !/^(\/[A-Za-z0-9._~-]+)+$/.test(path)) return fail('sync.store_url_invalid')
  return { ok: true, url: origin.cleaned + path }
}

export function parseOpenCartKeys(body: unknown): { ok: true; keys: ConnectKeys } | ConnectFailure {
  const storeUrl = field(body, 'store_url')
  const apiKey = field(body, 'api_key')
  if (!storeUrl || !apiKey) return fail('sync.fields_required')
  if (!KEY_RE.test(apiKey)) return fail('sync.opencart_key_invalid')
  const address = openCartAddress(storeUrl)
  if (!address.ok) return address
  return { ok: true, keys: { storeUrl: address.url, apiKey, apiSecret: null } }
}

function failureOf(err: unknown): ConnectFailure {
  if (!(err instanceof StoreApiError)) return fail('sync.opencart_no_response')
  if (err.code === 'network' || err.code === 'deadline') return fail('sync.opencart_no_response')
  if (err.code === 'unavailable') return fail('sync.opencart_unavailable', { status: err.status ?? 500 })
  return fail(err.key, err.params)
}

const wrongAddress = (err: unknown) => err instanceof StoreApiError && (err.key === 'sync.store_redirects' || err.key === 'sync.opencart_extension_missing')

export async function checkOpenCartKeys(keys: ConnectKeys): Promise<ConnectCheck> {
  const deadline = Date.now() + 40_000
  let lastWrong: unknown = null
  for (const candidate of wwwVariants(keys.storeUrl)) {
    const api = new OpenCartApi(candidate, keys.apiKey, { deadline, retries: 0 })
    try {
      const info = await api.info()
      await api.orders({ page: 1, limit: 1 })
      return {
        ok: true,
        storeUrl: candidate,
        currency: info.store.currency?.toUpperCase() ?? null,
        storeName: info.store.name?.trim() || null,
        version: info.opencart_version ?? null,
      }
    } catch (err) {
      if (!wrongAddress(err)) return failureOf(err)
      lastWrong = err
    }
  }
  return failureOf(lastWrong)
}

export const opencartConnect: KeyConnector = { parse: parseOpenCartKeys, check: checkOpenCartKeys }
