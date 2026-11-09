import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// =============================================
// Etichetele de stare: aceeași culoare înseamnă același lucru peste tot
// (verde = rulează / bine, chihlimbar = atenție, roșu = oprit / problemă,
// negru = Hontrio / ce iese în față, contur = ciornă / în așteptare, gri = neutru).
// =============================================

export type Tone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'outline'

// i18n-ignore-start: clase de stil, nu text
const TONES: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-neutral-100 text-neutral-600 ring-neutral-200/70', dot: 'bg-neutral-400 text-neutral-400' },
  brand: { badge: 'bg-neutral-900 text-white ring-neutral-900', dot: 'bg-white text-white' },
  green: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', dot: 'bg-emerald-500 text-emerald-500' },
  amber: { badge: 'bg-amber-50 text-amber-800 ring-amber-200/70', dot: 'bg-amber-500 text-amber-500' },
  red: { badge: 'bg-red-50 text-red-700 ring-red-200/70', dot: 'bg-red-500 text-red-500' },
  outline: { badge: 'bg-white text-neutral-700 ring-neutral-300', dot: 'bg-neutral-500 text-neutral-500' },
}
// i18n-ignore-end

export function Badge({ tone = 'neutral', dot, live, children, className }: {
  tone?: Tone; dot?: boolean; live?: boolean; children: ReactNode; className?: string
}) {
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-semibold ring-1 ring-inset', TONES[tone].badge, className)}>
      {(dot || live) && <StatusDot tone={tone} live={live} />}
      {children}
    </span>
  )
}

/** Un punct de stare; „live" pulsează ușor (campania rulează acum). */
export function StatusDot({ tone = 'neutral', live, className }: { tone?: Tone; live?: boolean; className?: string }) {
  return <span className={cn('size-1.5 shrink-0 rounded-full', TONES[tone].dot, live && 'animate-live', className)} />
}

/** O tastă, într-un indiciu de scurtătură (⌘K). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-neutral-200 bg-white px-1 font-sans text-[11px] font-medium text-neutral-500 shadow-[0_1px_0_rgb(16_24_40/0.06)]', className)}>
      {children}
    </kbd>
  )
}
