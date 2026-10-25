import { syncEdinioStore } from '@/lib/edinio/sync'
import { syncShopifyStore } from '@/lib/shopify/sync'
import { syncWooStore } from '@/lib/woocommerce/sync'

// =============================================
// Sincronizarea în modelul comun, oricare ar fi platforma magazinului
// =============================================

export type SyncMode = 'incremental' | 'full'

export type CommerceSyncResult =
  | { ok: true; mode: SyncMode; complete: boolean; offers: number; orders: number; offersTotal: number; ordersTotal: number }
  | { ok: false; reason: 'not_found' | 'locked' | 'revoked' | 'failed'; message?: string }

/** Platformele care alimentează modelul comun (paginile de reclame). */
export const COMMERCE_PLATFORMS = ['edinio', 'woocommerce', 'shopify'] as const

export function isCommercePlatform(platform: string | null | undefined): boolean {
  return (COMMERCE_PLATFORMS as readonly string[]).includes(platform ?? '')
}

export async function syncCommerceStore(
  storeId: string, platform: string, mode: SyncMode, opts: { deadline?: number } = {},
): Promise<CommerceSyncResult> {
  if (platform === 'woocommerce') return syncWooStore(storeId, mode, opts)
  if (platform === 'shopify') return syncShopifyStore(storeId, mode, opts)
  if (platform === 'edinio') {
    const r = await syncEdinioStore(storeId, mode, opts)
    // Edinio termină trecerea dintr-o dată (magazine mici, paginare pe chei)
    return r.ok ? { ...r, complete: true } : r
  }
  return { ok: false, reason: 'not_found' }
}
