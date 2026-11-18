import { createAdminClient } from '@/lib/supabase/admin'
import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'
import { storedMessage } from '@/lib/i18n/stored'
import { logError, logWarn } from '@/lib/logger'
import { notify } from '@/lib/ads/journal'
import { moneyIn, tIn } from '@/lib/ads/emails'
import { readAll } from '@/lib/ads/read-all'
import { COMMERCE_PLATFORMS } from '@/lib/commerce/platforms'
import {
  buildStatement, billable, lastDay, neededRates, periodBounds, periodDate, refundCredit, statementCurrency,
  type BillingOrder, type CountedOrder, type Statement,
} from '@/lib/billing/statement'
import { eurRatesOn } from '@/lib/billing/ecb'
import { createInvoice, paymentStatus, smartBillConfig, SmartBillError, type InvoiceClient, type SmartBillConfig } from '@/lib/billing/smartbill'
import { addDays, BILLING_TZ, countFrom, DUE_DAYS, dunningStep, periodToClose, SUSPEND_AFTER, todayRo } from '@/lib/billing/schedule'
import {
  dueReminderMail, finalReminderMail, invoiceMail, noticeMail, paidMail, profileMissingMail, sendBillingEmail, suspendedMail,
} from '@/lib/billing/emails'

// =============================================
// Facturarea, pas cu pas (cronul zilnic /api/cron/billing și administrarea):
//   1. închiderea lunii trecute, din ziua 15: situația fiecărui magazin
//      (comenzile numărate, taxa, creditul din rambursări), salvată o dată;
//   2. emiterea facturii în SmartBill: rândul se „ia” întâi (issuing), ca
//      două rulări să nu emită de două ori; un răspuns pierdut lasă rândul
//      în issuing, de rezolvat din administrare (nu se reîncearcă singur);
//   3. plățile, din SmartBill: plătită → paid (și pilotul repornește);
//      neplătită → amintiri, apoi pilotul se oprește (art. 13).
// =============================================

type Supabase = ReturnType<typeof createAdminClient>

const ORDER_COLUMNS = 'id, order_number, external_id, placed_at, state, payment_status, currency, subtotal, discount, tax, total, utm_campaign'
export const STATEMENT_COLUMNS = 'id, user_id, store_id, store_name, period, currency, sales, orders_count, fee, adjustment, amount, credit_carry, orders, adjusted_orders, status, invoice_series, invoice_number, invoice_url, payment_url, invoice_total, issued_at, due_date, paid_at, reminders, error'
const OPEN_STATUSES = ['pending', 'needs_profile', 'error']
/** Pauza dintre două apeluri SmartBill (limita: 30 la 10 secunde, apoi blocare 10 minute). */
const SMARTBILL_GAP_MS = 400

export type StatementRow = {
  id: string; user_id: string | null; store_id: string | null; store_name: string; period: string
  currency: 'RON' | 'EUR'; sales: number; orders_count: number; fee: number; adjustment: number; amount: number; credit_carry: number
  orders: CountedOrder[]; adjusted_orders: { id: string; value: number }[]; status: string
  invoice_series: string | null; invoice_number: string | null; invoice_url: string | null; payment_url: string | null
  invoice_total: number | null; issued_at: string | null; due_date: string | null; paid_at: string | null; reminders: number; error: string | null
}

type StoreRow = { id: string; user_id: string; store_name: string | null; store_url: string; currency: string | null; timezone: string | null; billing_suspended_at: string | null }
const STORE_COLUMNS = 'id, user_id, store_name, store_url, currency, timezone, billing_suspended_at'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const storeLabel = (s: Pick<StoreRow, 'store_name' | 'store_url'>) => s.store_name?.trim() || s.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '')

export function parseStatement(r: Record<string, unknown>): StatementRow {
  return {
    ...(r as unknown as StatementRow),
    period: String(r.period).slice(0, 7),
    sales: num(r.sales), orders_count: num(r.orders_count), fee: num(r.fee), adjustment: num(r.adjustment),
    amount: num(r.amount), credit_carry: num(r.credit_carry), reminders: num(r.reminders),
    invoice_total: r.invoice_total === null || r.invoice_total === undefined ? null : num(r.invoice_total),
    orders: Array.isArray(r.orders) ? (r.orders as CountedOrder[]) : [],
    adjusted_orders: Array.isArray(r.adjusted_orders) ? (r.adjusted_orders as { id: string; value: number }[]) : [],
  }
}

/** Luna „AAAA-LL” în limba omului: „noiembrie 2026”. */
export function monthLabel(period: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`))
}

/** O zi „AAAA-LL-ZZ” în limba omului: „25 decembrie 2026”. */
export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

// ─── Configurarea ────────────────────────────────────────────────────────────

export type BillingConfigRow = { start_date: string | null; notice_sent_at: string | null }

export async function billingConfig(supabase: Supabase): Promise<BillingConfigRow> {
  const { data } = await supabase.from('billing_config').select('start_date, notice_sent_at').eq('id', 1).maybeSingle()
  return { start_date: data?.start_date ?? null, notice_sent_at: data?.notice_sent_at ?? null }
}

// ─── Situația unei luni ──────────────────────────────────────────────────────

export type ComputedStatement = { statement: Statement; adjusted: { id: string; value: number }[] }

/**
 * Situația unei luni pentru un magazin: comenzile lunii, creditul din comenzile facturate
 * rambursate între timp și cel rămas din luna trecută. `startDate` = de când se numără.
 */
export async function computeStatement(supabase: Supabase, store: StoreRow, period: string, startDate: string, opts: { ignoreStatementId?: string } = {}): Promise<ComputedStatement> {
  const tz = store.timezone || BILLING_TZ
  const { from, to } = periodBounds(period, tz)
  const orders = await readAll<BillingOrder>((a, b) => supabase.from('commerce_orders').select(ORDER_COLUMNS)
    .eq('store_id', store.id).gte('placed_at', from).lt('placed_at', to).order('placed_at', { ascending: true }).range(a, b))

  const hontrioIds = orders.filter(o => (o.utm_campaign ?? '').toLowerCase().startsWith('hontrio-')).map(o => o.id)
  const excluded = new Set<string>()
  for (let i = 0; i < hontrioIds.length; i += 500) {
    const { data } = await supabase.from('billing_exclusions').select('order_id').in('order_id', hontrioIds.slice(i, i + 500))
    for (const r of data ?? []) excluded.add(r.order_id as string)
  }

  // Lunile de dinainte ale magazinului: creditul din rambursări și cel rămas
  const { data: priorRows } = await supabase.from('billing_statements').select(STATEMENT_COLUMNS)
    .eq('store_id', store.id).lt('period', periodDate(period)).order('period', { ascending: true })
  const priors = (priorRows ?? []).map(r => parseStatement(r as Record<string, unknown>)).filter(r => r.id !== opts.ignoreStatementId)
  const adjustedBefore = new Set(priors.flatMap(p => p.adjusted_orders.map(a => a.id)))
  const adjusted: { id: string; value: number }[] = []
  let credit = priors.length ? priors[priors.length - 1].credit_carry : 0
  for (const p of priors.filter(r => r.status === 'invoiced' || r.status === 'paid')) {
    const open = p.orders.filter(o => !adjustedBefore.has(o.id))
    if (!open.length) continue
    const ids = open.map(o => o.id)
    const [{ data: now }, { data: contested }] = await Promise.all([
      supabase.from('commerce_orders').select('id, state, payment_status').in('id', ids),
      supabase.from('billing_exclusions').select('order_id').in('order_id', ids),
    ])
    // Rambursată, anulată sau scoasă din calcul după o contestație: se întoarce ca și credit
    const gone = new Set([
      ...(now ?? []).filter(o => !billable(o as { state: string; payment_status: string | null })).map(o => o.id as string),
      ...(contested ?? []).map(r => r.order_id as string),
    ])
    const refunds = open.filter(o => gone.has(o.id))
    if (!refunds.length) continue
    const alreadyRefunded = p.orders.filter(o => adjustedBefore.has(o.id)).reduce((s, o) => s + o.value, 0)
    credit += refundCredit({ id: p.id, currency: p.currency, sales: p.sales, refunded_value: alreadyRefunded, new_refunds: refunds.reduce((s, o) => s + o.value, 0) })
    adjusted.push(...refunds.map(o => ({ id: o.id, value: o.value })))
  }

  const currency = statementCurrency(store.currency)
  const rates = await eurRatesOn(neededRates(orders, currency), lastDay(period))
  const statement = buildStatement({
    period, storeCurrency: store.currency, timeZone: tz, orders, excluded,
    startDate: countFrom(period, startDate), rates, credit,
  })
  return { statement, adjusted }
}

// ─── Emiterea ────────────────────────────────────────────────────────────────

type Profile = InvoiceClient & { user_id: string }

/** Emite factura unei situații (dacă se poate). Întoarce starea în care a rămas rândul. */
export async function issueStatement(supabase: Supabase, row: StatementRow, cfg: SmartBillConfig | null, today: string): Promise<string> {
  if (!row.user_id || row.amount <= 0) return row.status
  const { data: profileRow } = await supabase.from('billing_profiles').select('user_id, name, vat_code, reg_com, is_vat_payer, address, city, county, country, email').eq('user_id', row.user_id).maybeSingle()
  const profile = profileRow as Profile | null

  if (!profile) {
    if (row.status !== 'needs_profile') {
      await supabase.from('billing_statements').update({ status: 'needs_profile', updated_at: new Date().toISOString() }).eq('id', row.id)
      await sendBillingEmail(row.user_id, (t, locale) => profileMissingMail(t, { store: row.store_name, month: monthLabel(row.period, locale), amount: moneyIn(locale, row.currency)(row.amount) }))
      await notify(supabase, row.user_id, 'warning', storedMessage('billing.notif_profile_title'), storedMessage('billing.notif_profile_body', { store: row.store_name }))
    }
    return 'needs_profile'
  }
  if (!cfg) {
    logError('billing', 'SmartBill nu este configurat: factura așteaptă', { statementId: row.id })
    return row.status
  }

  // Rândul se ia înainte de apel: o altă rulare nu-l mai găsește deschis
  const { data: claimed } = await supabase.from('billing_statements').update({ status: 'issuing', error: null, updated_at: new Date().toISOString() })
    .eq('id', row.id).in('status', OPEN_STATUSES).select('id')
  if (!claimed?.length) return row.status

  const invoiceLocale: Locale = profile.country.toUpperCase() === 'RO' ? 'ro' : 'en'
  const t = tIn(invoiceLocale)
  const money = moneyIn(invoiceLocale, row.currency)
  const month = monthLabel(row.period, invoiceLocale)
  const dueDate = addDays(today, DUE_DAYS)
  const mentions = [
    t('billing.invoice_mentions', { count: row.orders_count, sales: money(row.sales), month }),
    ...(row.adjustment < 0 ? [t('billing.invoice_credit', { amount: money(-row.adjustment) })] : []),
    t('billing.invoice_list', { url: 'app.hontrio.com/settings?tab=billing' }),
  ].join(' ')

  try {
    const inv = await createInvoice(cfg, {
      client: profile, currency: row.currency, amount: row.amount, issueDate: today, dueDate,
      line: t('billing.invoice_line', { month, store: row.store_name }), mentions,
    })
    await supabase.from('billing_statements').update({
      status: 'invoiced', invoice_series: inv.series, invoice_number: inv.number, invoice_url: inv.viewUrl, payment_url: inv.payUrl,
      invoice_total: row.amount, issued_at: new Date().toISOString(), due_date: dueDate, updated_at: new Date().toISOString(),
      // Emisă, dar cu o problemă raportată de SmartBill (de exemplu, fără link de plată): o vede administrarea
      error: inv.warning,
    }).eq('id', row.id)
    if (inv.warning) logWarn('billing', 'Factura s-a emis cu un avertisment SmartBill', { statementId: row.id, warning: inv.warning })
    const number = `${inv.series} ${inv.number}`
    await sendBillingEmail(row.user_id, (tt, locale) => invoiceMail(tt, {
      store: row.store_name, month: monthLabel(row.period, locale), amount: moneyIn(locale, row.currency)(row.amount),
      due: dayLabel(dueDate, locale), number, viewUrl: inv.viewUrl, payUrl: inv.payUrl,
    }), profile.email)
    await notify(supabase, row.user_id, 'info', storedMessage('billing.notif_invoice_title', { number }), storedMessage('billing.notif_invoice_body', { store: row.store_name, amount: money(row.amount) }))
    return 'invoiced'
  } catch (err) {
    if (err instanceof SmartBillError) {
      // SmartBill a răspuns cu o eroare: factura nu există, se poate încerca din nou
      await supabase.from('billing_statements').update({ status: 'error', error: err.message, updated_at: new Date().toISOString() }).eq('id', row.id)
      logError('billing', 'SmartBill a refuzat factura', { statementId: row.id, status: err.status, error: err.message })
      return 'error'
    }
    // Fără răspuns (timp depășit, rețea): poate s-a emis. Rămâne „issuing”, de verificat în SmartBill
    await supabase.from('billing_statements').update({ error: storedMessage('billing.error_unknown_result'), updated_at: new Date().toISOString() }).eq('id', row.id)
    logError('billing', 'Rezultat necunoscut la emiterea facturii: de verificat în SmartBill', { statementId: row.id, error: err instanceof Error ? err.message : String(err) })
    return 'issuing'
  }
}

// ─── Închiderea lunii ────────────────────────────────────────────────────────

export type CloseSummary = { period: string | null; created: number; free: number; issued: number; waiting: number; errors: string[] }

export async function closeMonth(supabase: Supabase, today: string, deadline: number): Promise<CloseSummary> {
  const summary: CloseSummary = { period: null, created: 0, free: 0, issued: 0, waiting: 0, errors: [] }
  const cfg = await billingConfig(supabase)
  const period = periodToClose(today, cfg.start_date)
  if (!period || !cfg.start_date) return summary
  summary.period = period
  const sb = smartBillConfig()

  const { data: stores, error } = await supabase.from('stores').select(STORE_COLUMNS).in('platform', [...COMMERCE_PLATFORMS])
  if (error) { summary.errors.push(`stores: ${error.message}`); return summary }

  for (const store of (stores ?? []) as StoreRow[]) {
    if (Date.now() > deadline) { summary.errors.push('deadline'); break }
    try {
      const { data: existing } = await supabase.from('billing_statements').select(STATEMENT_COLUMNS).eq('store_id', store.id).eq('period', periodDate(period)).maybeSingle()
      let row = existing ? parseStatement(existing as Record<string, unknown>) : null
      if (!row) {
        const { statement, adjusted } = await computeStatement(supabase, store, period, cfg.start_date)
        // i18n-ignore: rezumat tehnic pentru jurnalul cronului
        if (statement.missingRates.length) { summary.errors.push(`${store.id}: curs BCE lipsă ${statement.missingRates.join(',')}`); continue }
        const { data: inserted, error: eIns } = await supabase.from('billing_statements').insert({
          user_id: store.user_id, store_id: store.id, store_name: storeLabel(store), period: periodDate(period), currency: statement.currency,
          sales: statement.sales, orders_count: statement.orders.length, fee: statement.fee, adjustment: statement.adjustment,
          amount: statement.amount, credit_carry: statement.credit_carry, orders: statement.orders, adjusted_orders: adjusted,
          status: statement.amount > 0 ? 'pending' : 'free',
        }).select(STATEMENT_COLUMNS).single()
        // Altă rulare a salvat-o între timp (cheia magazin + lună): o lăsăm pe aceea
        if (eIns || !inserted) { if (eIns && !/duplicate/i.test(eIns.message)) summary.errors.push(`${store.id}: ${eIns.message}`); continue }
        row = parseStatement(inserted as Record<string, unknown>)
        summary.created++
        if (row.status === 'free') { summary.free++; continue }
      }
      if (!OPEN_STATUSES.includes(row.status)) continue
      const status = await issueStatement(supabase, row, sb, today)
      if (status === 'invoiced') summary.issued++
      else summary.waiting++
      await sleep(SMARTBILL_GAP_MS)
    } catch (err) {
      summary.errors.push(`${store.id}: ${err instanceof Error ? err.message : String(err)}`)
      logError('billing', 'Situația lunii nu s-a putut închide', { storeId: store.id, period, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return summary
}

// ─── Plățile și neplata ──────────────────────────────────────────────────────

export type PaymentSummary = { checked: number; paid: number; reminded: number; suspended: number; errors: string[] }

/** Pilotul magazinului repornește dacă nu mai are o factură trecută de termenul de suspendare. */
async function resumeIfClear(supabase: Supabase, storeId: string, today: string): Promise<boolean> {
  const { data: store } = await supabase.from('stores').select('billing_suspended_at').eq('id', storeId).maybeSingle()
  if (!store?.billing_suspended_at) return false
  const { data: open } = await supabase.from('billing_statements').select('due_date').eq('store_id', storeId).eq('status', 'invoiced')
  const blocking = (open ?? []).some(r => r.due_date && addDays(String(r.due_date), SUSPEND_AFTER) <= today)
  if (blocking) return false
  await supabase.from('stores').update({ billing_suspended_at: null }).eq('id', storeId)
  return true
}

export async function checkPayments(supabase: Supabase, today: string, deadline: number): Promise<PaymentSummary> {
  const summary: PaymentSummary = { checked: 0, paid: 0, reminded: 0, suspended: 0, errors: [] }
  const sb = smartBillConfig()
  if (!sb) return summary
  const { data: rows } = await supabase.from('billing_statements').select(STATEMENT_COLUMNS).eq('status', 'invoiced').order('due_date', { ascending: true })

  for (const raw of rows ?? []) {
    if (Date.now() > deadline) { summary.errors.push('deadline'); break }
    const row = parseStatement(raw as Record<string, unknown>)
    if (!row.invoice_series || !row.invoice_number || !row.due_date) continue
    const number = `${row.invoice_series} ${row.invoice_number}`
    try {
      const pay = await paymentStatus(sb, row.invoice_series, row.invoice_number)
      summary.checked++
      await sleep(SMARTBILL_GAP_MS)
      if (pay.paid) {
        await supabase.from('billing_statements').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.id)
        summary.paid++
        const resumed = row.store_id ? await resumeIfClear(supabase, row.store_id, today) : false
        if (row.user_id) {
          await sendBillingEmail(row.user_id, t => paidMail(t, { number, resumed }))
          await notify(supabase, row.user_id, 'success', storedMessage('billing.notif_paid_title', { number }), storedMessage(resumed ? 'billing.notif_paid_resumed' : 'billing.notif_paid_body'))
        }
        continue
      }
      if (!row.user_id) continue
      const { data: store } = row.store_id ? await supabase.from('stores').select('billing_suspended_at').eq('id', row.store_id).maybeSingle() : { data: null }
      const step = dunningStep({ due_date: String(row.due_date).slice(0, 10), reminders: row.reminders, suspended: !!store?.billing_suspended_at || !row.store_id }, today)
      if (step === 'remind_due') {
        await sendBillingEmail(row.user_id, (t, locale) => dueReminderMail(t, { number, amount: moneyIn(locale, row.currency)(row.amount), due: dayLabel(String(row.due_date).slice(0, 10), locale), payUrl: row.payment_url }))
        await supabase.from('billing_statements').update({ reminders: 1, last_reminder_at: new Date().toISOString() }).eq('id', row.id)
        summary.reminded++
      } else if (step === 'remind_final') {
        const suspendOn = addDays(String(row.due_date).slice(0, 10), SUSPEND_AFTER)
        await sendBillingEmail(row.user_id, (t, locale) => finalReminderMail(t, { number, amount: moneyIn(locale, row.currency)(row.amount), store: row.store_name, suspendOn: dayLabel(suspendOn, locale), payUrl: row.payment_url }))
        await notify(supabase, row.user_id, 'warning', storedMessage('billing.notif_final_title', { number }), storedMessage('billing.notif_final_body', { store: row.store_name }))
        await supabase.from('billing_statements').update({ reminders: 2, last_reminder_at: new Date().toISOString() }).eq('id', row.id)
        summary.reminded++
      } else if (step === 'suspend' && row.store_id) {
        const { data: done } = await supabase.from('stores').update({ billing_suspended_at: new Date().toISOString() }).eq('id', row.store_id).is('billing_suspended_at', null).select('id')
        if (done?.length) {
          await sendBillingEmail(row.user_id, t => suspendedMail(t, { number, store: row.store_name, payUrl: row.payment_url }))
          await notify(supabase, row.user_id, 'error', storedMessage('billing.notif_suspended_title', { store: row.store_name }), storedMessage('billing.notif_suspended_body', { number }))
          summary.suspended++
        }
      }
    } catch (err) {
      summary.errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`)
      logError('billing', 'Plata nu s-a putut verifica', { statementId: row.id, error: err instanceof Error ? err.message : String(err) })
      // O blocare SmartBill (429) oprește rularea: următoarele apeluri ar prelungi blocarea
      if (err instanceof SmartBillError && err.status === 429) break
    }
  }

  // Facturile rămase fără răspuns de la SmartBill: le vede administratorul
  const { data: stuck } = await supabase.from('billing_statements').select('id').eq('status', 'issuing').lt('updated_at', new Date(Date.now() - 3_600_000).toISOString())
  if (stuck?.length) logWarn('billing', 'Facturi cu rezultat necunoscut, de verificat în SmartBill', { ids: stuck.map(s => s.id) })
  return summary
}

// ─── Pornirea facturării ─────────────────────────────────────────────────────

/** Salvează data de pornire și trimite anunțul de 30 de zile tuturor (e-mail și în aplicație). */
export async function startBilling(supabase: Supabase, startDate: string, adminId: string): Promise<{ notified: number; emailed: number }> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('billing_config').update({ start_date: startDate, notice_sent_at: now, updated_at: now, updated_by: adminId }).eq('id', 1)
  if (error) throw new Error(error.message)
  const { data: users } = await supabase.from('users').select('id, email_verified_at, role')
  const list = (users ?? []).filter(u => u.role !== 'admin')
  if (list.length) {
    await supabase.from('notifications').insert(list.map(u => ({
      user_id: u.id, type: 'info', is_read: false,
      title: storedMessage('billing.notif_notice_title'), message: storedMessage('billing.notif_notice_body', { date: startDate }),
    })))
  }
  let emailed = 0
  for (const u of list.filter(x => x.email_verified_at)) {
    if (await sendBillingEmail(u.id as string, (t, locale) => noticeMail(t, { start: dayLabel(startDate, locale) }))) emailed++
    await sleep(600)
  }
  return { notified: list.length, emailed }
}

/** Ziua de azi pentru facturare (România). */
export const billingToday = () => todayRo()
