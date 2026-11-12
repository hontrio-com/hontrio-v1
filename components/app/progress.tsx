'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Cât s-a făcut dintr-un drum: o bară subțire care se umple cu o animație
// scurtă.
// =============================================

/** O bară subțire care se umple până la `value` (0–100). */
export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-neutral-100', className)}>
      <motion.div className={cn('h-full rounded-full bg-neutral-900', barClassName)}
        initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  )
}
