'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Fundalurile platformei, în alb și negru:
//   DotPattern, FlickeringGrid, Ripple, NoiseTexture — Magic UI (magicui.design, MIT)
//   Spotlight — Aceternity UI (ui.aceternity.com; folosire în aplicații, fără
//   redistribuirea codului)
// Toate stau sub conținut (pointer-events: none) și se opresc la „reduce motion".
// =============================================

/** Puncte pe un caroiaj (Magic UI · Dot Pattern). Culoarea vine din `text-*`; se estompează cu `mask-image`. */
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
 * Pătrățele care pâlpâie încet (Magic UI · Flickering Grid), pe canvas. Se oprește
 * cât nu se vede pe ecran; cu „reduce motion" rămâne un desen fix.
 * `color` e „r,g,b".
 */
export function FlickeringGrid({ square = 3, gap = 5, chance = 0.22, color = '255,255,255', maxOpacity = 0.2, className }: {
  square?: number; gap?: number; chance?: number; color?: string; maxOpacity?: number; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let cols = 0
    let rows = 0
    let cells = new Float32Array(0)
    let dpr = 1
    let frame = 0
    let last = 0
    let visible = true

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const step = (square + gap) * dpr
      const side = square * dpr
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillStyle = `rgba(${color},${cells[i * rows + j]})`
          ctx.fillRect(i * step, j * step, side, side)
        }
      }
    }
    const setup = () => {
      const { width, height } = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      cols = Math.ceil(width / (square + gap))
      rows = Math.ceil(height / (square + gap))
      cells = new Float32Array(cols * rows)
      for (let i = 0; i < cells.length; i++) cells[i] = Math.random() * maxOpacity
      draw()
    }
    const tick = (time: number) => {
      const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
      last = time
      for (let i = 0; i < cells.length; i++) if (Math.random() < chance * dt) cells[i] = Math.random() * maxOpacity
      draw()
      frame = visible ? requestAnimationFrame(tick) : 0
    }
    const start = () => {
      if (reduce || frame) return
      last = 0
      frame = requestAnimationFrame(tick)
    }

    setup()
    const resize = new ResizeObserver(setup)
    resize.observe(canvas)
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    seen.observe(canvas)
    start()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      seen.disconnect()
    }
  }, [square, gap, chance, color, maxOpacity, reduce])

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />
}

// Razele de lumină, albe, din colțurile de sus (Aceternity · Spotlight New)
const BEAM_WIDE = 'radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgba(255,255,255,.085) 0, rgba(255,255,255,.025) 50%, rgba(255,255,255,0) 80%)' // i18n-ignore
const BEAM_NARROW = 'radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,.06) 0, rgba(255,255,255,.02) 80%, transparent 100%)' // i18n-ignore
const BEAM_FAINT = 'radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,.04) 0, rgba(255,255,255,.015) 80%, transparent 100%)' // i18n-ignore

/** Două fascicule de lumină care se leagănă încet peste un fundal închis (Aceternity · Spotlight). */
export function Spotlight({ className, sway = 80, duration = 9 }: { className?: string; sway?: number; duration?: number }) {
  const reduce = useReducedMotion()
  const side = (dir: 1 | -1) => (
    <motion.div className={cn('pointer-events-none absolute top-0 h-full w-full', dir === 1 ? 'left-0' : 'right-0')}
      animate={reduce ? undefined : { x: [0, sway * dir, 0] }}
      transition={{ duration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}>
      <div className={cn('absolute top-0', dir === 1 ? 'left-0' : 'right-0')}
        style={{ transform: `translateY(-320px) rotate(${-45 * dir}deg)`, background: BEAM_WIDE, width: 520, height: 1280 }} />
      <div className={cn('absolute top-0', dir === 1 ? 'left-0 origin-top-left' : 'right-0 origin-top-right')}
        style={{ transform: `rotate(${-45 * dir}deg) translate(${5 * dir}%, -50%)`, background: BEAM_NARROW, width: 220, height: 1280 }} />
      <div className={cn('absolute top-0', dir === 1 ? 'left-0 origin-top-left' : 'right-0 origin-top-right')}
        style={{ transform: `rotate(${-45 * dir}deg) translate(${-180 * dir}%, -70%)`, background: BEAM_FAINT, width: 220, height: 1280 }} />
    </motion.div>
  )
  return (
    <motion.div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4 }}>
      {side(1)}
      {side(-1)}
    </motion.div>
  )
}

/** Cercuri concentrice care respiră în jurul unui element (Magic UI · Ripple). */
export function Ripple({ size = 96, rings = 5, step = 56, className }: { size?: number; rings?: number; step?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      {Array.from({ length: rings }, (_, i) => (
        <div key={i}
          className="absolute left-1/2 top-1/2 animate-ripple rounded-full border border-white/[0.14] bg-white/[0.025] motion-reduce:animate-none"
          style={{ '--i': i, width: size + i * step, height: size + i * step, opacity: 0.9 - i * 0.15, transform: 'translate(-50%, -50%)' } as CSSProperties} />
      ))}
    </div>
  )
}

/** Granulație fină peste o suprafață (Magic UI · Noise Texture), ca să nu pară plată. */
export function NoiseTexture({ className, frequency = 0.75, opacity = 0.5 }: { className?: string; frequency?: number; opacity?: number }) {
  const id = useId()
  return (
    <svg aria-hidden className={cn('pointer-events-none absolute inset-0 size-full mix-blend-overlay', className)}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={3} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} opacity={opacity} />
    </svg>
  )
}
