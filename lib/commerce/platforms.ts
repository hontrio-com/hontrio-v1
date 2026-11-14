// =============================================
// Platformele de magazin pe care le citește Hontrio. Modul pur (fără server),
// folosit și de paginile din browser (numele platformei în meniu și în Setări).
// =============================================

/** Platformele care alimentează modelul comun (paginile de reclame). */
export const COMMERCE_PLATFORMS = ['edinio', 'woocommerce', 'shopify', 'gomag', 'merchantpro', 'opencart'] as const

export type CommercePlatform = typeof COMMERCE_PLATFORMS[number]

export const PLATFORM_NAMES: Record<CommercePlatform, string> = {
  edinio: 'Edinio',
  woocommerce: 'WooCommerce',
  shopify: 'Shopify',
  gomag: 'Gomag',
  merchantpro: 'MerchantPro',
  opencart: 'OpenCart',
}

/** Platformele legate cu chei pe care comerciantul le lipește în Hontrio (nu prin OAuth). */
export const KEY_PLATFORMS = ['woocommerce', 'gomag', 'merchantpro', 'opencart'] as const

export type KeyPlatform = typeof KEY_PLATFORMS[number]

export function isCommercePlatform(platform: string | null | undefined): platform is CommercePlatform {
  return (COMMERCE_PLATFORMS as readonly string[]).includes(platform ?? '')
}

export function isKeyPlatform(platform: string | null | undefined): platform is KeyPlatform {
  return (KEY_PLATFORMS as readonly string[]).includes(platform ?? '')
}

export function platformName(platform: string | null | undefined): string {
  return isCommercePlatform(platform) ? PLATFORM_NAMES[platform] : (platform ?? '')
}

/**
 * Numele magazinului pentru pagini: cel dat de platformă, altfel adresa lui
 * (Gomag și MerchantPro nu spun prin API cum se numește magazinul).
 */
export function storeDisplayName(store: { store_name?: string | null; store_url?: string | null }): string {
  const name = store.store_name?.trim()
  if (name) return name
  return (store.store_url ?? '').replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}
