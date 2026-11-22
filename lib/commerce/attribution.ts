// =============================================
// De unde știe Hontrio ce vânzări au adus campaniile lui.
//
// - Magazinele care păstrează sursa comenzii (Edinio, WooCommerce, Shopify,
//   MerchantPro, OpenCart): comanda are `utm_campaign` = „hontrio-<ID>”, unde
//   ID este numărul campaniei din Google Ads (Termeni, art. 4.3). Hontrio pune
//   parametrul în sufixul adresei reclamei, iar magazinul îl salvează pe comandă.
// - Gomag nu dă sursa comenzii prin API (docs/integrari/GOMAG.md): vânzările
//   aduse de campaniile Hontrio se iau din conversiile raportate de Google Ads
//   pentru ele (hotărârea din 14.11.2026, Termeni art. 9.2).
// =============================================

export const HONTRIO_UTM_PREFIX = 'hontrio-'

/** Sursa vânzărilor aduse de campaniile Hontrio: comenzile magazinului sau conversiile Google Ads. */
export type SalesSource = 'store_orders' | 'google_ads'

export function salesSource(platform: string | null | undefined): SalesSource {
  return platform === 'gomag' ? 'google_ads' : 'store_orders'
}

/** Comanda a venit dintr-o campanie Hontrio, după ultimul clic: sursa începe cu „hontrio-”. */
export function isHontrioUtm(utm: string | null | undefined): boolean {
  return (utm ?? '').trim().toLowerCase().startsWith(HONTRIO_UTM_PREFIX)
}

/** Numărul campaniei Google Ads din sursa unei comenzi („hontrio-24490539576” → „24490539576”). */
export function hontrioCampaignId(utm: string | null | undefined): string | null {
  const m = /^hontrio-(\d+)/i.exec((utm ?? '').trim())
  return m ? m[1] : null
}
