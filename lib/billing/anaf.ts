// =============================================
// Datele unei firme românești după CUI, din serviciul public ANAF (v9), ca
// omul să nu le scrie de mână pe factură: denumirea, Registrul Comerțului,
// sediul și dacă este plătitoare de TVA. ANAF primește doar CUI-ul.
// =============================================

const ANAF_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva'

export type CompanyData = {
  name: string
  vat_code: string
  reg_com: string | null
  is_vat_payer: boolean
  address: string
  city: string
  county: string | null
  postal_code: string | null
}

/** CUI-ul curat: doar cifrele, fără „RO”; null dacă nu arată a CUI (2–10 cifre). */
export function cleanCui(input: string): string | null {
  const digits = input.trim().toUpperCase().replace(/^RO/, '').replace(/[\s.-]/g, '')
  return /^\d{2,10}$/.test(digits) ? digits : null
}

/** Cifra de control a CUI-ului (algoritmul ANAF, cheia 753217532). */
export function validCui(cui: string): boolean {
  if (!/^\d{2,10}$/.test(cui)) return false
  const key = '753217532'
  const body = cui.slice(0, -1).padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i])
  const control = (sum * 10) % 11 % 10
  return control === Number(cui.slice(-1))
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const title = (s: string) => s.toLowerCase().replace(/(^|[\s.(-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())

/** Răspunsul ANAF → datele de pe factură. null = CUI negăsit. */
export function parseAnaf(json: unknown): CompanyData | null {
  const found = (json as { found?: unknown[] } | null)?.found
  const f = Array.isArray(found) ? (found[0] as Record<string, Record<string, unknown>> | undefined) : undefined
  const g = f?.date_generale
  if (!g || !str(g.denumire)) return null
  const s = f.adresa_sediu_social ?? {}
  const street = [str(s.sdenumire_Strada), str(s.snumar_Strada) && `nr. ${str(s.snumar_Strada)}`, str(s.sdetalii_Adresa)].filter(Boolean).join(', ')
  const county = str(s.sdenumire_Judet)
  let city = str(s.sdenumire_Localitate)
  // București: pe e-Factura orașul este sectorul („Sector 1”…„Sector 6”)
  if (/bucure/i.test(county)) {
    const sector = /sector\s*([1-6])/i.exec(`${city} ${str(g.adresa)}`)
    if (sector) city = `Sector ${sector[1]}`
  }
  return {
    name: str(g.denumire),
    vat_code: String(g.cui ?? ''),
    reg_com: str(g.nrRegCom) || null,
    is_vat_payer: !!(f.inregistrare_scop_Tva as { scpTVA?: unknown } | undefined)?.scpTVA,
    address: street || str(g.adresa),
    city: city ? title(city) : '',
    county: county ? title(county) : null,
    postal_code: str(s.scod_Postal) || str(g.codPostal) || null,
  }
}

/** Datele firmei după CUI, de la ANAF; null = negăsit. Aruncă la o eroare a serviciului. */
export async function lookupCompany(cui: string): Promise<CompanyData | null> {
  const day = new Date().toISOString().slice(0, 10)
  const res = await fetch(ANAF_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ cui: Number(cui), data: day }]),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ANAF ${res.status}`)
  return parseAnaf(await res.json())
}
