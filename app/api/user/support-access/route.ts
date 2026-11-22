import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowsSupportAccess } from '@/lib/auth/impersonation-rules'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/user/support-access — intrările echipei Hontrio în contul tău, pentru
// suport (Termeni, art. 10.5): când a intrat și când a ieșit, din jurnalul
// admin_impersonations. Plus dacă regula ți se aplică (versiunea acceptată).
// =============================================

const ROUTE = '/api/user/support-access'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id
  const supabase = createAdminClient()
  const [{ data: user }, { data: rows, error }] = await Promise.all([
    supabase.from('users').select('terms_version').eq('id', userId).maybeSingle(),
    supabase.from('admin_impersonations').select('id, started_at, expires_at, ended_at').eq('user_id', userId).order('started_at', { ascending: false }).limit(50),
  ])
  if (error) {
    logApiError(ROUTE, 500, 'Jurnalul accesului nu s-a putut citi', { userId, error: error.message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
  return NextResponse.json({
    allowed: allowsSupportAccess((user?.terms_version as string | null) ?? null),
    entries: (rows ?? []).map(r => ({ id: r.id, started_at: r.started_at, ended_at: r.ended_at ?? (Date.parse(r.expires_at) < Date.now() ? r.expires_at : null) })),
  })
}
