'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, ChevronRight, FileText, Receipt, Search, Wallet, WalletCards } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Select } from '@/components/app/input'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Callout, EmptyState } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { day, useFormats } from '@/components/app/formats'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton } from '@/components/admin/parts'
import { useMoney } from '@/components/admin/money'
import { STATEMENT_TONE, useMonth } from '@/components/admin/account-billing'
import { InvoiceSheet } from '@/components/admin/invoice-sheet'
import type { InvoiceRow, InvoicesData } from '@/lib/admin/billing'

// =============================================
// Facturile Hontrio: ce s-a facturat și încasat luna aceasta, ce e de încasat
// și ce e restant, apoi toate situațiile lunare (cu factură sau fără), cu
// căutare și filtre. Un rând deschide factura: sumele, clientul, comenzile
// numărate și acțiunile pe ea.
// =============================================

type Filter = 'all' | 'due' | 'overdue' | 'paid' | 'problems' | 'not_invoiced' | 'void'

const matches = (r: InvoiceRow, filter: Filter, today: string) => {
  const overdue = r.status === 'invoiced' && !!r.due_date && r.due_date < today
  switch (filter) {
    case 'due': return r.status === 'invoiced'
    case 'overdue': return overdue
    case 'paid': return r.status === 'paid'
    case 'problems': return ['error', 'issuing', 'needs_profile'].includes(r.status)
    case 'not_invoiced': return r.status === 'free' || r.status === 'pending'
    case 'void': return r.status === 'void'
    default: return true
  }
}

export default function InvoicesPage() {
  const { t } = useT()
  const f = useFormats('RON')
  const money = useMoney()
  const month = useMonth()
  const { data, loading, refresh } = useAdminData<InvoicesData>('/api/admin/invoices')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [period, setPeriod] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const periods = useMemo(() => [...new Set((data?.invoices ?? []).map(r => r.period))].sort().reverse(), [data])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.invoices ?? []).filter(r =>
      matches(r, filter, data?.today ?? '') && (period === 'all' || r.period === period)
      && (!q || [r.store_name, r.email, r.client?.name, r.client?.vat_code, r.invoice_number, `${r.invoice_series ?? ''}${r.invoice_number ?? ''}`]
        .some(v => (v ?? '').toLowerCase().includes(q))))
  }, [data, search, filter, period])

  if (loading && !data) return <PageSkeleton tiles={4} />
  if (!data?.invoices) return <LoadError />
  const totals = data.totals
  const open = data.invoices.find(r => r.id === openId) ?? null
  const dayFmt = (d: string | null) => (d ? f.date.format(day(d)) : '—')

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_invoices')} description={t('admin.inv_description')} actions={<RefreshButton loading={loading} onClick={refresh} />} />

      {!data.active && (
        <Callout tone="info" title={t('admin.bill_off_title')}
          action={<Button asChild size="sm"><Link href="/admin/financial">{t('admin.inv_go_financial')}<ArrowRight /></Link></Button>}>
          {data.start_date ? t('admin.bill_off_scheduled', { date: dayFmt(data.start_date) }) : t('admin.inv_off_none')}
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.inv_issued_month')} value={money.many(totals.issued_month)} icon={<FileText />} footnote={t('admin.inv_issued_month_hint')} />
        <StatCard label={t('admin.inv_paid_month')} value={money.many(totals.paid_month)} icon={<Wallet />} footnote={t('admin.inv_paid_all', { amount: money.many(totals.paid_all) })} />
        <StatCard label={t('admin.inv_due')} value={money.many(totals.due)} icon={<WalletCards />} footnote={t('admin.bill_due_hint')} />
        <StatCard label={t('admin.inv_overdue_total')} value={money.many(totals.overdue)} icon={<AlertTriangle />}
          footnote={totals.overdue_count ? t('admin.bill_overdue_count', { count: totals.overdue_count }) : t('admin.bill_overdue_none')} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input icon={<Search />} wrapperClassName="flex-1" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.inv_search')} />
        <Select value={filter} onChange={e => setFilter(e.target.value as Filter)} wrapperClassName="sm:w-56" aria-label={t('admin.accounts_filter')}>
          {(['all', 'due', 'overdue', 'paid', 'problems', 'not_invoiced', 'void'] as const).map(v => <option key={v} value={v}>{t(`admin.inv_filter_${v}`)}</option>)}
        </Select>
        <Select value={period} onChange={e => setPeriod(e.target.value)} wrapperClassName="sm:w-48" aria-label={t('admin.inv_col_month')}>
          <option value="all">{t('admin.inv_all_months')}</option>
          {periods.map(p => <option key={p} value={p}>{month(p)}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<Receipt />} title={data.invoices.length ? t('admin.inv_none_filtered') : t('admin.inv_none')}
            description={data.invoices.length ? undefined : t('admin.inv_none_hint')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('admin.inv_col_invoice')}</Th>
                <Th className="min-w-[200px]">{t('admin.inv_col_client')}</Th>
                <Th className="hidden md:table-cell">{t('admin.inv_col_month')}</Th>
                <Th align="right" className="hidden lg:table-cell">{t('admin.bill_col_counted')}</Th>
                <Th align="right">{t('admin.bill_col_amount')}</Th>
                <Th className="hidden xl:table-cell">{t('admin.inv_col_issued')}</Th>
                <Th className="hidden sm:table-cell">{t('admin.inv_col_due')}</Th>
                <Th>{t('admin.col_status')}</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const overdue = r.status === 'invoiced' && !!r.due_date && r.due_date < data.today
                return (
                  <Tr key={r.id} clickable tabIndex={0} onClick={() => setOpenId(r.id)} onKeyDown={e => { if (e.key === 'Enter') setOpenId(r.id) }}>
                    <Td className="whitespace-nowrap font-medium text-neutral-900">{r.invoice_number ? `${r.invoice_series ?? ''} ${r.invoice_number}`.trim() : <span className="font-normal text-neutral-400">{t('admin.inv_no_invoice')}</span>}</Td>
                    <Td>
                      <p className="truncate text-neutral-900">{r.client?.name ?? r.store_name}</p>
                      <p className="truncate text-[12px] text-neutral-500">{r.client ? `${r.store_name} · ${r.email ?? ''}` : r.email ?? '—'}</p>
                    </Td>
                    <Td className="hidden whitespace-nowrap capitalize text-neutral-700 md:table-cell">{month(r.period)}</Td>
                    <Td align="right" className="hidden tabular-nums text-neutral-700 lg:table-cell">{money.one(r.sales, r.currency)}</Td>
                    <Td align="right" className="tabular-nums font-medium text-neutral-900">{money.one(r.amount, r.currency)}</Td>
                    <Td className="hidden whitespace-nowrap text-neutral-500 xl:table-cell">{r.issued_at ? f.date.format(new Date(r.issued_at)) : '—'}</Td>
                    <Td className={`hidden whitespace-nowrap sm:table-cell ${overdue ? 'font-medium text-red-600' : 'text-neutral-500'}`}>{dayFmt(r.due_date)}</Td>
                    <Td><Badge tone={overdue ? 'red' : STATEMENT_TONE[r.status] ?? 'neutral'}>{overdue ? t('admin.inv_overdue') : t(`billing.st_${r.status}`)}</Badge></Td>
                    <Td><ChevronRight className="size-4 text-neutral-300" /></Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <InvoiceSheet invoice={open} today={data.today} f={f} onClose={() => setOpenId(null)} onChanged={refresh} />
    </FadeIn>
  )
}
