import { createHmac } from 'node:crypto'
import { safeEqual } from '@/lib/security/compare'

// =============================================
// Semnăturile Shopify, verificate în timp constant.
// - întoarcerea din OAuth: HMAC-SHA256 (hex) peste parametrii adresei, fără
//   `hmac` și `signature`, sortați după nume, scriși `cheie=valoare` legați cu `&`
// - webhook-urile: HMAC-SHA256 (base64) peste corpul brut, în antetul
//   X-Shopify-Hmac-Sha256
// Ambele cu secretul aplicației (SHOPIFY_CLIENT_SECRET).
// =============================================

/** Mesajul semnat de Shopify la întoarcerea din OAuth. */
export function oauthMessage(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

export function oauthHmac(params: URLSearchParams, secret: string): string {
  return createHmac('sha256', secret).update(oauthMessage(params)).digest('hex')
}

/** Parametrii întoarcerii din OAuth sunt semnați de Shopify. */
export function verifyOAuthHmac(params: URLSearchParams, secret: string | null | undefined): boolean {
  const hmac = params.get('hmac')
  if (!secret || !hmac) return false
  return safeEqual(oauthHmac(params, secret), hmac.toLowerCase())
}

export function webhookHmac(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

/** Corpul webhook-ului e semnat de Shopify (antetul X-Shopify-Hmac-Sha256). */
export function verifyWebhookHmac(rawBody: string, header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !header) return false
  return safeEqual(webhookHmac(rawBody, secret), header)
}

/** Domeniul unui magazin Shopify: nume.myshopify.com, nimic altceva. */
export function isShopDomain(shop: unknown): shop is string {
  return typeof shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)
}
