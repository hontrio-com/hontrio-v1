import type { NextResponse } from 'next/server'

// =============================================
// Unde se întoarce omul după o conectare (Edinio, Google): conectările pornite
// din onboarding (`?from=onboarding`) se întorc acolo, celelalte în Setări.
// Un cookie scurt ține minte asta cât durează aprobarea în celălalt site.
// =============================================

const COOKIE = 'hontrio_return_to'
const MAX_AGE_SEC = 15 * 60

function build(request: Request, onboarding: boolean, params: Record<string, string>): URL {
  const url = new URL(onboarding ? '/onboarding' : '/settings', request.url)
  if (!onboarding) url.searchParams.set('tab', 'integrations')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

/** Pe cererea care pornește conectarea: ține minte că vine din onboarding. */
export function rememberReturn(request: Request, response: NextResponse): NextResponse {
  if (new URL(request.url).searchParams.get('from') === 'onboarding') {
    response.cookies.set(COOKIE, 'onboarding', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE_SEC,
      path: '/',
      // lax: întoarcerea de pe alt site e o navigare, cookie-ul trebuie să vină cu ea
      sameSite: 'lax',
    })
  }
  return response
}

/** Eșec chiar la pornire (înainte de cookie): după `?from=` din cerere. */
export function startFailureUrl(request: Request, params: Record<string, string>): URL {
  return build(request, new URL(request.url).searchParams.get('from') === 'onboarding', params)
}

/** Adresa de întoarcere din celălalt site, cu rezultatul conectării în parametri. */
export function returnUrl(request: Request, params: Record<string, string>): URL {
  return build(request, /(?:^|;\s*)hontrio_return_to=onboarding(?:;|$)/.test(request.headers.get('cookie') ?? ''), params)
}

/** După întoarcere, cookie-ul nu mai trebuie. */
export function forgetReturn(response: NextResponse): NextResponse {
  response.cookies.delete(COOKIE)
  return response
}
