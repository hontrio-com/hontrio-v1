import type { NextConfig } from "next";

// Unde poate trimite un formular (form-action): site-ul și serverele la care
// pleacă omul să aprobe o conectare (Google, Shopify, Edinio).
const edinioOrigin = (() => {
  try { return new URL(process.env.EDINIO_BASE_URL || 'https://www.edinio.com').origin } catch { return 'https://www.edinio.com' }
})()
const FORM_TARGETS = ["'self'", 'https://accounts.google.com', 'https://*.myshopify.com', 'https://accounts.shopify.com', edinioOrigin]

// O politică de conținut prudentă: nu atinge scripturile, stilurile sau imaginile
// (Google Analytics, Turnstile, imaginile magazinelor merg ca până acum); oprește
// încadrarea în alte site-uri, schimbarea adresei de bază și pluginurile.
const CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  `form-action ${FORM_TARGETS.join(' ')}`,
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Doar pentru `next dev`: site-ul se deschide local și de pe adresa din rețea (unde
  // se vede partea de prezentare). Fără ea, Next 16 blochează scripturile de dezvoltare
  // cerute de pe acea adresă și paginile nu mai devin interactive.
  allowedDevOrigins: ['192.168.1.137'],
  // Prețurile nu mai au pagina lor (14.11.2026): sunt o secțiune pe prima pagină.
  // Adresa veche (și cea a site-ului dinainte) duce acolo.
  async redirects() {
    return [{ source: '/pricing', destination: '/#pricing', permanent: true }]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          // Doi ani; fără includeSubDomains/preload până nu sunt toate subdomeniile pe HTTPS
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
