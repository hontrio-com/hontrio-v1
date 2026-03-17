'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n/context'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Package, ImageIcon, TrendingUp, Sparkles, ArrowRight, ArrowUpRight, Zap, CheckCircle, Clock, CreditCard, Search, Bot, Store, RefreshCw, AlertTriangle, ChevronRight, Circle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type DashboardData = {
  totalProducts: number; optimizedProducts: number; publishedProducts: number; draftProducts: number
  totalImages: number; avgSeoScore: number
  seoBreakdown: { green: number; yellow: number; red: number }
  worstProduct: { id: string; title: string | null; seo_score: number; image: string | null } | null
  creditsRemaining: number
  recentProducts: { id: string; original_title: string | null; optimized_title: string | null; status: string; seo_score: number; original_images: string[] | null }[]
  recentTransactions: { description: string; amount: number; created_at: string; reference_type: string; type: string }[]
  store: { id: string; store_url: string; store_name: string | null; sync_status: string; last_sync_at: string | null; products_count: number; platform: string } | null
  agent: { is_active: boolean; agent_name: string | null; conversations_today: number } | null
  onboardingChecklist: { id: string; label: string; done: boolean; href: string }[]
  onboardingProgress: number; onboardingComplete: boolean
  aiInsight: { type: string; message: string; action: string; actionUrl: string; stat: string; params?: Record<string, any> } | null
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const start = prev.current; prev.current = value; if (start === value) return
    const t0 = performance.now()
    const step = (now: number) => { const p = Math.min((now - t0) / 700, 1); setDisplay(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }, [value])
  return <>{display}{suffix}</>
}

function SeoDonut({ green, yellow, red, total }: { green: number; yellow: number; red: number; total: number }) {
  const r = 28, c = 2 * Math.PI * r
  const segs = [{ v: green, col: '#22c55e' }, { v: yellow, col: '#f59e0b' }, { v: red, col: '#ef4444' }, { v: Math.max(total - green - yellow - red, 0), col: '#f5f5f5' }]
  let off = 0
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="rotate-[-90deg]">
      {total === 0 ? <circle cx="36" cy="36" r={r} fill="none" stroke="#f5f5f5" strokeWidth="8" /> :
        segs.map((s, i) => { if (!s.v) return null; const d = (s.v / total) * c; const el = <circle key={i} cx="36" cy="36" r={r} fill="none" stroke={s.col} strokeWidth="8" strokeDasharray={`${d} ${c - d}`} strokeDashoffset={-off} strokeLinecap="round" />; off += d; return el })}
    </svg>
  )
}

function Skeleton({ className }: { className?: string }) { return <div className={`animate-pulse bg-neutral-100 rounded-xl ${className || ''}`} /> }

const stagger = { container: { animate: { transition: { staggerChildren: 0.07 } } }, item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } } }

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useT()
  const userName = session?.user?.name?.split(' ')[0] || 'User'
  const userPlan = (session?.user as any)?.plan || 'free'

  useEffect(() => { fetch('/api/dashboard').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])

  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? t('dashboard.good_morning') : h < 18 ? t('dashboard.good_afternoon') : t('dashboard.good_evening') }
  const formatTime = (iso: string) => new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const optRate = data && data.totalProducts > 0 ? Math.round((data.optimizedProducts + data.publishedProducts) / data.totalProducts * 100) : 0

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="lg:col-span-2 h-80" /><div className="space-y-4"><Skeleton className="h-36" /><Skeleton className="h-40" /></div></div>
    </div>
  )

  const noProducts = !data || data.totalProducts === 0

  return (
    <motion.div className="space-y-6" variants={stagger.container} initial="initial" animate="animate">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div variants={stagger.item}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{getGreeting()}, {userName}</h1>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 uppercase tracking-wide">{userPlan}</span>
            </div>
            <p className="text-neutral-400 mt-0.5 text-[14px]">{t('dashboard.welcome')}</p>
          </div>
          <Link href="/products">
            <motion.button whileTap={{ scale: 0.985 }} className="h-10 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
              <Sparkles className="h-4 w-4" />{t('dashboard.optimize_products')}
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* ── Onboarding checklist ────────────────────────────────────────────── */}
      {data && !data.onboardingComplete && (
        <motion.div variants={stagger.item}>
          <div className="bg-neutral-900 text-white rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-[15px]">{t('onboarding.title')}</p>
                <p className="text-neutral-400 text-[13px]">{data.onboardingProgress} / {data.onboardingChecklist.length}</p>
              </div>
              <div className="relative h-12 w-12">
                <svg className="rotate-[-90deg]" viewBox="0 0 36 36" width="48" height="48">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 15}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 15 }} animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - data.onboardingProgress / data.onboardingChecklist.length) }}
                    transition={{ duration: 0.8, delay: 0.3 }} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Math.round(data.onboardingProgress / data.onboardingChecklist.length * 100)}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {data.onboardingChecklist.map(s => (
                <Link key={s.id} href={s.href}>
                  <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all cursor-pointer ${s.done ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}>
                    {s.done ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-white/30 shrink-0" />}
                    <span className={`text-[12px] truncate ${s.done ? 'text-white/80' : 'text-white/40'}`}>{s.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── AI Insight ─────────────────────────────────────────────────────── */}
      {data?.aiInsight && (
        <motion.div variants={stagger.item}>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-white" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{t('dashboard.ai_insight')}</span>
                  <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{t('dashboard.' + data.aiInsight.stat, data.aiInsight.params)}</span>
                </div>
                <p className="text-[13px] text-neutral-600 leading-relaxed">{t('dashboard.' + data.aiInsight.message, data.aiInsight.params)}</p>
              </div>
              <Link href={data.aiInsight.actionUrl} className="shrink-0">
                <button className="group flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium px-4 py-2 rounded-xl transition-all">
                  {t('dashboard.' + data.aiInsight.action, data.aiInsight.params)}<ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <motion.div variants={stagger.item}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('dashboard.total_products'), value: data?.totalProducts || 0, icon: Package, href: '/products' },
            { label: t('dashboard.ai_images'), value: data?.totalImages || 0, icon: ImageIcon, href: '/images' },
            { label: t('dashboard.seo_score'), value: data?.avgSeoScore || 0, suffix: '/100', icon: Search, href: '/seo' },
            { label: t('dashboard.credits_remaining'), value: data?.creditsRemaining || 0, icon: CreditCard, href: '/credits', bar: true },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
              <Link href={stat.href}>
                <div className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl p-5 cursor-pointer transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-neutral-100 flex items-center justify-center"><stat.icon className="h-[18px] w-[18px] text-neutral-500" /></div>
                    <ArrowUpRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                  </div>
                  <p className="text-[22px] font-bold text-neutral-900 tabular-nums"><AnimatedNumber value={stat.value} suffix={stat.suffix} /></p>
                  <p className="text-[13px] text-neutral-400 mt-0.5">{stat.label}</p>
                  {(stat as any).bar && (
                    <div className="mt-2 h-1 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${(data?.creditsRemaining || 0) <= 5 ? 'bg-red-400' : (data?.creditsRemaining || 0) <= 20 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(((data?.creditsRemaining || 0) / 100) * 100, 100)}%` }} transition={{ duration: 0.8, delay: 0.4 }} />
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT */}
        <motion.div variants={stagger.item} className="lg:col-span-2 space-y-5">
          {/* Optimization progress */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-semibold text-neutral-900">{t('dashboard.seo_score')}</p>
              <Link href="/products" className="text-[12px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition-colors">{t('common.view')} {t('common.all')}<ArrowRight className="h-3 w-3" /></Link>
            </div>
            {noProducts ? (
              <div className="text-center py-10">
                <div className="h-14 w-14 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-3"><Package className="h-7 w-7 text-neutral-300" /></div>
                <p className="text-neutral-400 text-[14px] mb-3">{t('products.no_products')}</p>
                <Link href="/settings"><button className="h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium transition-all">{t('onboarding.connect_store')}</button></Link>
              </div>
            ) : (<>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[{ label: t('dashboard.draft'), value: data?.draftProducts }, { label: t('dashboard.optimized'), value: data?.optimizedProducts }, { label: t('dashboard.published'), value: data?.publishedProducts }].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-lg bg-neutral-50">
                    <p className="text-[20px] font-bold text-neutral-900">{s.value}</p>
                    <p className="text-[12px] text-neutral-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 mb-5">
                {[{ label: t('dashboard.optimized_products'), pct: optRate, delay: 0.4 }, { label: t('dashboard.published_in_store'), pct: data && data.totalProducts > 0 ? Math.round(data.publishedProducts / data.totalProducts * 100) : 0, delay: 0.5 }].map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between text-[13px] mb-1.5"><span className="text-neutral-500">{b.label}</span><span className="font-medium text-neutral-800">{b.pct}%</span></div>
                    <div className="h-[6px] bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.9, delay: b.delay }} className="h-full bg-neutral-900 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-2">{t('dashboard.recent_activity')}</p>
              <div className="space-y-1">
                {(data?.recentProducts || []).map(p => (
                  <Link key={p.id} href={`/seo/${p.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-neutral-50 transition-colors group cursor-pointer">
                      <div className="h-9 w-9 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
                        {p.original_images?.[0] ? <img src={p.original_images[0]} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-neutral-300" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-neutral-900 truncate">{p.optimized_title || p.original_title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${p.status === 'published' ? 'bg-emerald-50 text-emerald-700' : p.status === 'optimized' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {p.status === 'published' ? t('dashboard.published') : p.status === 'optimized' ? t('dashboard.optimized') : t('dashboard.draft')}
                          </span>
                          {p.seo_score > 0 && <span className={`text-[10px] font-medium ${p.seo_score >= 80 ? 'text-emerald-600' : p.seo_score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>SEO {p.seo_score}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </>)}
          </div>

          {/* Quick Win */}
          {data?.worstProduct && (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="h-[3px] bg-neutral-900" />
              <div className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">{t('dashboard.quick_win')}</p>
                  <p className="text-[13px] font-medium text-neutral-900 truncate">{data.worstProduct.title || t('dashboard.no_product_title')}</p>
                  <p className="text-[12px] text-neutral-400">{t('dashboard.seo_score_label')}: <span className="font-semibold text-neutral-900">{data.worstProduct.seo_score}/100</span></p>
                </div>
                <Link href={`/seo/${data.worstProduct.id}`}><button className="h-8 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium transition-all shrink-0">{t('seo.optimize_all')}</button></Link>
              </div>
            </div>
          )}
        </motion.div>

        {/* RIGHT */}
        <motion.div variants={stagger.item} className="space-y-5">
          {/* SEO Donut */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-semibold text-neutral-900">{t('dashboard.seo_score')}</p>
              <Link href="/seo" className="text-[12px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition-colors">{t('common.view')}<ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <SeoDonut green={data?.seoBreakdown.green || 0} yellow={data?.seoBreakdown.yellow || 0} red={data?.seoBreakdown.red || 0} total={data?.totalProducts || 0} />
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-[14px] font-bold text-neutral-900">{data?.avgSeoScore || 0}</span></div>
              </div>
              <div className="flex-1 space-y-2.5">
                {[{ dot: 'bg-emerald-500', label: t('dashboard.good_80'), val: data?.seoBreakdown.green || 0 }, { dot: 'bg-amber-400', label: t('dashboard.medium_50'), val: data?.seoBreakdown.yellow || 0 }, { dot: 'bg-red-400', label: t('dashboard.weak_50'), val: data?.seoBreakdown.red || 0 }].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><div className={`h-2 w-2 rounded-full ${s.dot}`} /><span className="text-[12px] text-neutral-500">{s.label}</span></div>
                    <span className="text-[12px] font-semibold text-neutral-900">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Store */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2 mb-3"><Store className="h-4 w-4 text-neutral-400" />{t('sidebar.settings')}</p>
            {data?.store ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${data.store.sync_status === 'active' ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    <span className="text-[13px] font-medium text-neutral-800 truncate max-w-[140px]">{data.store.store_name || data.store.store_url}</span>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${data.store.sync_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>{data.store.sync_status === 'active' ? t('common.active_label') : data.store.sync_status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-neutral-50 rounded-lg p-2.5 text-center"><p className="text-[15px] font-bold text-neutral-900">{data.store.products_count}</p><p className="text-[11px] text-neutral-400">{t('dashboard.products_label')}</p></div>
                  <div className="bg-neutral-50 rounded-lg p-2.5 text-center"><p className="text-[12px] font-semibold text-neutral-600 capitalize">{data.store.platform}</p><p className="text-[11px] text-neutral-400">{t('dashboard.platform')}</p></div>
                </div>
                {data.store.last_sync_at && <p className="text-[11px] text-neutral-400 flex items-center gap-1"><RefreshCw className="h-3 w-3" />{t('dashboard.last_sync_label')}: {formatTime(data.store.last_sync_at)}</p>}
                <Link href="/settings"><button className="w-full text-[12px] text-neutral-500 hover:text-neutral-900 flex items-center justify-center gap-1 py-1 transition-colors">{t('common.settings')}<ExternalLink className="h-3 w-3" /></button></Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-2"><Store className="h-5 w-5 text-neutral-300" /></div>
                <p className="text-[13px] text-neutral-400 mb-3">{t('products.no_products_desc')}</p>
                <Link href="/settings"><button className="h-8 px-4 rounded-lg border border-neutral-200 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 transition-all">{t('onboarding.connect_store')}</button></Link>
              </div>
            )}
          </div>

          {/* Agent */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2 mb-3"><Bot className="h-4 w-4 text-neutral-400" />{t('sidebar.ai_agent')}</p>
            {data?.agent ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${data.agent.is_active ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    <span className="text-[13px] font-medium text-neutral-800">{data.agent.agent_name || 'Agent AI'}</span>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${data.agent.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{data.agent.is_active ? t('common.active_label') : t('common.inactive_label')}</span>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0"><Zap className="h-4 w-4 text-neutral-600" /></div>
                  <div><p className="text-[20px] font-bold text-neutral-900 tabular-nums">{data.agent.conversations_today}</p><p className="text-[12px] text-neutral-400">{t('dashboard.conversations_today')}</p></div>
                </div>
                <Link href="/agent"><button className="w-full text-[12px] text-neutral-500 hover:text-neutral-900 flex items-center justify-center gap-1 py-1 transition-colors">{t('dashboard.view_agent')}<ExternalLink className="h-3 w-3" /></button></Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-2"><Bot className="h-5 w-5 text-neutral-300" /></div>
                <p className="text-[13px] text-neutral-400 mb-3">{t('agent.inactive')}</p>
                <Link href="/agent"><button className="h-8 px-4 rounded-lg border border-neutral-200 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 transition-all">{t('sidebar.config')}</button></Link>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <p className="text-[15px] font-semibold text-neutral-900 flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-neutral-400" />{t('dashboard.recent_activity')}</p>
            {data?.recentTransactions?.length ? (
              <div className="space-y-2.5">
                {data.recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                      {tx.reference_type === 'image_generation' ? <ImageIcon className="h-3 w-3 text-neutral-500" /> : tx.type === 'purchase' ? <CreditCard className="h-3 w-3 text-neutral-500" /> : <Sparkles className="h-3 w-3 text-neutral-500" />}
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-[12px] text-neutral-700 truncate">{tx.description}</p><p className="text-[11px] text-neutral-400">{formatTime(tx.created_at)}</p></div>
                    <span className={`text-[12px] font-medium shrink-0 ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount} cr</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5"><Clock className="h-7 w-7 text-neutral-200 mx-auto mb-2" /><p className="text-[13px] text-neutral-400">{t('dashboard.no_activity')}</p></div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}