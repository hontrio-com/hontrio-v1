import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { logApiError } from '@/lib/logger'
import { addDays, billingActive, DUE_DAYS, earliestStart, todayRo } from '@/lib/billing/schedule'
import { invoiceSeries, smartBillConfig } from '@/lib/billing/smartbill'
import { billingConfig, computeStatement, issueStatement, parseStatement, startBilling, STATEMENT_COLUMNS } from '@/lib/billing/run'

// =============================================
// /api/admin/billing — facturarea, pentru administrator.
// GET: pornirea, configurarea SmartBill (seria există?) și situațiile tuturor.
// POST { action }:
//   start { start_date }   pornește facturarea și trimite anunțul de 30 de zile
//   stop                   oprește o pornire programată (încă neîncepută)
//   exclude { order_id, reason }  scoate o comandă contestată; situația
//                                 nefacturată se recalculează, cea facturată
//                                 dă credit în luna următoare
//   retry { statement_id }         emite din nou o factură refuzată de SmartBill
//   resolve { statement_id, series?, number?, view_url? }
//                                  factura cu rezultat necunoscut: există în
//                                  SmartBill (cu seria și numărul) sau nu
//   void { statement_id }          factura anulată în SmartBill
//   unsuspend { store_id }         repornește pilotul unui magazin
// =============================================

const ROUTE = '/api/admin/billing'
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

async function admin() {
  const session = await getServerSession(authOptions)
  return session?.user && session.user.role === 'admin' ? session.user : null
}

export async function GET() {
  const t = await getT()
  if (!(await admin())) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  try {
    const supabase = createAdminClient()
    const today = todayRo()
    const cfg = await billingConfig(supabase)
    const sb = smartBillConfig()
    let smartbill: { configured: boolean; series_ok: boolean | null; card_link: boolean; error: string | null } = { configured: !!sb, series_ok: null, card_link: !!sb?.cardLink, error: null }
    if (sb) {
      try { smartbill = { ...smartbill, series_ok: (await invoiceSeries(sb)).includes(sb.series) } } catch (err) { smartbill.error = err instanceof Error ? err.message : String(err) }
    }
    const { data: rows } = await supabase.from('billing_statements').select(STATEMENT_COLUMNS).order('period', { ascending: false }).limit(300)
    const statements = (rows ?? []).map(r => parseStatement(r as Record<string, unknown>))
    const userIds = [...new Set(statements.map(s => s.user_id).filter((x): x is string => !!x))]
    const { data: users } = userIds.length ? await supabase.from('users').select('id, email').in('id', userIds) : { data: [] }
    const emails = new Map((users ?? []).map(u => [u.id as string, u.email as string]))
    const { data: suspended } = await supabase.from('stores').select('id, store_name, store_url, billing_suspended_at').not('billing_suspended_at', 'is', null)
    return NextResponse.json({
      today, active: billingActive(cfg.start_date, today), start_date: cfg.start_date, notice_sent_at: cfg.notice_sent_at,
      earliest_start: earliestStart(today), smartbill,
      statements: statements.map(s => ({ ...s, email: s.user_id ? emails.get(s.user_id) ?? null : null })),
      suspended: (suspended ?? []).map(s => ({ store_id: s.id, store_name: s.store_name || s.store_url, since: s.billing_suspended_at })),
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Facturarea nu s-a putut citi', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const t = await getT()
  const user = await admin()
  if (!user) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const action = typeof body?.action === 'string' ? body.action : ''
  const supabase = createAdminClient()
  const today = todayRo()
  const str = (k: string) => (typeof body?.[k] === 'string' ? (body[k] as string).trim() : '')

  try {
    if (action === 'start') {
      const start = str('start_date')
      if (!DAY_RE.test(start) || start < earliestStart(today)) return NextResponse.json({ error: t('billing.admin_err_start', { date: earliestStart(today) }) }, { status: 400 })
      const cfg = await billingConfig(supabase)
      if (billingActive(cfg.start_date, today)) return NextResponse.json({ error: t('billing.admin_err_already_active') }, { status: 400 })
      return NextResponse.json(await startBilling(supabase, start, user.id))
    }

    if (action === 'stop') {
      const cfg = await billingConfig(supabase)
      if (billingActive(cfg.start_date, today)) return NextResponse.json({ error: t('billing.admin_err_already_active') }, { status: 400 })
      await supabase.from('billing_config').update({ start_date: null, updated_at: new Date().toISOString(), updated_by: user.id }).eq('id', 1)
      return NextResponse.json({ ok: true })
    }

    if (action === 'unsuspend') {
      await supabase.from('stores').update({ billing_suspended_at: null }).eq('id', str('store_id'))
      return NextResponse.json({ ok: true })
    }

    if (action === 'exclude') {
      const orderId = str('order_id')
      const reason = str('reason').slice(0, 500)
      if (!orderId || !reason) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
      const { error } = await supabase.from('billing_exclusions').upsert({ order_id: orderId, reason, created_by: user.id }, { onConflict: 'order_id' })
      if (error) throw new Error(error.message)
      // Situația încă nefacturată care o conține se recalculează; una facturată dă credit luna următoare
      const { data: rows } = await supabase.from('billing_statements').select(STATEMENT_COLUMNS).in('status', ['pending', 'needs_profile', 'error', 'free'])
      const cfg = await billingConfig(supabase)
      for (const raw of rows ?? []) {
        const s = parseStatement(raw as Record<string, unknown>)
        if (!s.orders.some(o => o.id === orderId) || !s.store_id || !cfg.start_date) continue
        const { data: store } = await supabase.from('stores').select('id, user_id, store_name, store_url, currency, timezone, billing_suspended_at').eq('id', s.store_id).maybeSingle()
        if (!store) continue
        const { statement, adjusted } = await computeStatement(supabase, store, s.period, cfg.start_date, { ignoreStatementId: s.id })
        await supabase.from('billing_statements').update({
          sales: statement.sales, orders_count: statement.orders.length, fee: statement.fee, adjustment: statement.adjustment,
          amount: statement.amount, credit_carry: statement.credit_carry, orders: statement.orders, adjusted_orders: adjusted,
          status: statement.amount > 0 ? (s.status === 'free' ? 'pending' : s.status) : 'free', updated_at: new Date().toISOString(),
        }).eq('id', s.id)
      }
      return NextResponse.json({ ok: true })
    }

    const id = str('statement_id')
    const { data: raw } = id ? await supabase.from('billing_statements').select(STATEMENT_COLUMNS).eq('id', id).maybeSingle() : { data: null }
    if (!raw) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
    const row = parseStatement(raw as Record<string, unknown>)

    if (action === 'retry') {
      if (row.status !== 'error' && row.status !== 'needs_profile' && row.status !== 'pending') return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
      const status = await issueStatement(supabase, row, smartBillConfig(), today)
      return NextResponse.json({ status })
    }

    if (action === 'resolve') {
      if (row.status !== 'issuing') return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
      const series = str('series')
      const number = str('number')
      if (series && number) {
        const issued = (row.issued_at ?? new Date().toISOString()).slice(0, 10)
        await supabase.from('billing_statements').update({
          status: 'invoiced', invoice_series: series, invoice_number: number, invoice_url: str('view_url') || null,
          invoice_total: row.amount, issued_at: new Date().toISOString(), due_date: addDays(issued, DUE_DAYS), error: null, updated_at: new Date().toISOString(),
        }).eq('id', row.id)
      } else {
        // Nu există în SmartBill: se poate emite din nou
        await supabase.from('billing_statements').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', row.id)
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'void') {
      await supabase.from('billing_statements').update({ status: 'void', updated_at: new Date().toISOString() }).eq('id', row.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  } catch (err) {
    logApiError(ROUTE, 500, 'Acțiunea de facturare a eșuat', { action, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
