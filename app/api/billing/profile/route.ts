import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { checkProfile } from '@/lib/billing/profile'

// =============================================
// PUT /api/billing/profile — datele firmei pentru factura Hontrio (SmartBill
// și e-Factura): denumirea, codul fiscal, Registrul Comerțului, sediul și
// adresa la care vine factura. O factură blocată pe lipsa lor pleacă la
// următoarea rulare a facturării.
// =============================================

const ROUTE = '/api/billing/profile'

export async function PUT(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id
  const rl = await rateLimitAsync(`billing-profile:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const checked = checkProfile(body)
  if (!checked.ok) return NextResponse.json({ error: t(checked.error), field: checked.field }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('billing_profiles').upsert({ user_id: userId, ...checked.profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    logApiError(ROUTE, 500, 'Datele de facturare nu s-au salvat', { userId, error: error.message })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
  return NextResponse.json({ profile: checked.profile })
}
