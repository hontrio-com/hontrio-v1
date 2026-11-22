import { createAdminClient } from '@/lib/supabase/admin'
import { addMoney, type Money } from '@/lib/admin/money'
import { balanceOf, type Balance } from '@/lib/admin/balance'
import { billingConfig, computeStatement, parseStatement, STATEMENT_COLUMNS, STORE_COLUMNS, type StatementRow, type StoreRow } from '@/lib/billing/run'
import { billingActive, todayRo } from '@/lib/billing/schedule'
import { storeDisplayName } from '@/lib/commerce/platforms'

// =============================================
// Facturarea în panoul de administrare: ce are de plată fiecare cont, ce e
// restant, ce s-a încasat, factura fiecărei luni și cât ar fi taxa lunii în
// curs (aceeași socoteală ca la emitere, lib/billing/run.ts). Sumele sunt pe
// monede (lei sau euro, după magazin).
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

export type { Balance }

/** Soldul fiecărui cont (pentru lista conturilor). */
export async function balancesByUser(supabase: Supabase, nowMs: number): Promise<Record<string, Balance>> {
  const { data } = await supabase.from('billing_statements').select('user_id, status, amount, currency, due_date').in('status', ['invoiced', 'paid'])
  const today = todayRo(nowMs)
  const byUser = new Map<string, { status: string; amount: number; currency: 'RON' | 'EUR'; due_date: string | null }[]>()
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (!r.user_id) continue
    const list = byUser.get(String(r.user_id)) ?? []
    list.push({ status: String(r.status), amount: Number(r.amount) || 0, currency: r.currency === 'EUR' ? 'EUR' : 'RON', due_date: (r.due_date as string | null) ?? null })
    byUser.set(String(r.user_id), list)
  }
  return Object.fromEntries([...byUser].map(([id, rows]) => [id, balanceOf(rows, today)]))
}

export type BillingProfile = {
  name: string; vat_code: string; reg_com: string | null; is_vat_payer: boolean; address: string; city: string
  county: string | null; country: string; email: string; updated_at: string | null
}

export type AccountBilling = {
  /** Facturarea a pornit (data de start a trecut) și de când se numără. */
  active: boolean
  start_date: string | null
  profile: BillingProfile | null
  balance: Balance
  statements: StatementRow[]
  /** Luna în curs, pe magazin: ce s-ar factura dacă luna s-ar încheia azi. */
  estimate: { period: string; stores: { store_id: string; store_name: string; currency: string; sales: number; orders: number; fee: number; amount: number }[] }
}

export async function accountBilling(supabase: Supabase, userId: string, nowMs: number): Promise<AccountBilling> {
  const today = todayRo(nowMs)
  const period = today.slice(0, 7)
  const [cfg, profileRes, statementsRes, storesRes] = await Promise.all([
    billingConfig(supabase),
    supabase.from('billing_profiles').select('name, vat_code, reg_com, is_vat_payer, address, city, county, country, email, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('billing_statements').select(STATEMENT_COLUMNS).eq('user_id', userId).order('period', { ascending: false }),
    supabase.from('stores').select(STORE_COLUMNS).eq('user_id', userId).order('created_at'),
  ])
  const statements = (statementsRes.data ?? []).map(r => parseStatement(r as Record<string, unknown>))

  // Luna în curs, socotită ca la emitere; înainte de pornire, ca și cum facturarea ar fi pornit la începutul lunii
  const startDate = cfg.start_date && cfg.start_date > `${period}-01` ? cfg.start_date : `${period}-01`
  const stores = (storesRes.data ?? []) as StoreRow[]
  const estimate = await Promise.all(stores.map(async s => {
    const { statement } = await computeStatement(supabase, s, period, startDate)
    return {
      store_id: s.id, store_name: storeDisplayName(s), currency: statement.currency,
      sales: statement.sales, orders: statement.count, fee: statement.fee, amount: statement.amount,
    }
  }))

  const p = profileRes.data as Record<string, unknown> | null
  return {
    active: billingActive(cfg.start_date, today),
    start_date: cfg.start_date,
    profile: p ? {
      name: String(p.name), vat_code: String(p.vat_code), reg_com: (p.reg_com as string | null) ?? null, is_vat_payer: !!p.is_vat_payer,
      address: String(p.address), city: String(p.city), county: (p.county as string | null) ?? null, country: String(p.country),
      email: String(p.email), updated_at: (p.updated_at as string | null) ?? null,
    } : null,
    balance: balanceOf(statements, today),
    statements,
    estimate: { period, stores: estimate },
  }
}

// ─── Toate facturile ────────────────────────────────────────────────────────

export type InvoiceRow = StatementRow & {
  email: string | null
  /** Firma de pe factură, din datele de facturare ale contului. */
  client: { name: string; vat_code: string } | null
}

export type InvoicesData = {
  today: string
  active: boolean
  start_date: string | null
  invoices: InvoiceRow[]
  totals: {
    /** Emise luna aceasta (după data emiterii), plătite luna aceasta, de încasat, restante. */
    issued_month: Money; paid_month: Money; due: Money; overdue: Money; overdue_count: number; paid_all: Money
  }
}

export async function listInvoices(supabase: Supabase, nowMs: number): Promise<InvoicesData> {
  const today = todayRo(nowMs)
  const monthStart = `${today.slice(0, 7)}-01`
  const [cfg, rowsRes] = await Promise.all([
    billingConfig(supabase),
    supabase.from('billing_statements').select(STATEMENT_COLUMNS).order('period', { ascending: false }).order('store_name').limit(2000),
  ])
  const rows = (rowsRes.data ?? []).map(r => parseStatement(r as Record<string, unknown>))
  const userIds = [...new Set(rows.map(r => r.user_id).filter((x): x is string => !!x))]
  const [usersRes, profilesRes] = userIds.length
    ? await Promise.all([
      supabase.from('users').select('id, email').in('id', userIds),
      supabase.from('billing_profiles').select('user_id, name, vat_code').in('user_id', userIds),
    ])
    : [{ data: [] }, { data: [] }]
  const emails = new Map(((usersRes.data ?? []) as Record<string, unknown>[]).map(u => [String(u.id), String(u.email)]))
  const clients = new Map(((profilesRes.data ?? []) as Record<string, unknown>[]).map(p => [String(p.user_id), { name: String(p.name), vat_code: String(p.vat_code) }]))

  const totals = { issued_month: {} as Money, paid_month: {} as Money, due: {} as Money, overdue: {} as Money, overdue_count: 0, paid_all: {} as Money }
  for (const r of rows) {
    // Ziua emiterii și a plății, după ceasul României
    const issued = r.issued_at ? todayRo(Date.parse(r.issued_at)) : null
    const paid = r.paid_at ? todayRo(Date.parse(r.paid_at)) : null
    if ((r.status === 'invoiced' || r.status === 'paid') && issued && issued >= monthStart) addMoney(totals.issued_month, r.currency, r.amount)
    if (r.status === 'paid') {
      addMoney(totals.paid_all, r.currency, r.amount)
      if (paid && paid >= monthStart) addMoney(totals.paid_month, r.currency, r.amount)
    }
    if (r.status === 'invoiced') {
      addMoney(totals.due, r.currency, r.amount)
      if (r.due_date && r.due_date < today) { addMoney(totals.overdue, r.currency, r.amount); totals.overdue_count++ }
    }
  }

  return {
    today, active: billingActive(cfg.start_date, today), start_date: cfg.start_date,
    invoices: rows.map(r => ({ ...r, email: r.user_id ? emails.get(r.user_id) ?? null : null, client: r.user_id ? clients.get(r.user_id) ?? null : null })),
    totals,
  }
}
