'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

// =============================================
// Mișcările platformei, după modelul Magic UI (magicui.design, MIT):
// cifrele urcă la valoarea lor, blocurile apar cu o estompare scurtă. Toate
// țin cont de „reduce motion" din sistem.
// =============================================

/** Un număr care urcă (sau coboară) lin până la valoarea lui. */
export function NumberTicker({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(reduce ? value : 0)
  const spring = useSpring(motionValue, { damping: 38, stiffness: 160, restDelta: 0.5 })
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (inView) motionValue.set(value)
  }, [motionValue, inView, value])

  // Formatul vine de obicei ca funcție nouă la fiecare randare: abonarea se reface, ieftin
  useEffect(() => spring.on('change', v => {
    if (ref.current) ref.current.textContent = format(v)
  }), [spring, format])

  return <span ref={ref} className={className}>{format(reduce ? value : 0)}</span>
}

const EASE = [0.21, 0.47, 0.32, 0.98] as const

/** Apare cu o estompare scurtă; `delay` pentru blocuri care vin unul după altul. */
export function FadeIn({ children, delay = 0, y = 8, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className}
      initial={reduce ? false : { opacity: 0, y, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, delay, ease: EASE }}>
      {children}
    </motion.div>
  )
}
