import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { listInvoices } from '@/lib/admin/billing'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/admin/invoices — toate situațiile lunare și facturile lor, cu firma
// clientului și totalurile (emise și încasate luna aceasta, de încasat,
// restante). Acțiunile pe o factură rămân în POST /api/admin/billing.
// =============================================

const ROUTE = '/api/admin/invoices'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  try {
    return NextResponse.json(await listInvoices(createAdminClient(), Date.now()))
  } catch (err) {
    logApiError(ROUTE, 500, 'Facturile nu s-au putut citi', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
