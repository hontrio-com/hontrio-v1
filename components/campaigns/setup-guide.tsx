'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ExternalLink, Rocket } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import type { Plan } from '@/lib/campaigns/plan'
import type { Formats } from '@/components/campaigns/formats'

// =============================================
// Ghidul de pornire (ca „Get started" la Stripe): pașii până la prima
// campanie, bifați pe măsură ce se fac, cu un singur buton pentru pasul de
// acum. Alături, ce va lansa Hontrio când totul e gata.
// =============================================

type StepId = 'store' | 'google' | 'merchant' | 'conversion' | 'costs' | 'audit'

const STEPS: { id: StepId; blockers: string[] }[] = [
  { id: 'store', blockers: ['store'] },
  { id: 'google', blockers: ['google_ads', 'ads_account', 'currency', 'account_manager'] },
  { id: 'merchant', blockers: ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose'] },
  { id: 'conversion', blockers: ['conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value'] },
  { id: 'costs', blockers: ['costs', 'no_offers', 'too_many_exclusions'] },
  { id: 'audit', blockers: ['audit'] },
]

export function SetupGuide({ plan, f, onLaunch }: { plan: Plan; f: Formats; onLaunch: () => void }) {
  const { t } = useT()
  const steps = STEPS.map(s => ({ ...s, blocker: plan.blockers.find(b => s.blockers.includes(b.id)) ?? null }))
  const done = steps.filter(s => !s.blocker).length
  const current = steps.find(s => s.blocker) ?? null
  const ready = !current
  const pct = Math.round((done / steps.length) * 100)

  const label = (b: Plan['blockers'][number]) => {
    const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
    const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
    return t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params)
      : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* Pașii */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-neutral-950">{t(ready ? 'campaigns.setup_ready_title' : 'campaigns.setup_title')}</h2>
              <p className="mt-1 text-[13px] text-neutral-500">{t('campaigns.setup_progress', { done: String(done), total: String(steps.length) })}</p>
            </div>
            <ProgressRing value={pct} />
          </div>

          <ol className="mt-6 space-y-1">
            {steps.map((s, i) => {
              const isDone = !s.blocker
              const isCurrent = current?.id === s.id
              return (
                <li key={s.id} className={cn('relative flex gap-3 rounded-xl p-3 transition-colors', isCurrent && 'bg-brand-50/60 ring-1 ring-brand-100')}>
                  {i < steps.length - 1 && <span className={cn('absolute left-[23px] top-10 h-[calc(100%-24px)] w-px', isDone ? 'bg-brand-200' : 'bg-neutral-200')} />}
                  <span className={cn('relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    isDone ? 'bg-brand-600 text-white' : isCurrent ? 'bg-white text-brand-700 ring-2 ring-brand-600' : 'bg-white text-neutral-400 ring-1 ring-neutral-300')}>
                    {isDone ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14px] font-medium', isDone ? 'text-neutral-500' : 'text-neutral-900')}>{t(`campaigns.setup_${s.id}`)}</p>
                    {isCurrent && s.blocker && (
                      <div className="mt-1.5">
                        <p className="text-[13px] leading-relaxed text-neutral-600">{label(s.blocker)}</p>
                        <Button asChild size="sm" variant="primary" className="mt-3">
                          {s.blocker.external
                            ? <a href={s.blocker.href} target="_blank" rel="noopener">{t('campaigns.setup_do_it')}<ExternalLink /></a>
                            : <Link href={s.blocker.href}>{t('campaigns.setup_do_it')}<ArrowRight /></Link>}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Ce va lansa Hontrio */}
        <div className="relative overflow-hidden border-t border-neutral-100 bg-gradient-to-b from-neutral-50 to-white p-6 lg:border-l lg:border-t-0">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-100/50 blur-3xl" />
          <p className="relative text-[12px] font-semibold uppercase tracking-wider text-neutral-400">{t('campaigns.setup_preview')}</p>
          <p className="relative mt-2 text-[15px] font-semibold text-neutral-900">{t(plan.structure.type === 'shopping' ? 'campaigns.type_shopping' : 'campaigns.type_pmax')}</p>
          <dl className="relative mt-4 space-y-3">
            {[
              { label: t('campaigns.row_products'), value: f.int.format(plan.counts.included) },
              { label: t('campaigns.row_budget'), value: plan.budget.daily !== null ? t('campaigns.g_budget_value', { budget: f.money.format(plan.budget.daily) }) : '—' },
              plan.structure.type === 'shopping'
                ? { label: t('campaigns.g_stat_cpc'), value: plan.structure.cpc_ceiling !== null ? f.money2.format(plan.structure.cpc_ceiling) : '—' }
                : { label: t('campaigns.econ_target'), value: plan.structure.start_target !== null ? f.num.format(plan.structure.start_target) : '—' },
              { label: t('campaigns.econ_break_even'), value: plan.economics.break_even !== null ? f.num.format(plan.economics.break_even) : '—' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between gap-3 text-[13px]">
                <dt className="text-neutral-500">{r.label}</dt>
                <dd className="font-medium tabular-nums text-neutral-900">{r.value}</dd>
              </div>
            ))}
          </dl>
          {plan.forecast && (
            <div className="relative mt-5 rounded-xl bg-white p-3.5 ring-1 ring-neutral-200/80">
              <p className="text-[12px] text-neutral-500">{t('campaigns.setup_forecast')}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-emerald-600">{f.money.format(plan.forecast.profit)}</p>
              <p className="text-[12px] text-neutral-500">{t('campaigns.setup_forecast_hint', { revenue: f.money.format(plan.forecast.revenue), spend: f.money.format(plan.forecast.spend) })}</p>
            </div>
          )}
          <Button variant="primary" size="lg" className="relative mt-5 w-full" disabled={!ready} onClick={onLaunch}>
            <Rocket />{t('campaigns.setup_launch')}
          </Button>
          {!ready && <p className="relative mt-2 text-center text-[12px] text-neutral-400">{t('campaigns.setup_launch_wait')}</p>}
        </div>
      </div>
    </Card>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#ececf0" strokeWidth="4" />
        <motion.circle cx="22" cy="22" r={r} fill="none" stroke="#5b5bd6" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-neutral-700">{value}%</span>
    </div>
  )
}
