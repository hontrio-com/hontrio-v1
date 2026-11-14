import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'
import { syncEdinioStore } from '@/lib/edinio/sync'
import { syncGomagStore } from '@/lib/gomag/sync'
import { syncMerchantProStore } from '@/lib/merchantpro/sync'
import { syncOpenCartStore } from '@/lib/opencart/sync'
import { syncShopifyStore } from '@/lib/shopify/sync'
import { syncWooStore } from '@/lib/woocommerce/sync'
import type { CommerceSyncResult, SyncMode } from './sync-types'

export type { CommerceSyncResult, SyncMode } from './sync-types'
export { COMMERCE_PLATFORMS, isCommercePlatform } from './platforms'

// =============================================
// Sincronizarea în modelul comun, oricare ar fi platforma magazinului.
//
// După fiecare încercare se scrie când e magazinul din nou la rând
// (stores.next_sync_at): după o reușită, la rularea următoare a cronului; după
// un eșec, cu pauză crescătoare (15 min, 30, 1 h... cel mult o zi). Cronul ia
// magazinele în ordinea lui next_sync_at, deci fiecare își primește rândul, iar
// unul care nu răspunde nu mai ține pe loc sincronizarea celorlalte.
// =============================================

// La reușită, magazinul e din nou la rând peste atât (cronul rulează la 15 minute)
const NEXT_AFTER_SUCCESS_MS = 10 * 60_000
const BACKOFF_BASE_MS = 15 * 60_000
const BACKOFF_MAX_MS = 24 * 60 * 60_000

/** Pauza după al n-lea eșec la rând: 15 min, 30 min, 1 h, 2 h... cel mult o zi. */
export function backoffMs(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1))
}

type SyncOptions = {
  deadline?: number
  /** Pornită de om („Sincronizează acum"): se încearcă și un magazin cu cheia refuzată (poate a reparat-o). */
  manual?: boolean
}

async function runPlatform(storeId: string, platform: string, mode: SyncMode, opts: SyncOptions): Promise<CommerceSyncResult> {
  if (platform === 'woocommerce') return syncWooStore(storeId, mode, { deadline: opts.deadline })
  if (platform === 'shopify') return syncShopifyStore(storeId, mode, { deadline: opts.deadline })
  if (platform === 'gomag') return syncGomagStore(storeId, mode, opts)
  if (platform === 'merchantpro') return syncMerchantProStore(storeId, mode, opts)
  if (platform === 'opencart') return syncOpenCartStore(storeId, mode, opts)
  if (platform === 'edinio') {
    const r = await syncEdinioStore(storeId, mode, { deadline: opts.deadline })
    // Edinio termină trecerea dintr-o dată (magazine mici, paginare pe chei)
    return r.ok ? { ...r, complete: true } : r
  }
  return { ok: false, reason: 'not_found' }
}

/** Când e magazinul din nou la rând, după rezultat. O eroare a bazei aici nu strică sincronizarea. */
async function schedule(storeId: string, result: CommerceSyncResult) {
  if (!result.ok && result.reason !== 'failed') return
  const supabase = createAdminClient()
  try {
    if (result.ok) {
      await supabase.from('stores').update({ sync_failures: 0, next_sync_at: new Date(Date.now() + NEXT_AFTER_SUCCESS_MS).toISOString() }).eq('id', storeId)
      return
    }
    const { data } = await supabase.from('stores').select('sync_failures').eq('id', storeId).maybeSingle()
    const failures = (Number(data?.sync_failures) || 0) + 1
    await supabase.from('stores').update({ sync_failures: failures, next_sync_at: new Date(Date.now() + backoffMs(failures)).toISOString() }).eq('id', storeId)
  } catch (err) {
    logError('commerce/sync', 'Programarea sincronizării următoare a eșuat', { storeId, error: (err as Error).message })
  }
}

export async function syncCommerceStore(
  storeId: string, platform: string, mode: SyncMode, opts: SyncOptions = {},
): Promise<CommerceSyncResult> {
  const result = await runPlatform(storeId, platform, mode, opts)
  await schedule(storeId, result)
  return result
}
