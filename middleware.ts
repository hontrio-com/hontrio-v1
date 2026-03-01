import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl
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
    ].filter(Boolean)

    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Allow-Credentials', 'true')

    // Preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }

    // Skip auth check for public API routes
    if (
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/stripe/webhook')
    ) {
      return response
    }
  }

  // ===== Public routes =====
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
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
  // If onboarding is completed (in token), redirect to dashboard
  if (pathname === '/onboarding') {
    if (token.onboardingCompleted === true) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Note: Redirect from dashboard->onboarding is handled client-side
  // in the dashboard layout, not middleware, to avoid stale JWT issues

  // ===== Admin routes =====
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (token.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect root
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
    '/products/:path*',
    '/images/:path*',
    '/seo/:path*',
    '/credits/:path*',
    '/settings/:path*',
    '/support/:path*',
    '/admin/:path*',
    '/api/:path*',
    '/login',
    '/register',
  ],
}