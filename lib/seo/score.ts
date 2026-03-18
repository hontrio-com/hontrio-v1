// ─── lib/seo/score.ts ────────────────────────────────────────────────────────
// Single source of truth pentru calculul scorului SEO.
// Folosit la: sync (scor initial real), save route, si UI (calcLiveScore).
// ─────────────────────────────────────────────────────────────────────────────

export interface SeoScoreInput {
  title: string
  metaDescription: string
  shortDescription: string  // text plain, fara HTML
  longDescription: string   // text plain, fara HTML
  focusKeyword: string
}

export interface SeoScoreBreakdown {
  label: string
  pts: number
  max: number
  ok: boolean
}

export interface SeoScoreResult {
  score: number
  breakdown: SeoScoreBreakdown[]
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countKeywordOccurrences(text: string, keyword: string): number {
  if (!keyword || !text) return 0
  // Escape special regex chars in keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match whole word or phrase (word boundary aware, including Romanian diacritics)
  const regex = new RegExp(`(?<![a-zA-ZăâîșțĂÂÎȘȚ])${escaped}(?![a-zA-ZăâîșțĂÂÎȘȚ])`, 'gi')
  return (text.match(regex) || []).length
}

export function calculateSeoScore(input: SeoScoreInput): SeoScoreResult {
  const title  = (input.title || '').trim()
  const meta   = (input.metaDescription || '').trim()
  const short  = stripHtml(input.shortDescription || '').trim()
  const long   = stripHtml(input.longDescription || '').trim()
  const kw     = (input.focusKeyword || '').trim().toLowerCase()

  const tLen       = title.length
  const mLen       = meta.length
  const longWords  = long.split(/\s+/).filter(Boolean).length
  const allText    = (short + ' ' + long).toLowerCase()
  const totalWords = allText.split(/\s+/).filter(Boolean).length || 1
  const kwCount    = kw ? countKeywordOccurrences(allText, kw) : 0
  const density    = kw ? (kwCount / totalWords) * 100 : 0

  const breakdown: SeoScoreBreakdown[] = [
    {
      label: `Titlu 50-70 car. (${tLen})`,
      pts:   tLen >= 50 && tLen <= 70 ? 15 : tLen > 0 ? 7 : 0,
      max:   15,
      ok:    tLen >= 50 && tLen <= 70,
    },
    {
      label: 'Keyword în titlu',
      pts:   kw && title.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0,
      max:   10,
      ok:    !kw || title.toLowerCase().includes(kw),
    },
    {
      label: `Meta 120-155 car. (${mLen})`,
      pts:   mLen >= 120 && mLen <= 155 ? 15 : mLen > 0 ? 7 : 0,
      max:   15,
      ok:    mLen >= 120 && mLen <= 155,
    },
    {
      label: 'Keyword în meta',
      pts:   kw && meta.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0,
      max:   10,
      ok:    !kw || meta.toLowerCase().includes(kw),
    },
    {
      label: 'Descriere scurtă',
      pts:   short.length >= 80 ? 15 : short.length > 0 ? 7 : 0,
      max:   15,
      ok:    short.length >= 80,
    },
    {
      label: `Desc. lungă 200+ cuv. (${longWords})`,
      pts:   longWords >= 200 ? 20 : longWords > 0 ? 8 : 0,
      max:   20,
      ok:    longWords >= 200,
    },
    {
      label: 'Focus keyword setat',
      pts:   kw.length >= 2 ? 8 : 0,
      max:   8,
      ok:    kw.length >= 2,
    },
    {
      label: `Density ${density.toFixed(1)}% (0.5-2.5%)`,
      pts:   density >= 0.5 && density <= 2.5 ? 7 : 0,
      max:   7,
      ok:    density >= 0.5 && density <= 2.5,
    },
  ]

  const score = Math.min(100, breakdown.reduce((sum, c) => sum + c.pts, 0))
  return { score, breakdown }
}

// Calculeaza scorul initial real al unui produs din WooCommerce —
// pe baza campurilor originale importate (titlu, desc, short_desc, meta Yoast)
export function calculateInitialSeoScore(product: {
  original_title:             string | null
  original_description:       string | null
  original_short_description: string | null
  meta_description:           string | null
  focus_keyword:              string | null
}): number {
  return calculateSeoScore({
    title:            product.original_title || '',
    metaDescription:  product.meta_description || '',
    shortDescription: product.original_short_description || '',
    longDescription:  product.original_description || '',
    focusKeyword:     product.focus_keyword || '',
  }).score
}