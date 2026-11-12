import type { Params } from '@/lib/i18n/translate'
import { fetchPublic, PublicFetchError, validateStoreUrl } from '@/lib/security/validate-url'

// =============================================
// WooCommerce — verificarea cheii la conectare (aceeași pentru „Testează" și
// „Conectează"): adresa e publică, cheia e acceptată și poate citi comenzile.
// Cheile WooCommerce sunt `ck_` / `cs_` urmate de 40 de caractere hex; primim
// orice lungime rezonabilă (unele pluginuri le fac altfel).
// =============================================

const KEY_RE = /^ck_[A-Za-z0-9]{8,120}$/
const SECRET_RE = /^cs_[A-Za-z0-9]{8,120}$/

export type WooKeys = { storeUrl: string; consumerKey: string; consumerSecret: string }
type Failure = { ok: false; key: string; params?: Params; status: number }

/** Câmpurile din formular, verificate; `storeUrl` e originea curată (https://domeniu). */
export function parseWooKeys(body: unknown): { ok: true; keys: WooKeys } | Failure {
  const b = (body ?? {}) as Record<string, unknown>
  const { store_url, consumer_key, consumer_secret } = b
  if (typeof store_url !== 'string' || typeof consumer_key !== 'string' || typeof consumer_secret !== 'string' || !store_url || !consumer_key || !consumer_secret) {
    return { ok: false, key: 'sync.fields_required', status: 400 }
  }
  const key = consumer_key.trim()
  const secret = consumer_secret.trim()
  if (!KEY_RE.test(key)) return { ok: false, key: 'sync.woo_consumer_key_invalid', status: 400 }
  if (!SECRET_RE.test(secret)) return { ok: false, key: 'sync.woo_consumer_secret_invalid', status: 400 }
  const url = validateStoreUrl(store_url)
  if (!url.valid) return { ok: false, key: url.error ?? 'sync.store_url_invalid', status: 400 }
  return { ok: true, keys: { storeUrl: url.cleaned, consumerKey: key, consumerSecret: secret } }
}

export type WooCheck = { ok: true; currency: string | null; version: string | null; storeName: string | null } | Failure

/** Întreabă magazinul (prin fetchPublic: doar adrese publice, fără redirecționări spre alte site-uri). */
export async function checkWooKeys({ storeUrl, consumerKey, consumerSecret }: WooKeys): Promise<WooCheck> {
  const auth = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const get = (path: string) => fetchPublic(`${storeUrl}/wp-json/wc/v3/${path}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })

  try {
    const status = await get('system_status?_fields=environment,settings')
    if (status.status === 401 || status.status === 403) return { ok: false, key: 'sync.woo_key_not_accepted', status: 400 }
    if (status.status === 404) return { ok: false, key: 'sync.woo_not_detected', status: 400 }
    if (!status.ok) return { ok: false, key: 'sync.store_responded_status', params: { status: status.status }, status: 400 }
    const info = await status.json().catch(() => null) as { environment?: { version?: unknown }; settings?: { currency?: unknown; blog_name?: unknown } } | null

    // Cheia trebuie să poată citi vânzările (o comandă, doar id-ul)
    const orders = await get('orders?per_page=1&_fields=id')
    await orders.body?.cancel().catch(() => {})
    if (!orders.ok) return { ok: false, key: 'sync.woo_key_no_orders', status: 400 }

    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
    return {
      ok: true,
      currency: text(info?.settings?.currency, 3),
      version: text(info?.environment?.version, 20),
      storeName: text(info?.settings?.blog_name, 120),
    }
  } catch (err) {
    if (err instanceof PublicFetchError) return { ok: false, key: err.key, params: err.params, status: 400 }
    return { ok: false, key: 'sync.store_no_response_check_url', status: 400 }
  }
}
