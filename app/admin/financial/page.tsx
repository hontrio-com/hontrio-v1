'use client'

import { useState } from 'react'
import { DollarSign, Download, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardFooter, CardHeader } from '@/components/app/surface'
import { DataRow, KpiCard, StatCard } from '@/components/app/kpi'
import { Button } from '@/components/app/button'
import { BarTrend, ChartLegend, DualTrend } from '@/components/app/charts'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useNow } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, PlanDistribution, RefreshButton } from '@/components/admin/parts'

// =============================================
// Raportul financiar: luna curentă față de cea trecută, ultimele 12 luni,
// indicatorii abonamentelor și detalierea pe luni, cu export CSV. Sumele sunt
// în dolari, ca prețurile planurilor.
// =============================================

type MonthData = {
  label: string; revenue: number; subRevenue: number; packRevenue: number; apiCost: number
  profit: number; margin: number; images: number; texts: number; newUsers: number
}
type FinancialData = {
  monthly: MonthData[]; current: MonthData; prev: MonthData
  mrr: number; arpu: number; ltv: number; churnRate: number
  forecastRevenue: number; forecastProfit: number; forecastMargin: number
  planDist: Record<string, number>; totalPaid: number; totalUsers: number
  allTimeRevenue: number; allTimeProfit: number; allTimeApiCost: number
}

const change = (curr: number, prev: number) => (prev ? (curr - prev) / prev : null)

export default function FinancialPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const now = useNow()
  const { data, loading, refresh } = useAdminData<FinancialData>('/api/admin/financial')
  const [exporting, setExporting] = useState(false)

  if (loading && !data) return <PageSkeleton />
  if (!data?.monthly) return <LoadError />

  const usd = (n: number) => f.money.format(n)
  const usd2 = (n: number) => f.money2.format(n)
  const series = (pick: (m: MonthData) => number) => data.monthly.map(m => ({ label: m.label, value: pick(m) }))
  const month = now ? new Date(now).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' }) : ''

  const exportCSV = () => {
    setExporting(true)
    const rows = [
      [t('admin.financial_month'), `${t('admin.financial_revenue')} (USD)`, `${t('admin.financial_subscriptions')} (USD)`, `${t('admin.financial_credit_packs')} (USD)`, `${t('admin.financial_api_cost')} (USD)`, `${t('admin.financial_profit')} (USD)`, `${t('admin.financial_margin')} (%)`, t('admin.financial_images'), t('admin.financial_texts'), t('admin.financial_new_users')],
      ...data.monthly.map(m => [m.label, m.revenue, m.subRevenue, m.packRevenue, m.apiCost, m.profit, m.margin, m.images, m.texts, m.newUsers]),
      [],
      [t('admin.financial_csv_summary'), '', '', '', '', '', '', '', '', ''],
      [`${t('admin.financial_total_revenue')} (USD)`, data.allTimeRevenue],
      [`${t('admin.financial_total_profit')} (USD)`, data.allTimeProfit],
      [`${t('admin.financial_total_api_cost')} (USD)`, data.allTimeApiCost],
      [`${t('admin.mrr')} (USD)`, data.mrr],
      [`${t('admin.arpu')} (USD)`, data.arpu],
      [`${t('admin.financial_ltv_estimated')} (USD)`, data.ltv],
      [`${t('admin.financial_churn_rate')} (%)`, data.churnRate],
      [`${t('admin.financial_forecast_next_month')} (USD)`, data.forecastRevenue],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('admin.financial_csv_filename', { month: new Date().toISOString().slice(0, 7) })
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.financial_title')} description={`${month} · ${t('admin.financial_realtime')}`}
        actions={(
          <>
            <RefreshButton loading={loading} onClick={refresh} />
            <Button variant="primary" loading={exporting} onClick={exportCSV}>
              {!exporting && <Download />}{exporting ? t('admin.financial_exporting') : t('admin.financial_export_csv')}
            </Button>
          </>
        )} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('admin.mrr')} value={data.mrr} format={usd} delta={change(data.current.subRevenue, data.prev.subRevenue)}
          series={series(m => m.subRevenue)} footnote={t('admin.financial_active_subscribers', { count: data.totalPaid })} />
        <KpiCard label={t('admin.financial_revenue_this_month')} value={data.current.revenue} format={usd} delta={change(data.current.revenue, data.prev.revenue)}
          series={series(m => m.revenue)} footnote={t('admin.financial_last_month_value', { value: usd(data.prev.revenue) })} />
        <KpiCard label={t('admin.financial_profit_this_month')} value={data.current.profit} format={usd} delta={change(data.current.profit, data.prev.profit)}
          series={series(m => m.profit)} footnote={t('admin.financial_margin_value', { margin: data.current.margin })} />
        <KpiCard label={t('admin.financial_api_cost_this_month')} value={data.current.apiCost} format={usd2} delta={change(data.current.apiCost, data.prev.apiCost)} good="down"
          series={series(m => m.apiCost)} footnote={t('admin.financial_images_texts', { images: data.current.images, texts: data.current.texts })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.financial_revenue_12_months')} description={t('admin.financial_monthly_trend')} />
          <div className="px-3 pb-4 pt-4">
            <BarTrend data={data.monthly.map(m => ({ label: m.label, value: m.revenue, extra: t('admin.financial_margin_tooltip', { margin: m.margin }) }))}
              format={usd} axisFormat={v => f.compact.format(v)} height={220} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t('admin.financial_revenue_vs_cost')} description={t('admin.financial_monthly_profitability')}
            action={<ChartLegend items={[{ label: t('admin.financial_revenue'), className: 'bg-neutral-900' }, { label: t('admin.financial_api_cost'), className: 'bg-neutral-400' }]} />} />
          <div className="px-3 pb-4 pt-4">
            <DualTrend data={data.monthly.map(m => ({ label: m.label, a: m.revenue, b: m.apiCost }))} names={{ a: t('admin.financial_revenue'), b: t('admin.financial_api_cost') }}
              format={usd} axisFormat={v => f.compact.format(v)} height={220} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.arpu')} value={usd2(data.arpu)} icon={<DollarSign />} footnote={`${t('admin.financial_arpu_sub')} · ${t('admin.financial_arpu_note')}`} />
        <StatCard label={t('admin.financial_ltv_estimated')} value={usd(data.ltv)} icon={<TrendingUp />} footnote={`${t('admin.financial_ltv_sub')} · ${t('admin.financial_ltv_note')}`} />
        <StatCard label={t('admin.financial_churn_rate')} value={`${f.num.format(data.churnRate)}%`} icon={<TrendingDown />} footnote={`${t('admin.financial_churn_sub')} · ${t('admin.financial_churn_note')}`} />
        <StatCard label={t('admin.financial_forecast')} value={usd(data.forecastRevenue)} icon={<Target />} footnote={`${t('admin.financial_forecast_sub')} · ${t('admin.financial_forecast_note', { margin: data.forecastMargin })}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('admin.plan_distribution')} />
          <div className="px-5 pb-3 pt-4">
            <PlanDistribution plans={data.planDist} total={data.totalUsers} />
            <dl className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
              <DataRow label={t('admin.financial_paying_users')} value={data.totalPaid} strong />
              <DataRow label={t('admin.financial_total_users')} value={data.totalUsers} />
              <DataRow label={t('admin.financial_conversion')} value={`${data.totalUsers > 0 ? Math.round((data.totalPaid / data.totalUsers) * 100) : 0}%`} />
            </dl>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden lg:col-span-2">
          <CardHeader title={t('admin.financial_monthly_breakdown')} className="pb-3" />
          <Table>
            <thead>
              <tr>
                <Th>{t('admin.financial_month')}</Th>
                <Th align="right">{t('admin.financial_revenue')}</Th>
                <Th align="right">{t('admin.financial_api_cost')}</Th>
                <Th align="right">{t('admin.financial_profit')}</Th>
                <Th align="right">{t('admin.financial_margin')}</Th>
                <Th align="right">{t('admin.financial_img_short')}</Th>
                <Th align="right">{t('admin.financial_new_users')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.slice().reverse().slice(0, 8).map((m, i) => (
                <Tr key={m.label} className={cn(i === 0 && 'font-semibold')}>
                  <Td className="text-neutral-700">{m.label}</Td>
                  <Td align="right" className="text-neutral-900">{usd(m.revenue)}</Td>
                  <Td align="right" className="text-neutral-500">{usd2(m.apiCost)}</Td>
                  <Td align="right" className={cn(m.profit < 0 ? 'text-red-600' : 'text-neutral-900')}>{usd(m.profit)}</Td>
                  <Td align="right" className="text-neutral-700">{m.margin}%</Td>
                  <Td align="right" className="text-neutral-500">{m.images}</Td>
                  <Td align="right" className="text-neutral-500">{m.newUsers > 0 ? `+${m.newUsers}` : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <CardFooter className="mt-auto grid grid-cols-3 gap-4">
            {[
              { label: t('admin.financial_total_revenue'), value: usd(data.allTimeRevenue) },
              { label: t('admin.financial_total_profit'), value: usd(data.allTimeProfit) },
              { label: t('admin.financial_total_api_cost'), value: usd2(data.allTimeApiCost) },
            ].map(r => (
              <div key={r.label}>
                <p className="text-[12px] text-neutral-500">{r.label}</p>
                <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-neutral-950">{r.value}</p>
              </div>
            ))}
          </CardFooter>
        </Card>
      </div>
    </FadeIn>
  )
}
