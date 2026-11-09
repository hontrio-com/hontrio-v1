'use client'

import { type CSSProperties, type ReactNode } from 'react'
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, type MotionStyle } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Suprafețele „vii": cardul cu lumina care urmărește cursorul (Magic UI · Magic
// Card) și raza care înconjoară un contur (Magic UI · Border Beam), ambele din
// magicui.design (MIT), în alb-negru.
// =============================================

/**
 * Un card în care lumina urmărește cursorul: o pată fină pe suprafață și o
 * margine care se aprinde lângă cursor (Magic UI · Magic Card).
 * `tone="dark"` pentru suprafețe negre.
 */
export function MagicCard({ children, className, size = 280, tone = 'light' }: {
  children: ReactNode
  className?: string
  size?: number
  tone?: 'light' | 'dark'
}) {
  const x = useMotionValue(-size)
  const y = useMotionValue(-size)
  const spot = useMotionTemplate`radial-gradient(${size}px circle at ${x}px ${y}px, var(--mc-spot), transparent 72%)`
  const edge = useMotionTemplate`radial-gradient(${size * 0.75}px circle at ${x}px ${y}px, var(--mc-edge), transparent 70%)`
  const vars = (tone === 'dark'
    ? { '--mc-spot': 'rgba(255,255,255,0.07)', '--mc-edge': 'rgba(255,255,255,0.55)' }
    : { '--mc-spot': 'rgba(10,10,10,0.04)', '--mc-edge': 'rgba(10,10,10,0.5)' }) as CSSProperties

  return (
    <div
      style={vars}
      onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect()
        x.set(e.clientX - r.left)
        y.set(e.clientY - r.top)
      }}
      onPointerLeave={() => { x.set(-size); y.set(-size) }}
      className={cn('group/mc relative isolate overflow-hidden', className)}>
      {/* Marginea care se aprinde lângă cursor: doar inelul de 1px al cardului se vede */}
      <motion.span aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border border-transparent opacity-0 transition-opacity duration-300 [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)] group-hover/mc:opacity-100"
        style={{ background: edge } as MotionStyle} />
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/mc:opacity-100"
        style={{ background: spot } as MotionStyle} />
      <div className="relative z-[1] h-full">{children}</div>
    </div>
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
