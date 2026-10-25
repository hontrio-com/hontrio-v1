// =============================================
// Edinio — configurarea legăturii (Hontrio e clientul OAuth al Edinio)
// =============================================

export const EDINIO_CLIENT_ID = 'hontrio'

export type EdinioErrorCode =
  | 'not_configured' | 'unauthorized' | 'rate_limited' | 'unavailable'
  | 'invalid_grant' | 'bad_response' | 'network' | 'timeout'

export class EdinioError extends Error {
  constructor(message: string, public code: EdinioErrorCode, public status?: number) {
    super(message)
  }
}

/**
 * Adresa Edinio și secretul clientului Hontrio.
 * EDINIO_CLIENT_SECRET are aceeași valoare ca HONTRIO_CLIENT_SECRET în Edinio.
 */
export function getEdinioConfig(): { baseUrl: string; clientSecret: string } {
  const baseUrl = (process.env.EDINIO_BASE_URL || 'https://www.edinio.com').replace(/\/+$/, '')
  const clientSecret = process.env.EDINIO_CLIENT_SECRET || ''
  if (clientSecret.length < 32) {
    throw new EdinioError('EDINIO_CLIENT_SECRET lipsește sau e prea scurt', 'not_configured')
  }
  return { baseUrl, clientSecret }
}

export function isEdinioConfigured(): boolean {
  try { getEdinioConfig(); return true } catch { return false }
}

// Trebuie să fie EXACT una din adresele din HONTRIO_REDIRECT_URIS (Edinio),
// caracter cu caracter. O derivăm din originea cererii, ca la Google, ca să
// meargă la fel pe localhost:3002 și pe app.hontrio.com.
export function getEdinioRedirectUri(requestUrl: string): string {
  return `${new URL(requestUrl).origin}/api/integrations/edinio/callback`
}
