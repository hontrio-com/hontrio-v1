'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Filele, în designul Bezeno: o pastilă gri cu fila aleasă pe un fond alb
// care alunecă de la una la alta; numărul fiecărei file stă alături, mic.
// =============================================

export type TabItem<T extends string> = { value: T; label: string; count?: number; icon?: ReactNode; attention?: boolean }

export function PageTabs<T extends string>({ id, items, value, onChange, className }: {
  /** Unic pe pagină: fondul alb alunecă doar între filele aceluiași rând. */
  id: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex w-fit max-w-full overflow-x-auto rounded-full bg-neutral-100 p-1 text-sm font-medium [scrollbar-width:none]', className)}>
      {items.map(it => {
        const active = it.value === value
        return (
          <button key={it.value} role="tab" aria-selected={active} onClick={() => onChange(it.value)}
            className={cn('relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors', active ? 'text-black' : 'text-neutral-500 hover:text-black')}>
            {active && (
              <motion.span layoutId={`tabs-${id}`} className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
            )}
            {it.icon && <span className="relative [&_svg]:size-4">{it.icon}</span>}
            <span className="relative">{it.label}</span>
            {it.count !== undefined && it.count > 0 && (
              <span className={cn('relative font-mono text-[11px]', it.attention ? 'rounded-full bg-black px-1.5 text-white' : 'text-neutral-400')}>{it.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Un comutator în pastilă (2–4 variante), cu fondul alb care alunecă. */
export function Segmented<T extends string>({ id, items, value, onChange, size = 'md' }: {
  id: string
  items: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-neutral-100 p-1">
      {items.map(it => {
        const active = it.value === value
        return (
          <button key={it.value} onClick={() => onChange(it.value)} aria-pressed={active}
            className={cn('relative rounded-full font-medium transition-colors', size === 'sm' ? 'px-3 py-1 text-[12.5px]' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-black' : 'text-neutral-500 hover:text-black')}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className="relative">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
