/**
 * Normalizes a URL entered by user:
 * - "competitor.ro" → "https://competitor.ro"
 * - "www.competitor.ro" → "https://www.competitor.ro"
 * - "http://competitor.ro" → kept as is
 * - "https://competitor.ro/products" → kept as is
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ''

  // Already has protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try { new URL(trimmed); return trimmed } catch { return trimmed }
  }

  // Add https://
  const withProtocol = 'https://' + trimmed
  try { new URL(withProtocol); return withProtocol } catch { return withProtocol }
}

export function hostnameOnly(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

/**
 * Extracts a simple SEO score from an analysis object (0-100)
 */
export function calcCompetitorScore(analysis: any): number {
  let n = 0
  if (analysis?.title) {
    const l = analysis.title.length
    n += l >= 50 && l <= 70 ? 25 : l > 0 ? 12 : 0
  }
  if (analysis?.meta_description) {
    const l = analysis.meta_description.length
    n += l >= 120 && l <= 155 ? 25 : l > 0 ? 12 : 0
  }
  if (analysis?.focus_keywords?.length) n += Math.min(analysis.focus_keywords.length * 5, 20)
  if (analysis?.headings?.length) n += Math.min(analysis.headings.length * 3, 15)
  if (analysis?.content_length_estimate > 300) n += 15
  return Math.min(n, 100)
}