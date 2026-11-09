'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Capul fiecărei pagini, în designul Bezeno: deasupra, un rând mic gri (sau
// starea paginii), titlul mare și strâns, o frază despre la ce folosește și,
// în dreapta, acțiunea principală. Sub el, opțional, filele paginii.
// =============================================

export function PageHeader({ title, description, actions, meta, children, className }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Un rând mic deasupra titlului (ex. starea pilotului). */
  meta?: ReactNode
  /** Filele paginii. */
  children?: ReactNode
  className?: string
}) {
  return (
    <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn('mb-2 space-y-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {meta && <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-neutral-400">{meta}</div>}
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-neutral-950 sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.header>
  )
}
