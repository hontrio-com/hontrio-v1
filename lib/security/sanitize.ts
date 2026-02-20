// Sanitize HTML content from external sources (WooCommerce, etc.)
// Strips all HTML tags and dangerous content

export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags and content
    .replace(/on\w+="[^"]*"/gi, '')                     // Remove event handlers
    .replace(/on\w+='[^']*'/gi, '')                     // Remove event handlers (single quotes)
    .replace(/<[^>]*>/g, ' ')                            // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Keep safe HTML tags (for displaying descriptions)
const SAFE_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody']

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')

  // Remove tags that aren't in safe list
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    return SAFE_TAGS.includes(tag.toLowerCase()) ? match : ''
  })

  return clean.trim()
}