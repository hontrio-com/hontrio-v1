// =============================================
// Țara comenzii ca cod ISO (RO, MD, HU...). Unele platforme (Gomag) dau numele
// țării, scris cum l-a scris magazinul: „Romania", „România", „Republica
// Moldova", „Ungaria". Numele se caută în toate limbile din jurul magazinelor
// noastre, fără diacritice și fără litere mari. Funcție pură.
// =============================================

// Limbile în care pot fi scrise numele țărilor
const LOCALES = ['ro', 'en', 'hu', 'de', 'fr', 'it', 'es', 'bg', 'pl']

// Coduri cu nume în CLDR care nu sunt țări (Uniunea Europeană, ONU, pseudo-limbi)
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'ZZ', 'QO', 'XA', 'XB'])

// Nume uzuale pe care CLDR nu le are (sau le are altfel)
const ALIASES: Record<string, string> = {
  'marea britanie': 'GB', anglia: 'GB', uk: 'GB', 'great britain': 'GB', scotia: 'GB',
  sua: 'US', usa: 'US', 'statele unite': 'US', america: 'US', 'united states of america': 'US',
  olanda: 'NL', holland: 'NL', 'republica ceha': 'CZ', 'czech republic': 'CZ', turkey: 'TR',
  moldova: 'MD', 'rep moldova': 'MD', 'republica moldova': 'MD',
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

let byName: Map<string, string> | null = null

/** Codul e cel în vigoare (nu unul vechi, ca DD sau SU, pe care CLDR îl trimite la cel nou). */
function isCanonical(code: string): boolean {
  try {
    return Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}`
  } catch {
    return false
  }
}

function codes(): string[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  const out: string[] = []
  for (const a of letters) for (const b of letters) {
    const code = a + b
    if (!NOT_COUNTRIES.has(code) && isCanonical(code) && names.of(code)) out.push(code)
  }
  return out
}

let known: Set<string> | null = null

function table(): Map<string, string> {
  if (byName) return byName
  const map = new Map<string, string>()
  const all = codes()
  known = new Set(all)
  for (const locale of LOCALES) {
    let names: Intl.DisplayNames
    try { names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }) } catch { continue }
    for (const code of all) {
      const name = names.of(code)
      if (name) {
        const key = normalize(name)
        if (key && !map.has(key)) map.set(key, code)
      }
    }
  }
  for (const [name, code] of Object.entries(ALIASES)) map.set(normalize(name), code)
  byName = map
  return map
}

/** Numele sau codul unei țări → codul ISO din două litere; null dacă nu e o țară cunoscută. */
export function countryCode(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  const map = table()
  if (/^[A-Za-z]{2}$/.test(v) && known!.has(v.toUpperCase())) return v.toUpperCase()
  // Și „UK", „SUA": prescurtări care nu sunt coduri ISO
  return map.get(normalize(v)) ?? null
}
