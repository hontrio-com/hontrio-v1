'use client'

import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

// =============================================
// Ce îi arată omului că se întâmplă ceva:
//   ProgressCircle, Confetti, AnimatedList — Magic UI (magicui.design, MIT)
//   LaunchSteps — Multi Step Loader din Aceternity UI (ui.aceternity.com; folosire
//   în aplicații, fără redistribuirea codului)
//   StatusMark și bifa desenată (Stepper) — React Bits (reactbits.dev, MIT +
//   Commons Clause: se folosește în produs, nu se revinde)
// Toate țin cont de „reduce motion" din sistem.
// =============================================

/**
 * Câți pași s-au făcut, ca un cerc cu o mică pauză între capete (Magic UI ·
 * Animated Circular Progress Bar), cu „2/5" în mijloc. `tone="dark"` pe negru.
 */
export function ProgressCircle({ value, max, label, size = 64, tone = 'light', className }: {
  value: number; max: number; label?: string; size?: number; tone?: 'light' | 'dark'; className?: string
}) {
  const r = 45
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const gap = 0.04
  const filled = Math.max(0, pct - (pct > 0 && pct < 1 ? gap : 0))
  const rest = pct >= 1 ? 0 : Math.max(0, 1 - pct - (pct > 0 ? gap * 2 : 0))
  const dark = tone === 'dark'
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" fill="none">
          {rest > 0 && (
            <circle cx="50" cy="50" r={r} strokeWidth="8" strokeLinecap="round" stroke={dark ? 'rgba(255,255,255,0.14)' : '#e5e5e5'}
              strokeDasharray={`${rest * c} ${c}`} transform={`rotate(${(pct + (pct > 0 ? gap : 0)) * 360} 50 50)`}
              style={{ transition: 'stroke-dasharray 1s ease, transform 1s ease' }} />
          )}
          <circle cx="50" cy="50" r={r} strokeWidth="8" strokeLinecap="round" stroke={dark ? '#ffffff' : '#0a0a0a'}
            strokeDasharray={`${filled * c} ${c}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums tracking-[-0.02em]', dark ? 'text-white' : 'text-neutral-950')}>
          {value}<span className={dark ? 'text-white/40' : 'text-neutral-400'}>/{max}</span>
        </span>
      </div>
      {label && <span className={cn('text-[11px] font-medium', dark ? 'text-white/50' : 'text-neutral-500')}>{label}</span>}
    </div>
  )
}

/** Bifa care se desenează (React Bits · Stepper). */
export function DrawnCheck({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className={className} aria-hidden>
      <motion.path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.08, type: 'tween', ease: 'easeOut', duration: 0.3 }} />
    </svg>
  )
}

export type MarkStatus = 'pending' | 'running' | 'done'

const MARK_UI = { type: 'spring' as const, duration: 0.3, bounce: 0 }
const MARK_MORPH = { duration: 0.3, ease: [0.77, 0, 0.175, 1] as [number, number, number, number] }
const MARK_IDLE_DASH = 0.3

/**
 * Starea unui pas (React Bits · Status Mark): inel punctat (urmează), arc care se
 * rotește (acum), apoi bifa care se desenează (gata). Culoarea vine din `text-*`;
 * bifa ia culoarea `check`.
 */
export function StatusMark({ status, size = 22, strokeWidth = 2, dashes = 8, check = 'stroke-white', className }: {
  status: MarkStatus; size?: number; strokeWidth?: number; dashes?: number; check?: string; className?: string
}) {
  const reduce = useReducedMotion()
  const r = 10 - strokeWidth / 2
  const C = 2 * Math.PI * r
  const P = C / Math.max(1, dashes)
  const running = status === 'running'
  const solid = status !== 'pending'
  const targetArc = running ? 0.68 : 1

  const mode = useMotionValue(solid ? 1 : 0)
  const arc = useMotionValue(targetArc)
  const travel = useMotionValue(0)
  const ringRef = useRef<SVGCircleElement>(null)
  const geo = useRef({ C, P })
  const generation = useRef(0)

  // Inelul trece din punctat (mode 0) în arc continuu (mode 1), lungimea lui fiind `arc`
  const writeDash = useCallback(() => {
    const { C: c, P: p } = geo.current
    const m = mode.get()
    const a = arc.get()
    const dash = MARK_IDLE_DASH * p + (a * c - MARK_IDLE_DASH * p) * m
    const gap = (1 - MARK_IDLE_DASH) * p + ((1 - a) * c - (1 - MARK_IDLE_DASH) * p) * m
    ringRef.current?.setAttribute('stroke-dasharray', `${Math.max(0, dash)} ${Math.max(0, gap)}`)
  }, [mode, arc])

  useLayoutEffect(() => {
    geo.current = { C, P }
    writeDash()
    ringRef.current?.setAttribute('stroke-dashoffset', String(travel.get()))
  }, [C, P, writeDash, travel])

  useEffect(() => {
    const offs = [
      mode.on('change', writeDash),
      arc.on('change', writeDash),
      travel.on('change', v => ringRef.current?.setAttribute('stroke-dashoffset', String(v))),
    ]
    return () => {
      offs.forEach(off => off())
      mode.stop(); arc.stop(); travel.stop()
    }
  }, [mode, arc, travel, writeDash])

  useEffect(() => {
    const g = ++generation.current
    if (reduce) {
      mode.jump(solid ? 1 : 0); arc.jump(targetArc); travel.jump(0)
      return
    }
    if (mode.get() === 0) arc.jump(targetArc)
    animate(mode, solid ? 1 : 0, MARK_MORPH)
    animate(arc, targetArc, MARK_UI)
    if (running) {
      const from = travel.get()
      const spin = animate(travel, [from, from - C], { duration: 1.1, ease: 'linear', repeat: Infinity })
      return () => spin.stop()
    }
    animate(travel, Math.floor(travel.get() / P) * P, MARK_UI).then(() => {
      if (generation.current === g) travel.jump(0)
    })
  }, [status, running, solid, targetArc, reduce, C, P, mode, arc, travel])

  return (
    <span data-status={status} aria-hidden className={cn('group inline-flex shrink-0', className)}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="overflow-visible">
        <circle cx="12" cy="12" r={r} transform="rotate(-90 12 12)" strokeWidth={strokeWidth}
          className="fill-current stroke-current [fill-opacity:0] [stroke-opacity:0] [transition:fill-opacity_180ms_ease,stroke-opacity_200ms_ease] group-data-[status=running]:[stroke-opacity:0.15] group-data-[status=done]:[fill-opacity:1]" />
        <circle ref={ringRef} cx="12" cy="12" r={r} transform="rotate(-90 12 12)" strokeWidth={strokeWidth} strokeLinecap="round"
          className="fill-none stroke-current opacity-50 [transition:opacity_200ms_ease] group-data-[status=done]:opacity-100 group-data-[status=running]:opacity-100" />
        <path d="M7.5 12.25 10.5 15.25 16.75 8.75" pathLength={1} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" strokeLinejoin="round"
          className={cn('fill-none [stroke-dasharray:1_2] [stroke-dashoffset:1.05] opacity-0 [transition:stroke-dashoffset_160ms_cubic-bezier(0.23,1,0.32,1),opacity_0ms_linear_160ms] group-data-[status=done]:opacity-100 group-data-[status=done]:[stroke-dashoffset:0] group-data-[status=done]:[transition:stroke-dashoffset_240ms_cubic-bezier(0.23,1,0.32,1)_120ms,opacity_0ms_linear_120ms] motion-reduce:[stroke-dashoffset:0]', check)} />
      </svg>
    </span>
  )
}

/**
 * Ce se întâmplă cât durează o operație lungă (Aceternity UI · Multi Step Loader):
 * pașii trec unul câte unul peste un fundal estompat. Rămâne pe ultimul până se
 * termină operația; nu se întoarce la început.
 */
export function LaunchSteps({ open, title, hint, steps, every = 2200 }: { open: boolean; title: ReactNode; hint?: ReactNode; steps: string[]; every?: number }) {
  // Peste toată pagina: un părinte cu transform/filter (animațiile de apariție) ar prinde
  // `position: fixed` în el, așa că stratul stă direct în <body>
  const client = useSyncExternalStore(noSubscribe, () => true, () => false)
  if (!client) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-xl"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <StepsCore title={title} hint={hint} steps={steps} every={every} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const noSubscribe = () => () => {}

function StepsCore({ title, hint, steps, every }: { title: ReactNode; hint?: ReactNode; steps: string[]; every: number }) {
  const [at, setAt] = useState(0)
  // Componenta se montează la fiecare deschidere: pornește mereu de la primul pas
  useEffect(() => {
    if (at >= steps.length - 1) return
    const timer = setTimeout(() => setAt(a => Math.min(a + 1, steps.length - 1)), every)
    return () => clearTimeout(timer)
  }, [at, steps.length, every])

  return (
    <div className="w-full max-w-sm px-6">
      <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-neutral-500">{hint}</p>}
      <ol className="mt-6 space-y-3.5">
        {steps.map((s, i) => {
          const state = i < at ? 'done' : i === at ? 'now' : 'later'
          return (
            <motion.li key={s} className="flex items-center gap-3"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: state === 'later' ? 0.4 : 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
              <StatusMark status={state === 'done' ? 'done' : state === 'now' ? 'running' : 'pending'}
                className={state === 'later' ? 'text-neutral-400' : 'text-neutral-950'} />
              <span className={cn('text-[14px]', state === 'now' ? 'font-medium text-neutral-950' : 'text-neutral-600')}>{s}</span>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Confetti o singură dată, la montare (Magic UI · Confetti, peste canvas-confetti),
 * în nuanțe de gri. Nimic dacă sistemul cere mai puțină mișcare.
 */
export function ConfettiBurst() {
  useEffect(() => {
    const colors = ['#0a0a0a', '#404040', '#737373', '#d4d4d4']
    const shoot = (x: number, angle: number) => confetti({
      particleCount: 70, spread: 62, startVelocity: 46, angle, origin: { x, y: 0.62 }, colors, ticks: 220, scalar: 0.9, disableForReducedMotion: true,
    })
    shoot(0.3, 60)
    shoot(0.7, 120)
    return () => { confetti.reset() }
  }, [])
  return null
}

/**
 * O listă ale cărei rânduri intră unul după altul (Magic UI · Animated List),
 * cel mai nou sus. Pentru jurnale și activitate.
 */
export function AnimatedList({ children, every = 420, className }: { children: ReactNode; every?: number; className?: string }) {
  const reduce = useReducedMotion()
  const items = Children.toArray(children)
  const [count, setCount] = useState(reduce ? items.length : 1)
  useEffect(() => {
    if (count >= items.length) return
    const timer = setTimeout(() => setCount(c => c + 1), every)
    return () => clearTimeout(timer)
  }, [count, items.length, every])
  const shown = reduce ? items : items.slice(0, count)
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence initial={false}>
        {shown.map((item, i) => (
          <motion.div key={(item as { key?: string }).key ?? i} layout
            initial={reduce ? false : { scale: 0.92, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 38 }}>
            {item}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
