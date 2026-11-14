import { createRequire, syncBuiltinESMExports } from 'node:module'

// =============================================
// Rețeaua simulată pentru testele clienților API (Gomag, MerchantPro, OpenCart):
// orice nume de domeniu rezolvă la o adresă publică (fetchPublic își face
// verificările ca de obicei), iar `fetch` ajunge la funcția testului, nu pe
// internet. `restore()` pune totul la loc.
// =============================================

export type Handler = (req: Request, url: URL) => Response | Promise<Response>

export function stubNetwork(handler: Handler) {
  const require = createRequire(import.meta.url)
  const dns = require('node:dns/promises') as { lookup: unknown }
  const realLookup = dns.lookup
  dns.lookup = async () => [{ address: '93.184.216.34', family: 4 }]
  syncBuiltinESMExports()

  const realFetch = globalThis.fetch
  const calls: { url: URL; headers: Headers; method: string }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { cache: _cache, ...rest } = init ?? {}
    void _cache
    const req = new Request(input, rest)
    const url = new URL(req.url)
    calls.push({ url, headers: req.headers, method: req.method })
    return handler(req, url)
  }) as typeof fetch

  return {
    calls,
    restore() {
      globalThis.fetch = realFetch
      dns.lookup = realLookup
      syncBuiltinESMExports()
    },
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const text = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=UTF-8', ...headers } })
