'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Package, ImageIcon, TrendingUp, Sparkles, ArrowRight,
  ArrowUpRight, Zap, CheckCircle, Clock, CreditCard,
  Search, Bot, Store, RefreshCw, AlertTriangle,
  ChevronRight, Circle, ExternalLink,
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
  seoBreakdown: { green: number; yellow: number; red: number }
  worstProduct: { id: string; title: string | null; seo_score: number; image: string | null } | null
  creditsRemaining: number
  recentProducts: {
    id: string
    original_title: string | null
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
    type: string
  }[]
  store: {
    id: string
    store_url: string
    store_name: string | null
    sync_status: string
    last_sync_at: string | null
    products_count: number
    platform: string
  } | null
  agent: {
    is_active: boolean
    agent_name: string | null
    conversations_today: number
  } | null
  onboardingChecklist: { id: string; label: string; done: boolean; href: string }[]
  onboardingProgress: number
  onboardingComplete: boolean
  aiInsight: {
    type: string
    message: string
    action: string
    actionUrl: string
    stat: string
  } | null
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)
  useEffect(() => {
    const start = prevValue.current
    const end = value
    prevValue.current = value
    if (start === end) return
    const duration = 700
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <>{display}{suffix}</>
}

function SeoDonut({ green, yellow, red, total }: { green: number; yellow: number; red: number; total: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const segments = [
    { value: green, color: '#22c55e' },
    { value: yellow, color: '#eab308' },
    { value: red, color: '#ef4444' },
    { value: Math.max(total - green - yellow - red, 0), color: '#e5e7eb' },
  ]
  let offset = 0
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="rotate-[-90deg]">
      {total === 0 ? (
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      ) : (
        segments.map((seg, i) => {
          if (seg.value === 0) return null
          const pct = seg.value / total
          const dash = pct * circumference
          const el = (
            <circle key={i} cx="36" cy="36" r={radius} fill="none" stroke={seg.color} strokeWidth="8"
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} strokeLinecap="round" />
          )
          offset += dash
          return el
        })
      )}
    </svg>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className || ''}`} />
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any } } },
}

const syncStatusLabel: Record<string, string> = { active: 'Activ', pending: 'În așteptare', paused: 'Pauză', error: 'Eroare' }
const syncStatusColor: Record<string, string> = {
  active: 'text-emerald-600 bg-emerald-50', pending: 'text-yellow-600 bg-yellow-50',
  paused: 'text-gray-500 bg-gray-100', error: 'text-red-600 bg-red-50',
}
const planLabel: Record<string, string> = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
const planColor: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600', starter: 'bg-blue-50 text-blue-700',
  pro: 'bg-violet-50 text-violet-700', enterprise: 'bg-amber-50 text-amber-700',
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const userName = session?.user?.name?.split(' ')[0] || 'Utilizator'
  const userPlan = (session?.user as any)?.plan || 'free'

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      setData(result)
    } catch { console.error('Error loading dashboard') }
    finally { setLoading(false) }
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bună dimineața'
    if (h < 18) return 'Bună ziua'
    return 'Bună seara'
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const optimizationRate = data && data.totalProducts > 0
    ? Math.round((data.optimizedProducts + data.publishedProducts) / data.totalProducts * 100) : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80" />
          <div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-40" /></div>
        </div>
      </div>
    )
  }

  const hasNoProducts = !data || data.totalProducts === 0

  return (
    <motion.div className="space-y-6" variants={stagger.container} initial="initial" animate="animate">

      {/* Header */}
      <motion.div variants={stagger.item}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}, {userName}! 👋</h1>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${planColor[userPlan] || planColor.free}`}>
                {planLabel[userPlan] || 'Free'}
              </span>
            </div>
            <p className="text-gray-500 mt-0.5 text-sm">Iată un rezumat al performanței magazinului tău</p>
          </div>
          <Link href="/products">
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5 shadow-sm shadow-blue-200">
              <Sparkles className="h-4 w-4 mr-2" />Optimizează produse
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Onboarding Checklist */}
      {data && !data.onboardingComplete && (
        <motion.div variants={stagger.item}>
          <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-base">Configurare cont</p>
                  <p className="text-blue-200 text-sm">{data.onboardingProgress} din {data.onboardingChecklist.length} pași completați</p>
                </div>
                <div className="relative h-12 w-12">
                  <svg className="rotate-[-90deg]" viewBox="0 0 36 36" width="48" height="48">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                    <motion.circle cx="18" cy="18" r="15" fill="none" stroke="white" strokeWidth="3"
                      strokeDasharray={`${2 * Math.PI * 15}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - data.onboardingProgress / data.onboardingChecklist.length) }}
                      transition={{ duration: 0.8, delay: 0.3 }} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {Math.round(data.onboardingProgress / data.onboardingChecklist.length * 100)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {data.onboardingChecklist.map((step) => (
                  <Link key={step.id} href={step.href}>
                    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-all cursor-pointer ${step.done ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}>
                      {step.done
                        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                        : <Circle className="h-3.5 w-3.5 text-white/40 shrink-0" />}
                      <span className={`text-xs truncate ${step.done ? 'text-white' : 'text-blue-200'}`}>{step.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Insight */}
      {data?.aiInsight && (
        <motion.div variants={stagger.item}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">AI Insight</span>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{data.aiInsight.stat}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{data.aiInsight.message}</p>
              </div>
              <Link href={data.aiInsight.actionUrl} className="shrink-0">
                <button className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all">
                  {data.aiInsight.action}
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div variants={stagger.item}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total produse', value: data?.totalProducts || 0, icon: Package, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', href: '/products' },
            { label: 'Imagini generate', value: data?.totalImages || 0, icon: ImageIcon, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', href: '/images' },
            { label: 'Scor SEO mediu', value: data?.avgSeoScore || 0, suffix: '/100', icon: Search, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', href: '/seo' },
            { label: 'Credite rămase', value: data?.creditsRemaining || 0, icon: CreditCard, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', href: '/credits', showBar: true },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <Link href={stat.href}>
                <Card className="border-0 shadow-sm hover:shadow-md rounded-2xl cursor-pointer transition-shadow group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-10 w-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                        <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">
                      <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                    {stat.showBar && (
                      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${(data?.creditsRemaining || 0) <= 10 ? 'bg-red-400' : (data?.creditsRemaining || 0) <= 30 ? 'bg-orange-400' : 'bg-emerald-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(((data?.creditsRemaining || 0) / 100) * 100, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Optimization + Quick Win */}
        <motion.div variants={stagger.item} className="lg:col-span-2 space-y-5">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Progres optimizare</CardTitle>
                <Link href="/products">
                  <Button variant="ghost" size="sm" className="text-blue-600 text-xs h-8 gap-1">
                    Vezi toate <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {hasNoProducts ? (
                <div className="text-center py-10">
                  <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Package className="h-7 w-7 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm mb-3">Niciun produs sincronizat încă</p>
                  <Link href="/settings">
                    <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">Conectează magazinul</Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Draft', value: data?.draftProducts, bg: 'bg-slate-50', text: 'text-slate-700', sub: 'text-slate-400' },
                      { label: 'Optimizat', value: data?.optimizedProducts, bg: 'bg-amber-50', text: 'text-amber-700', sub: 'text-amber-400' },
                      { label: 'Publicat', value: data?.publishedProducts, bg: 'bg-emerald-50', text: 'text-emerald-700', sub: 'text-emerald-400' },
                    ].map(s => (
                      <div key={s.label} className={`text-center p-3 rounded-xl ${s.bg}`}>
                        <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                        <p className={`text-xs mt-0.5 ${s.sub}`}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 mb-5">
                    {[
                      { label: 'Produse optimizate', pct: optimizationRate, color: 'from-blue-500 to-indigo-500', delay: 0.4 },
                      { label: 'Publicate în magazin', pct: data && data.totalProducts > 0 ? Math.round(data.publishedProducts / data.totalProducts * 100) : 0, color: 'from-emerald-500 to-teal-500', delay: 0.5 },
                    ].map(b => (
                      <div key={b.label}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-500">{b.label}</span>
                          <span className="font-medium text-gray-800">{b.pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.9, delay: b.delay }}
                            className={`h-full bg-gradient-to-r ${b.color} rounded-full`} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Ultimele produse</p>
                  <div className="space-y-1">
                    {(data?.recentProducts || []).map(product => (
                      <Link key={product.id} href={`/products/${product.id}`}>
                        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
                          <div className="h-9 w-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                            {product.original_images?.[0]
                              ? <img src={product.original_images[0]} alt="" className="h-full w-full object-cover" />
                              : <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-gray-300" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.optimized_title || product.original_title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                product.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                                product.status === 'optimized' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                {product.status === 'published' ? 'Publicat' : product.status === 'optimized' ? 'Optimizat' : 'Draft'}
                              </span>
                              {product.seo_score > 0 && (
                                <span className={`text-[10px] font-medium ${product.seo_score >= 80 ? 'text-emerald-600' : product.seo_score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  SEO {product.seo_score}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Win */}
          {data?.worstProduct && (
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-400 to-red-400" />
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-500 mb-0.5">Quick Win</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{data.worstProduct.title || 'Produs fără titlu'}</p>
                    <p className="text-xs text-gray-500">Scor SEO: <span className="text-red-600 font-semibold">{data.worstProduct.seo_score}/100</span> — cel mai slab din catalog</p>
                  </div>
                  <Link href={`/products/${data.worstProduct.id}`}>
                    <Button size="sm" className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white shrink-0 h-8 px-3 text-xs">
                      Optimizează
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* RIGHT: SEO Donut + Store + Agent + Activity */}
        <motion.div variants={stagger.item} className="space-y-5">

          {/* SEO Breakdown */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Distribuție SEO</CardTitle>
                <Link href="/seo">
                  <Button variant="ghost" size="sm" className="text-blue-600 text-xs h-7 gap-1">
                    Detalii <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <SeoDonut green={data?.seoBreakdown.green || 0} yellow={data?.seoBreakdown.yellow || 0} red={data?.seoBreakdown.red || 0} total={data?.totalProducts || 0} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-800">{data?.avgSeoScore || 0}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  {[
                    { dot: 'bg-emerald-500', label: 'Bun (80+)', val: data?.seoBreakdown.green || 0 },
                    { dot: 'bg-yellow-400', label: 'Mediu (50-79)', val: data?.seoBreakdown.yellow || 0 },
                    { dot: 'bg-red-400', label: 'Slab (<50)', val: data?.seoBreakdown.red || 0 },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                        <span className="text-xs text-gray-600">{s.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-800">{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Store */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-400" />Magazin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.store ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${data.store.sync_status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{data.store.store_name || data.store.store_url}</span>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${syncStatusColor[data.store.sync_status] || syncStatusColor.pending}`}>
                      {syncStatusLabel[data.store.sync_status] || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-base font-bold text-gray-900">{data.store.products_count}</p>
                      <p className="text-[11px] text-gray-400">Produse</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-[11px] font-semibold text-gray-600 capitalize">{data.store.platform}</p>
                      <p className="text-[11px] text-gray-400">Platformă</p>
                    </div>
                  </div>
                  {data.store.last_sync_at && (
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />Ultima sync: {formatTime(data.store.last_sync_at)}
                    </p>
                  )}
                  <Link href="/settings">
                    <button className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1">
                      Gestionează <ExternalLink className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Store className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Niciun magazin conectat</p>
                  <Link href="/settings">
                    <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">Conectează acum</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-gray-400" />AI Agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.agent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${data.agent.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-gray-800">{data.agent.agent_name || 'Agent AI'}</span>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${data.agent.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {data.agent.is_active ? 'Activ' : 'Inactiv'}
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-blue-900 tabular-nums">{data.agent.conversations_today}</p>
                      <p className="text-xs text-blue-500">conversații azi</p>
                    </div>
                  </div>
                  <Link href="/agent">
                    <button className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1">
                      Deschide Agent <ExternalLink className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Bot className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 mb-3">Agent neconfigutat</p>
                  <Link href="/agent">
                    <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">Configurează</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />Activitate recentă
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                <div className="space-y-2.5">
                  {data.recentTransactions.map((t, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        t.reference_type === 'image_generation' ? 'bg-violet-100' :
                        t.type === 'purchase' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                        {t.reference_type === 'image_generation'
                          ? <ImageIcon className="h-3 w-3 text-violet-600" />
                          : t.type === 'purchase' ? <CreditCard className="h-3 w-3 text-emerald-600" />
                          : <Sparkles className="h-3 w-3 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{t.description}</p>
                        <p className="text-[11px] text-gray-400">{formatTime(t.created_at)}</p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${t.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount} cr
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5">
                  <Clock className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nicio activitate încă</p>
                </div>
              )}
            </CardContent>
          </Card>

        </motion.div>
      </div>
    </motion.div>
  )
}