'use client'

import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// =============================================
// Graficele platformei, pe Recharts (github.com/recharts/recharts): linii
// fine, umplere în degradeu, fără axe în exces. Culorile sunt cele ale
// stărilor (accentul, verde pentru bani câștigați, roșu pentru pierderi).
// =============================================

export const CHART = {
  brand: '#5b5bd6',
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
export function TrendChart({ data, color = CHART.brand, height = 220, format }: {
  /** În pixeli, sau '100%' ca să umple un părinte cu înălțimea știută. */
  data: Point[]; color?: string; height?: number | string; format: (n: number) => string
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
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a3a3a3' }} width={56} tickFormatter={v => format(Number(v))} />
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
