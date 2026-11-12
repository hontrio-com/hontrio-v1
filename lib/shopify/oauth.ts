// =============================================
// Shopify OAuth — ce au în comun pornirea (/api/shopify/install) și întoarcerea
// (/api/shopify/callback). Hontrio doar citește: produsele, stocul și comenzile.
// ⚠ Cu instalarea gestionată de Shopify, contează și drepturile din
// shopify.app.*.toml (access_scopes): acolo trebuie să fie aceleași.
// =============================================

export const SHOPIFY_SCOPES = ['read_products', 'read_inventory', 'read_orders'].join(',')

export const SHOPIFY_STATE_COOKIE = 'shopify_oauth_state'
export const SHOPIFY_ONBOARDING_COOKIE = 'shopify_redirect_onboarding'
export const SHOPIFY_STATE_MAX_AGE_SEC = 600

/** Cookie-urile fluxului: httpOnly, Secure în producție; lax, ca întoarcerea din Shopify (o navigare) să le aducă. */
export function shopifyCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SHOPIFY_STATE_MAX_AGE_SEC,
    path: '/',
    sameSite: 'lax' as const,
  }
}
