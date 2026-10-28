'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Cât s-a făcut dintr-un drum (pașii de pregătire, creditele): un inel cu
// procentul în mijloc sau o bară subțire. Se umplu cu o animație scurtă.
// =============================================

/** Un inel care se umple până la `value` (0–100), cu procentul în mijloc. */
export function ProgressRing({ value, size = 48, className }: { value: number; size?: number; className?: string }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#ececec" strokeWidth="4" />
        <motion.circle cx="22" cy="22" r={r} fill="none" stroke="#171717" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-neutral-700">{Math.round(value)}%</span>
    </div>
  )
}

/** O bară subțire care se umple până la `value` (0–100). */
export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-neutral-100', className)}>
      <motion.div className={cn('h-full rounded-full bg-neutral-900', barClassName)}
        initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  )
}
