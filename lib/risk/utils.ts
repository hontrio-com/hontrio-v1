/**
 * lib/risk/utils.ts
 * Normalizare date contact pentru identity resolution
 */

/**
 * Normalizează un număr de telefon la format standard.
 * Input: orice format (cu spații, +, 00, 0040, etc.)
 * Output: 10 cifre (RO) sau șir de cifre (internațional), sau null dacă invalid
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Elimină tot ce nu e cifră (spații, +, -, (, ), .)
  let d = raw.replace(/[\s\-\(\)\+\.\u00A0]/g, '')

  // Handle 00 prefix (international dial-out)
  if (d.startsWith('00')) d = d.slice(2)

  // Romanian country code: 40XXXXXXXXX → 0XXXXXXXXX
  if (d.startsWith('40') && d.length === 11) d = '0' + d.slice(2)

  // Romanian mobile/landline: 07XXXXXXXX, 02XXXXXXXX, 03XXXXXXXX
  if (/^0[23-9]\d{8}$/.test(d)) return d

  // Fallback: return cleaned digits if plausible length (international)
  if (d.length >= 7 && d.length <= 15 && /^\d+$/.test(d)) return d

  return null
}

/**
 * Normalizează un email: lowercase + trim
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const n = raw.toLowerCase().trim()
  return n.includes('@') ? n : null
}

/**
 * Normalizează un nume: lowercase, collapse spaces, fără diacritice
 * Folosit DOAR pentru comparație internă, nu pentru stocare
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ăâ]/g, 'a')
    .replace(/î/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculează un scor de similaritate între două șiruri (0-1)
 * Folosit pentru matching names
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1.0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * Scor de confidence pentru identity matching
 * Returns: { confidence: 0-1, reasons: string[], method: string }
 */
export function computeIdentityConfidence(a: {
  externalId?: string | null
  phone?: string | null
  email?: string | null
  name?: string | null
}, b: {
  externalId?: string | null
  phone?: string | null
  email?: string | null
  name?: string | null
}): { confidence: number; reasons: string[]; method: string } {
  const reasons: string[] = []
  let method = 'none'

  // Absolut — același WooCommerce customer_id
  if (a.externalId && b.externalId && a.externalId === b.externalId) {
    return { confidence: 1.0, reasons: ['same_wc_id'], method: 'wc_id' }
  }

  // Absolut — același email normalizat
  const ea = normalizeEmail(a.email), eb = normalizeEmail(b.email)
  if (ea && eb && ea === eb) {
    return { confidence: 0.95, reasons: ['same_email'], method: 'email' }
  }

  // Absolut — același telefon normalizat
  const pa = normalizePhone(a.phone), pb = normalizePhone(b.phone)
  if (pa && pb && pa === pb) {
    return { confidence: 0.90, reasons: ['same_phone'], method: 'phone' }
  }

  // Combinat: telefon parțial + nume similar
  let score = 0, w = 0
  if (pa && pb) {
    // Ultimele 8 cifre comune (prefix diferit)
    if (pa.slice(-8) === pb.slice(-8)) { score += 2.5; w += 3; reasons.push('phone_suffix_match') }
    else { score += stringSimilarity(pa, pb) * 3; w += 3 }
  }
  if (ea && eb) {
    const sim = stringSimilarity(ea, eb)
    score += sim * 2; w += 2
    if (sim > 0.85) reasons.push('email_similar')
  }
  const na = normalizeName(a.name), nb = normalizeName(b.name)
  if (na && nb) {
    const sim = stringSimilarity(na, nb)
    score += sim * 2; w += 2
    if (sim > 0.80) reasons.push('name_similar')
  }

  const confidence = w > 0 ? score / w : 0
  if (confidence >= 0.75) method = 'combined'

  return { confidence: Math.round(confidence * 100) / 100, reasons, method }
}
