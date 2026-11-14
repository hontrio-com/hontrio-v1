import type { Params } from '@/lib/i18n/translate'

// =============================================
// Conectarea unui magazin cu chei (WooCommerce, Gomag, MerchantPro, OpenCart):
// forma comună a verificării, folosită de /api/stores/test și /api/stores/connect.
// =============================================

/** Un refuz pentru om: cheia de traducere (secțiunea `sync`) și starea HTTP a rutei. */
export type ConnectFailure = { ok: false; key: string; params?: Params; status: number }

/** Ce se salvează pe rândul magazinului (cheile, criptate). */
export type ConnectKeys = { storeUrl: string; apiKey: string; apiSecret: string | null }

export type ConnectCheck =
  | {
    ok: true; storeUrl: string; currency: string | null; storeName: string | null; version: string | null
    /** Ce mai trebuie ținut pe magazin, aflat la conectare (ex. forma adresei pe care o recunoaște Gomag). */
    platformData?: Record<string, unknown>
  }
  | ConnectFailure

export type KeyConnector = {
  /** Câmpurile formularului, verificate fără rețea. */
  parse(body: unknown): { ok: true; keys: ConnectKeys } | ConnectFailure
  /** Întreabă platforma: cheia e acceptată și poate citi produsele și comenzile. */
  check(keys: ConnectKeys): Promise<ConnectCheck>
}

/** Câmpul din formular, curățat; null dacă lipsește. */
export function field(body: unknown, name: string): string | null {
  const v = (body as Record<string, unknown> | null)?.[name]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Aceeași adresă cu și fără „www." (unii comercianți scriu domeniul fără el). Calea rămâne. */
export function wwwVariants(address: string): string[] {
  try {
    const other = new URL(address)
    other.hostname = other.hostname.startsWith('www.') ? other.hostname.slice(4) : `www.${other.hostname}`
    return [address, other.toString().replace(/\/+$/, '')]
  } catch {
    return [address]
  }
}
