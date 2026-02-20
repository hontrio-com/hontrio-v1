/**
 * Validate and sanitize a store URL to prevent SSRF attacks
 * Only allows HTTPS URLs pointing to valid domains (no internal IPs)
 */
export function validateStoreUrl(url: string): { valid: boolean; cleaned: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, cleaned: '', error: 'URL invalid' }
  }

  // Trim and remove trailing slashes
  let cleaned = url.trim().replace(/\/+$/, '')

  // Must start with https://
  if (!cleaned.startsWith('https://') && !cleaned.startsWith('http://')) {
    cleaned = 'https://' + cleaned
  }

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  } catch {
    return { valid: false, cleaned: '', error: 'URL invalid. Exemplu: https://magazinul-tau.ro' }
  }

  // Force HTTPS
  if (parsed.protocol !== 'https:') {
    parsed.protocol = 'https:'
    cleaned = parsed.toString().replace(/\/+$/, '')
  }

  // Block internal/private IPs (SSRF protection)
  const hostname = parsed.hostname.toLowerCase()

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, cleaned: '', error: 'URL-urile locale nu sunt permise' }
  }

  // Block private IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number)
    if (
      a === 10 ||                          // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      a === 169 && b === 254 ||            // 169.254.0.0/16 (link-local)
      a === 0                              // 0.0.0.0/8
    ) {
      return { valid: false, cleaned: '', error: 'URL-urile cu IP privat nu sunt permise' }
    }
  }

  // Block special schemas that could be injected
  if (parsed.username || parsed.password) {
    return { valid: false, cleaned: '', error: 'URL-ul nu trebuie să conțină credențiale' }
  }

  // Must have a valid domain (at least one dot)
  if (!hostname.includes('.')) {
    return { valid: false, cleaned: '', error: 'Domeniu invalid. Exemplu: magazin.ro' }
  }

  // Remove path, query, hash — we only want the base URL
  const baseUrl = `${parsed.protocol}//${parsed.host}`

  return { valid: true, cleaned: baseUrl }
}

/**
 * Sanitize text input — strip XSS and limit length
 */
export function sanitizeText(text: string, maxLength: number = 200): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<[^>]*>/g, '')           // Strip HTML tags
    .replace(/javascript:/gi, '')       // Strip JS protocol
    .replace(/on\w+=/gi, '')           // Strip event handlers
    .replace(/[<>"']/g, '')            // Strip dangerous chars
    .trim()
    .substring(0, maxLength)
}