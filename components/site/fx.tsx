'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Efectele site-ului de prezentare, în alb și negru:
//   Reveal — Magic UI · Blur Fade (magicui.design, MIT)
//   DotField — după React Bits · Dot Grid (reactbits.dev, MIT + Commons Clause),
//     rescris pe canvas 2D, fără dependențe
//   FlickeringGrid — Magic UI (MIT)
// Toate țin cont de „reduce motion" și nu consumă nimic cât nu se văd.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

/** Apare din estompare când intră în ecran (o singură dată). */
export function Reveal({ children, delay = 0, y = 18, className, as = 'div' }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'li' | 'section'
}) {
  const reduce = useReducedMotion()
  const Tag = as === 'li' ? motion.li : as === 'section' ? motion.section : motion.div
  return (
    <Tag className={className}
      initial={reduce ? false : { opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}>
      {children}
    </Tag>
  )
}

/**
 * Un câmp de puncte care se întunecă și se dau la o parte în jurul cursorului.
 * Desenează doar cât se mișcă ceva; în rest, canvasul stă.
 */
export function DotField({ gap = 22, size = 1.4, grow = 1.6, proximity = 140, push = 7, className }: {
  gap?: number; size?: number; grow?: number; proximity?: number; push?: number; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let dpr = 1
    let width = 0
    let height = 0
    let frame = 0
    let visible = true
    // Cursorul real și cel netezit (urmărește cu întârziere, pentru o mișcare moale)
    const target = { x: -9999, y: -9999, on: false }
    const smooth = { x: -9999, y: -9999, k: 0 }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const cols = Math.ceil(width / gap) + 1
      const rows = Math.ceil(height / gap) + 1
      const ox = (width - (cols - 1) * gap) / 2
      const oy = (height - (rows - 1) * gap) / 2
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          let x = ox + i * gap
          let y = oy + j * gap
          let t = 0
          if (smooth.k > 0.001) {
            const dx = x - smooth.x
            const dy = y - smooth.y
            const d = Math.hypot(dx, dy)
            if (d < proximity) {
              t = (1 - d / proximity) ** 2 * smooth.k
              if (d > 0.01) {
                x += (dx / d) * push * t
                y += (dy / d) * push * t
              }
            }
          }
          // Din gri deschis (212) spre aproape negru (10)
          const shade = Math.round(212 - 202 * t)
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`
          ctx.beginPath()
          ctx.arc(x, y, size + grow * t, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const tick = () => {
      frame = 0
      const goal = target.on ? 1 : 0
      smooth.x += (target.x - smooth.x) * 0.18
      smooth.y += (target.y - smooth.y) * 0.18
      smooth.k += (goal - smooth.k) * 0.12
      draw()
      const settled = Math.abs(goal - smooth.k) < 0.002 && Math.abs(target.x - smooth.x) < 0.3 && Math.abs(target.y - smooth.y) < 0.3
      if (!settled && visible) frame = requestAnimationFrame(tick)
    }
    const kick = () => { if (!frame && visible) frame = requestAnimationFrame(tick) }

    const setup = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      draw()
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inside = x > -proximity && y > -proximity && x < rect.width + proximity && y < rect.height + proximity
      if (inside && !target.on && smooth.k < 0.01) { smooth.x = x; smooth.y = y }
      target.x = x
      target.y = y
      target.on = inside
      kick()
    }
    const onLeave = () => { target.on = false; kick() }

    setup()
    const resize = new ResizeObserver(setup)
    resize.observe(canvas)
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick() })
    seen.observe(canvas)
    if (!reduce) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      seen.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [gap, size, grow, proximity, push, reduce])

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 size-full', className)} />
}

/**
 * Pătrățele care pâlpâie încet (Magic UI · Flickering Grid), pe canvas, pentru
 * fundalurile închise. Se oprește cât nu se vede; cu „reduce motion" rămâne fix.
 * `color` e „r,g,b".
 */
export function FlickeringGrid({ square = 3, gap = 6, chance = 0.25, color = '255,255,255', maxOpacity = 0.18, className }: {
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
