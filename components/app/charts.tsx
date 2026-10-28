'use client'

import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// =============================================
// Graficele platformei, pe Recharts (github.com/recharts/recharts): linii
// fine, umplere în degradeu, fără axe în exces. Negrul e linia principală;
// verde pentru bani câștigați, roșu pentru pierderi, gri pentru cheltuială.
// =============================================

export const CHART = {
  brand: '#171717',
  green: '#10b981',
  red: '#ef4444',
  neutral: '#a3a3a3',
} as const

export type Point = { label: string; value: number }

/** Un grafic mic, fără axe, sub cifra unui KPI. */
export function Sparkline({ data, color = CHART.brand, height = 44 }: { data: Point[]; color?: string; height?: number }) {
  const id = useId().replace(/:/g, '')
  if (data.length < 2) return <div style={{ height }} />
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} dot={false}
            isAnimationActive animationDuration={900} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Un grafic de evoluție, cu axe discrete și o etichetă la trecerea cu mouse-ul. */
export function TrendChart({ data, color = CHART.brand, height = 220, format, axisFormat }: {
  /** În pixeli, sau '100%' ca să umple un părinte cu înălțimea știută. */
  data: Point[]; color?: string; height?: number | string
  /** Valoarea din eticheta de la hover; pe axă, axisFormat (mai scurt), dacă e dat. */
  format: (n: number) => string; axisFormat?: (n: number) => string
}) {
  const id = useId().replace(/:/g, '')
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} width={56} tickFormatter={v => (axisFormat ?? format)(Number(v))} />
          <Tooltip cursor={{ stroke: '#e5e5e5' }} content={({ active, payload, label }) => active && payload?.length ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] shadow-raised">
              <p className="text-neutral-500">{label}</p>
              <p className="mt-0.5 font-semibold tabular-nums text-neutral-900">{format(Number(payload[0].value))}</p>
            </div>
          ) : null} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#trend-${id})`} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Bare pe zile (sau săptămâni), cu o etichetă la trecerea mouse-ului: valoarea și, sub ea, un rând în plus. */
export function BarTrend({ data, height = 220, format, axisFormat }: {
  data: (Point & { extra?: string })[]; height?: number | string; format: (n: number) => string; axisFormat?: (n: number) => string
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} minTickGap={28} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} width={56} tickFormatter={v => (axisFormat ?? format)(Number(v))} />
          <Tooltip cursor={{ fill: 'rgb(0 0 0 / 0.04)' }} content={({ active, payload, label }) => active && payload?.length ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] shadow-raised">
              <p className="text-neutral-500">{label}</p>
              <p className="mt-0.5 font-semibold tabular-nums text-neutral-900">{format(Number(payload[0].value))}</p>
              {(payload[0].payload as { extra?: string }).extra && <p className="text-neutral-500">{(payload[0].payload as { extra?: string }).extra}</p>}
            </div>
          ) : null} />
          <Bar dataKey="value" fill={CHART.brand} radius={[3, 3, 0, 0]} maxBarSize={28} animationDuration={700} activeBar={{ fill: '#525252' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Două serii pe aceeași zi: `a` (principala) și `b` (a doua). */
export type Pair = { label: string; a: number; b: number }

/** Legenda unui grafic cu două serii: un pătrățel cu culoarea și numele. */
export function ChartLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-500">
      {items.map(it => <span key={it.label} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-sm ${it.className}`} />{it.label}</span>)}
    </div>
  )
}

function PairTooltip({ label, rows, total }: { label: string; rows: { name: string; value: string; className: string }[]; total?: string }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] shadow-raised">
      <p className="text-neutral-500">{label}</p>
      {rows.map(r => (
        <p key={r.name} className="mt-1 flex items-center gap-2 text-neutral-700">
          <span className={`size-2 rounded-sm ${r.className}`} />{r.name}<span className="ml-auto pl-4 font-semibold tabular-nums text-neutral-900">{r.value}</span>
        </p>
      ))}
      {total && <p className="mt-1 border-t border-neutral-100 pt-1 text-right font-semibold tabular-nums text-neutral-900">{total}</p>}
    </div>
  )
}

/** Două linii pe aceeași axă: `a` neagră, cu umplere; `b` gri, punctată (ex. vânzările față de cheltuială). */
export function DualTrend({ data, names, height = 240, format, axisFormat }: {
  data: Pair[]; names: { a: string; b: string }; height?: number | string; format: (n: number) => string; axisFormat?: (n: number) => string
}) {
  const id = useId().replace(/:/g, '')
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`dual-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.14} />
              <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} width={56} tickFormatter={v => (axisFormat ?? format)(Number(v))} />
          <Tooltip cursor={{ stroke: '#e5e5e5' }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as Pair
            return <PairTooltip label={String(label)} rows={[
              { name: names.a, value: format(row.a), className: 'bg-neutral-900' },
              { name: names.b, value: format(row.b), className: 'bg-neutral-400' },
            ]} />
          }} />
          <Area type="monotone" dataKey="b" stroke={CHART.neutral} strokeWidth={1.75} strokeDasharray="4 3" fill="none" dot={false} animationDuration={900} />
          <Area type="monotone" dataKey="a" stroke={CHART.brand} strokeWidth={2} fill={`url(#dual-${id})`} dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CHART.brand }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Bare stivuite pe zile: `a` jos (negru), `b` deasupra (gri); eticheta arată și totalul. */
export function StackedBars({ data, names, height = 200, format, axisFormat }: {
  data: Pair[]; names: { a: string; b: string }; height?: number | string; format: (n: number) => string; axisFormat?: (n: number) => string
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} minTickGap={28} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} width={56} tickFormatter={v => (axisFormat ?? format)(Number(v))} />
          <Tooltip cursor={{ fill: 'rgb(0 0 0 / 0.04)' }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as Pair
            return <PairTooltip label={String(label)} total={format(row.a + row.b)} rows={[
              { name: names.a, value: format(row.a), className: 'bg-neutral-900' },
              { name: names.b, value: format(row.b), className: 'bg-neutral-300' },
            ]} />
          }} />
          <Bar dataKey="a" stackId="s" fill={CHART.brand} maxBarSize={24} animationDuration={700} />
          <Bar dataKey="b" stackId="s" fill="#d4d4d4" radius={[3, 3, 0, 0]} maxBarSize={24} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
