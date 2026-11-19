'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarClock, ExternalLink, FileText, Receipt, Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card, CardHeader } from '@/components/app/surface'
import { DataRow, StatCard } from '@/components/app/kpi'
import { Badge } from '@/components/app/badge'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { textActionStyles } from '@/components/app/button'
import { cn } from '@/lib/utils'
import { day, type Formats } from '@/components/app/formats'
import { useMoney } from '@/components/admin/money'
import { addMoney, type Money } from '@/lib/admin/money'
import type { AccountBilling } from '@/lib/admin/billing'

// =============================================
// Fila Facturare din pagina unui cont: ce are de plată și ce e restant, ce a
// plătit, cât ar fi taxa lunii în curs, datele firmei și factura fiecărei luni.
// Acțiunile pe o factură (emiterea din nou, anularea) sunt în pagina Facturi.
// =============================================

export const STATEMENT_TONE: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  free: 'neutral', pending: 'neutral', needs_profile: 'amber', issuing: 'red', invoiced: 'amber', paid: 'green', error: 'red', void: 'neutral',
}

/** „noiembrie 2026”, din „2026-11”. */
export function useMonth() {
  const { intlLocale } = useT()
  const fmt = new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return (period: string) => fmt.format(new Date(`${period.slice(0, 7)}-01T00:00:00Z`))
}

export function AccountBillingTab({ data, loading, f }: { data: AccountBilling | null; loading: boolean; f: Formats }) {
  const { t } = useT()
  const money = useMoney()
  const month = useMonth()

  if (loading && !data) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
  if (!data) return <Callout tone="danger">{t('admin.load_error')}</Callout>

  const b = data.balance
  const fee: Money = {}
  const counted: Money = {}
  for (const s of data.estimate.stores) { addMoney(fee, s.currency, s.amount); addMoney(counted, s.currency, s.sales) }
  const dayFmt = (d: string | null) => (d ? f.date.format(day(d)) : '—')

  return (
    <div className="space-y-4">
      {!data.active && (
        <Callout tone="info" title={t('admin.bill_off_title')}>
          {data.start_date ? t('admin.bill_off_scheduled', { date: dayFmt(data.start_date) }) : t('admin.bill_off_none')}
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.bill_due')} value={money.many(b.due)} icon={<Wallet />} footnote={t('admin.bill_due_hint')} />
        <StatCard label={t('admin.bill_overdue')} value={money.many(b.overdue)} icon={<AlertTriangle />}
          footnote={b.overdue_count ? t('admin.bill_overdue_count', { count: b.overdue_count }) : t('admin.bill_overdue_none')} />
        <StatCard label={t('admin.bill_paid')} value={money.many(b.paid)} icon={<Receipt />} footnote={t('admin.bill_invoiced_total', { amount: money.many(b.invoiced) })} />
        <StatCard label={t('admin.bill_estimate', { month: month(data.estimate.period) })} value={money.many(fee)} icon={<CalendarClock />}
          footnote={t('admin.bill_estimate_hint', { amount: money.many(counted) })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={t('admin.bill_month_title')} description={t('admin.bill_month_hint', { month: month(data.estimate.period) })} />
          {data.estimate.stores.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-[13px] text-neutral-500">{t('admin.acc_no_stores')}</p>
          ) : (
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('admin.col_store')}</Th>
                    <Th align="right">{t('admin.bill_col_counted')}</Th>
                    <Th align="right">{t('admin.bill_col_fee')}</Th>
                    <Th align="right">{t('admin.bill_col_amount')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.estimate.stores.map(s => (
                    <Tr key={s.store_id}>
                      <Td className="font-medium text-neutral-900">{s.store_name}</Td>
                      <Td align="right" className="tabular-nums">{money.one(s.sales, s.currency)}<span className="block text-[12px] text-neutral-400">{t('admin.accounts_orders', { count: s.orders })}</span></Td>
                      <Td align="right" className="tabular-nums">{money.one(s.fee, s.currency)}</Td>
                      <Td align="right" className="tabular-nums font-medium text-neutral-900">{money.one(s.amount, s.currency)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('admin.bill_company_title')} />
          <div className="px-5 pb-4 pt-2">
            {data.profile ? (
              <dl className="divide-y divide-neutral-100">
                <DataRow label={t('admin.bill_company_name')} value={data.profile.name} />
                <DataRow label={t('admin.bill_company_vat')} value={`${data.profile.vat_code}${data.profile.is_vat_payer ? ` · ${t('admin.bill_company_vat_payer')}` : ''}`} />
                {data.profile.reg_com && <DataRow label={t('admin.bill_company_reg')} value={data.profile.reg_com} />}
                <DataRow label={t('admin.bill_company_address')} value={[data.profile.address, data.profile.city, data.profile.county, data.profile.country].filter(Boolean).join(', ')} />
                <DataRow label={t('admin.bill_company_email')} value={data.profile.email} />
              </dl>
            ) : (
              <p className="py-2 text-[13px] text-amber-700">{t('admin.bill_company_missing')}</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={t('admin.bill_statements_title')} description={t('admin.bill_statements_hint')}
          action={<Link href="/admin/invoices" className={cn(textActionStyles, 'text-[13px]')}>{t('admin.nav_invoices')}<ArrowRight /></Link>} />
        {data.statements.length === 0 ? (
          <EmptyState icon={<FileText />} title={t('admin.bill_statements_none')} className="py-12" />
        ) : (
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>{t('admin.inv_col_month')}</Th>
                  <Th className="hidden md:table-cell">{t('admin.col_store')}</Th>
                  <Th align="right">{t('admin.bill_col_counted')}</Th>
                  <Th align="right">{t('admin.bill_col_amount')}</Th>
                  <Th>{t('admin.col_status')}</Th>
                  <Th className="hidden sm:table-cell">{t('admin.inv_col_invoice')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.statements.map(s => (
                  <Tr key={s.id}>
                    <Td className="whitespace-nowrap font-medium capitalize text-neutral-900">{month(s.period)}</Td>
                    <Td className="hidden text-neutral-700 md:table-cell">{s.store_name}</Td>
                    <Td align="right" className="tabular-nums">{money.one(s.sales, s.currency)}<span className="block text-[12px] text-neutral-400">{t('admin.accounts_orders', { count: s.orders_count })}</span></Td>
                    <Td align="right" className="tabular-nums font-medium text-neutral-900">{money.one(s.amount, s.currency)}</Td>
                    <Td><Badge tone={STATEMENT_TONE[s.status] ?? 'neutral'}>{t(`billing.st_${s.status}`)}</Badge></Td>
                    <Td className="hidden whitespace-nowrap text-neutral-700 sm:table-cell">
                      {s.invoice_number ? (
                        <span className="inline-flex items-center gap-1">{s.invoice_series} {s.invoice_number}
                          {s.invoice_url && <a href={s.invoice_url} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-900" aria-label={t('admin.inv_open_pdf')}><ExternalLink className="size-3.5" /></a>}
                        </span>
                      ) : '—'}
                      {s.due_date && <span className="block text-[12px] text-neutral-400">{t('admin.inv_due_on', { date: dayFmt(s.due_date) })}</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
