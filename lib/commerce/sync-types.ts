// =============================================
// Rezultatul unei sincronizări, același pentru toate platformele.
// =============================================

export type SyncMode = 'incremental' | 'full'

export type CommerceSyncResult =
  | { ok: true; mode: SyncMode; complete: boolean; offers: number; orders: number; offersTotal: number; ordersTotal: number }
  | { ok: false; reason: 'not_found' | 'locked' | 'revoked' | 'failed'; message?: string }
