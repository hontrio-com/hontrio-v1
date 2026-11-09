'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Calculator as CalculatorIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { NumberTicker } from '@/components/app/motion'
import { cn } from '@/lib/utils'
import { FlickeringGrid, Reveal } from './fx'
import { SectionHeader } from './section'
import { primaryPill } from './header'

// =============================================
// Calculatorul pragului de profit: aceleași formule ca planul campaniei din
// aplicație (lib/campaigns/plan.ts), pe un singur produs:
//   marja = 1 − cost; prag (ROAS minim) = (1 + TVA) ÷ marjă, fiindcă Google
//   primește valoarea comenzii cu TVA; ținta = prag ÷ (1 − partea păstrată).
// =============================================

const GOALS = [
  { id: 'growth', keep: 0.1 },
  { id: 'balanced', keep: 0.25 },
  { id: 'profit', keep: 0.4 },
] as const
const VATS = [0, 0.19, 0.2, 0.21]
const SCALE = 8 // ROAS-ul maxim de pe bară

export function ProfitCalculator() {
  const { t, locale, intlLocale } = useT()
  const uid = useId()
  const euro = locale !== 'ro'
  const currency = euro ? 'EUR' : 'RON'
  const range = euro ? { min: 10, max: 400, step: 5, start: 70 } : { min: 50, max: 2000, step: 10, start: 350 }
  const [order, setOrder] = useState(range.start)
  const [costPct, setCostPct] = useState(60)
  const [vat, setVat] = useState(euro ? 0.2 : 0.21)
  const [goal, setGoal] = useState<(typeof GOALS)[number]['id']>('balanced')

  const keep = GOALS.find(g => g.id === goal)!.keep
  const margin = 1 - costPct / 100
  const ok = margin > 0.02
  const profit = (order / (1 + vat)) * margin
  const breakEven = ok ? (1 + vat) / margin : 0
  const target = ok ? breakEven / (1 - keep) : 0
  const costAtTarget = ok ? order / target : 0
  const kept = profit - costAtTarget

  const money = (n: number) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(n))
  const one = (n: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const at = (roas: number) => `${Math.min(100, (roas / SCALE) * 100)}%`
  const fill = (v: number, min: number, max: number) => ({ '--pct': `${((v - min) / (max - min)) * 100}%` }) as React.CSSProperties

  return (
    <section id="calculator" className="scroll-mt-24 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader badge={t('site.calc_badge')} icon={<CalculatorIcon />} titleA={t('site.calc_title_a')} titleB={t('site.calc_title_b')} desc={t('site.calc_desc')} />

        <Reveal delay={0.1} className="mx-auto mt-14 grid max-w-5xl grid-cols-1 overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-[var(--shadow-surface)] lg:grid-cols-[1.05fr_1fr]">
          {/* Ce pui tu */}
          <div className="flex flex-col gap-7 p-6 sm:p-8">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`${uid}-order`} className="text-[13px] font-semibold text-neutral-900">{t('site.calc_order')}</label>
                <span className="text-2xl font-bold tracking-[-0.03em] tabular-nums">{money(order)}</span>
              </div>
              <input id={`${uid}-order`} type="range" min={range.min} max={range.max} step={range.step} value={order}
                onChange={e => setOrder(Number(e.target.value))} className="range-mono mt-3 h-6 w-full" style={fill(order, range.min, range.max)} />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`${uid}-cost`} className="text-[13px] font-semibold text-neutral-900">{t('site.calc_cost')}</label>
                <span className="text-2xl font-bold tracking-[-0.03em] tabular-nums">{t('site.calc_cost_value', { pct: String(costPct) })}</span>
              </div>
              <input id={`${uid}-cost`} type="range" min={10} max={95} step={1} value={costPct}
                onChange={e => setCostPct(Number(e.target.value))} className="range-mono mt-3 h-6 w-full" style={fill(costPct, 10, 95)} />
            </div>

            <fieldset>
              <legend className="text-[13px] font-semibold text-neutral-900">{t('site.calc_vat')}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {VATS.map(v => (
                  <button key={v} type="button" onClick={() => setVat(v)} aria-pressed={vat === v}
                    className={cn('h-9 rounded-full border px-4 text-[13px] font-semibold tabular-nums transition-colors',
                      vat === v ? 'border-black bg-black text-white' : 'border-line bg-white text-neutral-600 hover:border-neutral-400')}>
                    {pct(v)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[13px] font-semibold text-neutral-900">{t('site.calc_goal')}</legend>
              <div className="mt-3 flex rounded-full bg-neutral-100 p-1 text-sm font-medium">
                {GOALS.map(g => (
                  <button key={g.id} type="button" onClick={() => setGoal(g.id)} aria-pressed={goal === g.id}
                    className={cn('relative flex-1 rounded-full px-3 py-1.5 transition-colors', goal === g.id ? 'text-black' : 'text-neutral-500 hover:text-black')}>
                    {goal === g.id && <motion.span layoutId={`${uid}-goal`} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                    <span className="relative">{t(`site.calc_goal_${g.id}`)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-neutral-500">{t('site.calc_goal_keep', { pct: String(Math.round(keep * 100)) })}</p>
            </fieldset>

            {/* Formulele, cum le folosește și aplicația */}
            <div className="mt-auto rounded-2xl border border-dashed border-line bg-neutral-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('site.calc_formula')}</p>
              <p className="mt-2 font-mono text-[12.5px] text-neutral-700">{t('site.calc_formula_breakeven')}</p>
              <p className="mt-1 font-mono text-[12.5px] text-neutral-700">{t('site.calc_formula_target')}</p>
            </div>
          </div>

          {/* Ce iese */}
          <div className="relative overflow-hidden bg-[#0a0a0a] p-6 text-white sm:p-8" aria-live="polite">
            <FlickeringGrid className="opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" maxOpacity={0.12} />
            <div className="relative">
              {ok ? (
                <>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-[12.5px] text-white/55">{t('site.calc_breakeven')}</p>
                      <p className="mt-1 text-5xl font-bold tracking-[-0.04em] tabular-nums"><NumberTicker value={breakEven} format={one} /></p>
                    </div>
                    <div>
                      <p className="text-[12.5px] text-white/55">{t('site.calc_target')}</p>
                      <p className="mt-1 text-5xl font-bold tracking-[-0.04em] tabular-nums text-white/90"><NumberTicker value={target} format={one} /></p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/60">{t('site.calc_breakeven_hint')} {t('site.calc_target_hint')}</p>

                  {/* Bara ROAS: sub prag pierzi bani, peste el e profit; punctul alb e ținta */}
                  <div className="mt-7">
                    <div className="relative h-3 overflow-hidden rounded-full bg-white/15">
                      <motion.span className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.28)_0_4px,transparent_4px_8px)]"
                        animate={{ width: at(breakEven) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                    </div>
                    <div className="relative h-0">
                      <motion.span className="absolute -top-[18px] size-4 -translate-x-1/2 rounded-full border-2 border-black bg-white shadow"
                        animate={{ left: at(target) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                    </div>
                    <div className="mt-2.5 flex justify-between text-[11px] text-white/50">
                      <span>{t('site.calc_zone_loss')}</span><span>{t('site.calc_zone_profit')}</span>
                    </div>
                  </div>

                  <dl className="mt-7 divide-y divide-white/10 border-y border-white/10 text-[13.5px]">
                    {[
                      { id: 'margin', label: t('site.calc_margin'), value: pct(margin) },
                      { id: 'profit', label: t('site.calc_profit'), value: money(profit) },
                      { id: 'cost', label: t('site.calc_cost_at_target'), value: money(costAtTarget) },
                      { id: 'kept', label: t('site.calc_kept'), value: money(kept) },
                    ].map(row => (
                      <div key={row.id} className="flex items-center justify-between gap-4 py-2.5">
                        <dt className="text-white/60">{row.label}</dt>
                        <dd className="shrink-0 font-semibold tabular-nums">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="py-16 text-center text-lg font-semibold leading-relaxed">{t('site.calc_no_margin')}</p>
              )}
              <p className="mt-5 text-[11.5px] leading-relaxed text-white/40">{t('site.calc_note')}</p>
              <Link href="/register" className={cn(primaryPill, 'mt-6 h-11 w-full bg-white px-6 text-sm text-black hover:bg-neutral-200')}>
                <span className="relative">{t('site.calc_cta')}</span><ArrowRight className="relative size-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
