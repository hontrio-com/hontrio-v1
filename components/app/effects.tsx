'use client'

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type MotionStyle } from 'framer-motion'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

// =============================================
// Efectele vizuale ale platformei, luate din bibliotecile open source (MIT)
// și trecute pe alb și negru, ca logo-ul:
//   DotPattern, BorderBeam, ShimmerButton, AnimatedCircularProgressBar,
//   Confetti — Magic UI (magicui.design)
//   MultiStepLoader — Aceternity UI (ui.aceternity.com)
//   bifa care se desenează — Stepper din React Bits (reactbits.dev)
// Toate sunt discrete și țin cont de „reduce motion" din sistem: pe un ecran
// folosit zilnic, mișcarea arată unde e acțiunea, nu decorează.
// =============================================

/** Fundal de puncte (Magic UI · Dot Pattern). Culoarea vine din `text-*`; se estompează cu `mask-image`. */
export function DotPattern({ size = 16, radius = 1, className }: { size?: number; radius?: number; className?: string }) {
  const id = useId()
  return (
    <svg aria-hidden className={cn('pointer-events-none absolute inset-0 size-full fill-current', className)}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
          <circle cx={radius} cy={radius} r={radius} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * O rază care înconjoară conturul (Magic UI · Border Beam), în negru spre gri.
 * Se pune într-un părinte `relative` cu colțuri rotunjite; urmează conturul lui.
 */
export function BorderBeam({ size = 90, duration = 7, delay = 0, width = 1.5, from = '#0a0a0a', to = '#a3a3a3', className }: {
  size?: number; duration?: number; delay?: number; width?: number; from?: string; to?: string; className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth: width, borderStyle: 'solid' }}>
      <motion.div
        className={cn('absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent', className)}
        style={{ width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)`, '--beam-from': from, '--beam-to': to } as MotionStyle} // i18n-ignore
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  )
}

/**
 * Butonul principal al unui moment important (Magic UI · Shimmer Button): negru,
 * cu o sclipire albă care îi ocolește marginea. Oprit, e un buton negru simplu.
 */
export function ShimmerButton({ children, className, disabled, ...props }: React.ComponentProps<'button'>) {
  return (
    <button type="button" disabled={disabled}
      style={{ '--spread': '90deg', '--shimmer-color': '#ffffff', '--radius': '12px', '--speed': '2.8s', '--cut': '0.07em', '--bg': '#0a0a0a' } as CSSProperties}
      className={cn('group relative z-0 inline-flex h-11 cursor-pointer select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap px-6 text-[14px] font-semibold text-white',
        'border border-white/10 [background:var(--bg)] [border-radius:var(--radius)] shadow-[0_10px_28px_-10px_rgb(0_0_0/0.55)]',
        'transform-gpu transition-[transform,opacity,box-shadow] duration-200 hover:shadow-[0_14px_34px_-10px_rgb(0_0_0/0.6)] active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-neutral-900/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        className)}
      {...props}>
      {/* Sclipirea: un con de lumină care se rotește în spatele butonului */}
      {!disabled && (
        <span aria-hidden className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size] motion-reduce:hidden">
          <span className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
            <span className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
          </span>
        </span>
      )}
      {children}
      {/* Lumina de jos, care crește la hover */}
      <span aria-hidden className="absolute inset-0 size-full [border-radius:var(--radius)] shadow-[inset_0_-8px_10px_#ffffff1f] transition-shadow duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      {/* Fundalul, puțin mai mic decât butonul: lasă sclipirea să se vadă pe margine */}
      <span aria-hidden className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  )
}

/**
 * Câți pași s-au făcut, ca un cerc cu o mică pauză între capete (Magic UI ·
 * Animated Circular Progress Bar), cu „2/5" în mijloc.
 */
export function ProgressCircle({ value, max, label, size = 64, className }: { value: number; max: number; label?: string; size?: number; className?: string }) {
  const r = 45
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const gap = 0.04
  const filled = Math.max(0, pct - (pct > 0 && pct < 1 ? gap : 0))
  const rest = pct >= 1 ? 0 : Math.max(0, 1 - pct - (pct > 0 ? gap * 2 : 0))
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" fill="none">
          {rest > 0 && (
            <circle cx="50" cy="50" r={r} strokeWidth="9" strokeLinecap="round" stroke="#e5e5e5"
              strokeDasharray={`${rest * c} ${c}`} transform={`rotate(${(pct + (pct > 0 ? gap : 0)) * 360} 50 50)`}
              style={{ transition: 'stroke-dasharray 1s ease, transform 1s ease' }} />
          )}
          <circle cx="50" cy="50" r={r} strokeWidth="9" strokeLinecap="round" stroke="#0a0a0a"
            strokeDasharray={`${filled * c} ${c}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
          {value}<span className="text-neutral-400">/{max}</span>
        </span>
      </div>
      {label && <span className="text-[11px] font-medium text-neutral-500">{label}</span>}
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

/**
 * Ce se întâmplă cât durează o operație lungă (Aceternity UI · Multi Step Loader):
 * pașii trec unul câte unul peste un fundal estompat. Rămâne pe ultimul până se
 * termină operația; nu se întoarce la început.
 */
export function LaunchSteps({ open, title, hint, steps, every = 2200 }: { open: boolean; title: ReactNode; hint?: ReactNode; steps: string[]; every?: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-xl"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <StepsCore title={title} hint={hint} steps={steps} every={every} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: state === 'later' ? 0.35 : 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05 }}>
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full',
                state === 'done' ? 'bg-neutral-950 text-white' : state === 'now' ? 'ring-2 ring-neutral-950' : 'ring-1 ring-neutral-300')}>
                {state === 'done' && <DrawnCheck className="size-3.5" />}
                {state === 'now' && <span className="size-2 animate-pulse rounded-full bg-neutral-950" />}
              </span>
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
