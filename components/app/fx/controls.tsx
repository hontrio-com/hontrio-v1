'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================
// Controalele momentelor importante:
//   ShimmerButton — Magic UI (magicui.design, MIT)
//   SlideCommit („glisează ca să confirmi") — React Bits (reactbits.dev, MIT +
//   Commons Clause: se folosește în produs, nu se revinde)
// În alb-negru; verdele și roșul rămân doar pentru reușită și eșec.
// =============================================

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
      {!disabled && (
        <span aria-hidden className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size] motion-reduce:hidden">
          <span className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
            <span className="absolute -inset-full w-auto rotate-0 animate-spin-around [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
          </span>
        </span>
      )}
      {children}
      <span aria-hidden className="absolute inset-0 size-full [border-radius:var(--radius)] shadow-[inset_0_-8px_10px_#ffffff1f] transition-shadow duration-300 group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      <span aria-hidden className="absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  )
}

// ── SlideCommit ──────────────────────────────────────────────────────────────

type Phase = 'idle' | 'pending' | 'done' | 'error'
type Sample = [number, number]
type Grip = { id: number; grab: number | null; moved: boolean; hist: Sample[] }
type MoveEvent = { pointerId: number; clientX: number; timeStamp: number }
type UpEvent = { pointerId: number }

const PAD = 4
const SQUASH_MAX = 0.08
const SQUASH_DIV = 110
const SWELL = 1.03
const MIN_PENDING = 300
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const SHAKE = [0, -5, 5, -3, 3, -1, 0]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const velocityOf = (hist: Sample[]) => {
  if (hist.length < 2) return 0
  const [t0, x0] = hist[0]
  const [t1, x1] = hist[hist.length - 1]
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000
}
const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

/**
 * „Glisează ca să confirmi" (React Bits · Slide Commit): o acțiune care nu se
 * poate întoarce nu pornește dintr-un clic scăpat. `onConfirm` întoarce o
 * promisiune: cât rulează, mânerul arată că lucrează; o eroare îl scutură și
 * îl aduce înapoi. Din tastatură: săgeata dreapta sau End.
 */
export function SlideCommit({
  label, doneLabel, errorLabel, workingLabel, onConfirm, onError, disabled = false,
  width = 300, height = 56, className,
}: {
  label: string
  doneLabel: ReactNode
  errorLabel: ReactNode
  /** Pentru cititoarele de ecran, cât lucrează. */
  workingLabel: string
  onConfirm: () => Promise<unknown>
  onError?: (reason: unknown) => void
  disabled?: boolean
  width?: number
  height?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [held, setHeld] = useState(false)
  const [hot, setHot] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const grip = useRef<Grip | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const homeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const run = useRef(0)
  const unwatch = useRef<(() => void) | null>(null)
  const live = useRef<{ move: (e: MoveEvent) => void; up: (e: UpEvent) => void }>({ move: () => {}, up: () => {} })
  const lastPercent = useRef(0)

  const GRIP = height - PAD * 2
  const INNER = width - PAD * 2
  const TRAVEL = Math.max(1, INNER - GRIP)
  const r = height / 2
  const gripR = Math.max(0, r - PAD)
  const k = 260 + 0.5 * 640
  const mass = 0.9
  const critical = 2 * Math.sqrt(k * mass)
  const commitSpring = { type: 'spring' as const, stiffness: k, damping: critical, mass }
  const homeSpring = { ...commitSpring, damping: critical * (1 - 0.38) }

  const x = useMotionValue(0)
  const anchor = useMotionValue(0)
  const shown = useMotionValue(1)
  const spin = useMotionValue(0)
  const pulse = useMotionValue(1)
  const shake = useMotionValue(0)
  const seen = useTransform(x, v => clamp(v, 0, TRAVEL))
  const edge = useTransform([seen, anchor], ([v, a]: number[]) => v + GRIP + clamp(a - v, 0, TRAVEL))
  const clip = useTransform(edge, R => `inset(0 ${INNER - R}px 0 0 round ${gripR}px)`)
  const content = useTransform([seen, edge], ([v, R]: number[]) => `translateX(${(v + R) / 2 - INNER / 2}px)`)
  const swell = hot && !held && phase === 'idle' && !reduce ? SWELL : 1
  const shape = useTransform(x, v => {
    const q = 1 - Math.min(SQUASH_MAX, Math.max(0, -v) / SQUASH_DIV)
    return `scale(${q * swell}, ${swell / q})`
  })
  const origin = useTransform(seen, v => `${v}px 50%`)
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0])
  const arrow = useTransform([seen, shown], ([v, on]: number[]) => on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1))
  const trackTransform = useTransform([shake, pulse], ([s, p]: number[]) => `translateX(${s}px) scale(${p})`)

  useMotionValueEvent(seen, 'change', v => {
    const percent = Math.round((v / TRAVEL) * 100)
    if (percent === lastPercent.current || !capsuleRef.current) return
    lastPercent.current = percent
    capsuleRef.current.setAttribute('aria-valuenow', String(percent))
    capsuleRef.current.setAttribute('aria-valuetext', `${label}, ${percent}%`)
  })

  useEffect(() => () => {
    clearTimeout(timer.current)
    clearTimeout(homeTimer.current)
    unwatch.current?.()
    run.current += 1
  }, [])

  const local = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return (clientX - rect.left) / (rect.width / width || 1)
  }

  const goHome = (velocity: number) => {
    if (reduce) animate(x, 0, { duration: 0.2, ease: EASE_OUT })
    else animate(x, 0, { ...homeSpring, velocity: Math.min(0, velocity) })
  }

  const resolve = (viaKey: boolean) => {
    setPhase('done')
    anchor.set(x.get())
    animate(spin, 0, { duration: 0.12 })
    if (reduce) x.set(0)
    else {
      animate(x, 0, commitSpring)
      if (!viaKey) animate(pulse, [1, 0.974, 1], { duration: 0.46, times: [0, 0.62, 1], ease: EASE_OUT, delay: 0.1 })
    }
  }

  const reject = (reason: unknown) => {
    setPhase('error')
    onError?.(reason)
    animate(spin, 0, { duration: 0.12 })
    animate(shown, 1, { duration: 0.2, delay: 0.12 })
    if (reduce) goHome(0)
    else {
      animate(shake, SHAKE, { duration: 0.45, ease: EASE_OUT })
      homeTimer.current = setTimeout(() => { if (!grip.current) goHome(0) }, 300)
    }
    timer.current = setTimeout(() => setPhase('idle'), 1800)
  }

  const commit = (viaKey: boolean) => {
    clearTimeout(timer.current)
    const id = ++run.current
    x.set(TRAVEL)
    setPhase('pending')
    animate(shown, 0, { duration: 0.2 })
    animate(spin, 1, { duration: 0.2 })
    const t0 = performance.now()
    const later = (fn: () => void) => setTimeout(() => { if (id === run.current) fn() }, Math.max(0, MIN_PENDING - (performance.now() - t0)))
    onConfirm().then(() => later(() => resolve(viaKey)), reason => later(() => reject(reason)))
  }

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || grip.current || phase === 'pending' || phase === 'done' || e.button !== 0) return
    x.stop()
    // Unde a apucat omul mânerul, din clipa apăsării: și o tragere dintr-o singură mișcare ajunge la capăt
    grip.current = { id: e.pointerId, grab: local(e.clientX) - x.get(), moved: false, hist: [] }
    setHeld(true)
    try { trackRef.current?.setPointerCapture(e.pointerId) } catch { /* nimic */ }
    unwatch.current?.()
    const onMove = (ev: PointerEvent) => ev.isTrusted && live.current.move(ev)
    const onUp = (ev: PointerEvent) => ev.isTrusted && live.current.up(ev)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    unwatch.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      unwatch.current = null
    }
  }

  const move = (e: MoveEvent) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    const at = local(e.clientX)
    if (g.grab === null) { g.grab = at - x.get(); return }
    const next = clamp(at - g.grab, 0, TRAVEL)
    if (Math.abs(next - x.get()) > 0.5) g.moved = true
    g.hist.push([e.timeStamp, next])
    if (g.hist.length > 4) g.hist.shift()
    x.set(next)
  }

  const up = (e: UpEvent) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    grip.current = null
    unwatch.current?.()
    try { trackRef.current?.releasePointerCapture(e.pointerId) } catch { /* nimic */ }
    setHeld(false)
    if (x.get() >= TRAVEL) commit(false)
    else if (g.moved) goHome(velocityOf(g.hist))
  }

  // Mânerele de pe window citesc mereu ultimele funcții (scrise după randare, nu în timpul ei)
  useLayoutEffect(() => { live.current = { move, up } })

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || phase === 'pending' || phase === 'done') return
    const step = TRAVEL / 10
    if (e.key === 'End') { e.preventDefault(); commit(true) }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(TRAVEL, x.get() + step)
      x.set(next)
      if (next >= TRAVEL) commit(true)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      x.set(Math.max(0, x.get() - step))
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault()
      if (grip.current) up({ pointerId: grip.current.id })
      else x.set(0)
    }
  }

  const iconSize = Math.round(GRIP * 0.42)
  const done = phase === 'done'

  return (
    <div data-phase={phase} data-held={held ? '' : undefined} data-disabled={disabled ? '' : undefined}
      className={cn('group/slide relative inline-block select-none align-middle data-[disabled]:pointer-events-none data-[disabled]:opacity-45', className)}
      style={{ width, height, '--sc-radius': `${r}px`, '--sc-grip-r': `${gripR}px`, '--sc-pad': `${PAD}px` } as CSSProperties}>
      <motion.div ref={trackRef} onPointerDown={down} style={{ transform: trackTransform }}
        className="relative h-full w-full cursor-grab touch-none rounded-[var(--sc-radius)] bg-neutral-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_12px_30px_-12px_rgb(0_0_0/0.6)] ring-1 ring-black/10 [-webkit-tap-highlight-color:transparent] group-data-[held]/slide:cursor-grabbing group-data-[phase=done]/slide:cursor-default group-data-[phase=pending]/slide:cursor-default">
        {/* Textul de pe șină, care se stinge pe măsură ce mânerul înaintează */}
        <motion.span aria-hidden style={{ opacity: say }}
          className="pointer-events-none absolute inset-0 grid place-items-center whitespace-nowrap pl-10 text-[14px] font-medium tracking-[-0.006em]">
          <span className="animate-shiny-text bg-[linear-gradient(110deg,rgba(255,255,255,0.45)_35%,#fff_50%,rgba(255,255,255,0.45)_65%)] bg-[length:250%_100%] bg-clip-text text-transparent [grid-area:1/1] transition-opacity group-data-[phase=error]/slide:opacity-0 motion-reduce:animate-none">
            {label}
          </span>
          <span className="text-[#ff8a8a] opacity-0 [grid-area:1/1] transition-opacity group-data-[phase=error]/slide:opacity-100">{errorLabel}</span>
        </motion.span>
        <motion.div ref={capsuleRef} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-busy={phase === 'pending' || undefined} aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          onPointerEnter={e => { if (e.pointerType === 'mouse' && finePointer()) setHot(true) }}
          onPointerLeave={() => setHot(false)}
          style={{ clipPath: clip, transform: shape, transformOrigin: origin }}
          className="absolute left-[var(--sc-pad)] top-[var(--sc-pad)] h-[calc(100%-var(--sc-pad)*2)] w-[calc(100%-var(--sc-pad)*2)] bg-white text-neutral-950 outline-none transition-colors duration-200 focus-visible:shadow-[inset_0_0_0_2px_#0a0a0a] group-data-[phase=done]/slide:bg-emerald-500 group-data-[phase=done]/slide:text-white group-data-[phase=error]/slide:bg-red-500 group-data-[phase=error]/slide:text-white">
          <motion.div className="absolute inset-0" style={{ transform: content }}>
            <motion.span aria-hidden style={{ opacity: arrow }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <ArrowRight size={iconSize} strokeWidth={2.2} />
            </motion.span>
            <motion.span aria-hidden style={{ opacity: spin }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" className="animate-spin motion-reduce:animate-pulse">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25" />
                <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </motion.span>
            <motion.span aria-hidden initial={false} animate={{ opacity: done ? 1 : 0, scale: done || reduce ? 1 : 0.95 }} transition={{ duration: 0.2, ease: EASE_OUT }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap text-[14px] font-semibold">
              <Check size={Math.round(GRIP * 0.38)} strokeWidth={2.6} />{doneLabel}
            </motion.span>
          </motion.div>
        </motion.div>
        <span className="sr-only" aria-live="polite">
          {phase === 'pending' ? workingLabel : phase === 'done' ? doneLabel : phase === 'error' ? errorLabel : ''}
        </span>
      </motion.div>
    </div>
  )
}
