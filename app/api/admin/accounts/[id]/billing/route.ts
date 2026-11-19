import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { accountBilling } from '@/lib/admin/billing'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/admin/accounts/{id}/billing — facturarea unui cont: datele firmei,
// soldul (de plată, restant, încasat), facturile lunilor și estimarea lunii în
// curs, pe magazin (lib/admin/billing.ts).
// =============================================

const ROUTE = '/api/admin/accounts/[id]/billing'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: t('admin.account_not_found') }, { status: 404 })
  try {
    return NextResponse.json(await accountBilling(createAdminClient(), id, Date.now()))
  } catch (err) {
    logApiError(ROUTE, 500, 'Facturarea contului nu s-a putut citi', { userId: id, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
