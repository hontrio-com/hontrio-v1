/**
 * Identity Clustering — detectează același client care comandă cu identități multiple
 * Algoritmul: normalizează numele + adresa + orașul și calculează similaritate
 * Dacă 2+ clienți au similaritate >75% → sunt același client → se agregă istoricul
 */

// ─── Normalizare text românesc ─────────────────────────────────────────────────
export function normalizeRomanian(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // diacritice
    .replace(/[ăâ]/g, 'a')
    .replace(/î/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Distanță Levenshtein normalizată ─────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
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
  const na = normalizeRomanian(a)
  const nb = normalizeRomanian(b)
  if (na === nb) return 1.0
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1.0
  return 1 - levenshtein(na, nb) / maxLen
}

// ─── Score similaritate compus ────────────────────────────────────────────────
export type ClusterCandidate = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  shipping_address: string | null
  city: string | null
}

export function computeClusterScore(a: ClusterCandidate, b: ClusterCandidate): number {
  let score = 0
  let weight = 0

  // Telefon identic → match absolut
  if (a.phone && b.phone) {
    const pA = a.phone.replace(/\s/g, '')
    const pB = b.phone.replace(/\s/g, '')
    if (pA === pB) return 1.0  // same phone = same person
    weight += 3
    // Ultimele 8 cifre comune (poate fi prefix diferit)
    if (pA.slice(-8) === pB.slice(-8)) { score += 2.5; }
    else score += stringSimilarity(pA, pB) * 3
  }

  // Email identic → match absolut
  if (a.email && b.email) {
    const eA = a.email.toLowerCase()
    const eB = b.email.toLowerCase()
    if (eA === eB) return 1.0
    weight += 2
    score += stringSimilarity(eA, eB) * 2
  }

  // Nume similar
  if (a.name && b.name) {
    weight += 2
    score += stringSimilarity(a.name, b.name) * 2
  }

  // Adresă similară
  if (a.shipping_address && b.shipping_address) {
    weight += 2
    score += stringSimilarity(a.shipping_address, b.shipping_address) * 2
  }

  // Același oraș
  if (a.city && b.city) {
    weight += 1
    if (normalizeRomanian(a.city) === normalizeRomanian(b.city)) score += 1
  }

  return weight > 0 ? score / weight : 0
}

// ─── Cluster matching pentru un client nou față de lista existentă ─────────────
export type ClusterMatch = {
  matchedCustomerId: string
  similarity: number
  matchReason: string[]
}

export function findClusterMatches(
  candidate: ClusterCandidate,
  existingCustomers: ClusterCandidate[],
  threshold = 0.72
): ClusterMatch[] {
  const matches: ClusterMatch[] = []

  for (const existing of existingCustomers) {
    if (existing.id === candidate.id) continue

    const sim = computeClusterScore(candidate, existing)
    if (sim >= threshold) {
      const reasons: string[] = []

      if (candidate.phone && existing.phone) {
        const pA = candidate.phone.replace(/\s/g, '')
        const pB = existing.phone.replace(/\s/g, '')
        if (pA.slice(-8) === pB.slice(-8)) reasons.push('telefon similar')
      }
      if (candidate.email && existing.email &&
          stringSimilarity(candidate.email, existing.email) > 0.8) {
        reasons.push('email similar')
      }
      if (candidate.name && existing.name &&
          stringSimilarity(candidate.name, existing.name) > 0.8) {
        reasons.push('nume similar')
      }
      if (candidate.shipping_address && existing.shipping_address &&
          stringSimilarity(candidate.shipping_address, existing.shipping_address) > 0.75) {
        reasons.push('adresă similară')
      }

      matches.push({
        matchedCustomerId: existing.id,
        similarity: Math.round(sim * 100),
        matchReason: reasons,
      })
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity)
}

// ─── Extrage orașul dintr-o adresă completă ───────────────────────────────────
export function extractCity(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim())
  // Orașele sunt de obicei al 2-3-lea element
  for (const part of parts.slice(1, 4)) {
    if (part.length > 2 && part.length < 30 && !/\d/.test(part)) {
      return part
    }
  }
  return parts[parts.length - 1] || null
}