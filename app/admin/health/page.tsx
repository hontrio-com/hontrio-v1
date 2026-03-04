'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, XCircle, Clock, Activity, Wifi } from 'lucide-react'

type Check = { name: string; ok: boolean; latency: number; error?: string }
type HealthData = { checks: Check[]; allOk: boolean; checkedAt: string }

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => { fetch() }, [])
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await window.fetch('/api/admin/health')
      const d = await res.json()
      setData(d)
    } catch { } finally { setLoading(false) }
  }

  const latencyColor = (ms: number) => {
    if (ms < 300) return 'text-gray-900'
    if (ms < 1000) return 'text-gray-500'
    return 'text-gray-300'
  }

  const latencyBar = (ms: number) => Math.min((ms / 3000) * 100, 100)

  return (
    <div className="space-y-6 font-mono">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Health</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-sans">
            {data ? `Verificat: ${new Date(data.checkedAt).toLocaleTimeString('ro-RO')}` : 'Se verifică...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-colors ${autoRefresh ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Wifi className="h-3.5 w-3.5" />Auto (30s)
          </button>
          <button onClick={fetch} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Verifică
          </button>
        </div>
      </motion.div>

      {/* Overall status */}
      {data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className={`rounded-2xl border p-5 ${data.allOk ? 'border-gray-200 bg-white' : 'border-gray-900 bg-gray-900'}`}>
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${data.allOk ? 'bg-gray-100' : 'bg-white/10'}`}>
                <Activity className={`h-6 w-6 ${data.allOk ? 'text-gray-700' : 'text-white'}`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${data.allOk ? 'text-gray-900' : 'text-white'}`}>
                  {data.allOk ? 'Toate sistemele funcționează' : 'Probleme detectate'}
                </p>
                <p className={`text-xs mt-0.5 font-sans ${data.allOk ? 'text-gray-400' : 'text-gray-300'}`}>
                  {data.checks.filter(c => c.ok).length}/{data.checks.length} servicii online
                </p>
              </div>
              <div className={`ml-auto h-3 w-3 rounded-full ${data.allOk ? 'bg-gray-300 animate-pulse' : 'bg-white animate-pulse'}`} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Individual checks */}
      <div className="space-y-3">
        {loading && !data && [1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
        {(data?.checks || []).map((check, i) => (
          <motion.div key={check.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {check.ok
                    ? <CheckCircle2 className="h-5 w-5 text-gray-700" />
                    : <XCircle className="h-5 w-5 text-gray-300" />
                  }
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{check.name}</p>
                    {check.error && <p className="text-xs text-gray-400 font-sans mt-0.5">{check.error}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${latencyColor(check.latency)}`}>
                    {check.latency}ms
                  </span>
                  <p className="text-[10px] text-gray-300 font-sans mt-0.5">
                    {check.ok ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              {check.latency > 0 && (
                <div className="mt-3">
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${latencyBar(check.latency)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      className={`h-full rounded-full ${check.ok ? 'bg-gray-300' : 'bg-gray-900'}`}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-gray-300">0ms</span>
                    <span className="text-[9px] text-gray-300">3000ms</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Latency legend */}
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="flex gap-6 px-2">
            {[{ label: '< 300ms — Excelent', color: 'bg-gray-900' }, { label: '300-1000ms — OK', color: 'bg-gray-400' }, { label: '> 1000ms — Lent', color: 'bg-gray-200' }].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${l.color}`} />
                <span className="text-[10px] text-gray-400 font-sans">{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}