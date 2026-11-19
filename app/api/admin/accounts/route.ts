import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAccounts } from '@/lib/admin/accounts'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/admin/accounts — toate conturile, cu magazinele, campaniile și
// cifrele lor pe ultimele 30 de zile (lib/admin/accounts.ts), plus totalurile.
// =============================================

const ROUTE = '/api/admin/accounts'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  try {
    return NextResponse.json(await listAccounts(createAdminClient(), Date.now()))
  } catch (err) {
    logApiError(ROUTE, 500, 'Conturile nu s-au putut citi', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
