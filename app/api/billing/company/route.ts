import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { rateLimitAsync } from '@/lib/security/rate-limit'
import { cleanCui, lookupCompany, validCui } from '@/lib/billing/anaf'

// =============================================
// GET /api/billing/company?cui=… — datele unei firme românești din serviciul
// public ANAF, ca omul să nu le scrie de mână. La ANAF ajunge doar CUI-ul.
// =============================================

const ROUTE = '/api/billing/company'

export async function GET(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const rl = await rateLimitAsync(`billing-anaf:${session.user.id}`, 20, 60 * 60 * 1000)
  if (!rl.success) return NextResponse.json({ error: t('api.rate_limited') }, { status: 429 })

  const cui = cleanCui(new URL(request.url).searchParams.get('cui') ?? '')
  if (!cui || !validCui(cui)) return NextResponse.json({ error: t('billing.err_cui') }, { status: 400 })
  try {
    const company = await lookupCompany(cui)
    if (!company) return NextResponse.json({ error: t('billing.anaf_not_found') }, { status: 404 })
    return NextResponse.json({ company })
  } catch (err) {
    logApiError(ROUTE, 502, 'ANAF nu a răspuns', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('billing.anaf_unavailable') }, { status: 502 })
  }
}
