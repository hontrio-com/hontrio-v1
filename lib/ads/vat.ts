// =============================================
// Cota standard de TVA pe țară — pentru magazinele care nu calculează taxe
// în platformă (des la WooCommerce). Prețurile către consumatori din UE
// includ TVA prin lege, deci pragul de profit o presupune, și o spune.
// Cote valabile în octombrie 2026.
// =============================================

const STANDARD_VAT: Record<string, number> = {
  AT: 0.2, BE: 0.21, BG: 0.2, CY: 0.19, CZ: 0.21, DE: 0.19, DK: 0.25, EE: 0.24, ES: 0.21,
  FI: 0.255, FR: 0.2, GR: 0.24, HR: 0.25, HU: 0.27, IE: 0.23, IT: 0.22, LT: 0.21, LU: 0.17,
  LV: 0.21, MT: 0.18, NL: 0.21, PL: 0.23, PT: 0.23, RO: 0.21, SE: 0.25, SI: 0.22, SK: 0.23,
  CH: 0.081, GB: 0.2, MD: 0.2, NO: 0.25,
}

export function standardVatRate(country: string | null | undefined): number | null {
  return country ? STANDARD_VAT[country.toUpperCase()] ?? null : null
}
