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
// Acordul pentru Termeni, cu aceleași două căsuțe ca la înscriere:
// - al unui cont care nu l-a dat la înscriere (contul făcut cu Google,
//   conturile de dinainte de acord);
// - pentru o versiune nouă (anunțul din aplicație): schimbările care cer acord
//   expres (art. 18.2) se aplică doar de la el. Se păstrează versiunea și ora
//   acordului de acum.
// După răspuns, pagina reîmprospătează sesiunea (`update()`).
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
  // Fără acord sau cu o versiune mai veche (cea nouă nu se scrie peste ea însăși)
  const { error } = await supabase.from('users')
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq('id', session.user.id)
    .or(`terms_accepted_at.is.null,terms_version.is.null,terms_version.lt.${TERMS_VERSION}`)
  if (error) {
    logError(ROUTE, 'Acordul nu a putut fi salvat', { userId: session.user.id, error: error.message })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
