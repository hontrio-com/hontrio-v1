'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Package,
  ImageIcon,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Store,
  DollarSign,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  FileText,
  Activity,
  Euro,
  Percent,
  PieChart,
  Wallet,
  Calculator,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Financial = {
  mrr: number
  monthlySubscriptionRevenue: number
  monthlyCreditPackRevenue: number
  totalMonthlyRevenue: number
  monthlyImageGenerations: number
  monthlyTextGenerations: number
  monthlyImageCost: number
  monthlyTextCost: number
  totalMonthlyApiCost: number
  totalMonthlyApiCostEur: number
  monthlyProfit: number
  profitMargin: number
  totalRevenue: number
  totalApiCost: number
  totalApiCostEur: number
  totalProfit: number
  totalImageCost: number
  totalTextCost: number
  totalTextGenerations: number
  arpu: number
  costPerCredit: number
  revenuePerCredit: number
  totalPaidUsers: number
  planDistribution: Record<string, number>
  costPerImageGeneration: number
  costPerTextGeneration: number
  usdToEurRate: number
}

type Stats = {
  totalUsers: number
  totalStores: number
  totalProducts: number
  totalImages: number
  totalCreditsUsed: number
  recentUsers: { id: string; email: string; name: string; plan: string; credits: number; created_at: string }[]
  recentJobs: { id: string; type: string; status: string; created_at: string; user_email: string; user_name: string | null }[]
  financial: Financial
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      setStats(data)
    } catch {
      console.error('Error loading stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return <p className="text-red-500">Eroare la încărcarea statisticilor</p>

  const f = stats.financial

  const statCards = [
    { label: 'Utilizatori', value: stats.totalUsers, icon: Users, bg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Magazine', value: stats.totalStores, icon: Store, bg: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'Produse', value: stats.totalProducts, icon: Package, bg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Imagini AI', value: stats.totalImages, icon: ImageIcon, bg: 'bg-orange-100', iconColor: 'text-orange-600' },
    { label: 'Credite consumate', value: stats.totalCreditsUsed, icon: CreditCard, bg: 'bg-red-100', iconColor: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Statistici platformă</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview general și indicatori financiari HONTRIO</p>
      </motion.div>

      {/* Basic stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}>
            <Card className="rounded-2xl border-0 shadow-sm card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-gray-300" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ===== FINANCIAL DASHBOARD ===== */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.15 }}>
        <div className="bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Euro className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Dashboard Financiar — Luna curentă</h2>
                <p className="text-green-200 text-sm">{new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{f.mrr}€</p>
                <p className="text-[10px] text-green-200 mt-0.5">MRR (Venit Recurent)</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{f.totalMonthlyRevenue}€</p>
                <p className="text-[10px] text-green-200 mt-0.5">Venit total luna</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{f.totalMonthlyApiCostEur.toFixed(2)}€</p>
                <p className="text-[10px] text-green-200 mt-0.5">Cost API luna</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{f.monthlyProfit.toFixed(2)}€</p>
                <p className="text-[10px] text-green-200 mt-0.5">Profit luna</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{f.profitMargin.toFixed(1)}%</p>
                <p className="text-[10px] text-green-200 mt-0.5">Marjă profit</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Financial detail cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Venituri abonamente',
            value: `${f.monthlySubscriptionRevenue}€`,
            sub: `${f.totalPaidUsers} abonați activi`,
            icon: Wallet,
            bg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
          },
          {
            label: 'Venituri credit packs',
            value: `${f.monthlyCreditPackRevenue}€`,
            sub: 'Pachete individuale',
            icon: CreditCard,
            bg: 'bg-blue-100',
            iconColor: 'text-blue-600',
          },
          {
            label: 'ARPU',
            value: `${f.arpu.toFixed(1)}€`,
            sub: 'Venit mediu per user plătit',
            icon: Calculator,
            bg: 'bg-purple-100',
            iconColor: 'text-purple-600',
          },
          {
            label: 'Cost per credit',
            value: `$${f.costPerCredit.toFixed(4)}`,
            sub: `Veniți: $${f.revenuePerCredit.toFixed(3)}/credit`,
            icon: BarChart3,
            bg: 'bg-orange-100',
            iconColor: 'text-orange-600',
          },
        ].map((card, i) => (
          <motion.div key={card.label} {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 + i * 0.03 }}>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* All-time financials + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.25 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Totaluri financiare (all-time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {[
                  { label: 'Venit total', value: `${f.totalRevenue}€`, color: 'text-green-600' },
                  { label: 'Cost API total', value: `${f.totalApiCostEur.toFixed(2)}€`, color: 'text-red-500' },
                  { label: 'Profit total', value: `${f.totalProfit.toFixed(2)}€`, color: 'text-emerald-600' },
                  { label: 'Cost imagini total', value: `$${f.totalImageCost.toFixed(2)}`, color: 'text-purple-600' },
                  { label: 'Cost texte total', value: `$${f.totalTextCost.toFixed(4)}`, color: 'text-blue-600' },
                  { label: 'Texte generate total', value: `${f.totalTextGenerations}`, color: 'text-gray-700' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.3 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-purple-600" />
                Distribuție planuri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(f.planDistribution).map(([plan, count]) => {
                  const total = stats.totalUsers || 1
                  const percentage = ((count / total) * 100).toFixed(1)
                  const planColors: Record<string, string> = {
                    free: 'bg-gray-400',
                    starter: 'bg-blue-500',
                    professional: 'bg-indigo-500',
                    enterprise: 'bg-purple-600',
                  }
                  const planPrices: Record<string, string> = {
                    free: '0€',
                    starter: '49€',
                    professional: '99€',
                    enterprise: '249€',
                  }
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">{plan}</span>
                          <Badge className="border-0 text-[10px] bg-gray-100 text-gray-500">{planPrices[plan]}/lună</Badge>
                        </div>
                        <span className="text-sm text-gray-700">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${planColors[plan] || 'bg-gray-400'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent users + Recent jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.35 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Utilizatori recenți</CardTitle>
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-0 text-[10px]">
                  {stats.totalUsers} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {stats.recentUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Niciun utilizator</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentUsers.slice(0, 6).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {user.name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name || 'Fără nume'}</p>
                          <p className="text-[11px] text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] capitalize">{user.plan}</Badge>
                        <span className="text-xs text-gray-400">{user.credits} cr</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent jobs */}
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.4 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Ultimele generări</CardTitle>
                <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-0 text-[10px]">
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {stats.recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nicio generare</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentJobs.slice(0, 8).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                          job.type === 'image' ? 'bg-purple-100' : job.type === 'full_product' ? 'bg-indigo-100' : 'bg-blue-100'
                        }`}>
                          {job.type === 'image' ? (
                            <ImageIcon className="h-4 w-4 text-purple-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {job.type === 'full_product' ? 'Produs complet' : job.type}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {job.user_name || job.user_email} ·{' '}
                            {new Date(job.created_at).toLocaleString('ro-RO', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge className={`border-0 text-[10px] ${
                        job.status === 'completed' ? 'bg-green-50 text-green-600' :
                        job.status === 'failed' ? 'bg-red-50 text-red-600' :
                        job.status === 'processing' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {job.status === 'completed' ? 'Complet' :
                         job.status === 'failed' ? 'Eșuat' :
                         job.status === 'processing' ? 'În lucru' : 'În coadă'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* API pricing reference */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.45 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Referință prețuri API (costuri reale)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">OpenAI GPT-4o-mini</span>
                </div>
                <p className="text-xs text-blue-700">Input: $0.15/1M tokens · Output: $0.60/1M tokens</p>
                <p className="text-xs text-blue-600 mt-1">~$0.004 per generare text (titlu + descrieri + SEO)</p>
                <p className="text-[10px] text-blue-500 mt-1">~800 tokens input + ~1500 tokens output per request</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">KIE Nano Banana Pro</span>
                </div>
                <p className="text-xs text-purple-700">1K/2K: $0.09/imagine · 4K: $0.12/imagine</p>
                <p className="text-xs text-purple-600 mt-1">~$0.10 per imagine (medie cu overhead)</p>
                <p className="text-[10px] text-purple-500 mt-1">Via kie.ai — ~20% mai ieftin decât Google direct</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}