'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Package,
  ImageIcon,
  CreditCard,
  TrendingUp,
  BarChart3,
  Store,
  DollarSign,
  Loader2,
  ArrowUpRight,
  Clock,
  Sparkles,
  FileText,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Stats = {
  totalUsers: number
  totalStores: number
  totalProducts: number
  totalImages: number
  totalCreditsUsed: number
  recentUsers: { id: string; email: string; name: string; plan: string; credits: number; created_at: string }[]
  recentJobs: { id: string; type: string; status: string; created_at: string }[]
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
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return <p className="text-red-500">Eroare la încărcarea statisticilor</p>

  const statCards = [
    { label: 'Utilizatori', value: stats.totalUsers, icon: Users, color: 'blue', bg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Magazine', value: stats.totalStores, icon: Store, color: 'green', bg: 'bg-green-100', iconColor: 'text-green-600' },
    { label: 'Produse', value: stats.totalProducts, icon: Package, color: 'purple', bg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Imagini AI', value: stats.totalImages, icon: ImageIcon, color: 'orange', bg: 'bg-orange-100', iconColor: 'text-orange-600' },
    { label: 'Credite consumate', value: stats.totalCreditsUsed, icon: CreditCard, color: 'red', bg: 'bg-red-100', iconColor: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Statistici platformă</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview general asupra sistemului HONTRIO</p>
      </motion.div>

      {/* Stats grid */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 }}>
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
        <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.25 }}>
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
                          job.type === 'image' ? 'bg-purple-100' : 'bg-blue-100'
                        }`}>
                          {job.type === 'image' ? (
                            <ImageIcon className="h-4 w-4 text-purple-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 capitalize">{job.type}</p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(job.created_at).toLocaleString('ro-RO', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge className={`border-0 text-[10px] ${
                        job.status === 'completed' ? 'bg-green-50 text-green-600' :
                        job.status === 'failed' ? 'bg-red-50 text-red-600' :
                        'bg-yellow-50 text-yellow-600'
                      }`}>
                        {job.status === 'completed' ? 'Complet' :
                         job.status === 'failed' ? 'Eșuat' : 'În lucru'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}