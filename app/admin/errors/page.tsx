'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ImageIcon, FileText, RefreshCw, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

type ErrorEntry = { id: string; type: string; detail: string; user: string; created_at: string; error: string }
type ErrorData = { errors: ErrorEntry[]; totalErrors: number; last24h: number }

export default function ErrorsPage() {
  const { t } = useT()
  const jobTypeLabel = (type: string) => t.has(`admin.job_type_${type}`) ? t(`admin.job_type_${type}`) : type
  const [data, setData] = useState<ErrorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'image_generation' | 'text'>('all')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/errors')
      const d = await res.json()
      setData(d)
    } catch { } finally { setLoading(false) }
  }

  const filtered = (data?.errors || []).filter(e =>
    filter === 'all' ? true : e.type === filter
  )

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return t('common.time_minutes_ago', { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('common.time_hours_ago', { count: h })
    return t('common.time_days_ago', { count: Math.floor(h / 24) })
  }

  return (
    <div className="space-y-6 font-mono">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('admin.nav_errors')}</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-sans">{t('admin.errors_subtitle')}</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: t('admin.errors_total'), value: data?.totalErrors ?? '—' },
          { label: t('admin.errors_last_24h'), value: data?.last24h ?? '—' },
          { label: t('admin.errors_rate'), value: data ? t('admin.errors_per_day', { value: data.totalErrors > 0 ? data.last24h : 0 }) : '—' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'image_generation', 'text'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            {f === 'all' ? t('common.all') : f === 'image_generation' ? t('admin.financial_images') : t('admin.financial_texts')}
          </button>
        ))}
      </div>

      {/* Error list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-sans">{t('admin.errors_empty')}</p>
          </div>
        )}
        {!loading && filtered.map((err, i) => (
          <motion.div
            key={err.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-4 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
          >
            <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
              {err.type === 'image_generation'
                ? <ImageIcon className="h-3.5 w-3.5 text-gray-500" />
                : <FileText className="h-3.5 w-3.5 text-gray-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-900">{jobTypeLabel(err.type)}</span>
                <span className="text-[10px] text-gray-400 font-sans">{err.user}</span>
              </div>
              <p className="text-xs text-gray-500 font-sans truncate">{err.detail}</p>
              <p className="text-[10px] text-gray-300 font-sans mt-0.5">{err.error}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-300 shrink-0">
              <Clock className="h-3 w-3" />
              {timeAgo(err.created_at)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}