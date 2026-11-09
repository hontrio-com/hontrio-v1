'use client'

import { useId } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Surface } from '@/components/app/surface'
import { StatusMark } from '@/components/app/fx/feedback'
import { day, type Formats } from '@/components/app/formats'
import type { SeriesPoint } from '@/components/campaigns/types'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// După lansare, suprafața mare a Dashboard-ului (ca „Create new clips" la
// Bezeno): ce aduc reclamele zi de zi (vânzările, linia neagră, și cheltuiala,
// punctată), cu pragul de profit, ținta și bugetul în pastile, și drumul spre
// campanii. Până vin primele cifre, spune că Google verifică reclamele.
// =============================================

const bigButton = 'group flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-black px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_28px_-12px_rgba(0,0,0,0.6)] transition hover:bg-neutral-800'
const chip = 'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-neutral-500'

export function CampaignSurface({ plan, series, days, f }: { plan: Plan | null; series: SeriesPoint[]; days: number; f: Formats }) {
  const { t } = useT()
  const id = useId().replace(/:/g, '')
  const shown = series.slice(-Math.min(days, series.length))
  const points = shown.map(d => ({ label: f.shortDate.format(day(d.date)), value: d.value, cost: d.cost, profit: d.profit }))
  const empty = points.every(p => p.value === 0 && p.cost === 0)

  return (
    <Surface dotted>
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{t('home.campaign_title')}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t('home.campaign_desc')}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-black" />{t('home.ads_sales')}</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-neutral-400" />{t('overview.ads_spend')}</span>
          </div>
        </div>

        <div className="mt-6 h-[260px] min-w-0">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 text-center">
              <StatusMark status="running" size={24} className="text-neutral-900" />
              <p className="text-[15px] font-semibold text-neutral-900">{t('home.warming_title')}</p>
              <p className="max-w-sm text-sm text-neutral-500">{t('home.warming_desc')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={points} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`cv-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#efefef" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#a3a3a3', fontSize: 11 }} minTickGap={28} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={n => f.compact.format(Number(n))} />
                <Tooltip cursor={{ stroke: '#0a0a0a', strokeOpacity: 0.2, strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as (typeof points)[number]
                    return (
                      <div className="min-w-[170px] rounded-xl bg-black px-3 py-2 text-[12px] text-white shadow-xl">
                        <p className="mb-1 text-white/55">{label}</p>
                        <p className="flex justify-between gap-6"><span className="text-white/60">{t('home.ads_sales')}</span><span className="font-semibold tabular-nums">{f.money.format(p.value)}</span></p>
                        <p className="flex justify-between gap-6"><span className="text-white/60">{t('overview.ads_spend')}</span><span className="tabular-nums">{f.money.format(p.cost)}</span></p>
                        {p.profit !== null && (
                          <p className="mt-1 flex justify-between gap-6 border-t border-white/10 pt-1"><span className="text-white/60">{t('home.profit_short')}</span>
                            <span className={cn('font-semibold tabular-nums', p.profit < 0 ? 'text-red-300' : 'text-emerald-300')}>{f.money.format(p.profit)}</span></p>
                        )}
                      </div>
                    )
                  }} />
                <Area type="monotone" dataKey="cost" stroke="#a3a3a3" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false}
                  activeDot={{ r: 3, fill: '#a3a3a3', stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={1000} />
                <Area type="monotone" dataKey="value" stroke="#0a0a0a" strokeWidth={2.2} fill={`url(#cv-${id})`} dot={false}
                  activeDot={{ r: 5, fill: '#fff', stroke: '#0a0a0a', strokeWidth: 2.5 }} isAnimationActive animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {plan?.economics.break_even != null && <span className={chip}>{t('overview.ads_roas_be', { roas: f.num.format(plan.economics.break_even) })}</span>}
            {plan?.target_roas != null && <span className={chip}>{t('wizard.goal_target', { roas: f.num.format(plan.target_roas) })}</span>}
            {plan?.budget.daily != null && <span className={chip}>{t('home.budget_chip', { budget: f.money.format(plan.budget.daily) })}</span>}
            {plan && <span className={chip}>{t('home.pilot_on', { mode: t(`campaigns.mode_${plan.settings.mode}`) })}</span>}
          </div>
          <Link href="/campaigns" className={bigButton}>{t('home.see_campaigns')}<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Link>
        </div>
      </div>
    </Surface>
  )
}
