import { encode, type JWT } from 'next-auth/jwt'
import type { NextResponse } from 'next/server'
import { authOptions } from './auth.config'

// =============================================
// Administratorul în contul unui client („Conectare” din panoul de
// administrare). Sesiunea devine a clientului, cu administratorul în ea:
// - cel mult o oră; apoi (sau la „Înapoi în admin”) redevine a lui;
// - doar în conturile care au acceptat Termenii cu accesul echipei pentru
//   suport (impersonation-rules.ts, SUPPORT_ACCESS_TERMS_VERSION);
// - fiecare intrare și ieșire se scrie în admin_impersonations, iar clientul
//   le vede în Setări, la Securitate;
// - nu în contul altui administrator, nici într-unul cu adresa neconfirmată;
// - ce schimbă identitatea contului, accesul la el, datele firmei sau leagă
//   conturi externe din browserul administratorului (Google, Edinio, Shopify)
//   rămâne al clientului: proxy.ts refuză acele cereri.
// Regulile și sesiunea, în impersonation-rules.ts; aici, cookie-ul.
// =============================================

/** Scrie sesiunea în cookie-ul NextAuth, cu aceleași opțiuni (o sesiune goală îl șterge). */
export async function writeSession(response: NextResponse, token: JWT): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET
  const cookie = authOptions.cookies?.sessionToken
  if (!secret || !cookie) return false
  if (!token.id) {
    response.cookies.set(cookie.name, '', { ...cookie.options, maxAge: 0 })
    return true
  }
  const maxAge = authOptions.session?.maxAge ?? 24 * 60 * 60
  response.cookies.set(cookie.name, await encode({ token, secret, maxAge }), { ...cookie.options, maxAge })
  return true
}
