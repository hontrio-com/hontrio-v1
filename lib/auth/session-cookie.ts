import { encode, getToken } from 'next-auth/jwt'
import type { NextRequest, NextResponse } from 'next/server'
import { authOptions } from './auth.config'

// =============================================
// Sesiunea dispozitivului curent, rescrisă cu o versiune nouă: după ce omul își
// schimbă parola de aici, celelalte sesiuni se închid (versiunea a crescut),
// dar el rămâne în cont.
// =============================================

export async function reissueSession(request: NextRequest, response: NextResponse, sessionVersion: number): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET
  const cookie = authOptions.cookies?.sessionToken
  if (!secret || !cookie) return
  const token = await getToken({ req: request, secret, cookieName: cookie.name })
  if (!token?.id) return
  const maxAge = authOptions.session?.maxAge ?? 24 * 60 * 60
  const value = await encode({ token: { ...token, sv: sessionVersion, refreshedAt: Date.now() }, secret, maxAge })
  response.cookies.set(cookie.name, value, { ...cookie.options, maxAge })
}
