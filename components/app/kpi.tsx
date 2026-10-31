'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/app/surface'
import { NumberTicker } from '@/components/app/motion'
import { Sparkline, CHART, type Point } from '@/components/app/charts'
import { InfoTip } from '@/components/app/info-tip'

// =============================================
// O cifră-cheie (ca la Stripe): eticheta, valoarea mare, schimbarea față de
// perioada de dinainte și evoluția ei, într-un grafic mic.
// =============================================

/** Schimbarea în procente; `good` = în ce direcție e de bine (la cheltuială, în jos). */
export function Delta({ value, good = 'up', className }: { value: number | null; good?: 'up' | 'down'; className?: string }) {
  if (value === null || !Number.isFinite(value)) return null
  const up = value >= 0
  const positive = Math.abs(value) < 0.005 ? null : (up ? good === 'up' : good === 'down')
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1 py-px text-[12px] font-semibold tabular-nums',
      positive === null ? 'text-neutral-500' : positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600', className)}>
      <Icon className="size-3" strokeWidth={2.5} />
      {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
    </span>
  )
}

/** O cifră simplă, fără evoluție: eticheta, valoarea și, opțional, o notă sub ea. */
export function StatCard({ label, value, footnote, icon, delta, good, className }: {
  label: ReactNode
  value: ReactNode
  footnote?: ReactNode
  icon?: ReactNode
  delta?: number | null
  good?: 'up' | 'down'
  className?: string
}) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
        {icon && <span className="shrink-0 text-neutral-400 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-[24px] font-semibold leading-none tracking-[-0.02em] text-neutral-950 tabular-nums">{value}</p>
        {delta !== undefined && <Delta value={delta ?? null} good={good} />}
      </div>
      {footnote && <p className="mt-1.5 text-[12px] leading-snug text-neutral-400">{footnote}</p>}
    </Card>
  )
}

/** O celulă dintr-un tablou de cifre (mai multe la un loc, în același card). */
export function Metric({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[13px] text-neutral-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold leading-tight tracking-[-0.015em] text-neutral-950 tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{note}</p>}
    </div>
  )
}

/** Un rând etichetă — valoare, într-o listă scurtă de cifre. */
export function DataRow({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd className={cn('text-[13px] tabular-nums', strong ? 'font-semibold text-neutral-950' : 'text-neutral-700')}>{value}</dd>
    </div>
  )
}

export function KpiCard({ label, value, format, delta, good = 'up', series, color, help, footnote, className }: {
  label: string
  value: number | null
  format: (n: number) => string
  /** Schimbarea relativă față de perioada de dinainte (0,12 = +12%). */
  delta?: number | null
  good?: 'up' | 'down'
  series?: Point[]
  color?: string
  help?: ReactNode
  footnote?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium text-neutral-500">{label}</p>
          {help && <InfoTip>{help}</InfoTip>}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className="text-[24px] font-semibold leading-none tracking-[-0.02em] text-neutral-950 tabular-nums">
            {value === null ? '—' : <NumberTicker value={value} format={format} />}
          </p>
          {delta !== undefined && <Delta value={delta ?? null} good={good} />}
        </div>
        {footnote && <p className="mt-1.5 text-[12px] text-neutral-400">{footnote}</p>}
      </div>
      <div className="mt-auto pt-3">
        {series && series.length > 1 ? <Sparkline data={series} color={color ?? CHART.brand} /> : <div className="h-11" />}
      </div>
    </Card>
  )
}
