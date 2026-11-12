import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LOCALE_COOKIE, SOURCE_LOCALE, detectLocale, isLocale } from '@/lib/i18n/config'
import { MESSAGES } from '@/lib/i18n/dictionaries'
import { createT } from '@/lib/i18n/translate'

// ─── Hostname detection ──────────────────────────────────────────────────────
// hontrio.com (no subdomain) → landing/marketing pages
// app.hontrio.com → platform (dashboard, auth, API)
// localhost → both (for development)
//
// Antetele de securitate (CSP, HSTS, X-Frame-Options...) vin din next.config.ts,
// pentru toate rutele.

const APP_SUBDOMAIN = 'app'
const MAIN_DOMAIN = 'hontrio.com'

function getHostType(request: NextRequest): 'landing' | 'app' {
  const host = request.headers.get('host') || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) return 'app'
  if (host.includes('.vercel.app')) return 'app'
  if (host.startsWith(`${APP_SUBDOMAIN}.`)) return 'app'
  return 'landing'
}

/** Mesajul de refuz, în limba cererii (alegerea din cookie, altfel țara și browserul). */
function forbidden(request: NextRequest) {
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = isLocale(chosen) ? chosen : detectLocale(request.headers.get('x-vercel-ip-country'), request.headers.get('accept-language'))
  const t = createT(locale, MESSAGES[locale], locale === SOURCE_LOCALE ? undefined : MESSAGES[SOURCE_LOCALE])
  return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
}

// Paginile de cont: deschise fără sesiune
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostType = getHostType(request)

  // ═══════════════════════════════════════════════════════════════════════════
  // LANDING DOMAIN (hontrio.com) — only serve public pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (hostType === 'landing') {
    if (
      pathname === '/' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      /\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2|mp4|webm|ogg|mp3|wav)$/.test(pathname)
    ) {
      return NextResponse.next()
    }
    // Any platform route on bare domain → redirect to app.hontrio.com
    const appUrl = new URL(pathname, `https://${APP_SUBDOMAIN}.${MAIN_DOMAIN}`)
    appUrl.search = request.nextUrl.search
    return NextResponse.redirect(appUrl)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APP DOMAIN (app.hontrio.com) — full platform with auth
  // ═══════════════════════════════════════════════════════════════════════════
  const token = await getToken({ req: request })
  // O sesiune retrasă (parolă schimbată, cont șters) rămâne în cookie fără `id`
  const authed = typeof token?.id === 'string' && token.id.length > 0
  const response = NextResponse.next()

  // ===== CORS for API routes =====
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || ''
    const allowedOrigins = [
      process.env.NEXTAUTH_URL || 'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL || '',
      `https://${MAIN_DOMAIN}`,
      `https://${APP_SUBDOMAIN}.${MAIN_DOMAIN}`,
    ].filter(Boolean)

    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Vary', 'Origin')
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }

    // Rutele publice: autentificarea, cronurile (secretul lor) și întoarcerea din Shopify
    // (callback-ul verifică singur sesiunea; webhook-urile, semnătura)
    if (
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/cron/') ||
      pathname.startsWith('/api/shopify/callback') ||
      pathname.startsWith('/api/shopify/webhooks')
    ) {
      return response
    }
  }

  // ===== Static media files — always public (public/ folder) =====
  if (/\.(mp4|webm|ogg|mp3|wav|svg|png|jpg|jpeg|gif|ico|pdf)$/.test(pathname)) {
    return response
  }

  // ===== Public routes =====
  if (AUTH_PAGES.some(p => pathname.startsWith(p)) || pathname.startsWith('/api/auth')) {
    if (authed && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ===== Protected routes =====
  if (!authed) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ===== Onboarding route protection =====
  if (pathname === '/onboarding') {
    if (token?.onboardingCompleted === true) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ===== Admin routes =====
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (token?.role !== 'admin') {
      if (pathname.startsWith('/api/')) return forbidden(request)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Root on app subdomain → go to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/onboarding',
    '/dashboard/:path*',
    '/campaigns/:path*',
    '/products/:path*',
    '/recommendations/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/support/:path*',
    '/admin/:path*',
    '/api/user/:path*',
    '/api/stores/:path*',
    '/api/integrations/:path*',
    '/api/catalog/:path*',
    '/api/overview/:path*',
    '/api/recommendations/:path*',
    '/api/campaigns/:path*',
    '/api/tickets/:path*',
    '/api/notifications/:path*',
    '/api/onboarding/:path*',
    '/api/admin/:path*',
    '/api/search/:path*',
    '/api/shopify/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ],
}
