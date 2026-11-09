'use client'

import { type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/app/motion'

// =============================================
// Rândul de cifre de pe Dashboard, ca la Bezeno: patru carduri, primul negru;
// fiecare cu iconița, eticheta, o pastilă cu tendința, cifra mare, o frază și
// barele pe ultimele 14 zile (cea de azi e evidențiată; zilele fără nimic sunt
// puncte, ca, cardul să nu pară gol). Lumina urmărește cursorul pe card.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

export type Stat = {
  key: string
  icon: LucideIcon
  label: string
  value: number
  format: (n: number) => string
  hint: ReactNode
  /** Valorile pe zile, de la cea mai veche la azi; fără ele, `footer`. */
  series?: number[]
  /** Etichetele de sub bare (ex. „acum 14 zile" / „azi"). */
  axis?: [string, string]
  /** Textul din pastilă (ex. „+12% față de înainte"); `up` o face neagră. */
  trend?: { text: string; up: boolean | null }
  /** În locul barelor (ex. o bară de proporție). */
  footer?: ReactNode
}

/** Barele pe 14 zile: înălțimea după valoare, valoarea apare la trecerea cursorului. */
function Bars({ data, dark, delay, format }: { data: number[]; dark: boolean; delay: number; format: (n: number) => string }) {
  const reduce = useReducedMotion()
  const max = Math.max(1, ...data.map(v => Math.max(0, v)))
  return (
    <div className="flex h-14 items-end gap-[3px]">
      {data.map((v, i) => {
        const h = v > 0 ? Math.max(14, (v / max) * 100) : 0
        const hot = i === data.length - 1
        return (
          <div key={i} className="group/bar relative flex h-full flex-1 items-end">
            {v > 0 ? (
              <motion.div initial={reduce ? false : { height: 0 }} animate={{ height: `${h}%` }}
                transition={{ delay: delay + i * 0.03, type: 'spring', stiffness: 160, damping: 18 }}
                className={cn('w-full rounded-[5px]', dark ? (hot ? 'bg-white' : 'bg-white/35') : hot ? 'bg-black' : 'bg-neutral-300')} />
            ) : (
              <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: delay + i * 0.03 }}
                className={cn('mx-auto h-[5px] w-full rounded-full', dark ? (hot ? 'bg-white/70' : 'bg-white/15') : hot ? 'bg-black/60' : 'bg-neutral-200')} />
            )}
            {v > 0 && (
              <span className={cn('pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold opacity-0 transition group-hover/bar:opacity-100',
                dark ? 'bg-white text-black' : 'bg-black text-white')}>
                {format(v)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ s, i }: { s: Stat; i: number }) {
  const reduce = useReducedMotion()
  const mx = useMotionValue(-200)
  const my = useMotionValue(-200)
  const dark = i === 0
  const glow = useMotionTemplate`radial-gradient(220px circle at ${mx}px ${my}px, ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'}, transparent 70%)`
  const Icon = s.icon

  return (
    <motion.div
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(e.clientX - r.left)
        my.set(e.clientY - r.top)
      }}
      onMouseLeave={() => { mx.set(-200); my.set(-200) }}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn('group relative flex flex-col overflow-hidden rounded-[1.6rem] border p-4 sm:p-5',
        dark
          ? 'border-black bg-[radial-gradient(120%_120%_at_0%_0%,#2a2a2a_0%,#0a0a0a_55%)] text-white shadow-[0_24px_50px_-28px_rgba(0,0,0,0.8)]'
          : 'border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_24px_50px_-32px_rgba(0,0,0,0.35)]')}>
      {/* Lumina de sub cursor și caroiajul fin */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glow }} />
      <div aria-hidden className={cn('pointer-events-none absolute inset-0 [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]',
        dark ? 'bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)]' : 'bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)]')} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', dark ? 'bg-white/10 ring-1 ring-white/15' : 'bg-neutral-100 ring-1 ring-black/5')}>
            <Icon className="size-4" />
          </span>
          <span className={cn('truncate text-sm font-medium', dark ? 'text-white/70' : 'text-neutral-500')}>{s.label}</span>
        </div>
        {s.trend && (
          <span className={cn('flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
            dark ? 'bg-white/10 text-white' : s.trend.up ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500')}>
            {s.trend.up === true && <ArrowUpRight className="size-3" />}
            {s.trend.up === false && <ArrowDownRight className="size-3" />}
            {s.trend.text}
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <div className="text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums sm:text-[2.6rem]">
          <NumberTicker value={s.value} format={s.format} />
        </div>
        <div className={cn('mt-1.5 text-xs', dark ? 'text-white/45' : 'text-neutral-400')}>{s.hint}</div>
      </div>

      <div className="relative -mx-1 mt-auto pt-3">
        {s.series ? (
          <>
            <Bars data={s.series} dark={dark} delay={0.15 + i * 0.08} format={s.format} />
            {s.axis && (
              <div className={cn('mt-1 flex justify-between px-1 text-[10px]', dark ? 'text-white/35' : 'text-neutral-300')}>
                <span>{s.axis[0]}</span><span>{s.axis[1]}</span>
              </div>
            )}
          </>
        ) : <div className="px-1">{s.footer}</div>}
      </div>
    </motion.div>
  )
}

/** Rândul de cifre: carduri de analiză, cu barele pe zile. */
export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {stats.map((s, i) => <StatCard key={s.key} s={s} i={i} />)}
    </div>
  )
}
