import { lookup } from 'node:dns/promises'
import type { Params } from '@/lib/i18n/translate'

// =============================================
// Adresele magazinelor pe care le cheamă serverul (WooCommerce): numai HTTPS,
// numai nume publice, care rezolvă la adrese publice. Altfel un „magazin"
// ar putea trimite serverul spre rețeaua internă (SSRF).
//
// - validateStoreUrl: forma adresei, la conectare (fără rețea)
// - assertPublicHost: numele rezolvat în DNS nu duce la o adresă privată
// - fetchPublic: fetch cu redirecționările urmate de mână, fiecare verificată;
//   o redirecționare spre altă origine se oprește (cheia API ar pleca acolo)
//
// Cheile de eroare sunt din secțiunea `sync`, pentru t() în rute sau storedMessage().
// =============================================

/** Porturile acceptate (implicit, adică 443, sau 8443). */
const ALLOWED_PORTS = ['', '443', '8443']

// Domeniile care nu sunt pe internetul public
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp']

export type StoreUrlCheck = { valid: boolean; cleaned: string; error?: string }

/** Forma adresei: HTTPS, un domeniu public (sau un IPv4 public), fără date de logare. Întoarce doar originea. */
export function validateStoreUrl(url: unknown): StoreUrlCheck {
  if (!url || typeof url !== 'string' || url.length > 2048) return { valid: false, cleaned: '', error: 'sync.store_url_invalid' }

  let cleaned = url.trim().replace(/\/+$/, '')
  // Altă schemă decât http(s) (ftp://, file://...): nu e adresa unui magazin
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned) && !/^https?:\/\//i.test(cleaned)) return { valid: false, cleaned: '', error: 'sync.store_url_invalid' }
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  } catch {
    return { valid: false, cleaned: '', error: 'sync.store_url_invalid' }
  }
  // Magazinul se cheamă doar prin HTTPS (cheia API nu pleacă necriptată)
  if (parsed.protocol === 'http:') parsed.protocol = 'https:'
  if (parsed.protocol !== 'https:') return { valid: false, cleaned: '', error: 'sync.store_url_invalid' }
  if (parsed.username || parsed.password) return { valid: false, cleaned: '', error: 'sync.store_url_credentials' }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname) return { valid: false, cleaned: '', error: 'sync.store_url_invalid' }
  if (hostname === 'localhost' || LOCAL_SUFFIXES.some(s => hostname.endsWith(s))) {
    return { valid: false, cleaned: '', error: 'sync.store_url_local' }
  }
  // Un IP scris direct: doar unul public (IPv6 nu, mai jos: fără punct nu e domeniu)
  if (parseIPv4(hostname) !== null || hostname.startsWith('[')) {
    if (isBlockedAddress(hostname)) return { valid: false, cleaned: '', error: 'sync.store_url_private_ip' }
  }
  if (!hostname.includes('.')) return { valid: false, cleaned: '', error: 'sync.store_url_domain' }
  if (!ALLOWED_PORTS.includes(parsed.port)) return { valid: false, cleaned: '', error: 'sync.store_url_port' }

  return { valid: true, cleaned: `https://${hostname}${parsed.port ? `:${parsed.port}` : ''}` }
}

// ─── Adresele IP care nu se cheamă niciodată ─────────────────────────────────

/** IPv4 → număr pe 32 de biți; null dacă nu e un IPv4 scris zecimal cu puncte. */
export function parseIPv4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some(p => p > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

// Rețelele private, locale, rezervate și de documentare (RFC 6890 și urmașii)
const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]
const V4_RANGES = V4_BLOCKED.map(([base, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return { net: (parseIPv4(base)! & mask) >>> 0, mask }
})

function isBlockedV4(n: number): boolean {
  return V4_RANGES.some(r => ((n & r.mask) >>> 0) === r.net)
}

/** IPv6 → cele 8 grupuri de 16 biți; null dacă nu e un IPv6 valid. Acceptă [..], zona (%eth0) și IPv4 la coadă. */
export function parseIPv6(input: string): number[] | null {
  let ip = input.trim().toLowerCase()
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1)
  const zone = ip.indexOf('%')
  if (zone !== -1) ip = ip.slice(0, zone)
  if (!ip.includes(':')) return null

  const lastColon = ip.lastIndexOf(':')
  const last = ip.slice(lastColon + 1)
  if (last.includes('.')) {
    const v4 = parseIPv4(last)
    if (v4 === null) return null
    ip = `${ip.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`
  }

  const halves = ip.split('::')
  if (halves.length > 2) return null
  const groupsOf = (s: string) => (s === '' ? [] : s.split(':'))
  const head = groupsOf(halves[0])
  const tail = halves.length === 2 ? groupsOf(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out.length === 8 ? out : null
}

function isBlockedV6(g: number[]): boolean {
  const zeros = (from: number, to: number) => g.slice(from, to).every(x => x === 0)
  const v4At = (hi: number, lo: number) => ((hi << 16) >>> 0) + lo
  // ::, ::1, IPv4 compatibil (::a.b.c.d) și mapat (::ffff:a.b.c.d): după adresa IPv4 din ele
  if (zeros(0, 5) && (g[5] === 0 || g[5] === 0xffff)) return isBlockedV4(v4At(g[6], g[7])) || zeros(0, 8)
  // NAT64 (64:ff9b::/96 după IPv4-ul din el; 64:ff9b:1::/48, de uz local)
  if (g[0] === 0x64 && g[1] === 0xff9b) return g[2] === 1 || isBlockedV4(v4At(g[6], g[7]))
  // 6to4 (2002::/16): IPv4-ul e în grupurile 1–2
  if (g[0] === 0x2002) return isBlockedV4(v4At(g[1], g[2]))
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0x0db8)) return true // Teredo, documentare
  if (g[0] === 0x100 && zeros(1, 4)) return true // discard (100::/64)
  if ((g[0] & 0xfe00) === 0xfc00) return true // unique local (fc00::/7)
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true // link-local, site-local
  if ((g[0] & 0xff00) === 0xff00) return true // multicast
  return false
}

/** O adresă IP privată, locală, rezervată sau de neînțeles. */
export function isBlockedAddress(ip: string): boolean {
  const v4 = parseIPv4(ip.replace(/^\[|\]$/g, ''))
  if (v4 !== null) return isBlockedV4(v4)
  const v6 = parseIPv6(ip)
  return v6 ? isBlockedV6(v6) : true
}

// ─── DNS ─────────────────────────────────────────────────────────────────────

export type Resolver = (hostname: string) => Promise<string[]>

const systemResolver: Resolver = async (hostname) => (await lookup(hostname, { all: true, verbatim: true })).map(a => a.address)

/** O cerere refuzată înainte să plece: adresa nu e publică sau magazinul trimite în altă parte. */
export class PublicFetchError extends Error {
  constructor(message: string, public code: 'blocked' | 'redirect' | 'invalid', public key: string, public params?: Params) {
    super(message)
  }
}

// Numele verificate recent (o sincronizare face sute de cereri spre același magazin)
const checked = new Map<string, number>()
const CHECK_TTL_MS = 60_000

/** Numele rezolvă doar la adrese publice. O eroare DNS (ENOTFOUND) trece mai departe, ca eroare de rețea. */
export async function assertPublicHost(hostname: string, resolve: Resolver = systemResolver): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (host === 'localhost' || LOCAL_SUFFIXES.some(s => host.endsWith(s))) {
    throw new PublicFetchError(`Adresă locală: ${host}`, 'blocked', 'sync.store_url_local')
  }
  if (parseIPv4(host) !== null || host.includes(':')) {
    if (isBlockedAddress(host)) throw new PublicFetchError(`Adresă privată: ${host}`, 'blocked', 'sync.store_url_private_ip')
    return
  }
  if (resolve === systemResolver && (checked.get(host) ?? 0) > Date.now()) return
  const addresses = await resolve(host)
  if (!addresses.length || addresses.some(isBlockedAddress)) {
    throw new PublicFetchError(`${host} rezolvă la o adresă privată`, 'blocked', 'sync.store_url_private_ip')
  }
  if (resolve === systemResolver) checked.set(host, Date.now() + CHECK_TTL_MS)
}

const MAX_REDIRECTS = 3

/**
 * fetch spre un magazin: doar HTTPS, doar adrese publice, redirecționările urmate
 * de mână și doar în aceeași origine (cheia din antet nu pleacă la altcineva).
 */
export async function fetchPublic(url: string | URL, init: RequestInit = {}, opts: { resolve?: Resolver } = {}): Promise<Response> {
  let current = new URL(url)
  for (let hop = 0; ; hop++) {
    if (current.protocol !== 'https:' || current.username || current.password || !ALLOWED_PORTS.includes(current.port)) {
      throw new PublicFetchError(`Adresă nepermisă: ${current.origin}`, 'invalid', 'sync.store_url_invalid')
    }
    await assertPublicHost(current.hostname, opts.resolve)
    const res = await fetch(current, { ...init, redirect: 'manual' })
    if (res.status < 300 || res.status >= 400 || res.status === 304) return res
    const location = res.headers.get('location')
    if (!location) return res
    await res.body?.cancel().catch(() => {})
    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      throw new PublicFetchError('Redirecționare spre o adresă invalidă', 'invalid', 'sync.store_url_invalid')
    }
    if (next.origin !== current.origin) {
      throw new PublicFetchError(`Magazinul redirecționează spre ${next.origin}`, 'redirect', 'sync.store_redirects', { url: next.origin })
    }
    if (hop >= MAX_REDIRECTS) throw new PublicFetchError('Prea multe redirecționări', 'redirect', 'sync.store_redirect_loop')
    current = next
  }
}
