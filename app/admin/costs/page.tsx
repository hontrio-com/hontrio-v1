'use client'

import { BarChart2, DollarSign, FileText, ImageIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { DataRow, Delta, StatCard } from '@/components/app/kpi'
import { BarTrend } from '@/components/app/charts'
import { ProgressBar } from '@/components/app/progress'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { FadeIn } from '@/components/app/motion'
import { day, useFormats } from '@/components/app/formats'
import { useNow } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton } from '@/components/admin/parts'

// =============================================
// Costurile API: cât a costat luna, pe ce s-au dus banii, luna curentă față
// de cea trecută, costul pe zile și prețurile furnizorilor.
// =============================================

type MonthData = { images: number; texts: number; costUsd: number; costEur: number; imageCostUsd: number; textCostUsd: number }
type DailyBreakdown = { date: string; images: number; texts: number; costUsd: number; costEur: number }
type CostData = {
  totalCreditsUsed: number; month: MonthData
  lastMonth: { images: number; texts: number; costUsd: number }; costTrend: number; costPerCredit: number
  dailyBreakdown: DailyBreakdown[]
}

function ShareBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[13px] text-neutral-500">{label}</span>
      <ProgressBar value={pct} className="flex-1" />
      <span className="w-10 text-right text-[13px] tabular-nums text-neutral-700">{pct}%</span>
    </div>
  )
}

export default function AdminCostsPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const now = useNow()
  const { data: costs, loading, refresh } = useAdminData<CostData>('/api/admin/costs')

  if (loading && !costs) return <PageSkeleton />
  if (!costs?.month) return <LoadError />

  const usd2 = (n: number) => f.money2.format(n)
  const month = now ? new Date(now).toLocaleDateString(intlLocale, { month: 'long', year: 'numeric' }) : ''
  // Zilele vin de la cea mai nouă spre cea mai veche; pe grafic, invers
  const chart = costs.dailyBreakdown.slice(0, 20).reverse().map(d => ({ label: f.shortDate.format(day(d.date)), value: d.costUsd }))

  return (
    <FadeIn className="space-y-6">
      {/* i18n-ignore */}
      <PageHeader title={t('admin.nav_costs')} description={`OpenAI GPT-4o-mini + KIE Nano Banana Pro · ${month}`}
        actions={<RefreshButton loading={loading} onClick={refresh} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('admin.costs_month_cost')} value={usd2(costs.month.costUsd)} icon={<DollarSign />} footnote={`≈ ${costs.month.costEur.toFixed(2)}€`}
          delta={costs.costTrend !== 0 ? costs.costTrend / 100 : undefined} good="down" />
        <StatCard label={t('admin.costs_images_generated')} value={f.int.format(costs.month.images)} icon={<ImageIcon />} footnote={t('admin.costs_cost_value', { value: costs.month.imageCostUsd.toFixed(2) })} />
        <StatCard label={t('admin.stats_texts_generated')} value={f.int.format(costs.month.texts)} icon={<FileText />} footnote={t('admin.costs_cost_value', { value: costs.month.textCostUsd.toFixed(4) })} />
        <StatCard label={t('admin.stats_cost_per_credit')} value={`$${costs.costPerCredit.toFixed(4)}`} icon={<BarChart2 />} footnote={t('admin.costs_credits_total', { count: costs.totalCreditsUsed })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.costs_breakdown', { month })} />
          <div className="space-y-4 px-5 pb-5 pt-4">
            <ShareBar value={costs.month.imageCostUsd} max={costs.month.costUsd} label={t('admin.costs_kie_images')} />
            <ShareBar value={costs.month.textCostUsd} max={costs.month.costUsd} label={t('admin.costs_gpt_texts')} />
            <div className="flex items-baseline justify-between border-t border-neutral-100 pt-3">
              <span className="text-[13px] text-neutral-500">{t('admin.costs_month_total')}</span>
              <span>
                <span className="text-[18px] font-semibold tabular-nums tracking-[-0.015em] text-neutral-950">{usd2(costs.month.costUsd)}</span>
                <span className="ml-1.5 text-[12px] text-neutral-400">≈ {costs.month.costEur.toFixed(2)}€</span>
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('admin.costs_month_comparison')}
            action={costs.costTrend !== 0 ? <span className="flex items-center gap-1.5 text-[12px] text-neutral-500"><Delta value={costs.costTrend / 100} good="down" />{t('admin.costs_vs_last_month_short')}</span> : undefined} />
          <div className="mt-3 grid grid-cols-2 gap-px border-t border-neutral-100 bg-neutral-100">
            {[
              { title: t('admin.stats_current_month'), ...costs.month, cost: costs.month.costUsd },
              { title: t('admin.costs_last_month'), ...costs.lastMonth, cost: costs.lastMonth.costUsd },
            ].map(m => (
              <div key={m.title} className="bg-white px-5 py-3">
                <p className="pb-1 text-[13px] font-medium text-neutral-900">{m.title}</p>
                <dl className="divide-y divide-neutral-100">
                  <DataRow label={t('admin.financial_images')} value={m.images} />
                  <DataRow label={t('admin.financial_texts')} value={m.texts} />
                  <DataRow label={t('admin.costs_total_cost')} value={usd2(m.cost)} strong />
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {costs.dailyBreakdown.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title={t('admin.costs_daily')} description={t('admin.costs_active_days', { count: costs.dailyBreakdown.length })} />
          <div className="px-3 pb-4 pt-4">
            <BarTrend data={chart} format={v => `$${v.toFixed(3)}`} height={180} />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>{t('admin.date')}</Th>
                <Th align="right">{t('admin.financial_images')}</Th>
                <Th align="right">{t('admin.financial_texts')}</Th>
                <Th align="right">{t('admin.costs_cost_usd')}</Th>
                <Th align="right">{t('admin.costs_cost_eur')}</Th>
              </tr>
            </thead>
            <tbody>
              {costs.dailyBreakdown.slice(0, 10).map(d => (
                <Tr key={d.date}>
                  <Td className="text-neutral-700">{f.shortDate.format(day(d.date))}</Td>
                  <Td align="right" className="text-neutral-500">{d.images}</Td>
                  <Td align="right" className="text-neutral-500">{d.texts}</Td>
                  <Td align="right" className="font-medium text-neutral-900">${d.costUsd.toFixed(3)}</Td>
                  <Td align="right" className="text-neutral-500">{d.costEur.toFixed(3)}€</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader title={t('admin.api_price_reference')} />
        <div className="mt-3 grid grid-cols-1 gap-px border-t border-neutral-100 bg-neutral-100 sm:grid-cols-2">
          {[
            { name: 'OpenAI GPT-4o-mini', icon: <FileText />, rows: [[t('admin.costs_input'), t('admin.costs_per_million_tokens', { price: '0.15' })], [t('admin.costs_output'), t('admin.costs_per_million_tokens', { price: '0.60' })], [t('admin.costs_per_generation'), '~$0.004'], [t('admin.costs_avg_tokens'), t('admin.costs_avg_tokens_value')]] }, // i18n-ignore
            { name: 'KIE Nano Banana Pro', icon: <ImageIcon />, rows: [['1K / 2K', t('admin.costs_per_image', { price: '0.09' })], ['4K', t('admin.costs_per_image', { price: '0.12' })], [t('admin.costs_google_direct'), t('admin.costs_per_image', { price: '0.134' })], [t('admin.costs_savings'), t('admin.costs_savings_value')]] }, // i18n-ignore
          ].map(api => (
            <div key={api.name} className="bg-white px-5 py-3">
              <p className="flex items-center gap-2 pb-1 text-[13px] font-semibold text-neutral-900 [&_svg]:size-4 [&_svg]:text-neutral-400">{api.icon}{api.name}</p>
              <dl className="divide-y divide-neutral-100">
                {api.rows.map(([label, val]) => <DataRow key={label} label={label} value={val} />)}
              </dl>
            </div>
          ))}
        </div>
      </Card>
    </FadeIn>
  )
}
