import { checkWooKeys, parseWooKeys } from '@/lib/woocommerce/connect'
import { gomagConnect } from '@/lib/gomag/connect'
import { merchantproConnect } from '@/lib/merchantpro/connect'
import { opencartConnect } from '@/lib/opencart/connect'
import type { KeyConnector } from './connect-types'
import { isKeyPlatform, type KeyPlatform } from './platforms'

// =============================================
// Platformele legate cu chei, fiecare cu verificarea ei, pentru rutele
// /api/stores/test și /api/stores/connect.
// =============================================

/** WooCommerce în forma comună: cheia și secretul REST (ck_ / cs_). */
const wooConnect: KeyConnector = {
  parse(body) {
    const r = parseWooKeys(body)
    return r.ok ? { ok: true, keys: { storeUrl: r.keys.storeUrl, apiKey: r.keys.consumerKey, apiSecret: r.keys.consumerSecret } } : r
  },
  async check(keys) {
    const r = await checkWooKeys({ storeUrl: keys.storeUrl, consumerKey: keys.apiKey, consumerSecret: keys.apiSecret ?? '' })
    return r.ok ? { ok: true, storeUrl: keys.storeUrl, currency: r.currency, storeName: r.storeName, version: r.version } : r
  },
}

export const KEY_CONNECTORS: Record<KeyPlatform, KeyConnector> = {
  woocommerce: wooConnect,
  gomag: gomagConnect,
  merchantpro: merchantproConnect,
  opencart: opencartConnect,
}

/** Platforma din formular. Fără ea, WooCommerce (formularul de dinainte). Null = necunoscută. */
export function keyPlatformOf(body: unknown): KeyPlatform | null {
  const p = (body as Record<string, unknown> | null)?.platform
  if (p === undefined || p === null || p === '') return 'woocommerce'
  return typeof p === 'string' && isKeyPlatform(p) ? p : null
}
