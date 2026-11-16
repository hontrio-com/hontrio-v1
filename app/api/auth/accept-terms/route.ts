import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { TERMS_VERSION } from '@/lib/auth/validation'
import { logError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/auth/accept-terms — { accept_terms: true, accept_clauses: true }
//
// Acordul unui cont care nu l-a dat la înscriere (contul făcut cu Google,
// conturile de dinainte de acord), cu aceleași două căsuțe ca la înscriere.
// Rămâne primul acord dat. După răspuns, pagina reîmprospătează sesiunea
// (`update()`), ca proxy-ul să lase contul mai departe.
// =============================================

const ROUTE = '/api/auth/accept-terms'

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })

  const body = await request.json().catch(() => null) as { accept_terms?: unknown; accept_clauses?: unknown } | null
  if (body?.accept_terms !== true || body?.accept_clauses !== true) {
    return NextResponse.json({ error: t('auth.terms_gate_required') }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('users')
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq('id', session.user.id)
    .is('terms_accepted_at', null)
  if (error) {
    logError(ROUTE, 'Acordul nu a putut fi salvat', { userId: session.user.id, error: error.message })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
