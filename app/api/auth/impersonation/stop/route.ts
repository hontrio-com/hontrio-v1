import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { adminTokenBack, authOptions } from '@/lib/auth/auth.config'
import { writeSession } from '@/lib/auth/impersonation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/auth/impersonation/stop — „Înapoi în admin”: administratorul iese
// din contul clientului. Ieșirea se scrie în jurnal, iar sesiunea redevine a
// lui (dacă între timp nu mai e administrator, iese de tot). E sub /api/auth
// pentru că în contul clientului rolul sesiunii nu e „admin”.
// =============================================

export async function POST(request: NextRequest) {
  const t = await getT()
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, cookieName: authOptions.cookies?.sessionToken?.name })
  if (!token?.id || !token.impersonator) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

  const back = await adminTokenBack(createAdminClient(), token, 'admin')
  const response = NextResponse.json({ ok: true, redirect: back.id ? `/admin/users/${token.id}` : '/login' })
  if (!(await writeSession(response, back))) return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  return response
}
