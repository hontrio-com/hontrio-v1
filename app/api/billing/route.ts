import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/platforms'
import { salesSource } from '@/lib/commerce/attribution'
import { billingActive, todayRo } from '@/lib/billing/schedule'
import { countsConversions } from '@/lib/billing/statement'
import { billingConfig, computeStatement, parseStatement, STATEMENT_COLUMNS, STORE_COLUMNS, type StoreRow } from '@/lib/billing/run'

// =============================================
// GET /api/billing — facturarea omului: dacă a pornit, datele firmei,
// situațiile lunare cu facturile lor (și comenzile numărate, art. 9.2) și
// luna în curs, până azi, pentru fiecare magazin. La Gomag rândurile sunt
// zilele cu conversii Google Ads (`source: 'google_ads'`).
// =============================================

const ROUTE = '/api/billing'

export async function GET() {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id
  try {
    const supabase = createAdminClient()
    const today = todayRo()
    const [cfg, profileRes, statementsRes, storesRes, userRes] = await Promise.all([
      billingConfig(supabase),
      supabase.from('billing_profiles').select('name, vat_code, reg_com, is_vat_payer, address, city, county, country, email').eq('user_id', userId).maybeSingle(),
      supabase.from('billing_statements').select(STATEMENT_COLUMNS).eq('user_id', userId).order('period', { ascending: false }).limit(36),
      supabase.from('stores').select(STORE_COLUMNS).eq('user_id', userId).in('platform', [...COMMERCE_PLATFORMS]),
      supabase.from('users').select('terms_version').eq('id', userId).maybeSingle(),
    ])
    const active = billingActive(cfg.start_date, today)
    const stores = (storesRes.data ?? []) as StoreRow[]
    const conversionsAllowed = countsConversions(userRes.data?.terms_version as string | null)

    // Luna în curs, până azi: ce s-ar factura (în lansare, doar informativ)
    const period = today.slice(0, 7)
    const preview = []
    for (const store of stores) {
      try {
        const { statement } = await computeStatement(supabase, store, period, active ? cfg.start_date! : `${period}-01`)
        const source = salesSource(store.platform)
        preview.push({
          store_id: store.id, store_name: store.store_name || store.store_url, period, currency: statement.currency,
          sales: statement.sales, fee: statement.fee, orders: statement.orders, count: statement.count,
          source, counted: source === 'store_orders' || conversionsAllowed,
        })
      } catch (err) {
        logApiError(ROUTE, 500, 'Luna în curs nu s-a putut socoti', { storeId: store.id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    const platformOf = new Map(stores.map(s => [s.id, s.platform]))
    const statements = (statementsRes.data ?? []).map(r => {
      const s = parseStatement(r as Record<string, unknown>)
      const fromGoogle = s.orders.some(o => o.source === 'google_ads') || (s.store_id ? salesSource(platformOf.get(s.store_id)) === 'google_ads' : false)
      return {
        id: s.id, store_id: s.store_id, store_name: s.store_name, period: s.period, currency: s.currency,
        sales: s.sales, orders_count: s.orders_count, fee: s.fee, adjustment: s.adjustment, amount: s.amount, status: s.status,
        invoice: s.invoice_number ? `${s.invoice_series} ${s.invoice_number}` : null,
        invoice_url: s.invoice_url, payment_url: s.status === 'invoiced' ? s.payment_url : null,
        due_date: s.due_date, paid_at: s.paid_at, orders: s.orders,
        source: fromGoogle ? 'google_ads' : 'store_orders',
      }
    })

    return NextResponse.json({
      active, start_date: cfg.start_date, notice_sent_at: cfg.notice_sent_at,
      profile: profileRes.data ?? null,
      statements,
      preview,
      suspended: stores.filter(s => s.billing_suspended_at).map(s => ({ store_id: s.id, store_name: s.store_name || s.store_url })),
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Facturarea nu s-a putut citi', { userId, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
