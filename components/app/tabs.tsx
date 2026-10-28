'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Filele unei pagini (ca la Linear / Stripe): o linie sub cea activă, care
// alunecă de la o filă la alta. Fiecare filă poate avea un număr (ex.
// propunerile care așteaptă).
// =============================================

export type TabItem<T extends string> = { value: T; label: string; count?: number; icon?: ReactNode; attention?: boolean }

export function PageTabs<T extends string>({ id, items, value, onChange, className }: {
  /** Unic pe pagină: linia activă alunecă doar între filele aceluiași rând. */
  id: string
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('relative flex gap-1 overflow-x-auto border-b border-neutral-200 [scrollbar-width:none]', className)}>
      {items.map(it => {
        const active = it.value === value
        return (
          <button key={it.value} role="tab" aria-selected={active} onClick={() => onChange(it.value)}
            className={cn('group relative flex h-10 shrink-0 items-center gap-2 px-3 text-[14px] font-medium transition-colors', active ? 'text-neutral-950' : 'text-neutral-500 hover:text-neutral-800')}>
            {it.icon && <span className={cn('[&_svg]:size-4', active ? 'text-neutral-800' : 'text-neutral-400 group-hover:text-neutral-600')}>{it.icon}</span>}
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                it.attention ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600')}>
                {it.count}
              </span>
            )}
            {active && (
              <motion.span layoutId={`tabs-${id}`} className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-neutral-900"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Un comutator în pastilă (2–4 variante), cu fundalul care alunecă. */
export function Segmented<T extends string>({ id, items, value, onChange, size = 'md' }: {
  id: string
  items: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5">
      {items.map(it => {
        const active = it.value === value
        return (
          <button key={it.value} onClick={() => onChange(it.value)} aria-pressed={active}
            className={cn('relative rounded-md font-medium transition-colors', size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800')}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgb(16_24_40/0.08),0_0_0_1px_rgb(16_24_40/0.04)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
