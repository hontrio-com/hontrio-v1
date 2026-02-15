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
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type CostData = {
  totalImageGenerations: number
  totalTextGenerations: number
  estimatedImageCost: number
  estimatedTextCost: number
  totalCreditsUsed: number
  transactions: { type: string; reference_type: string; amount: number; description: string; created_at: string }[]
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
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!costs) return <p className="text-red-500">Eroare la încărcarea datelor</p>

  const totalCost = costs.estimatedImageCost + costs.estimatedTextCost

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Costuri API</h1>
        <p className="text-gray-500 text-sm mt-0.5">Monitorizare costuri OpenAI și KIE pentru generări</p>
      </motion.div>

      {/* Cost banner */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="bg-gradient-to-r from-red-500 via-rose-600 to-pink-600 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <DollarSign className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Cost total estimat</h2>
                <p className="text-red-200 text-sm">Bazat pe prețurile API curente</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-3 text-center">
                <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                <p className="text-[10px] text-red-200">Total</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-3 text-center">
                <p className="text-2xl font-bold">{costs.totalCreditsUsed}</p>
                <p className="text-[10px] text-red-200">Credite</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Imagini generate', value: costs.totalImageGenerations, cost: `$${costs.estimatedImageCost.toFixed(2)}`, icon: ImageIcon, color: 'purple' },
          { label: 'Texte generate', value: costs.totalTextGenerations, cost: `$${costs.estimatedTextCost.toFixed(2)}`, icon: FileText, color: 'blue' },
          { label: 'Cost per credit', value: costs.totalCreditsUsed > 0 ? `$${(totalCost / costs.totalCreditsUsed).toFixed(3)}` : '$0', cost: 'medie', icon: BarChart3, color: 'green' },
          { label: 'Credite consumate', value: costs.totalCreditsUsed, cost: 'total', icon: TrendingDown, color: 'red' },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeInUp} transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-xl bg-${stat.color}-100 flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}-600`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <span className="text-[10px] font-medium text-gray-400">{stat.cost}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pricing reference */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Referință prețuri API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">OpenAI GPT-4o-mini</span>
                </div>
                <p className="text-xs text-blue-700">~$0.01 per generare text</p>
                <p className="text-xs text-blue-600 mt-1">Include: titlu, descrieri, beneficii, meta, SEO score</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">KIE Nano Banana Pro</span>
                </div>
                <p className="text-xs text-purple-700">~$0.12 per imagine generată</p>
                <p className="text-xs text-purple-600 mt-1">Include: 1K resolution, PNG, orice stil</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent transactions */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.25 }}>
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
                        ~${t.reference_type === 'image_generation' ? '0.12' : '0.01'}
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