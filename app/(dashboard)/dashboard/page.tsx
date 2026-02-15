'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { UpgradePrompt } from '@/components/upgrade-prompt'
import { motion } from 'framer-motion'
import {
  Package,
  ImageIcon,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Zap,
  CheckCircle,
  Clock,
  CreditCard,
  Search,
  Star,
  Target,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'

type DashboardData = {
  totalProducts: number
  optimizedProducts: number
  publishedProducts: number
  draftProducts: number
  totalImages: number
  avgSeoScore: number
  creditsUsed: number
  creditsRemaining: number
  recentProducts: {
    id: string
    original_title: string
    optimized_title: string | null
    status: string
    seo_score: number
    original_images: string[] | null
  }[]
  recentTransactions: {
    description: string
    amount: number
    created_at: string
    reference_type: string
  }[]
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const userName = session?.user?.name?.split(' ')[0] || 'Utilizator'

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      setData(result)
    } catch {
      console.error('Error loading dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bună dimineața'
    if (hour < 18) return 'Bună ziua'
    return 'Bună seara'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl animate-pulse" />
          <div className="h-80 bg-white rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  const optimizationRate = data && data.totalProducts > 0
    ? Math.round((data.optimizedProducts + data.publishedProducts) / data.totalProducts * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getGreeting()}, {userName}! 👋
            </h1>
            <p className="text-gray-500 mt-1">
              Iată un rezumat al performanței magazinului tău
            </p>
          </div>
          <Link href="/products">
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
              <Sparkles className="h-4 w-4 mr-2" />
              Optimizează produse
            </Button>
          </Link>
        </div>
      </motion.div>

 {/* Upgrade Prompt */}
       {data && (
        <UpgradePrompt
          credits={data.creditsRemaining}
          plan={(session?.user as any)?.plan || 'free'}
          variant="banner"
        />
      )}

      {/* Impact banner */}
      {data && data.optimizedProducts > 0 && (
        <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Impactul HONTRIO asupra magazinului tău</p>
                  <p className="text-blue-200 text-sm">
                    {data.optimizedProducts + data.publishedProducts} produse optimizate din {data.totalProducts} total —
                    scor SEO mediu de {data.avgSeoScore}/100
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
                  <p className="text-xl font-bold">{optimizationRate}%</p>
                  <p className="text-xs text-blue-200">Optimizat</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
                  <p className="text-xl font-bold">+{data.avgSeoScore}%</p>
                  <p className="text-xs text-blue-200">SEO Score</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total produse',
            value: data?.totalProducts || 0,
            icon: Package,
            color: 'blue',
            bg: 'bg-blue-50',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            href: '/products',
          },
          {
            label: 'Imagini generate',
            value: data?.totalImages || 0,
            icon: ImageIcon,
            color: 'purple',
            bg: 'bg-purple-50',
            iconBg: 'bg-purple-100',
            iconColor: 'text-purple-600',
            href: '/images',
          },
          {
            label: 'Scor SEO mediu',
            value: data?.avgSeoScore || 0,
            icon: Search,
            color: 'green',
            bg: 'bg-green-50',
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            suffix: '/100',
            href: '/seo',
          },
          {
            label: 'Credite rămase',
            value: data?.creditsRemaining || 0,
            icon: CreditCard,
            color: 'orange',
            bg: 'bg-orange-50',
            iconBg: 'bg-orange-100',
            iconColor: 'text-orange-600',
            href: '/credits',
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeInUp} transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}>
            <Link href={stat.href}>
              <Card className="card-hover border-0 shadow-sm hover:shadow-md rounded-2xl cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-300" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}{stat.suffix || ''}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optimization progress */}
        <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.3 }} className="lg:col-span-2">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Progres optimizare</CardTitle>
                <Link href="/products">
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs h-8">
                    Vezi toate
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {/* Progress bars */}
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-600">Produse optimizate</span>
                    <span className="font-medium text-gray-900">{(data?.optimizedProducts || 0) + (data?.publishedProducts || 0)}/{data?.totalProducts || 0}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${optimizationRate}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-600">Publicate în magazin</span>
                    <span className="font-medium text-gray-900">{data?.publishedProducts || 0}/{data?.totalProducts || 0}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${data && data.totalProducts > 0 ? Math.round(data.publishedProducts / data.totalProducts * 100) : 0}%` }}
                      transition={{ duration: 1, delay: 0.6 }}
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Recent products */}
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Ultimele produse</p>
              <div className="space-y-2">
                {data?.recentProducts && data.recentProducts.length > 0 ? (
                  data.recentProducts.slice(0, 5).map((product) => (
                    <Link key={product.id} href={`/products/${product.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                        <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {product.original_images && product.original_images[0] ? (
                            <img src={product.original_images[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.optimized_title || product.original_title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${
                              product.status === 'published' ? 'bg-green-50 text-green-700' :
                              product.status === 'optimized' ? 'bg-blue-50 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {product.status === 'published' ? 'Publicat' :
                               product.status === 'optimized' ? 'Optimizat' : 'Draft'}
                            </Badge>
                            {product.seo_score > 0 && (
                              <span className={`text-[10px] font-medium ${
                                product.seo_score >= 80 ? 'text-green-600' :
                                product.seo_score >= 50 ? 'text-yellow-600' : 'text-red-500'
                              }`}>
                                SEO {product.seo_score}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Niciun produs sincronizat</p>
                    <Link href="/settings">
                      <Button variant="link" size="sm" className="text-blue-600 mt-1">
                        Conectează magazinul
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column */}
        <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.4 }} className="space-y-6">
          {/* Quick actions */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Acțiuni rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/products">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100/80 transition-colors cursor-pointer group">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Optimizează produse</p>
                    <p className="text-xs text-blue-600">{data?.draftProducts || 0} produse în așteptare</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>

              <Link href="/seo">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 hover:bg-green-100/80 transition-colors cursor-pointer group">
                  <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">Analizează SEO</p>
                    <p className="text-xs text-green-600">Vezi scorul produselor</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-green-400 group-hover:text-green-600 transition-colors" />
                </div>
              </Link>

              <Link href="/settings">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-purple-100/80 transition-colors cursor-pointer group">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900">Conectează magazin</p>
                    <p className="text-xs text-purple-600">WooCommerce, Shopify</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-purple-400 group-hover:text-purple-600 transition-colors" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Activitate recentă</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {data.recentTransactions.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        t.reference_type === 'image_generation' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        {t.reference_type === 'image_generation' ? (
                          <ImageIcon className="h-3.5 w-3.5 text-purple-600" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{t.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('ro-RO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-red-500 shrink-0">{t.amount} cr</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nicio activitate încă</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}