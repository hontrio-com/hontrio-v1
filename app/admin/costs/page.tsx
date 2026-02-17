'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  ImageIcon,
  FileText,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  Euro,
  Calendar,
  Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type MonthData = {
  images: number
  texts: number
  costUsd: number
  costEur: number
  imageCostUsd: number
  textCostUsd: number
}

type Transaction = {
  amount: number
  reference_type: string
  description: string
  created_at: string
  estimatedCostUsd: number
}

type DailyBreakdown = {
  date: string
  images: number
  texts: number
  costUsd: number
  costEur: number
}

type CostData = {
  totalImageGenerations: number
  totalTextGenerations: number
  totalCostUsd: number
  totalCostEur: number
  totalImageCostUsd: number
  totalTextCostUsd: number
  totalCreditsUsed: number
  month: MonthData
  lastMonth: { images: number; texts: number; costUsd: number }
  costTrend: number
  costPerCredit: number
  avgCostPerGeneration: number
  pricePerImage: number
  pricePerText: number
  usdToEur: number
  dailyBreakdown: DailyBreakdown[]
  transactions: Transaction[]
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function AdminCostsPage() {
  const [costs, setCosts] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCosts()
  }, [])

  const fetchCosts = async () => {
    try {
      const res = await fetch('/api/admin/costs')
      const data = await res.json()
      setCosts(data)
    } catch {
      console.error('Error loading costs')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!costs) return <p className="text-red-500">Eroare la încărcarea datelor</p>

  const trendIsUp = costs.costTrend > 0
  const monthName = new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Costuri API</h1>
        <p className="text-gray-500 text-sm mt-0.5">Monitorizare costuri reale OpenAI + KIE și analiza profitabilității</p>
      </motion.div>

      {/* Cost banner - this month */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="bg-gradient-to-r from-red-500 via-rose-600 to-pink-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cost API — {monthName}</h2>
                <p className="text-red-200 text-sm">Bazat pe prețurile reale OpenAI + KIE.ai</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">${costs.month.costUsd.toFixed(2)}</p>
                <p className="text-[10px] text-red-200 mt-0.5">Cost total (USD)</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{costs.month.costEur.toFixed(2)}€</p>
                <p className="text-[10px] text-red-200 mt-0.5">Cost total (EUR)</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{costs.month.images}</p>
                <p className="text-[10px] text-red-200 mt-0.5">Imagini generate</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <p className="text-2xl font-bold">{costs.month.texts}</p>
                <p className="text-[10px] text-red-200 mt-0.5">Texte generate</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <div className="flex items-center gap-1">
                  {costs.costTrend !== 0 && (
                    trendIsUp
                      ? <ArrowUpRight className="h-4 w-4 text-red-200" />
                      : <ArrowDownRight className="h-4 w-4 text-green-200" />
                  )}
                  <p className="text-2xl font-bold">
                    {costs.costTrend === 0 ? '—' : `${trendIsUp ? '+' : ''}${costs.costTrend.toFixed(1)}%`}
                  </p>
                </div>
                <p className="text-[10px] text-red-200 mt-0.5">vs luna trecută</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* All-time cost cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Imagini generate (total)',
            value: costs.totalImageGenerations,
            sub: `$${costs.totalImageCostUsd.toFixed(2)} cost total`,
            icon: ImageIcon,
            bg: 'bg-purple-100',
            iconColor: 'text-purple-600',
          },
          {
            label: 'Texte generate (total)',
            value: costs.totalTextGenerations,
            sub: `$${costs.totalTextCostUsd.toFixed(4)} cost total`,
            icon: FileText,
            bg: 'bg-blue-100',
            iconColor: 'text-blue-600',
          },
          {
            label: 'Cost per credit',
            value: `$${costs.costPerCredit.toFixed(4)}`,
            sub: `${costs.totalCreditsUsed} credite consumate`,
            icon: BarChart3,
            bg: 'bg-green-100',
            iconColor: 'text-green-600',
          },
          {
            label: 'Cost total all-time',
            value: `$${costs.totalCostUsd.toFixed(2)}`,
            sub: `≈ ${costs.totalCostEur.toFixed(2)}€`,
            icon: DollarSign,
            bg: 'bg-red-100',
            iconColor: 'text-red-600',
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeInUp} transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Month comparison + Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Month vs month */}
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Comparație luni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs font-medium text-blue-800 mb-3">Luna curentă</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-blue-600">Imagini</span>
                      <span className="text-xs font-semibold text-blue-900">{costs.month.images}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-blue-600">Texte</span>
                      <span className="text-xs font-semibold text-blue-900">{costs.month.texts}</span>
                    </div>
                    <div className="border-t border-blue-100 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-blue-600">Cost total</span>
                        <span className="text-sm font-bold text-blue-900">${costs.month.costUsd.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 mb-3">Luna trecută</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Imagini</span>
                      <span className="text-xs font-semibold text-gray-700">{costs.lastMonth.images}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Texte</span>
                      <span className="text-xs font-semibold text-gray-700">{costs.lastMonth.texts}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-400">Cost total</span>
                        <span className="text-sm font-bold text-gray-700">${costs.lastMonth.costUsd.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cost breakdown this month */}
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.25 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Detaliu costuri luna curentă
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Images */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                      <span className="text-sm text-gray-700">Imagini ({costs.month.images})</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">${costs.month.imageCostUsd.toFixed(2)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{
                        width: costs.month.costUsd > 0
                          ? `${(costs.month.imageCostUsd / costs.month.costUsd * 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>

                {/* Texts */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span className="text-sm text-gray-700">Texte ({costs.month.texts})</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">${costs.month.textCostUsd.toFixed(4)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: costs.month.costUsd > 0
                          ? `${(costs.month.textCostUsd / costs.month.costUsd * 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Total</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">${costs.month.costUsd.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 ml-2">≈ {costs.month.costEur.toFixed(2)}€</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Daily breakdown */}
      {costs.dailyBreakdown.length > 0 && (
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.3 }}>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Cost zilnic (ultimele 30 zile)</CardTitle>
                <span className="text-xs text-gray-400">{costs.dailyBreakdown.length} zile cu activitate</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {costs.dailyBreakdown.slice(0, 15).map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 w-24">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs text-gray-500">{day.images}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs text-gray-500">{day.texts}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">${day.costUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400 ml-1.5">≈ {day.costEur.toFixed(2)}€</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pricing reference */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.35 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Referință prețuri API (costuri reale verificate)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">OpenAI GPT-4o-mini</span>
                </div>
                <p className="text-xs text-blue-700">Input: $0.15/1M tokens · Output: $0.60/1M tokens</p>
                <p className="text-xs text-blue-600 mt-1">Cost real per generare: ~$0.004</p>
                <p className="text-[10px] text-blue-500 mt-1">Include: titlu, descrieri, beneficii, meta, SEO score</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">KIE Nano Banana Pro (via kie.ai)</span>
                </div>
                <p className="text-xs text-purple-700">1K/2K: $0.09/img · 4K: $0.12/img</p>
                <p className="text-xs text-purple-600 mt-1">Cost real per imagine: ~$0.10 (cu overhead)</p>
                <p className="text-[10px] text-purple-500 mt-1">Google direct: $0.134/img — economisești ~20%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent transactions */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.4 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Ultimele operații cu cost</CardTitle>
              <span className="text-xs text-gray-400">{costs.transactions.length} tranzacții</span>
            </div>
          </CardHeader>
          <CardContent>
            {costs.transactions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nicio operație</p>
              </div>
            ) : (
              <div className="space-y-1">
                {costs.transactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                        t.reference_type === 'image_generation' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        {t.reference_type === 'image_generation' ? (
                          <ImageIcon className="h-4 w-4 text-purple-600" />
                        ) : (
                          <FileText className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{t.description}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(t.created_at).toLocaleString('ro-RO', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-red-500">{t.amount} cr</span>
                      <p className="text-[10px] text-gray-400">
                        ~${t.estimatedCostUsd.toFixed(t.estimatedCostUsd < 0.01 ? 4 : 2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}