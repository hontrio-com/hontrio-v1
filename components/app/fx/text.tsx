'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Text care apare cuvânt cu cuvânt, din estompare (React Bits · Blur Text și
// Magic UI · Text Animate „blurInUp"). Cititorul de ecran primește textul
// întreg, o singură dată; animația e doar pentru ochi.
// =============================================

export function BlurText({ text, className, stagger = 0.045, delay = 0 }: { text: string; className?: string; stagger?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  return (
    <span className={cn('inline', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <motion.span key={`${text}-${i}`} className="inline-block whitespace-pre"
            initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, delay: delay + i * stagger, ease: [0.21, 0.47, 0.32, 0.98] }}>
            {w}{i < words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </span>
    </span>
  )
}
