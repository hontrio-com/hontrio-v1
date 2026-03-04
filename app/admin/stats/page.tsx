'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Package, ImageIcon, CreditCard, Store, DollarSign,
  TrendingUp, BarChart3, Wallet, Calculator, PieChart,
  Activity, FileText, ArrowUpRight, ArrowDownRight,
  RefreshCw, Euro, Percent,
} from 'lucide-react'

type Financial = {
  mrr: number; monthlySubscriptionRevenue: number; monthlyCreditPackRevenue: number
  totalMonthlyRevenue: number; monthlyImageGenerations: number; monthlyTextGenerations: number
  monthlyImageCost: number; monthlyTextCost: number; totalMonthlyApiCost: number
  totalMonthlyApiCostEur: number; monthlyProfit: number; profitMargin: number
  totalRevenue: number; totalApiCost: number; totalApiCostEur: number; totalProfit: number
  totalImageCost: number; totalTextCost: number; totalTextGenerations: number
  arpu: number; costPerCredit: number; revenuePerCredit: number; totalPaidUsers: number
  planDistribution: Record<string, number>; costPerImageGeneration: number
  costPerTextGeneration: number; usdToEurRate: number
}
type Stats = {
  totalUsers: number; totalStores: number; totalProducts: number; totalImages: number
  totalCreditsUsed: number
  recentUsers: { id: string; email: string; name: string; plan: string; credits: number; created_at: string }[]
  recentJobs: { id: string; type: string; status: string; created_at: string; user_email: string; user_name: string | null }[]
  financial: Financial
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-200', starter: 'bg-gray-400', professional: 'bg-gray-600', enterprise: 'bg-gray-900'
}
const PLAN_PRICES: Record<string, string> = {
  free: '0', starter: '99', professional: '249', enterprise: '499'
}

function StatCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string | number; sub?: string; icon: any; trend?: 'up' | 'down' | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        {trend && (
          trend === 'up'
            ? <ArrowUpRight className="h-4 w-4 text-gray-400" />
            : <ArrowDownRight className="h-4 w-4 text-gray-300" />
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-300 mt-0.5 font-mono">{sub}</p>}
    </div>
  )
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      setStats(data)
    } catch { } finally { setLoading(false) }
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
      </div>
    </div>
  )
  if (!stats) return <p className="text-red-500 text-sm">Eroare la încărcarea statisticilor</p>

  const f = stats.financial

  return (
    <div className="space-y-6 font-mono">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Statistici Platformă</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-sans">Overview general · {new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </button>
      </motion.div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Utilizatori', value: stats.totalUsers, icon: Users },
          { label: 'Magazine', value: stats.totalStores, icon: Store },
          { label: 'Produse', value: stats.totalProducts, icon: Package },
          { label: 'Imagini AI', value: stats.totalImages, icon: ImageIcon },
          { label: 'Credite consumate', value: stats.totalCreditsUsed, icon: CreditCard },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <StatCard {...s} value={s.value.toLocaleString('ro-RO')} />
          </motion.div>
        ))}
      </div>

      {/* Financial Overview - NO colored banners */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Dashboard Financiar</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">Luna curentă · {new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{f.totalMonthlyRevenue} RON</p>
              <p className="text-[10px] text-gray-400">Venit total luna</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-gray-50">
            {[
              { label: 'MRR', value: `${f.mrr} RON`, sub: `${f.totalPaidUsers} abonați` },
              { label: 'Abonamente', value: `${f.monthlySubscriptionRevenue} RON`, sub: 'Luna curentă' },
              { label: 'Credit packs', value: `${f.monthlyCreditPackRevenue} RON`, sub: 'Luna curentă' },
              { label: 'Cost API', value: `${f.totalMonthlyApiCostEur.toFixed(0)} RON`, sub: 'OpenAI + KIE' },
              { label: 'Marjă profit', value: `${f.profitMargin.toFixed(1)}%`, sub: `Profit: ${f.monthlyProfit.toFixed(0)} RON` },
            ].map(item => (
              <div key={item.label} className="px-5 py-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{item.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{item.value}</p>
                <p className="text-[10px] text-gray-300 mt-0.5 font-sans">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Venituri abonamente', value: `${f.monthlySubscriptionRevenue} RON`, sub: `${f.totalPaidUsers} abonați activi`, icon: Wallet },
          { label: 'Credit packs', value: `${f.monthlyCreditPackRevenue} RON`, sub: 'Pachete individuale', icon: CreditCard },
          { label: 'ARPU', value: `${f.arpu.toFixed(0)} RON`, sub: 'Venit mediu / user plătit', icon: Calculator },
          { label: 'Cost per credit', value: `$${f.costPerCredit.toFixed(4)}`, sub: `Venit: $${f.revenuePerCredit.toFixed(3)}/cr`, icon: BarChart3 },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 + i * 0.03 }}>
            <StatCard {...c} />
          </motion.div>
        ))}
      </div>

      {/* All-time + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Totaluri All-Time</p>
            </div>
            <div className="p-4 space-y-2">
              {[
                { label: 'Venit total', value: `${f.totalRevenue} RON`, bold: true },
                { label: 'Cost API total', value: `${f.totalApiCostEur.toFixed(0)} RON`, bold: false },
                { label: 'Profit total', value: `${f.totalProfit.toFixed(0)} RON`, bold: true },
                { label: 'Cost imagini', value: `$${f.totalImageCost.toFixed(2)}`, bold: false },
                { label: 'Cost texte', value: `$${f.totalTextCost.toFixed(4)}`, bold: false },
                { label: 'Texte generate', value: f.totalTextGenerations.toLocaleString(), bold: false },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <span className="text-xs text-gray-500 font-sans">{row.label}</span>
                  <span className={`text-xs ${row.bold ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Distribuție Planuri</p>
            </div>
            <div className="p-4 space-y-3">
              {Object.entries(f.planDistribution).map(([plan, count]) => {
                const total = stats.totalUsers || 1
                const pct = ((count / total) * 100).toFixed(1)
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900 capitalize">{plan}</span>
                        <span className="text-[10px] text-gray-400 font-sans">{PLAN_PRICES[plan] || '0'} RON/lună</span>
                      </div>
                      <span className="text-xs text-gray-600 font-semibold">{count} <span className="text-gray-300">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className={`h-full rounded-full ${PLAN_COLORS[plan] || 'bg-gray-300'}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent users + jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Utilizatori Recenți</p>
              <span className="text-xs text-gray-400 font-sans">{stats.totalUsers} total</span>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.recentUsers.slice(0, 6).map(user => (
                <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="h-8 w-8 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{user.name?.[0]?.toUpperCase() || 'U'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{user.name || user.email}</p>
                    <p className="text-[10px] text-gray-400 truncate font-sans">{user.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg capitalize">{user.plan}</span>
                    <p className="text-[10px] text-gray-300 mt-0.5">{user.credits} cr</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.37 }}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Ultimele Generări</p>
              <span className="text-xs text-gray-300 font-sans animate-pulse">● Live</span>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.recentJobs.slice(0, 8).map(job => (
                <div key={job.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${job.type === 'image' ? 'bg-gray-100' : 'bg-gray-50'}`}>
                    {job.type === 'image'
                      ? <ImageIcon className="h-3.5 w-3.5 text-gray-500" />
                      : <FileText className="h-3.5 w-3.5 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 capitalize">
                      {job.type === 'full_product' ? 'Produs complet' : job.type}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate font-sans">
                      {job.user_name || job.user_email} · {new Date(job.created_at).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${
                    job.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                    job.status === 'failed' ? 'bg-gray-900 text-white' :
                    job.status === 'processing' ? 'bg-gray-200 text-gray-700' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {job.status === 'completed' ? 'OK' : job.status === 'failed' ? 'ERR' : job.status === 'processing' ? '...' : 'Q'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* API cost reference - no colored boxes */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Referință Prețuri API</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
            {[
              { name: 'OpenAI GPT-4o-mini', icon: FileText, lines: ['Input: $0.15/1M tokens · Output: $0.60/1M tokens', '~$0.004 per generare text completă', '~800 tokens input + ~1500 tokens output per request'] },
              { name: 'KIE Nano Banana Pro', icon: ImageIcon, lines: ['1K/2K: $0.09/imagine · 4K: $0.12/imagine', '~$0.09 cost mediu per imagine', 'Via kie.ai — ~33% mai ieftin decât Google direct ($0.134)'] },
            ].map(api => (
              <div key={api.name} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <api.icon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-900">{api.name}</span>
                </div>
                {api.lines.map((line, i) => (
                  <p key={i} className={`text-[11px] font-sans ${i === 0 ? 'text-gray-600' : i === 1 ? 'text-gray-500' : 'text-gray-300'}`}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}