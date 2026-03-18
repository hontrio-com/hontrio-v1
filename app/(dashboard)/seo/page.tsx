'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  RefreshCw, ChevronRight, Monitor, Smartphone, Zap, Shield, BarChart3,
  Globe, Package, Sparkles, CheckSquare, Square, X, Tag,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditScore = { performance: number; seo: number; accessibility: number; best_practices: number }
type CWV = { lcp: string; lcp_score: number; fid: string; cls: string; cls_score: number; fcp: string; ttfb: string }
type Issue = { id: string; title: string; description: string; score: number | null; displayValue: string; impact: 'critical' | 'warning' | 'passed'; fix: string }
type AuditResult = { url: string; strategy: string; scores: AuditScore; cwv: CWV; seo_issues: Issue[]; perf_issues: Issue[] }
type Product = {
  id: string; original_title: string; optimized_title: string | null
  meta_description: string | null; seo_score: number; status: string
  category: string | null; focus_keyword: string | null
  original_images: string[] | null; thumbnail_url: string | null
  optimized_short_description: string | null; optimized_long_description: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const effectiveScore = (p: Product) => p.seo_score || 0

const scoreStyle = (s: number) => ({
  text: s >= 80 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : s > 0 ? 'text-red-500' : 'text-neutral-300',
  bar:  s >= 80 ? 'bg-emerald-500'   : s >= 50 ? 'bg-amber-400'   : s > 0 ? 'bg-red-400'   : 'bg-neutral-200',
})

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const variants = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

function FieldDot({ has, label }: { has: boolean; label: string }) {
  const { t } = useT()
  return (
    <span title={`${label}: ${has ? t('seo.field_completed_tooltip') : t('seo.field_missing_tooltip')}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold
        ${has ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
      {label[0]}
    </span>
  )
}

function ImpactBadge({ impact }: { impact: string }) {
  const { t } = useT()
  if (impact === 'passed')   return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"><CheckCircle className="h-3 w-3" />OK</span>
  if (impact === 'critical') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><XCircle className="h-3 w-3" />Critic</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100"><AlertTriangle className="h-3 w-3" />{t('seo.attention')}</span>
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const size = 72
  const r    = size / 2 - 7
  const circ = 2 * Math.PI * r
  const color = score >= 90 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={`${(score/100)*circ} ${circ}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-black text-white text-[15px] tabular-nums">{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/50 font-medium">{label}</span>
    </div>
  )
}

function CWVBadge({ score, value, label }: { score: number; value: string; label: string }) {
  const color = score >= 0.9 ? 'text-emerald-400' : score >= 0.5 ? 'text-amber-400' : 'text-red-400'
  const bg    = score >= 0.9 ? 'bg-emerald-500/10' : score >= 0.5 ? 'bg-amber-500/10' : 'bg-red-500/10'
  return (
    <div className={`${bg} rounded-xl px-4 py-3 text-center`}>
      <p className={`text-[15px] font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SEOPage() {
  const { t } = useT()
  const [activeTab, setActiveTab]         = useState<'products' | 'store'>('products')
  const [storeUrl, setStoreUrl]           = useState('')
  const [strategy, setStrategy]           = useState<'mobile' | 'desktop'>('mobile')
  const [auditing, setAuditing]           = useState(false)
  const [auditResult, setAuditResult]     = useState<AuditResult | null>(null)
  const [auditError, setAuditError]       = useState('')
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [products, setProducts]           = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [filterStatus, setFilterStatus]   = useState<'all' | 'unoptimized' | 'partial' | 'good'>('all')
  const [searchQ, setSearchQ]             = useState('')
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning]     = useState(false)
  const [bulkDone, setBulkDone]           = useState(0)
  const [bulkTotal, setBulkTotal]         = useState(0)
  const [bulkFailed, setBulkFailed]       = useState(0)
  const [bulkFinished, setBulkFinished]   = useState(false)
  const [bulkMsg, setBulkMsg]             = useState('')

  useEffect(() => {
    fetchProducts()
    fetch('/api/stores').then(r => r.json()).then(d => {
      if (d.store?.store_url) setStoreUrl(d.store.store_url)
    }).catch(() => {})
  }, [])

  async function fetchProducts() {
    setLoadingProducts(true)
    try {
      const res = await fetch('/api/products?per_page=200')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {} finally { setLoadingProducts(false) }
  }

  async function runAudit() {
    if (!storeUrl.trim()) return
    setAuditing(true); setAuditError(''); setAuditResult(null)
    try {
      const res = await fetch('/api/seo/audit-store', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: storeUrl.trim(), strategy }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || t('common.error_generic')) }
      setAuditResult(await res.json())
    } catch (e: any) { setAuditError(e.message) } finally { setAuditing(false) }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function runBulk() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBulkRunning(true); setBulkFinished(false)
    setBulkTotal(ids.length); setBulkDone(0); setBulkFailed(0); setBulkMsg('')
    const BATCH = 5
    let done = 0, failed = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      try {
        const res = await fetch('/api/seo/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: batch }),
        })
        const data = await res.json()
        if (res.ok) { done += data.succeeded || 0; failed += data.failed || 0 }
        else { failed += batch.length; if (data.error?.includes('insuficiente')) { setBulkMsg(data.error); break } }
      } catch { failed += batch.length }
      setBulkDone(done); setBulkFailed(failed)
    }
    setBulkRunning(false); setBulkFinished(true)
    setSelected(new Set())
    await fetchProducts()
  }

  const optimized   = products.filter(p => effectiveScore(p) >= 80).length
  const partial     = products.filter(p => { const s = effectiveScore(p); return s > 0 && s < 80 }).length
  const unoptimized = products.filter(p => effectiveScore(p) === 0).length
  const unoptimizedIds = products.filter(p => effectiveScore(p) < 80).map(p => p.id)

  const filtered = products.filter(p => {
    const s = effectiveScore(p)
    if (filterStatus === 'unoptimized' && s !== 0) return false
    if (filterStatus === 'partial' && (s === 0 || s >= 80)) return false
    if (filterStatus === 'good' && s < 80) return false
    if (searchQ) {
      const hay = (p.original_title + ' ' + (p.optimized_title || '') + ' ' + (p.category || '')).toLowerCase()
      if (!hay.includes(searchQ.toLowerCase())) return false
    }
    return true
  }).sort((a, b) => effectiveScore(a) - effectiveScore(b))

  const criticalIssues = auditResult?.seo_issues.filter(i => i.impact === 'critical').length ?? 0
  const warningIssues  = auditResult?.seo_issues.filter(i => i.impact === 'warning').length ?? 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('seo.title')}</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">{t('seo.subtitle')}</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
          <Shield className="h-3 w-3" />Google E-E-A-T
        </span>
      </div>

      {/* Tab Nav */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'products', label: t('seo.seo_products'),   icon: Package },
          { id: 'store',    label: t('seo.store_audit'), icon: Globe   },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap shrink-0
                ${activeTab === tab.id ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />{tab.label}
              {tab.id === 'products' && unoptimized > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unoptimized > 9 ? '9+' : unoptimized}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══ PRODUSE ═══ */}
      {activeTab === 'products' && (
        <div className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'all',          label: 'Total',        value: products.length, color: 'text-neutral-700' },
              { key: 'good',         label: 'seo.optimized_filter',   value: optimized,       color: 'text-emerald-600' },
              { key: 'partial',      label: 'seo.partial_filter',      value: partial,         color: 'text-amber-600'   },
              { key: 'unoptimized',  label: 'seo.unoptimized_filter', value: unoptimized,     color: 'text-red-500'     },
            ].map(s => (
              <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key as any ? 'all' : s.key as any)}
                className={`p-4 rounded-xl border-2 text-center transition-all bg-white
                  ${filterStatus === s.key ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <p className={`text-[26px] font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t('seo.search_product')}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-white border border-neutral-200 text-[13px] focus:outline-none focus:border-neutral-400 transition-all" />
            </div>
            <div className="flex-1" />
            {selected.size === 0 ? (
              unoptimizedIds.length > 0 && (
                <Btn variant="ghost" onClick={() => setSelected(new Set(unoptimizedIds))}>
                  <CheckSquare className="h-3.5 w-3.5" />Selectează neoptimizate ({unoptimizedIds.length})
                </Btn>
              )
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-xl">{selected.size} selectate</span>
                <button onClick={() => setSelected(new Set())} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"><X className="h-4 w-4" /></button>
                <Btn onClick={runBulk} disabled={bulkRunning}>
                  {bulkRunning
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Procesez...</>
                    : <><Sparkles className="h-3.5 w-3.5" />Optimizează ({selected.size * 5} cr.)</>}
                </Btn>
              </div>
            )}
          </div>

          {/* Bulk Progress */}
          <AnimatePresence>
            {(bulkRunning || bulkFinished) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-neutral-900">
                      {bulkRunning
                        ? t('seo.bulk_in_progress_msg')
                        : `${t('seo.bulk_done_format', { done: String(bulkDone) })}${bulkFailed > 0 ? t('seo.bulk_failed_format', { failed: String(bulkFailed) }) : ''}`}
                    </p>
                    {bulkFinished && <button onClick={() => setBulkFinished(false)}><X className="h-4 w-4 text-neutral-400" /></button>}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-neutral-400">
                      <span>{bulkDone}/{bulkTotal}</span>
                      <span tabular-nums>{Math.round((bulkDone / Math.max(bulkTotal, 1)) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-neutral-900 rounded-full" initial={{ width: 0 }}
                        animate={{ width: `${(bulkDone / Math.max(bulkTotal, 1)) * 100}%` }} transition={{ duration: 0.4 }} />
                    </div>
                  </div>
                  {bulkMsg && <p className="text-[11px] text-red-500 mt-2">{bulkMsg}</p>}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Products Table */}
          <Card className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-neutral-900">{t('seo.products_label')}</p>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1 text-[9px] font-semibold text-neutral-400">
                  {[t('seo.header_t_title'), t('seo.header_m_meta'), t('seo.header_k_keyword'), t('seo.header_s_short'), t('seo.header_l_long')].map(s => {
                    const [letter, ...rest] = s.split('·')
                    return (
                      <span key={s} className="flex items-center gap-0.5">
                        <span className="bg-neutral-200 rounded px-1 py-0.5">{letter}</span>
                        <span className="text-neutral-300">{rest.join('·')}</span>
                      </span>
                    )
                  })}
                </div>
                <span className="text-[11px] text-neutral-400 tabular-nums">{filtered.length}</span>
              </div>
            </div>

            {loadingProducts ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-13 bg-neutral-50 rounded-xl animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center">
                <Package className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
                <p className="text-[13px] text-neutral-400">{t('seo.no_products_label')}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {filtered.map((p, i) => {
                  const score = effectiveScore(p)
                  const cs    = scoreStyle(score)
                  const isSel = selected.has(p.id)
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.012, 0.2) }}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-all group ${isSel ? 'bg-neutral-50' : ''}`}>
                      <button onClick={() => toggleSelect(p.id)}
                        className={`shrink-0 transition-colors ${isSel ? 'text-neutral-900' : 'text-neutral-200 hover:text-neutral-400'}`}>
                        {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <Link href={`/seo/${p.id}`} className="shrink-0">
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 overflow-hidden">
                          {(p.thumbnail_url || p.original_images?.[0])
                            ? <img src={p.thumbnail_url || p.original_images![0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Package className="h-3.5 w-3.5 text-neutral-300" /></div>}
                        </div>
                      </Link>
                      <Link href={`/seo/${p.id}`} className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-neutral-900 truncate group-hover:text-neutral-600 transition-colors">
                          {p.optimized_title || p.original_title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.category && (
                            <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                              <Tag className="h-2.5 w-2.5" />{p.category}
                            </span>
                          )}
                          {p.focus_keyword && (
                            <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 rounded font-medium">{p.focus_keyword}</span>
                          )}
                        </div>
                      </Link>
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        <FieldDot has={!!p.optimized_title}             label={t('seo.field_dot_title')}   />
                        <FieldDot has={!!p.meta_description}            label={t('seo.field_dot_meta')}    />
                        <FieldDot has={!!p.focus_keyword}               label={t('seo.field_dot_keyword')} />
                        <FieldDot has={!!p.optimized_short_description} label={t('seo.field_dot_short')}  />
                        <FieldDot has={!!p.optimized_long_description}  label={t('seo.field_dot_long')}   />
                      </div>
                      <div className="hidden md:flex flex-col items-end gap-1 w-14 shrink-0">
                        <span className={`text-[12px] font-bold tabular-nums ${cs.text}`}>{score > 0 ? score : '—'}</span>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cs.bar}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ AUDIT MAGAZIN ═══ */}
      {activeTab === 'store' && (
        <div className="space-y-4">

          {/* Audit form — dark card */}
          <div className="bg-neutral-900 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{t('seo.audit_pagespeed')}</p>
                <p className="text-[11px] text-neutral-500">{t('seo.audit_desc')}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <input type="url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)}
                placeholder="https://magazinul-tau.ro" onKeyDown={e => e.key === 'Enter' && runAudit()}
                className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-neutral-500 text-[13px] focus:outline-none focus:border-white/40 transition-all" />
              <button onClick={runAudit} disabled={auditing || !storeUrl.trim()}
                className="flex items-center justify-center gap-2 bg-white text-neutral-900 rounded-xl px-4 py-2.5 text-[13px] font-semibold hover:bg-neutral-100 disabled:opacity-40 transition-all shrink-0">
                {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {auditing ? t('seo.audit_analyzing') : t('seo.audit_analyze_btn')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {[{ id: 'mobile', icon: Smartphone, label: 'Mobile' }, { id: 'desktop', icon: Monitor, label: 'Desktop' }].map(s => {
                const Icon = s.icon
                return (
                  <button key={s.id} onClick={() => setStrategy(s.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all
                      ${strategy === s.id ? 'bg-white text-neutral-900' : 'bg-white/10 text-neutral-400 hover:bg-white/20'}`}>
                    <Icon className="h-3.5 w-3.5" />{s.label}
                  </button>
                )
              })}
              <span className="text-neutral-600 text-[11px] ml-1">{t('seo.mobile_first')}</span>
            </div>

            {auditing && (
              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/40 mx-auto mb-2" />
                <p className="text-[12px] text-neutral-400">Analizez cu Google PageSpeed Insights...</p>
                <p className="text-[11px] text-neutral-600 mt-0.5">{t('seo.audit_wait')}</p>
              </div>
            )}
            {auditError && !auditing && (
              <div className="mt-3 flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-red-300">{t('seo.audit_error')}</p>
                  <p className="text-[11px] text-red-400 mt-0.5">{auditError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Audit Results */}
          {auditResult && !auditing && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Scores */}
              <div className="bg-neutral-900 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[13px] font-semibold text-white">Rezultate</p>
                    <a href={auditResult.url} target="_blank" rel="noopener"
                      className="text-neutral-400 text-[11px] hover:text-white flex items-center gap-1 transition-colors mt-0.5">
                      {auditResult.url}<ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <button onClick={runAudit} className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-5 flex-wrap">
                  <ScoreRing score={auditResult.scores.performance}    label={t('seo.audit_performance')} />
                  <ScoreRing score={auditResult.scores.seo}            label="SEO" />
                  <ScoreRing score={auditResult.scores.accessibility}  label={t('seo.audit_accessibility')} />
                  <ScoreRing score={auditResult.scores.best_practices} label={t('seo.audit_best_practices')} />
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-3">Core Web Vitals</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <CWVBadge score={auditResult.cwv.lcp_score} value={auditResult.cwv.lcp} label="LCP (≤2.5s)" />
                    <CWVBadge score={auditResult.cwv.cls_score} value={auditResult.cwv.cls} label="CLS (≤0.1)"  />
                    <CWVBadge score={1} value={auditResult.cwv.fcp}  label="FCP"  />
                    <CWVBadge score={1} value={auditResult.cwv.ttfb} label="TTFB" />
                  </div>
                </div>
              </div>

              {/* Issue summary */}
              {(criticalIssues > 0 || warningIssues > 0) && (
                <div className="flex items-center gap-3">
                  {criticalIssues > 0 && (
                    <span className="flex items-center gap-1.5 text-[12px] text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full font-medium">
                      <XCircle className="h-3.5 w-3.5" />{criticalIssues} critice
                    </span>
                  )}
                  {warningIssues > 0 && (
                    <span className="flex items-center gap-1.5 text-[12px] text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />{warningIssues} avertismente
                    </span>
                  )}
                </div>
              )}

              {/* SEO Issues */}
              {auditResult.seo_issues.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-neutral-400" />
                    <p className="text-[13px] font-semibold text-neutral-900">Audit SEO — {auditResult.seo_issues.length} verificări</p>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {[...auditResult.seo_issues]
                      .sort((a, b) => ({ critical: 0, warning: 1, passed: 2 }[a.impact] - { critical: 0, warning: 1, passed: 2 }[b.impact]))
                      .map(issue => (
                        <div key={issue.id}>
                          <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors text-left">
                            <ImpactBadge impact={issue.impact} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-neutral-900">{issue.title}</p>
                              {issue.displayValue && <p className="text-[11px] text-neutral-400 mt-0.5">{issue.displayValue}</p>}
                            </div>
                            <ChevronRight className={`h-4 w-4 text-neutral-300 shrink-0 transition-transform ${expandedIssue === issue.id ? 'rotate-90' : ''}`} />
                          </button>
                          <AnimatePresence>
                            {expandedIssue === issue.id && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="px-4 pb-4 space-y-2">
                                  <div className="bg-neutral-50 rounded-xl p-3">
                                    <p className="text-[12px] text-neutral-500 leading-relaxed">{issue.description}</p>
                                  </div>
                                  <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                                    <p className="text-[11px] font-semibold text-neutral-700 mb-1">{t('seo.how_to_fix')}</p>
                                    <p className="text-[12px] text-neutral-600 leading-relaxed">{issue.fix}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                  </div>
                </Card>
              )}

              {/* Perf Issues */}
              {auditResult.perf_issues.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-[13px] font-semibold text-neutral-900">Performanță — {auditResult.perf_issues.length} oportunități</p>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {auditResult.perf_issues.map(issue => (
                      <div key={issue.id}>
                        <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors text-left">
                          <ImpactBadge impact={issue.impact} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-neutral-900">{issue.title}</p>
                            {issue.displayValue && <p className="text-[11px] text-neutral-400 mt-0.5">{issue.displayValue}</p>}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-neutral-300 shrink-0 transition-transform ${expandedIssue === issue.id ? 'rotate-90' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {expandedIssue === issue.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <div className="px-4 pb-4">
                                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                  <p className="text-[11px] font-semibold text-amber-700 mb-1">✦ Cum rezolvi:</p>
                                  <p className="text-[12px] text-amber-600 leading-relaxed">{issue.fix}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* Empty state */}
          {!auditResult && !auditing && !auditError && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Zap,      label: t('seo.audit_cwv'), desc: t('seo.cwv_desc') },
                { icon: Search,   label: t('seo.audit_seo_technical'), desc: t('seo.audit_seo_technical_desc') },
                { icon: BarChart3, label: t('seo.audit_fix_instructions'), desc: t('seo.technical_audit_desc') },
              ].map(item => {
                const Icon = item.icon
                return (
                  <Card key={item.label} className="p-4">
                    <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
                      <Icon className="h-4 w-4 text-neutral-400" />
                    </div>
                    <p className="text-[13px] font-semibold text-neutral-900">{item.label}</p>
                    <p className="text-[12px] text-neutral-400 mt-1 leading-relaxed">{item.desc}</p>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}