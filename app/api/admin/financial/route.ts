import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLocale, tFor } from '@/lib/i18n/server'
import { INTL_LOCALE } from '@/lib/i18n/config'
import { logApiError } from '@/lib/logger'

// =============================================
// GET /api/admin/financial — încasările și conturile noi, pe ultimele 12 luni.
// Încasările sunt facturile Hontrio plătite (billing_statements, status „paid”),
// în lei și în euro; până pornește facturarea (art. 9.5) sunt 0.
// =============================================

const ROUTE = '/api/admin/financial'

export async function GET() {
  const locale = await getLocale()
  const t = tFor(locale)
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }
    const supabase = createAdminClient()
    const now = new Date()

    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return {
        label: d.toLocaleDateString(INTL_LOCALE[locale], { month: 'short', year: '2-digit' }),
        start: d.toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
      }
    })

    const { data: users, error } = await supabase.from('users').select('created_at').gte('created_at', months[0].start)
    if (error) throw error

    const monthly = months.map(m => ({
      label: m.label,
      newUsers: (users || []).filter(u => u.created_at >= m.start && u.created_at < m.end).length,
    }))

    // Încasările: facturile Hontrio plătite (lunar și de la început), în moneda lor
    const { data: paid, error: ePaid } = await supabase.from('billing_statements').select('amount, currency, paid_at').eq('status', 'paid')
    if (ePaid) throw ePaid
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const sum = (rows: { amount: unknown; currency: unknown }[]) => rows.reduce((acc, r) => {
      const c = r.currency === 'EUR' ? 'EUR' : 'RON'
      acc[c] = Math.round((acc[c] + Number(r.amount || 0)) * 100) / 100
      return acc
    }, { RON: 0, EUR: 0 })
    return NextResponse.json({
      monthly,
      revenue: { thisMonth: sum((paid ?? []).filter(r => r.paid_at && r.paid_at >= monthStart)), allTime: sum(paid ?? []) },
    })
  } catch (err) {
    // Detaliul tehnic rămâne în jurnal; omul primește un mesaj în limba lui
    logApiError(ROUTE, 500, 'Eroare la raportul financiar', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
