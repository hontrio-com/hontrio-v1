'use client'

import { useEffect, useId, useState, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// O rază de lumină care curge între două elemente (Magic UI · Animated Beam,
// magicui.design, MIT). Aici: o legătură făcută curge, una lipsă e punctată și
// stinsă. Coordonatele se recalculează când containerul își schimbă mărimea.
// =============================================

export function AnimatedBeam({
  containerRef, fromRef, toRef, active = true, curvature = 0, reverse = false, duration = 3.2, delay = 0,
  color = '#ffffff', tail = '#a3a3a3', baseOpacity = 0.14, width = 1.5,
  startXOffset = 0, startYOffset = 0, endXOffset = 0, endYOffset = 0, className,
}: {
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  /** Legătura e făcută: curge lumina. Altfel, doar un drum punctat. */
  active?: boolean
  curvature?: number
  reverse?: boolean
  duration?: number
  delay?: number
  color?: string
  tail?: string
  baseOpacity?: number
  width?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
  className?: string
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const [geo, setGeo] = useState({ d: '', w: 0, h: 0 })

  useEffect(() => {
    const update = () => {
      const box = containerRef.current
      const a = fromRef.current
      const b = toRef.current
      if (!box || !a || !b) return
      const rc = box.getBoundingClientRect()
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const sx = ra.left - rc.left + ra.width / 2 + startXOffset
      const sy = ra.top - rc.top + ra.height / 2 + startYOffset
      const ex = rb.left - rc.left + rb.width / 2 + endXOffset
      const ey = rb.top - rc.top + rb.height / 2 + endYOffset
      setGeo({ d: `M ${sx},${sy} Q ${(sx + ex) / 2},${sy - curvature} ${ex},${ey}`, w: rc.width, h: rc.height })
    }
    const observer = new ResizeObserver(update)
    if (containerRef.current) observer.observe(containerRef.current)
    const frame = requestAnimationFrame(update)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset])

  const x = reverse ? { x1: ['90%', '-10%'], x2: ['100%', '0%'] } : { x1: ['10%', '110%'], x2: ['0%', '100%'] }

  return (
    <svg aria-hidden fill="none" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w || 1} ${geo.h || 1}`}
      className={cn('pointer-events-none absolute left-0 top-0 transform-gpu', className)}>
      <path d={geo.d} stroke={color} strokeWidth={width} strokeOpacity={baseOpacity} strokeLinecap="round"
        strokeDasharray={active ? undefined : '2 6'} />
      {active && reduce && <path d={geo.d} stroke={color} strokeWidth={width} strokeOpacity={0.55} strokeLinecap="round" />}
      {active && !reduce && (
        <>
          <path d={geo.d} strokeWidth={width} stroke={`url(#${id})`} strokeLinecap="round" />
          <defs>
            <motion.linearGradient id={id} gradientUnits="userSpaceOnUse" className="transform-gpu"
              initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
              animate={{ x1: x.x1, x2: x.x2, y1: ['0%', '0%'], y2: ['0%', '0%'] }}
              transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0.4 }}>
              <stop stopColor={color} stopOpacity="0" />
              <stop stopColor={color} />
              <stop offset="32.5%" stopColor={tail} />
              <stop offset="100%" stopColor={tail} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </>
      )}
    </svg>
  )
}
