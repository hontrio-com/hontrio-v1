'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Download, RefreshCw, ArrowUpRight,
  ArrowDownRight, Minus, BarChart2, DollarSign, Users,
  Zap, Target, Activity, Calendar, ChevronRight,
} from 'lucide-react'

type MonthData = {
  label: string
  revenue: number
  subRevenue: number
  packRevenue: number
  apiCost: number
  profit: number
  margin: number
  images: number
  texts: number
  newUsers: number
}

type FinancialData = {
  monthly: MonthData[]
  current: MonthData
  prev: MonthData
  mrr: number
  arpu: number
  ltv: number
  churnRate: number
  forecastRevenue: number
  forecastProfit: number
  forecastMargin: number
  planDist: Record<string, number>
  totalPaid: number
  totalUsers: number
  allTimeRevenue: number
  allTimeProfit: number
  allTimeApiCost: number
}

const fmt = (n: number) => n.toLocaleString('ro-RO')

function MiniSparkline({ data, color = '#000' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120, h = 32, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BarChart({ data }: { data: MonthData[] }) {
  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="flex items-end gap-1 h-40 w-full">
      {data.map((d, i) => {
        const revH = (d.revenue / maxRev) * 100
        const costH = (d.apiCost / maxRev) * 100
        const isLast = i === data.length - 1
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {d.label}: {fmt(d.revenue)} RON
            </div>
            <div className="w-full flex flex-col justify-end" style={{ height: '128px' }}>
              <div
                className={`w-full rounded-t transition-all ${isLast ? 'bg-gray-900' : 'bg-gray-200 group-hover:bg-gray-400'}`}
                style={{ height: `${revH}%`, minHeight: revH > 0 ? '2px' : '0' }}
              />
            </div>
            <span className="text-[9px] text-gray-400 mt-1">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function ProfitChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map(d => Math.max(d.revenue, d.apiCost)), 1)
  return (
    <div className="relative h-40">
      <div className="flex items-end gap-1 h-32 w-full">
        {data.map((d, i) => {
          const isLast = i === data.length - 1
          return (
            <div key={i} className="flex-1 flex gap-px items-end group relative">
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {d.label} · Profit: {d.margin}%
              </div>
              <div className="flex-1 rounded-t bg-gray-100 group-hover:bg-gray-900 transition-all" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? '2px' : '0' }} />
              <div className="flex-1 rounded-t bg-gray-300 group-hover:bg-red-400 transition-all" style={{ height: `${(d.apiCost / max) * 100}%`, minHeight: d.apiCost > 0 ? '2px' : '0' }} />
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm bg-gray-900" /><span className="text-[10px] text-gray-500">Venituri</span></div>
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm bg-gray-300" /><span className="text-[10px] text-gray-500">Cost API</span></div>
      </div>
    </div>
  )
}

function DonutChart({ planDist }: { planDist: Record<string, number> }) {
  const total = Object.values(planDist).reduce((s, v) => s + v, 0) || 1
  const colors = ['#f3f4f6', '#d1d5db', '#6b7280', '#111827']
  const plans = ['free', 'starter', 'professional', 'enterprise']
  let cumAngle = -90

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 80 80" className="w-20 h-20 shrink-0">
        {plans.map((plan, i) => {
          const pct = (planDist[plan] || 0) / total
          const angle = pct * 360
          if (angle < 1) { return null }
          const startRad = (cumAngle * Math.PI) / 180
          const endRad = ((cumAngle + angle) * Math.PI) / 180
          cumAngle += angle
          const x1 = 40 + 32 * Math.cos(startRad)
          const y1 = 40 + 32 * Math.sin(startRad)
          const x2 = 40 + 32 * Math.cos(endRad)
          const y2 = 40 + 32 * Math.sin(endRad)
          const large = angle > 180 ? 1 : 0
          return (
            <path
              key={plan}
              d={`M 40 40 L ${x1} ${y1} A 32 32 0 ${large} 1 ${x2} ${y2} Z`}
              fill={colors[i]}
              stroke="white"
              strokeWidth="1"
            />
          )
        })}
        <circle cx="40" cy="40" r="18" fill="white" />
        <text x="40" y="44" textAnchor="middle" fontSize="10" fontWeight="600" fill="#111">{total}</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {plans.map((plan, i) => (
          <div key={plan} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-sm" style={{ background: colors[i] }} />
              <span className="text-xs capitalize text-gray-600">{plan}</span>
            </div>
            <span className="text-xs font-medium text-gray-900">{planDist[plan] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FinancialPage() {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/financial')
      const d = await res.json()
      setData(d)
    } catch { } finally { setLoading(false) }
  }

  const exportCSV = () => {
    if (!data) return
    setExporting(true)
    const rows = [
      ['Luna', 'Venituri (RON)', 'Abonamente (RON)', 'Credit Packs (RON)', 'Cost API (RON)', 'Profit (RON)', 'Marjă (%)', 'Imagini', 'Texte', 'Useri noi'],
      ...data.monthly.map(m => [m.label, m.revenue, m.subRevenue, m.packRevenue, m.apiCost, m.profit, m.margin, m.images, m.texts, m.newUsers]),
      [],
      ['SUMAR', '', '', '', '', '', '', '', '', ''],
      ['Venituri totale (RON)', data.allTimeRevenue],
      ['Profit total (RON)', data.allTimeProfit],
      ['Cost API total (RON)', data.allTimeApiCost],
      ['MRR (RON)', data.mrr],
      ['ARPU (RON)', data.arpu],
      ['LTV estimat (RON)', data.ltv],
      ['Churn rate (%)', data.churnRate],
      ['Forecast luna urmatoare (RON)', data.forecastRevenue],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hontrio-raport-financiar-${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const delta = (curr: number, prev: number) => {
    if (!prev) return null
    const pct = ((curr - prev) / prev) * 100
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (!data) return <p className="text-red-500 text-sm">Eroare la încărcare</p>

  const revDelta = delta(data.current.revenue, data.prev.revenue)
  const profDelta = delta(data.current.profit, data.prev.profit)

  return (
    <div className="space-y-6 font-mono">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Raport Financiar</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-sans">
            {new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })} · Date în timp real
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
          <button onClick={exportCSV} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs hover:bg-gray-800 transition-colors disabled:opacity-60">
            <Download className="h-3.5 w-3.5" />{exporting ? 'Export...' : 'Export CSV'}
          </button>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'MRR', value: `${fmt(data.mrr)} RON`,
            sub: `${data.totalPaid} abonați activi`,
            sparkData: data.monthly.map(m => m.subRevenue),
            delta: revDelta,
          },
          {
            label: 'Venit luna curentă', value: `${fmt(data.current.revenue)} RON`,
            sub: `Prev: ${fmt(data.prev.revenue)} RON`,
            sparkData: data.monthly.map(m => m.revenue),
            delta: revDelta,
          },
          {
            label: 'Profit luna curentă', value: `${fmt(data.current.profit)} RON`,
            sub: `Marjă: ${data.current.margin}%`,
            sparkData: data.monthly.map(m => m.profit),
            delta: profDelta,
          },
          {
            label: 'Cost API luna', value: `${fmt(data.current.apiCost)} RON`,
            sub: `${data.current.images} img · ${data.current.texts} texte`,
            sparkData: data.monthly.map(m => m.apiCost),
            delta: null,
          },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{kpi.label}</p>
                {kpi.delta && (
                  <span className={`flex items-center text-[10px] font-medium ${kpi.delta.up ? 'text-gray-900' : 'text-gray-400'}`}>
                    {kpi.delta.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.delta.pct}%
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-sans">{kpi.sub}</p>
              <div className="mt-2">
                <MiniSparkline data={kpi.sparkData} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Venituri 12 luni</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">Evoluție lunară</p>
              </div>
              <BarChart2 className="h-4 w-4 text-gray-300" />
            </div>
            <BarChart data={data.monthly} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Venituri vs Cost API</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">Profitabilitate lunară</p>
              </div>
              <Activity className="h-4 w-4 text-gray-300" />
            </div>
            <ProfitChart data={data.monthly} />
          </div>
        </motion.div>
      </div>

      {/* Metrics Row: Churn, LTV, ARPU, Forecast */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'ARPU', value: `${fmt(data.arpu)} RON`, sub: 'Avg Revenue Per User', icon: DollarSign, note: 'Per abonat activ/lună' },
          { label: 'LTV Estimat', value: `${fmt(data.ltv)} RON`, sub: 'Lifetime Value', icon: TrendingUp, note: 'ARPU ÷ Churn rate' },
          { label: 'Churn Rate', value: `${data.churnRate}%`, sub: 'Rată de abandon', icon: TrendingDown, note: 'Luna curentă vs precedentă' },
          { label: 'Forecast', value: `${fmt(data.forecastRevenue)} RON`, sub: 'Prognoză luna viitoare', icon: Target, note: `Marjă estimată: ${data.forecastMargin}%` },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.03 }}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{m.label}</p>
                <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <m.icon className="h-3.5 w-3.5 text-gray-500" />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{m.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-sans">{m.sub}</p>
              <p className="text-[9px] text-gray-300 mt-1 font-sans">{m.note}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom Row: Plan dist + Monthly table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">Distribuție Planuri</p>
            <DonutChart planDist={data.planDist} />
            <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
              {[
                { label: 'Useri plătitori', value: data.totalPaid },
                { label: 'Useri totali', value: data.totalUsers },
                { label: 'Conversie', value: `${data.totalUsers > 0 ? Math.round((data.totalPaid / data.totalUsers) * 100) : 0}%` },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-sans">{r.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Monthly table */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Breakdown Lunar</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Lună', 'Venituri', 'Cost API', 'Profit', 'Marjă', 'Img', 'Useri+'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.slice().reverse().slice(0, 8).map((m, i) => (
                    <tr key={m.label} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i === 0 ? 'font-semibold' : ''}`}>
                      <td className="px-4 py-2.5 text-gray-600">{m.label}</td>
                      <td className="px-4 py-2.5 text-gray-900">{fmt(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-gray-400">{m.apiCost.toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-gray-900">{fmt(m.profit)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`${m.margin >= 80 ? 'text-gray-900' : m.margin >= 60 ? 'text-gray-500' : 'text-gray-300'}`}>{m.margin}%</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{m.images}</td>
                      <td className="px-4 py-2.5 text-gray-400">{m.newUsers > 0 ? `+${m.newUsers}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* All-time footer */}
            <div className="px-5 py-3 bg-gray-50 grid grid-cols-3 gap-4 border-t border-gray-100">
              {[
                { label: 'Venituri totale', value: `${fmt(data.allTimeRevenue)} RON` },
                { label: 'Profit total', value: `${fmt(data.allTimeProfit)} RON` },
                { label: 'Cost API total', value: `${fmt(data.allTimeApiCost)} RON` },
              ].map(r => (
                <div key={r.label}>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest">{r.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}