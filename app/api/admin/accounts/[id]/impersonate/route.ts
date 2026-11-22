import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth/auth.config'
import { PROFILE_COLUMNS, type Profile } from '@/lib/auth/session-token'
import { writeSession } from '@/lib/auth/impersonation'
import { impersonationRefusal, impersonationToken, IMPERSONATION_MS } from '@/lib/auth/impersonation-rules'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp } from '@/lib/security/rate-limit'
import { getT } from '@/lib/i18n/server'
import { logApiError, logWarn } from '@/lib/logger'

// =============================================
// POST /api/admin/accounts/{id}/impersonate — administratorul intră în contul
// clientului („Conectare”): intrarea se scrie în jurnal, iar sesiunea din
// browser devine a clientului, cu administratorul în ea, pentru o oră
// (lib/auth/impersonation.ts). Doar în conturile care au acceptat Termenii cu
// accesul echipei pentru suport (art. 10.5). Răspunsul spune unde să meargă pagina.
// =============================================

const ROUTE = '/api/admin/accounts/[id]/impersonate'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  const { id } = await params
  const supabase = createAdminClient()

  // Administratorul, din bază (rolul din sesiune poate fi vechi de un minut)
  const [{ data: adminRow }, { data: targetRow }] = await Promise.all([
    supabase.from('users').select(PROFILE_COLUMNS).eq('id', session.user.id).maybeSingle(),
    supabase.from('users').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
  ])
  const admin = adminRow as Profile | null
  const target = targetRow as Profile | null
  if (!admin || admin.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  const refusal = impersonationRefusal(admin.id, target)
  if (refusal || !target) return NextResponse.json({ error: t(`admin.impersonate_refused_${refusal ?? 'not_found'}`) }, { status: refusal === 'not_found' ? 404 : 400 })

  const now = Date.now()
  const { data: audit, error } = await supabase.from('admin_impersonations').insert({
    admin_id: admin.id, admin_email: admin.email, user_id: target.id, user_email: target.email,
    started_at: new Date(now).toISOString(), expires_at: new Date(now + IMPERSONATION_MS).toISOString(),
    ip: clientIp(request.headers), user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  }).select('id').single()
  if (error || !audit) {
    logApiError(ROUTE, 500, 'Intrarea în cont nu s-a putut scrie în jurnal', { adminId: admin.id, userId: target.id, error: error?.message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }

  // Cum a intrat administratorul (parolă sau Google): sesiunea lui de după îl păstrează
  const own = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, cookieName: authOptions.cookies?.sessionToken?.name })
  const provider = typeof own?.provider === 'string' ? own.provider : 'credentials'
  const token = impersonationToken(target, { id: admin.id, name: admin.name || admin.email, email: admin.email, provider }, audit.id, now)
  const response = NextResponse.json({ ok: true, redirect: target.onboarding_completed ? '/dashboard' : '/onboarding' })
  if (!(await writeSession(response, token))) return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  logWarn('admin/impersonate', 'Administratorul a intrat în contul unui client', { adminId: admin.id, userId: target.id })
  return response
}
