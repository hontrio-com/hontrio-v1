'use client'

import { useId, useRef, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Rocket, Sparkles } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/app/motion'
import { FlickeringGrid, NoiseTexture, Ripple, Spotlight } from '@/components/app/fx/backgrounds'
import { AnimatedBeam } from '@/components/app/fx/beam'
import { BlurText } from '@/components/app/fx/text'
import { StatusMark } from '@/components/app/fx/feedback'
import { day, type Formats } from '@/components/app/formats'
import type { SeriesPoint } from '@/components/campaigns/types'
import type { Setup, SetupStep, StepId } from '@/components/dashboard/setup'

// =============================================
// Antetul Dashboard-ului, pe negru: locul unde omul vede dintr-o privire unde
// e. Înainte de lansare, harta drumului (magazinul, Google Ads, Merchant
// Center și costurile curg spre Hontrio, care lansează campania), cu razele
// aprinse pe legăturile făcute. După lansare, ce aduce campania: profitul,
// cheltuiala, vânzările și ROAS-ul față de prag, cu graficul pe zile.
// =============================================

const EASE = [0.21, 0.47, 0.32, 0.98] as const

/** Butonul alb, singurul accent pe fundalul negru. */
export const heroButton = 'inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13.5px] font-semibold text-neutral-950 shadow-[0_10px_30px_-12px_rgba(255,255,255,0.45)] transition-[background-color,transform] duration-150 hover:bg-neutral-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40 [&_svg]:size-4'
const ghostButton = 'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/30 [&_svg]:size-4'

/** Suprafața neagră: caroiaj care pâlpâie, fascicule de lumină și granulație fină. */
export function DarkHero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('relative isolate overflow-hidden rounded-[22px] bg-[#0a0a0a] text-white shadow-[0_28px_70px_-32px_rgb(0_0_0/0.7)]', className)}>
      <FlickeringGrid className="[mask-image:radial-gradient(60%_80%_at_78%_45%,black,transparent)]" maxOpacity={0.17} />
      <Spotlight />
      <NoiseTexture opacity={0.3} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.08]" />
      <div className="relative">{children}</div>
    </section>
  )
}

function HeroPill({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70 backdrop-blur">
      <span className={cn('relative flex size-1.5', live ? 'text-emerald-400' : 'text-white')}>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
        <span className="relative size-1.5 rounded-full bg-current" />
      </span>
      {children}
    </span>
  )
}

// ── Înainte de lansare ────────────────────────────────────────────────────────

export function SetupHero({ setup, selected, onSelect, onContinue }: {
  setup: Setup
  /** Pasul deschis în panoul de dedesubt. */
  selected: StepId
  onSelect: (id: StepId) => void
  /** Duce omul la panoul cu pasul de acum. */
  onContinue: () => void
}) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const title = setup.left <= 1 ? t('wizard.title_ready') : t('wizard.title_left', { count: setup.left })
  return (
    <DarkHero>
      <div className="grid items-center gap-10 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="min-w-0">
          <HeroPill>{t('wizard.eyebrow')}</HeroPill>
          <h2 className="mt-5 max-w-xl text-[28px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[36px]">
            <BlurText key={title} text={title} />
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/55">{t('wizard.subtitle')}</p>

          <div className="mt-7 max-w-md">
            <div className="flex gap-1.5">
              {setup.steps.map(s => (
                <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.span className="block h-full rounded-full bg-white" initial={reduce ? false : { width: 0 }}
                    animate={{ width: s.state === 'done' ? '100%' : s.state === 'current' ? '38%' : '0%' }}
                    transition={{ duration: 0.9, ease: EASE, delay: s.index * 0.08 }} />
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] font-medium text-white/45">{t('wizard.progress', { done: String(setup.done), total: String(setup.total) })}</p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onContinue} className={heroButton}>
              {setup.blocking ? t('home.continue_with', { step: t(`wizard.${setup.current}_title`) }) : t('home.go_launch')}<ArrowRight />
            </button>
            <span className="text-[12.5px] text-white/40">{t('home.setup_hint')}</span>
          </div>
        </div>

        <SetupMap setup={setup} selected={selected} onSelect={onSelect} />
      </div>
    </DarkHero>
  )
}

const INPUTS: StepId[] = ['store', 'google', 'tracking', 'costs']
const CURVES = [-36, -12, 12, 36]

/**
 * Harta: patru intrări (magazinul, Google Ads, Merchant și conversiile, costurile)
 * curg spre Hontrio, care lansează campania. O legătură făcută are raza aprinsă;
 * una lipsă e punctată. Fiecare nod deschide pasul lui.
 */
function SetupMap({ setup, selected, onSelect }: { setup: Setup; selected: StepId; onSelect: (id: StepId) => void }) {
  const { t } = useT()
  const box = useRef<HTMLDivElement>(null)
  const core = useRef<HTMLDivElement>(null)
  const out = useRef<HTMLSpanElement>(null)
  const n0 = useRef<HTMLSpanElement>(null)
  const n1 = useRef<HTMLSpanElement>(null)
  const n2 = useRef<HTMLSpanElement>(null)
  const n3 = useRef<HTMLSpanElement>(null)
  const nodes = [n0, n1, n2, n3]
  const byId = new Map(setup.steps.map(s => [s.id, s]))
  const ready = setup.blocking === null
  const launchSelected = selected === 'launch'

  return (
    <div ref={box} className="relative hidden h-[300px] w-full md:block" aria-label={t('home.map_label')} role="group">
      {INPUTS.map((id, i) => (
        <AnimatedBeam key={id} containerRef={box} fromRef={nodes[i]} toRef={core} active={byId.get(id)?.state === 'done'}
          curvature={CURVES[i]} delay={i * 0.45} duration={3.6} endXOffset={-26} />
      ))}
      <AnimatedBeam containerRef={box} fromRef={core} toRef={out} active={ready} duration={2.4} startXOffset={30} />

      <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-2">
        {INPUTS.map((id, i) => {
          const step = byId.get(id)
          return step ? <MapNode key={id} nodeRef={nodes[i]} step={step} label={t(`wizard.${id}_title`)} selected={selected === id} onSelect={onSelect} /> : null
        })}
      </div>

      {/* Hontrio, în mijloc */}
      <div className="absolute left-[63%] top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Ripple size={86} rings={4} step={50} />
        <div ref={core} className="relative flex size-[66px] items-center justify-center rounded-[20px] bg-white shadow-[0_0_44px_rgba(255,255,255,0.28)]">
          <Image src="/logo-icon.png" alt="Hontrio" width={32} height={32} className="select-none" />
        </div>
      </div>

      {/* Campania */}
      <button type="button" onClick={() => onSelect('launch')} className="group absolute right-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2.5 focus-visible:outline-none">
        <span ref={out} className={cn('relative flex size-[54px] items-center justify-center rounded-full transition-all duration-300 [&_svg]:size-5',
          ready ? 'bg-white text-neutral-950 shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'bg-white/[0.04] text-white/40 ring-1 ring-white/15',
          launchSelected && 'ring-2 ring-white ring-offset-[3px] ring-offset-[#0a0a0a]',
          'group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-white/60')}>
          {ready && <span aria-hidden className="absolute inset-0 animate-ping rounded-full ring-1 ring-white/50 motion-reduce:animate-none" />}
          <Rocket />
        </span>
        <span className={cn('text-[12px] font-medium', ready ? 'text-white' : 'text-white/40')}>{t('home.map_campaign')}</span>
      </button>
    </div>
  )
}

function MapNode({ nodeRef, step, label, selected, onSelect }: {
  nodeRef: RefObject<HTMLSpanElement | null>; step: SetupStep; label: string; selected: boolean; onSelect: (id: StepId) => void
}) {
  const { t } = useT()
  const Icon = step.icon
  return (
    <button type="button" onClick={() => onSelect(step.id)} aria-pressed={selected}
      aria-label={`${label}: ${t(`wizard.state_${step.state === 'done' ? 'done' : step.state === 'current' ? 'current' : 'next'}`)}`}
      className="group flex items-center gap-3 text-left focus-visible:outline-none">
      <span className={cn('w-[124px] text-right text-[12.5px] font-medium leading-tight transition-colors',
        step.state === 'done' ? 'text-white/70' : step.state === 'current' ? 'text-white' : 'text-white/35', 'group-hover:text-white')}>
        {label}
      </span>
      <span ref={nodeRef} className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 [&_svg]:size-[18px]',
        step.state === 'done' && 'bg-white text-neutral-950 shadow-[0_0_28px_rgba(255,255,255,0.22)]',
        step.state === 'current' && 'bg-white/[0.08] text-white ring-1 ring-white/70',
        step.state === 'next' && 'bg-white/[0.03] text-white/35 ring-1 ring-white/15',
        selected && 'ring-2 ring-white ring-offset-[3px] ring-offset-[#0a0a0a]',
        'group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-white/60')}>
        {step.state === 'current' && <span aria-hidden className="absolute inset-0 animate-ping rounded-2xl ring-1 ring-white/40 motion-reduce:animate-none" />}
        <Icon />
        {step.state === 'done' && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-400 text-neutral-950 ring-2 ring-[#0a0a0a]">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
        )}
      </span>
    </button>
  )
}

// ── După lansare ──────────────────────────────────────────────────────────────

export type HeroAds = { cost: number; value: number; conversions: number; roas: number | null; break_even: number | null; profit: number | null }

export function CampaignHero({ ads, series, days, period, mode, proposals, f }: {
  /** Cifrele Google Ads ale perioadei alese; null = nicio cheltuială încă. */
  ads: HeroAds | null
  series: SeriesPoint[]
  days: number
  period: string
  mode: 'approve' | 'auto'
  proposals: number
  f: Formats
}) {
  const { t } = useT()
  const shown = series.slice(-Math.min(days, series.length))
  const roas = ads?.roas ?? null
  const be = ads?.break_even ?? null
  const above = roas !== null && be !== null ? roas >= be : null
  // Bara ROAS-ului: pragul pe la două treimi, ca diferența să se vadă în ambele sensuri
  const scale = Math.max(roas ?? 0, (be ?? 0) * 1.5, 1)

  return (
    <DarkHero>
      <div className="grid gap-10 p-6 sm:p-9 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <HeroPill live>{t('home.pilot_on', { mode: t(`campaigns.mode_${mode}`) })}</HeroPill>
            {proposals > 0 && (
              <Link href="/campaigns?tab=pilot" className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-neutral-950 transition hover:bg-neutral-200">
                <Sparkles className="size-3" />{t('home.proposals_waiting', { count: proposals })}
              </Link>
            )}
          </div>

          <p className="mt-6 text-[13px] font-medium text-white/50">{t('home.profit_label', { period: period.toLowerCase() })}</p>
          {ads ? (
            <>
              <p className={cn('mt-1 text-[44px] font-semibold leading-none tabular-nums tracking-[-0.045em] sm:text-[52px]',
                ads.profit !== null && ads.profit < 0 && 'text-red-300')}>
                {ads.profit === null ? '—' : <NumberTicker value={ads.profit} format={n => f.money.format(Math.round(n))} />}
              </p>
              <p className="mt-2 text-[12.5px] text-white/40">{t('home.profit_hint')}</p>

              <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
                <HeroStat label={t('overview.ads_spend')} value={f.money.format(ads.cost)} />
                <HeroStat label={t('home.ads_sales')} value={f.money.format(ads.value)} />
                <div>
                  <dt className="text-[12px] text-white/45">ROAS</dt>
                  <dd className={cn('mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.02em]', above === false && 'text-red-300')}>
                    {roas === null ? '—' : f.num.format(roas)}
                  </dd>
                  {roas !== null && be !== null && (
                    <div className="mt-2">
                      <div className="relative h-1 rounded-full bg-white/10">
                        <motion.div className={cn('h-full rounded-full', above ? 'bg-white' : 'bg-red-300')}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(100, (roas / scale) * 100)}%` }} transition={{ duration: 1, ease: EASE }} />
                        <span aria-hidden className="absolute -top-1 h-3 w-px bg-white/60" style={{ left: `${(be / scale) * 100}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-white/40">{t('overview.ads_roas_be', { roas: f.num.format(be) })}</p>
                    </div>
                  )}
                </div>
              </dl>
            </>
          ) : (
            <div className="mt-3 flex items-start gap-3">
              <StatusMark status="running" size={22} className="mt-1 text-white" />
              <div>
                <p className="text-[22px] font-semibold tracking-[-0.03em]">{t('home.warming_title')}</p>
                <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-white/50">{t('home.warming_desc')}</p>
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Link href="/campaigns" className={heroButton}>{t('home.see_campaigns')}<ArrowRight /></Link>
            <Link href="/reports" className={ghostButton}>{t('home.see_reports')}</Link>
          </div>
        </div>

        <HeroChart data={shown} f={f} />
      </div>
    </DarkHero>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-white/45">{label}</dt>
      <dd className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.02em]">{value}</dd>
    </div>
  )
}

/** Vânzările din reclame (linia albă) și cheltuiala (punctată) pe zile, pe negru. */
function HeroChart({ data, f }: { data: SeriesPoint[]; f: Formats }) {
  const { t } = useT()
  const id = useId().replace(/:/g, '')
  const points = data.map(d => ({ label: f.shortDate.format(day(d.date)), value: d.value, cost: d.cost, profit: d.profit }))
  const empty = points.every(p => p.value === 0 && p.cost === 0)
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-end gap-4 text-[11.5px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-white" />{t('home.ads_sales')}</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-white/50" />{t('overview.ads_spend')}</span>
      </div>
      <div className="relative h-[230px]">
        {empty ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-[12.5px] text-white/35">{t('home.chart_waiting')}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`hv-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
                <filter id={`hg-${id}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={36} />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof points)[number]
                  return (
                    <div className="rounded-xl border border-white/10 bg-neutral-900/95 px-3 py-2 text-[12px] text-white shadow-2xl backdrop-blur">
                      <p className="mb-1 font-medium text-white/60">{label}</p>
                      <p className="flex justify-between gap-6"><span className="text-white/60">{t('home.ads_sales')}</span><span className="font-semibold tabular-nums">{f.money.format(p.value)}</span></p>
                      <p className="flex justify-between gap-6"><span className="text-white/60">{t('overview.ads_spend')}</span><span className="tabular-nums">{f.money.format(p.cost)}</span></p>
                      {p.profit !== null && (
                        <p className="mt-1 flex justify-between gap-6 border-t border-white/10 pt-1"><span className="text-white/60">{t('home.profit_short')}</span>
                          <span className={cn('font-semibold tabular-nums', p.profit < 0 ? 'text-red-300' : 'text-emerald-300')}>{f.money.format(p.profit)}</span></p>
                      )}
                    </div>
                  )
                }} />
              <Area type="monotone" dataKey="cost" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false}
                activeDot={{ r: 3, fill: '#a3a3a3', stroke: '#0a0a0a', strokeWidth: 2 }} isAnimationActive animationDuration={1100} />
              <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} fill={`url(#hv-${id})`} filter={`url(#hg-${id})`} dot={false}
                activeDot={{ r: 4.5, fill: '#ffffff', stroke: '#0a0a0a', strokeWidth: 2 }} isAnimationActive animationDuration={1300} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
