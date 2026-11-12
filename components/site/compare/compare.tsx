'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Reveal } from '../fx'
import { CompareHeader, CompareNote, PATHS, useAnswers, usePrice, type Path } from './shared'

// =============================================
// Comparația „Singur, cu o agenție sau cu Hontrio?”, varianta C: o lună din
// campania ta, zi cu zi. Trei rânduri de câte 30 de pătrățele; unul plin e o zi
// în care cineva chiar a lucrat la campanie: singur, câteva zile, când ai timp;
// o agenție, de obicei o dată pe săptămână; Hontrio, în fiecare zi. Sub fiecare
// rând, cât plătești și cine decide bugetul. Când graficul intră în ecran, zilele
// trec una câte una și se umplu. Cu „reduce motion”, luna apare direct plină
// (din CSS, ca serverul și browserul să randeze la fel).
// =============================================

const DAYS = 30
const ALL = Array.from({ length: DAYS }, (_, i) => i + 1)

/** Zilele în care cineva a lucrat la campanie: un exemplu, spus ca atare sub grafic. */
const WORKED: Record<Path, ReadonlySet<number>> = {
  solo: new Set([2, 6, 17, 26]), // când ai timp: câteva zile, la întâmplare
  agency: new Set([3, 10, 17, 24]), // de obicei o dată pe săptămână
  hontrio: new Set(ALL), // în fiecare zi
}

/** Cât durează trecerea lunii, în secunde. */
const SWEEP = 2.6

/** O zi: plină dacă a lucrat cineva la campanie; ziua la care a ajuns trecerea lunii are un contur. */
function Cell({ on, worked, now, newWeek }: { on: boolean; worked: boolean; now: boolean; newWeek: boolean }) {
  return (
    <span className={cn(
      'h-7 min-w-0 flex-1 rounded-[3px] transition-colors duration-300 sm:h-9 sm:rounded-[5px]',
      // O săptămână nouă: puțin mai mult loc, ca ritmul săptămânal să se vadă
      newWeek && 'ml-[3px] sm:ml-2',
      on ? 'bg-neutral-950' : 'bg-neutral-200/70',
      worked && 'motion-reduce:bg-neutral-950',
      now && 'relative z-10 shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#0a0a0a] motion-reduce:shadow-none',
    )} />
  )
}

function MonthRow({ path, day }: { path: Path; day: number }) {
  const { t } = useT()
  const price = usePrice()
  const answer = useAnswers()
  const ours = path === 'hontrio'
  const worked = WORKED[path]
  // Ziua la care a ajuns trecerea lunii (nimic înainte de început și după final)
  const now = day > 0 && day < DAYS ? day : 0

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 border-t border-line py-6 first:border-t-0 first:pt-0 last:pb-0 sm:py-7 md:grid-cols-[10.5rem_minmax(0,1fr)] md:items-start md:gap-x-10">
      {/* Cine și cât de des: pe telefon pe un rând, pe ecranele mari unul sub altul */}
      <div className="contents md:block">
        <p className={cn('text-[15.5px] font-semibold tracking-tight', ours ? 'text-neutral-950' : 'text-neutral-600')}>{t(`site.cmp_${path}`)}</p>
        <p className={cn('text-balance text-right text-[13.5px] leading-snug md:mt-1 md:text-left', ours ? 'font-medium text-neutral-950' : 'text-neutral-500')}>
          {answer('cadence', path).main}
        </p>
      </div>

      <div className="col-span-2 mt-3 md:col-span-1 md:mt-0">
        <div role="img" aria-label={t('site.cmpc_strip', { who: t(`site.cmp_${path}`), count: worked.size, total: DAYS })} className="flex gap-[2px] sm:gap-1">
          {ALL.map(d => (
            <Cell key={d} on={d <= day && worked.has(d)} worked={worked.has(d)} now={d === now} newWeek={d > 1 && (d - 1) % 7 === 0} />
          ))}
        </div>
        <p className={cn('mt-3 text-pretty text-[14px] leading-relaxed', ours ? 'text-neutral-950' : 'text-neutral-500')}>
          <span className={ours ? 'font-semibold' : 'font-medium text-neutral-700'}>{t(`site.cmpc_cost_${path}`, price)}</span>{' '}
          {t(`site.cmpc_decides_${path}`)}
        </p>
        {/* Treptele prețului Hontrio, sub 2% */}
        {ours && <p className="mt-0.5 text-pretty text-[13px] leading-relaxed text-neutral-500">{t('site.cmp_cost_hontrio_detail', price)}</p>}
      </div>
    </div>
  )
}

export function Compare() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const inView = useInView(panel, { once: true, amount: 0.45 })
  const progress = useMotionValue(0)
  const [day, setDay] = useState(0)
  useMotionValueEvent(progress, 'change', v => setDay(Math.min(DAYS, Math.ceil(v))))

  // Luna trece o singură dată, când graficul e destul de vizibil
  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(progress, DAYS, { duration: SWEEP, ease: 'linear', delay: 0.45 })
    return () => controls.stop()
  }, [inView, reduce, progress])

  return (
    <section id="cmp-c" className="scroll-mt-24 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <CompareHeader desc={t('site.cmpc_desc')} />

        <Reveal delay={0.08} className="mt-14 md:mt-20">
          <div ref={panel} className="md:rounded-[1.75rem] md:border md:border-line md:bg-white md:p-10 md:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_40px_80px_-60px_rgba(0,0,0,0.35)] lg:p-12">
            {/* Legenda și axa zilelor, deasupra pătrățelelor */}
            <div className="mb-7 md:mb-8 md:grid md:grid-cols-[10.5rem_minmax(0,1fr)] md:gap-x-10 md:gap-y-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-neutral-600 md:col-span-2">
                <li className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-[3px] bg-neutral-950" />{t('site.cmpc_legend_on')}</li>
                <li className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-[3px] bg-neutral-200/70" />{t('site.cmpc_legend_off')}</li>
              </ul>
              <div aria-hidden className="hidden justify-between text-[12.5px] tabular-nums text-neutral-400 md:col-start-2 md:flex">
                <span>{t('site.cmpc_day', { n: 1 })}</span>
                <span>{t('site.cmpc_day', { n: DAYS })}</span>
              </div>
            </div>

            <div>
              {PATHS.map(path => <MonthRow key={path} path={path} day={day} />)}
            </div>
          </div>
        </Reveal>

        <CompareNote before={t('site.cmpc_note')} className="mx-auto mt-8 max-w-2xl text-center md:mt-10" />
      </div>
    </section>
  )
}
