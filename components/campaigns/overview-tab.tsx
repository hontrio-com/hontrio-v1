'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Bot, ChartLine, Inbox, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card, CardHeader } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { Badge } from '@/components/app/badge'
import { KpiCard } from '@/components/app/kpi'
import { TrendChart, CHART } from '@/components/app/charts'
import { Segmented } from '@/components/app/tabs'
import { FadeIn } from '@/components/app/motion'
import { EmptyState } from '@/components/app/feedback'
import { useTimeAgo } from '@/components/app/time'
import { CampaignTable } from '@/components/campaigns/campaign-table'
import { day, type Formats } from '@/components/campaigns/formats'
import type { CampaignView } from '@/components/campaigns/views'
import type { ActionItem, SeriesPoint } from '@/components/campaigns/types'
import type { Mode, Plan } from '@/lib/campaigns/plan'

// =============================================
// Prezentarea campaniilor: cele patru cifre care contează (profitul după
// reclame, vânzările aduse, ROAS-ul și cheltuiala, față de cele 30 de zile
// de dinainte), evoluția lor, ce așteaptă pilotul de la tine și campaniile.
// =============================================

type Metric = 'profit' | 'value' | 'cost'

export function OverviewTab({ plan, views, series, mode, proposals, journal, f, onOpen, onTab, onNew }: {
  plan: Plan
  views: CampaignView[]
  series: SeriesPoint[]
  mode: Mode
  proposals: ActionItem[]
  journal: ActionItem[]
  f: Formats
  onOpen: (v: CampaignView) => void
  onTab: (tab: 'campaigns' | 'pilot') => void
  onNew: () => void
}) {
  const { t } = useT()
  const [metric, setMetric] = useState<Metric>('profit')

  const { cur, prev, points } = useMemo(() => {
    const half = Math.floor(series.length / 2)
    const sum = (list: SeriesPoint[]) => list.reduce((s, p) => ({
      cost: s.cost + p.cost, value: s.value + p.value, conversions: s.conversions + p.conversions,
      profit: p.profit === null || s.profit === null ? null : s.profit + p.profit,
    }), { cost: 0, value: 0, conversions: 0, profit: 0 as number | null })
    return { cur: sum(series.slice(half)), prev: sum(series.slice(0, half)), points: series.slice(half) }
  }, [series])

  // Google raportează ziua de ieri: în primele zile după lansare nu e încă nimic de arătat
  const noData = series.every(p => p.cost === 0 && p.value === 0)
  const delta = (a: number | null, b: number | null) => (noData || a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b))
  const roas = (p: { cost: number; value: number }) => (p.cost > 0 ? p.value / p.cost : null)
  const line = (key: Metric) => (noData ? undefined : points.map(p => ({ label: f.shortDate.format(day(p.date)), value: key === 'profit' ? p.profit ?? 0 : p[key] })))
  // O zi fără cheltuială n-are ROAS (nu e un ROAS de zero)
  const roasLine = noData ? undefined : points.filter(p => p.cost > 0).map(p => ({ label: f.shortDate.format(day(p.date)), value: p.value / p.cost }))
  const ago = useTimeAgo()

  return (
    <div className="space-y-6">
      {/* Cifrele-cheie */}
      <FadeIn>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label={t('campaigns.kpi_profit')} value={cur.profit} format={n => f.money.format(n)} delta={delta(cur.profit, prev.profit)}
            series={line('profit')} color={CHART.green} help={t('campaigns.kpi_profit_help')} footnote={t('campaigns.kpi_last30')} />
          <KpiCard label={t('campaigns.kpi_value')} value={cur.value} format={n => f.money.format(n)} delta={delta(cur.value, prev.value)}
            series={line('value')} help={t('campaigns.kpi_value_help')} footnote={t('campaigns.kpi_conversions_count', { count: Math.round(cur.conversions) })} />
          <KpiCard label={t('campaigns.kpi_roas')} value={roas(cur)} format={n => f.num.format(n)} delta={delta(roas(cur), roas(prev))}
            series={roasLine} help={t('campaigns.kpi_roas_help', { roas: plan.economics.break_even !== null ? f.num.format(plan.economics.break_even) : '—' })}
            footnote={plan.economics.break_even !== null ? t('campaigns.kpi_break_even', { roas: f.num.format(plan.economics.break_even) }) : undefined} />
          <KpiCard label={t('campaigns.kpi_spend')} value={cur.cost} format={n => f.money.format(n)} delta={delta(cur.cost, prev.cost)} good="up"
            series={line('cost')} color={CHART.neutral} help={t('campaigns.kpi_spend_help')} footnote={t('campaigns.kpi_last30')} />
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Evoluția */}
        <FadeIn delay={0.05} className="lg:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader title={t('campaigns.trend_title')}
              description={points.length ? t('campaigns.trend_hint', { from: f.shortDate.format(day(points[0].date)), to: f.shortDate.format(day(points[points.length - 1].date)) }) : undefined}
              action={noData ? undefined : <Segmented id="trend-metric" size="sm" value={metric} onChange={setMetric}
                items={[{ value: 'profit', label: t('campaigns.trend_profit') }, { value: 'value', label: t('campaigns.trend_value') }, { value: 'cost', label: t('campaigns.trend_cost') }]} />} />
            {noData ? (
              <EmptyState icon={<ChartLine />} title={t('campaigns.trend_empty_title')} description={t('campaigns.trend_empty')} className="py-16" />
            ) : (
              // Graficul umple cardul cât e de înalt (îl întinde cardul pilotului de alături)
              <div className="relative min-h-[240px] flex-1">
                <div className="absolute inset-x-3 bottom-4 top-4">
                  <TrendChart data={line(metric) ?? []} format={n => f.compact.format(n)} height="100%"
                    color={metric === 'profit' ? CHART.green : metric === 'cost' ? CHART.neutral : CHART.brand} />
                </div>
              </div>
            )}
          </Card>
        </FadeIn>

        {/* Pilotul */}
        <FadeIn delay={0.1}>
          <Card className="flex h-full flex-col">
            <CardHeader icon={<Bot />} title={t('campaigns.pilot_title')}
              action={<Badge tone={mode === 'auto' ? 'brand' : 'neutral'} dot live={mode === 'auto'}>{t(`campaigns.mode_${mode}`)}</Badge>} />
            <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
              <button onClick={() => onTab('pilot')}
                className="group flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-left ring-1 ring-neutral-200/70 transition-all hover:bg-white hover:shadow-card">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${proposals.length ? 'bg-brand-600 text-white' : 'bg-white text-neutral-400 ring-1 ring-neutral-200'}`}>
                  {proposals.length ? <Sparkles className="size-4" /> : <Inbox className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-neutral-900">
                    {proposals.length ? t('campaigns.overview_proposals', { count: proposals.length }) : t('campaigns.overview_proposals_zero')}
                  </span>
                  <span className="block text-[12px] text-neutral-500">{t(proposals.length ? 'campaigns.overview_proposals_hint' : 'campaigns.overview_proposals_none')}</span>
                </span>
                <ArrowRight className="size-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
              </button>
              <p className="mt-5 text-[12px] font-medium text-neutral-500">{t('campaigns.overview_recent')}</p>
              {journal.length === 0 ? (
                <p className="mt-2 text-[13px] text-neutral-400">{t('campaigns.journal_empty')}</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {journal.slice(0, 4).map(a => (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.status === 'applied' ? 'bg-emerald-500' : a.status === 'failed' ? 'bg-red-500' : 'bg-neutral-300'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-neutral-800">{t(`campaigns.kind_action_${a.kind}`)}</span>
                        <span className="block text-[12px] text-neutral-400">{ago(a.created_at)} · {t(a.source === 'user' ? 'campaigns.by_you' : 'campaigns.by_pilot')}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {journal.length > 0 && (
                <button onClick={() => onTab('pilot')} className="mt-auto pt-4 text-left text-[13px] font-medium text-brand-700 hover:text-brand-800">
                  {t('campaigns.overview_see_journal')}
                </button>
              )}
            </div>
          </Card>
        </FadeIn>
      </div>

      {/* Campaniile */}
      <FadeIn delay={0.15}>
        <Card className="overflow-hidden">
          <CardHeader title={t('campaigns.board_title')} description={t('campaigns.overview_campaigns_hint')}
            action={<>
              <Button size="sm" variant="ghost" onClick={() => onTab('campaigns')}>{t('campaigns.overview_see_all')}<ArrowRight /></Button>
              <Button size="sm" onClick={onNew}>{t('campaigns.board_new')}</Button>
            </>} />
          <div className="mt-4">
            <CampaignTable views={views} plan={plan} f={f} onOpen={onOpen} compact />
          </div>
        </Card>
      </FadeIn>
    </div>
  )
}
