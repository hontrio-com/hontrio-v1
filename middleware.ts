import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Hostname detection ──────────────────────────────────────────────────────
// hontrio.com (no subdomain) → landing/marketing pages
// app.hontrio.com → platform (dashboard, auth, API)
// localhost → both (for development)

const APP_SUBDOMAIN = 'app'
const MAIN_DOMAIN = 'hontrio.com'

function getHostType(request: NextRequest): 'landing' | 'app' {
  const host = request.headers.get('host') || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) return 'app'
  if (host.includes('.vercel.app')) return 'app'
  if (host.startsWith(`${APP_SUBDOMAIN}.`)) return 'app'
  return 'landing'
}

export async function middleware(request: NextRequest) {
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
  const response = NextResponse.next()

  // ===== SECURITY HEADERS =====
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

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
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }

    // Skip auth check for public API routes
    if (
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/stripe/webhook') ||
      pathname.startsWith('/api/cron/') ||
      // Shopify OAuth + webhooks — publice (callback verifică sesiunea manual)
      pathname.startsWith('/api/shopify/install') ||
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
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/auth')
  ) {
    if (token && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  // ===== Protected routes =====
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ===== Onboarding route protection =====
  if (pathname === '/onboarding') {
    if (token.onboardingCompleted === true) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ===== Admin routes =====
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (token.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
    '/images/:path*',
    '/videos/:path*',
    '/credits/:path*',
    '/settings/:path*',
    '/support/:path*',
    '/admin/:path*',
    '/api/user/:path*',
    '/api/stores/:path*',
    '/api/integrations/:path*',
    '/api/products/:path*',
    '/api/catalog/:path*',
    '/api/overview/:path*',
    '/api/recommendations/:path*',
    '/api/images/:path*',
    '/api/generate/:path*',
    '/api/dashboard/:path*',
    '/api/credits/:path*',
    '/api/tickets/:path*',
    '/api/notifications/:path*',
    '/api/upload/:path*',
    '/api/onboarding/:path*',
    '/api/admin/:path*',
    '/api/stripe/checkout',
    '/api/stripe/portal',
    '/api/stripe/credits',
    '/api/brand-kit/:path*',
    '/api/search/:path*',
    '/api/shopify/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
}