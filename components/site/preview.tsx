'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { BarChart3, Check, Lightbulb, LayoutGrid, Megaphone, Package, PackageX, RotateCcw, SearchX, Settings, TrendingUp, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { NumberTicker } from '@/components/app/motion'
import { cn } from '@/lib/utils'

// =============================================
// Previzualizarea platformei din pagina principală, cu date demonstrative:
// cifrele lunii, graficul și pilotul automat, ale cărui propuneri le poți
// aproba sau respinge chiar aici. Cifrele se calculează din serii, ca să fie
// între ele la fel de coerente ca în aplicație (profit = vânzări ÷ prag − cost).
// =============================================

// Vânzările din reclame și cheltuiala, pe ultimele 30 de zile (RON)
const SALES = [520, 548, 531, 572, 590, 566, 604, 631, 598, 622, 655, 640, 618, 661, 690, 672, 648, 684, 712, 695, 668, 701, 728, 714, 689, 720, 748, 731, 706, 742]
const SPEND = [118, 121, 117, 124, 126, 121, 127, 130, 124, 127, 131, 128, 124, 130, 134, 131, 126, 132, 136, 133, 128, 133, 137, 134, 130, 135, 139, 136, 132, 137]
const BREAK_EVEN = 2.8
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const SALES_TOTAL = total(SALES)
const SPEND_TOTAL = total(SPEND)
const ROAS = SALES_TOTAL / SPEND_TOTAL
const PROFIT = SALES_TOTAL / BREAK_EVEN - SPEND_TOTAL

/** O curbă netedă (Catmull-Rom) prin puncte, ca drum SVG. */
function smooth(points: [number, number][]) {
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}
const W = 300
const H = 96
const toPoints = (xs: number[]) => xs.map((v, i) => [(i / (xs.length - 1)) * W, H - 8 - (v / 800) * (H - 16)] as [number, number])
const SALES_PATH = smooth(toPoints(SALES))
const SPEND_PATH = smooth(toPoints(SPEND))
const AREA_PATH = `${SALES_PATH} L ${W},${H} L 0,${H} Z`

const PROPOSALS = [
  { kind: 'site.preview_kind_negatives', text: 'site.preview_text_negatives', icon: SearchX },
  { kind: 'site.preview_kind_budget', text: 'site.preview_text_budget', icon: TrendingUp },
  { kind: 'site.preview_kind_products', text: 'site.preview_text_products', icon: PackageX },
] as const

function Chart({ animate }: { animate: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="site-preview-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#0a0a0a" strokeOpacity="0.06" strokeDasharray="2 4" />)}
      <motion.path d={AREA_PATH} fill="url(#site-preview-area)" initial={{ opacity: 0 }} animate={{ opacity: animate ? 1 : 0 }} transition={{ duration: 1, delay: 0.6 }} />
      <motion.path d={SPEND_PATH} fill="none" stroke="#a3a3a3" strokeWidth="1.5" strokeDasharray="4 4" 
        initial={{ pathLength: 0 }} animate={{ pathLength: animate ? 1 : 0 }} transition={{ duration: 1.4, ease: 'easeOut' }} />
      <motion.path d={SALES_PATH} fill="none" stroke="#0a0a0a" strokeWidth="2"  strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: animate ? 1 : 0 }} transition={{ duration: 1.6, ease: 'easeOut' }} />
    </svg>
  )
}

/** Pilotul automat: propunerile vin pe rând; le aprobi, le respingi sau le lași să curgă singure. */
function Pilot({ active }: { active: boolean }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  const [outcome, setOutcome] = useState<null | 'applied' | 'rejected'>(null)
  const [hover, setHover] = useState(false)
  const done = step >= PROPOSALS.length

  // După un răspuns, trece la propunerea următoare
  useEffect(() => {
    if (!outcome) return
    const timer = setTimeout(() => { setStep(s => s + 1); setOutcome(null) }, 1100)
    return () => clearTimeout(timer)
  }, [outcome])

  // Singur, cât nu te uiți la el: aprobă propunerea, iar la final o ia de la capăt
  useEffect(() => {
    if (!active || hover || reduce || outcome) return
    const timer = setTimeout(() => {
      if (done) setStep(0)
      else setOutcome('applied')
    }, done ? 5200 : 4200)
    return () => clearTimeout(timer)
  }, [active, hover, reduce, outcome, done, step])

  const current = PROPOSALS[Math.min(step, PROPOSALS.length - 1)]
  const left = PROPOSALS.length - step - 1

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      className="flex min-h-[214px] flex-col rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-neutral-900">{t('site.preview_pilot')}</p>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-medium text-neutral-600">{t('site.preview_mode')}</span>
      </div>
      <div className="relative mt-3 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-black text-white"><Check className="size-4" strokeWidth={3} /></span>
              <p className="max-w-[220px] text-[12px] leading-relaxed text-neutral-500">{t('site.preview_done')}</p>
              <button type="button" onClick={() => setStep(0)} className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-black hover:underline">
                <RotateCcw className="size-3" />{t('site.preview_again')}
              </button>
            </motion.div>
          ) : (
            <motion.div key={step} initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }} transition={{ duration: 0.35 }}
              className="rounded-xl border border-line bg-neutral-50/70 p-3">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black text-white"><current.icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-neutral-900">{t(current.kind)}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-neutral-500">{t(current.text)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1.5">
                <AnimatePresence mode="wait" initial={false}>
                  {outcome ? (
                    <motion.span key="outcome" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold',
                        outcome === 'applied' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500')}>
                      {outcome === 'applied' ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                      {t(outcome === 'applied' ? 'site.preview_applied' : 'site.preview_rejected')}
                    </motion.span>
                  ) : (
                    <motion.span key="actions" className="flex gap-1.5" exit={{ opacity: 0 }}>
                      <button type="button" onClick={() => setOutcome('rejected')}
                        className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] font-semibold text-neutral-700 transition hover:border-black">
                        <X className="size-3" />{t('site.preview_reject')}
                      </button>
                      <button type="button" onClick={() => setOutcome('applied')}
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-black px-2.5 text-[11px] font-semibold text-white transition hover:bg-neutral-800">
                        <Check className="size-3" />{t('site.preview_approve')}
                      </button>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!done && left > 0 && <p className="mt-2 text-center text-[11px] text-neutral-400">{t('site.preview_queue', { count: left })}</p>}
    </div>
  )
}

export function ProductPreview() {
  const { t, intlLocale } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, margin: '-80px' })
  const seen = useInView(ref, { once: true, margin: '-80px' })
  const money = (n: number) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(Math.round(n))
  const one = (n: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
  const bars = SALES.slice(-14)

  return (
    <figure ref={ref} aria-label={t('site.preview_label')}
      className="overflow-hidden rounded-[1.6rem] border border-line bg-white text-left shadow-[0_2px_4px_rgba(0,0,0,0.03),0_40px_100px_-40px_rgba(0,0,0,0.45)]">
      {/* Bara browserului */}
      <div className="flex items-center gap-3 border-b border-line bg-neutral-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="size-2.5 rounded-full bg-neutral-200" />)}</span>
        <span className="mx-auto hidden rounded-full border border-line bg-white px-3 py-0.5 font-mono text-[11px] text-neutral-500 sm:block">app.hontrio.com{/* i18n-ignore */}</span>
        <span className="ml-auto rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white sm:ml-0">{t('site.preview_demo')}</span>
      </div>

      <div className="flex">
        {/* Meniul aplicației, în miniatură */}
        <div className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-[#fbfbfb] py-4 lg:flex" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="mb-2 size-6" />
          {[LayoutGrid, Megaphone, BarChart3, Package, Lightbulb, Settings].map((Icon, i) => (
            <span key={i} className={cn('grid size-9 place-items-center rounded-xl', i === 0 ? 'bg-white text-black shadow-sm ring-1 ring-line' : 'text-neutral-400')}>
              <Icon className="size-4" />
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 bg-[#f7f7f8] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-neutral-400">{t('site.preview_store_line')}</p>
              <p className="mt-0.5 text-xl font-bold tracking-[-0.03em] text-neutral-950 sm:text-2xl">{t('site.preview_hello')}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-black/40 motion-reduce:hidden" /><span className="relative inline-flex size-2 rounded-full bg-black" /></span>
              {t('site.preview_status')}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] p-4 text-white">
              <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
              <p className="relative text-[11.5px] text-white/60">{t('site.preview_profit')}</p>
              <p className="relative mt-1 text-[22px] font-bold tracking-[-0.03em] tabular-nums"><NumberTicker value={PROFIT} format={money} /></p>
              <p className="relative text-[10.5px] text-white/45">{t('site.preview_period')}</p>
              <div className="relative mt-3 flex h-8 items-end gap-[3px]">
                {bars.map((v, i) => (
                  <motion.span key={i} className={cn('flex-1 rounded-[2px]', i === bars.length - 1 ? 'bg-white' : 'bg-white/25')}
                    initial={{ height: 2 }} animate={{ height: seen ? `${((v - 450) / 320) * 100}%` : 2 }} transition={{ duration: 0.6, delay: 0.3 + i * 0.03 }} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11.5px] text-neutral-500">{t('site.preview_sales')}</p>
              <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-neutral-950 tabular-nums"><NumberTicker value={SALES_TOTAL} format={money} /></p>
              <p className="text-[10.5px] text-neutral-400">{t('site.preview_period')}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-[11.5px] text-neutral-500">{t('site.preview_roas')}</p>
              <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-neutral-950 tabular-nums"><NumberTicker value={ROAS} format={one} /></p>
              <p className="text-[10.5px] text-neutral-400">{t('site.preview_breakeven', { value: one(BREAK_EVEN) })}</p>
              <div className="relative mt-3 h-1.5 rounded-full bg-neutral-100">
                <span className="absolute inset-y-0 left-0 rounded-full bg-neutral-300" style={{ width: `${(BREAK_EVEN / 8) * 100}%` }} />
                <motion.span className="absolute -top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-black shadow"
                  initial={{ left: '0%' }} animate={{ left: seen ? `${(ROAS / 8) * 100}%` : '0%' }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }} />
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-neutral-900">{t('site.preview_chart')}</p>
                <span className="flex items-center gap-3 text-[10.5px] text-neutral-500">
                  <span className="flex items-center gap-1"><span className="h-0.5 w-3.5 rounded-full bg-black" />{t('site.preview_legend_sales')}</span>
                  <span className="flex items-center gap-1"><span className="w-3.5 border-t border-dashed border-neutral-400" />{t('site.preview_legend_spend')}</span>
                </span>
              </div>
              <div className="mt-3"><Chart animate={seen} /></div>
            </div>
            <Pilot active={inView} />
          </div>
        </div>
      </div>
    </figure>
  )
}
