import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { accountDetail } from '@/lib/admin/accounts'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/admin/accounts/{id} — un cont pe larg: datele lui, Google, fiecare
// magazin (cu Merchant Center, pilotul, auditul și cifrele pe trei perioade),
// campaniile, ce a făcut pilotul, conectările administratorului, tichetele și
// notificările (lib/admin/accounts.ts).
// =============================================

const ROUTE = '/api/admin/accounts/[id]'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: t('admin.account_not_found') }, { status: 404 })
  try {
    const detail = await accountDetail(createAdminClient(), id, Date.now())
    if (!detail) return NextResponse.json({ error: t('admin.account_not_found') }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    logApiError(ROUTE, 500, 'Contul nu s-a putut citi', { userId: id, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
