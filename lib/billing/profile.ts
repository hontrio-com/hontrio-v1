import { cleanCui, validCui } from '@/lib/billing/anaf'

// =============================================
// Datele de facturare ale firmei, verificate înainte de salvare (ce ajunge
// pe factura SmartBill și în e-Factura). Funcție pură, în tests/billing.test.ts.
// =============================================

export type BillingProfile = {
  name: string
  vat_code: string
  reg_com: string | null
  is_vat_payer: boolean
  address: string
  city: string
  county: string | null
  country: string
  email: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

/** Câmpurile trimise de om → profilul de salvat, sau cheia erorii (secțiunea `billing`). */
export function checkProfile(input: Record<string, unknown> | null): { ok: true; profile: BillingProfile } | { ok: false; error: string; field: string } {
  const country = text(input?.country, 2).toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, error: 'billing.err_country', field: 'country' }
  const name = text(input?.name, 200)
  if (name.length < 2) return { ok: false, error: 'billing.err_name', field: 'name' }

  let vat = text(input?.vat_code, 20).toUpperCase().replace(/\s+/g, '')
  if (country === 'RO') {
    const cui = cleanCui(vat)
    if (!cui || !validCui(cui)) return { ok: false, error: 'billing.err_cui', field: 'vat_code' }
    vat = cui
  } else if (!/^[A-Z0-9]{4,20}$/.test(vat)) {
    return { ok: false, error: 'billing.err_vat', field: 'vat_code' }
  }

  const address = text(input?.address, 300)
  if (address.length < 3) return { ok: false, error: 'billing.err_address', field: 'address' }
  const county = text(input?.county, 100) || null
  let city = text(input?.city, 100)
  if (city.length < 2) return { ok: false, error: 'billing.err_city', field: 'city' }
  // București: pe e-Factura orașul este sectorul
  if (country === 'RO' && county && /bucure/i.test(county)) {
    const sector = /sector\s*([1-6])/i.exec(city)
    if (!sector) return { ok: false, error: 'billing.err_sector', field: 'city' }
    city = `Sector ${sector[1]}`
  }
  if (country === 'RO' && !county) return { ok: false, error: 'billing.err_county', field: 'county' }

  const email = text(input?.email, 254).toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'billing.err_email', field: 'email' }

  return {
    ok: true,
    profile: {
      name, vat_code: vat, reg_com: text(input?.reg_com, 40) || null,
      is_vat_payer: input?.is_vat_payer === true, address, city, county, country, email,
    },
  }
}
