'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  RefreshCw, ChevronRight, Monitor, Smartphone, Zap, Shield, BarChart3,
  Globe, Package, Sparkles, CheckSquare, Square, X, Tag,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

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

// Foloseste scorul real din DB — calculat la sync (initial) si la save (dupa optimizare)
// Nu mai exista hack-ul cu 60; scorul e intotdeauna real
const effectiveScore = (p: Product) => p.seo_score || 0

const scoreStyle = (s: number) => ({
  text: s >= 80 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : s > 0 ? 'text-red-500' : 'text-gray-300',
  bar:  s >= 80 ? 'bg-emerald-500'  : s >= 50 ? 'bg-amber-400'  : s > 0 ? 'bg-red-400'   : 'bg-gray-200',
})

function FieldDot({ has, label }: { has: boolean; label: string }) {
  return (
    <span title={`${label}: ${has ? 'completat' : 'lipsă'}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${has ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-400'}`}>
      {label[0]}
    </span>
  )
}

function ScoreRing({ score, size = 72, label }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 7
  const circ = 2 * Math.PI * r
  const color = score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={`${(score/100)*circ} ${circ}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-white" style={{ fontSize: size * 0.21 }}>{score}</span>
        </div>
      </div>
      {label && <span className="text-[10px] text-white/60 font-medium">{label}</span>}
    </div>
  )
}

function ImpactBadge({ impact }: { impact: string }) {
  if (impact === 'passed')   return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" />OK</span>
  if (impact === 'critical') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" />Critic</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />Atenție</span>
}

function CWVBadge({ score, value, label }: { score: number; value: string; label: string }) {
  const color = score >= 0.9 ? 'text-emerald-400' : score >= 0.5 ? 'text-amber-400' : 'text-red-400'
  const bg    = score >= 0.9 ? 'bg-emerald-500/10' : score >= 0.5 ? 'bg-amber-500/10' : 'bg-red-500/10'
  return (
    <div className={`${bg} rounded-xl px-4 py-3 text-center`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
    </div>
  )
}

export default function SEOPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'store'>('products')
  const [storeUrl, setStoreUrl]   = useState('')
  const [strategy, setStrategy]   = useState<'mobile' | 'desktop'>('mobile')
  const [auditing, setAuditing]   = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [auditError, setAuditError]   = useState('')
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [products, setProducts]   = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all'|'unoptimized'|'partial'|'good'>('all')
  const [searchQ, setSearchQ]     = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkDone, setBulkDone]   = useState(0)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [bulkFailed, setBulkFailed] = useState(0)
  const [bulkFinished, setBulkFinished] = useState(false)
  const [bulkMsg, setBulkMsg]     = useState('')

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
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Eroare') }
      setAuditResult(await res.json())
    } catch (e: any) { setAuditError(e.message) } finally { setAuditing(false) }
  }

  const unoptimizedIds = products.filter(p => effectiveScore(p) < 80).map(p => p.id)

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

  const filtered = products.filter(p => {
    const s = effectiveScore(p)
    if (filterStatus === 'unoptimized' && s !== 0) return false
    if (filterStatus === 'partial' && (s === 0 || s >= 80)) return false
    if (filterStatus === 'good' && s < 80) return false
    if (searchQ) {
      const hay = (p.original_title + ' ' + (p.optimized_title||'') + ' ' + (p.category||'')).toLowerCase()
      if (!hay.includes(searchQ.toLowerCase())) return false
    }
    return true
  }).sort((a, b) => effectiveScore(a) - effectiveScore(b))

  const criticalIssues = auditResult?.seo_issues.filter(i => i.impact === 'critical').length ?? 0
  const warningIssues  = auditResult?.seo_issues.filter(i => i.impact === 'warning').length ?? 0

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Optimizare SEO</h1>
            <p className="text-gray-500 text-sm mt-0.5">Audit magazin · Optimizare produse · Bulk · Competitor</p>
          </div>
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50 gap-1 py-1">
            <Shield className="h-3 w-3" />Google E-E-A-T
          </Badge>
        </div>
      </motion.div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[{ id: 'products', label: 'Produse SEO', icon: Package }, { id: 'store', label: 'Audit Magazin', icon: Globe }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
            {tab.id === 'products' && unoptimized > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unoptimized > 9 ? '9+' : unoptimized}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: products.length, color: 'text-gray-700', bg: 'bg-white', key: 'all' },
              { label: 'Optimizate', value: optimized, color: 'text-emerald-600', bg: 'bg-emerald-50', key: 'good' },
              { label: 'Parțial', value: partial, color: 'text-amber-600', bg: 'bg-amber-50', key: 'partial' },
              { label: 'Neoptimizate', value: unoptimized, color: 'text-red-500', bg: 'bg-red-50', key: 'unoptimized' },
            ].map(s => (
              <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key as any ? 'all' : s.key as any)}
                className={`rounded-2xl border-2 p-4 text-center shadow-sm transition-all ${s.bg} ${filterStatus === s.key ? 'border-blue-400 shadow-md' : 'border-transparent'}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Caută produs..."
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-blue-200 focus:bg-white transition-all" />
            </div>
            <div className="flex-1" />
            {selected.size === 0 ? (
              unoptimizedIds.length > 0 && (
                <button onClick={() => setSelected(new Set(unoptimizedIds))}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors">
                  <CheckSquare className="h-4 w-4" />Selectează neoptimizate ({unoptimizedIds.length})
                </button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">{selected.size} selectate</span>
                <button onClick={() => setSelected(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="h-4 w-4" /></button>
                <Button onClick={runBulk} disabled={bulkRunning} size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-1.5">
                  {bulkRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Procesez...</> : <><Sparkles className="h-3.5 w-3.5" />Optimizează ({selected.size * 5} cr.)</>}
                </Button>
              </div>
            )}
          </div>

          {/* Bulk progress */}
          <AnimatePresence>
            {(bulkRunning || bulkFinished) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        {bulkRunning ? '⚡ Optimizare în curs...' : `✅ ${bulkDone} produse optimizate${bulkFailed > 0 ? `, ${bulkFailed} eșuate` : ''}`}
                      </p>
                      {bulkFinished && <button onClick={() => setBulkFinished(false)}><X className="h-4 w-4 text-gray-400" /></button>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{bulkDone}/{bulkTotal}</span><span>{Math.round((bulkDone / Math.max(bulkTotal, 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-blue-500 rounded-full" initial={{ width: 0 }}
                          animate={{ width: `${(bulkDone / Math.max(bulkTotal, 1)) * 100}%` }} transition={{ duration: 0.4 }} />
                      </div>
                    </div>
                    {bulkMsg && <p className="text-xs text-red-500">{bulkMsg}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Products table */}
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Produse</h3>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                  <span className="bg-gray-100 rounded px-1.5 py-0.5">T</span><span>Titlu</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5 ml-1">M</span><span>Meta</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5 ml-1">K</span><span>Keyword</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5 ml-1">S</span><span>Scurtă</span>
                  <span className="bg-gray-100 rounded px-1.5 py-0.5 ml-1">L</span><span>Lungă</span>
                </div>
                <span className="text-xs text-gray-400">{filtered.length}</span>
              </div>
            </div>
            {loadingProducts ? (
              <div className="p-3 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center"><Package className="h-10 w-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">Niciun produs</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((p, i) => {
                  const score = effectiveScore(p)
                  const cs = scoreStyle(score)
                  const isSel = selected.has(p.id)
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.012, 0.2) }}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-all group ${isSel ? 'bg-blue-50/40' : ''}`}>
                      <button onClick={() => toggleSelect(p.id)} className={`shrink-0 transition-colors ${isSel ? 'text-blue-500' : 'text-gray-200 hover:text-gray-400'}`}>
                        {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <Link href={`/seo/${p.id}`} className="shrink-0">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden">
                          {(p.thumbnail_url || p.original_images?.[0])
                            ? <img src={p.thumbnail_url || p.original_images![0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Package className="h-3.5 w-3.5 text-gray-300" /></div>}
                        </div>
                      </Link>
                      <Link href={`/seo/${p.id}`} className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{p.optimized_title || p.original_title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.category && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Tag className="h-2.5 w-2.5" />{p.category}</span>}
                          {p.focus_keyword && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 rounded font-medium">{p.focus_keyword}</span>}
                        </div>
                      </Link>
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        <FieldDot has={!!p.optimized_title}             label="Titlu" />
                        <FieldDot has={!!p.meta_description}            label="Meta" />
                        <FieldDot has={!!p.focus_keyword}               label="Keyword" />
                        <FieldDot has={!!p.optimized_short_description} label="Scurtă" />
                        <FieldDot has={!!p.optimized_long_description}  label="Lungă" />
                      </div>
                      <div className="hidden md:flex flex-col items-end gap-1 w-16 shrink-0">
                        <span className={`text-xs font-bold ${cs.text}`}>{score > 0 ? score : '—'}</span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cs.bar}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'store' && (
        <div className="space-y-5">
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center"><Zap className="h-4 w-4 text-yellow-400" /></div>
                <div><h2 className="text-white font-semibold text-sm">Audit Google PageSpeed Insights</h2><p className="text-slate-400 text-xs">Performanță, SEO tehnic, Core Web Vitals</p></div>
              </div>
              <div className="flex gap-2 mb-3">
                <input type="url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)}
                  placeholder="https://magazinul-tau.ro" onKeyDown={e => e.key === 'Enter' && runAudit()}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 transition-all" />
                <Button onClick={runAudit} disabled={auditing || !storeUrl.trim()} className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl px-5 gap-2 shrink-0">
                  {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{auditing ? 'Analizez...' : 'Analizează'}
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                {[{ id: 'mobile', icon: Smartphone, label: 'Mobile' }, { id: 'desktop', icon: Monitor, label: 'Desktop' }].map(s => (
                  <button key={s.id} onClick={() => setStrategy(s.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${strategy === s.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}>
                    <s.icon className="h-3.5 w-3.5" />{s.label}
                  </button>
                ))}
                <span className="text-slate-500 text-xs ml-1">Google recomandă mobile-first</span>
              </div>
            </div>
            {auditing && (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-medium">Analizez cu Google PageSpeed Insights...</p>
                <p className="text-gray-400 text-xs mt-1">Poate dura 15-30 secunde</p>
              </div>
            )}
            {auditError && !auditing && (
              <div className="p-4 flex items-center gap-3 text-red-600 bg-red-50">
                <XCircle className="h-5 w-5 shrink-0" />
                <div><p className="text-sm font-medium">Eroare audit</p><p className="text-xs text-red-500 mt-0.5">{auditError}</p></div>
              </div>
            )}
          </Card>

          {auditResult && !auditing && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-semibold text-sm">Rezultate</p>
                      <a href={auditResult.url} target="_blank" rel="noopener" className="text-blue-400 text-xs hover:underline flex items-center gap-1">{auditResult.url}<ExternalLink className="h-3 w-3" /></a>
                    </div>
                    <button onClick={runAudit} className="text-slate-400 hover:text-white transition-colors"><RefreshCw className="h-4 w-4" /></button>
                  </div>
                  <div className="flex gap-5 flex-wrap">
                    <ScoreRing score={auditResult.scores.performance} label="Performanță" />
                    <ScoreRing score={auditResult.scores.seo} label="SEO" />
                    <ScoreRing score={auditResult.scores.accessibility} label="Accesibilitate" />
                    <ScoreRing score={auditResult.scores.best_practices} label="Bune practici" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-slate-400 text-xs font-medium mb-3">Core Web Vitals</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <CWVBadge score={auditResult.cwv.lcp_score} value={auditResult.cwv.lcp} label="LCP (≤2.5s)" />
                      <CWVBadge score={auditResult.cwv.cls_score} value={auditResult.cwv.cls} label="CLS (≤0.1)" />
                      <CWVBadge score={1} value={auditResult.cwv.fcp} label="FCP" />
                      <CWVBadge score={1} value={auditResult.cwv.ttfb} label="TTFB" />
                    </div>
                  </div>
                </div>
                {(criticalIssues > 0 || warningIssues > 0) && (
                  <div className="px-5 py-3 flex gap-4 bg-gray-50 border-t border-gray-100 text-sm">
                    {criticalIssues > 0 && <span className="flex items-center gap-1.5 text-red-600 font-medium"><XCircle className="h-4 w-4" />{criticalIssues} critice</span>}
                    {warningIssues > 0 && <span className="flex items-center gap-1.5 text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" />{warningIssues} avertismente</span>}
                  </div>
                )}
              </Card>
              {auditResult.seo_issues.length > 0 && (
                <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Search className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Audit SEO — {auditResult.seo_issues.length} verificări</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[...auditResult.seo_issues].sort((a, b) => ({ critical: 0, warning: 1, passed: 2 }[a.impact] - { critical: 0, warning: 1, passed: 2 }[b.impact])).map(issue => (
                      <div key={issue.id}>
                        <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                          <ImpactBadge impact={issue.impact} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                            {issue.displayValue && <p className="text-xs text-gray-500 mt-0.5">{issue.displayValue}</p>}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-gray-300 shrink-0 transition-transform ${expandedIssue === issue.id ? 'rotate-90' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {expandedIssue === issue.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <div className="px-5 pb-4 space-y-2">
                                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500 leading-relaxed">{issue.description}</p></div>
                                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                  <p className="text-xs font-semibold text-blue-700 mb-1">✦ Cum rezolvi:</p>
                                  <p className="text-xs text-blue-600 leading-relaxed">{issue.fix}</p>
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
              {auditResult.perf_issues.length > 0 && (
                <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Performanță — {auditResult.perf_issues.length} oportunități</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {auditResult.perf_issues.map(issue => (
                      <div key={issue.id}>
                        <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
                          <ImpactBadge impact={issue.impact} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                            {issue.displayValue && <p className="text-xs text-gray-500 mt-0.5">{issue.displayValue}</p>}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-gray-300 shrink-0 transition-transform ${expandedIssue === issue.id ? 'rotate-90' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {expandedIssue === issue.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <div className="px-5 pb-4">
                                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                                  <p className="text-xs font-semibold text-amber-700 mb-1">✦ Cum rezolvi:</p>
                                  <p className="text-xs text-amber-600 leading-relaxed">{issue.fix}</p>
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

          {!auditResult && !auditing && !auditError && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Zap, color: 'amber', title: 'Core Web Vitals', desc: 'LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 — praguri Google mobile-first' },
                { icon: Search, color: 'blue', title: 'Audit SEO tehnic', desc: 'Title, meta, canonical, robots.txt, structured data, alt text' },
                { icon: BarChart3, color: 'green', title: 'Fix instructions', desc: 'Fiecare problemă vine cu instrucțiuni conform Google Guidelines' },
              ].map(item => (
                <Card key={item.title} className="border-0 shadow-sm rounded-2xl">
                  <CardContent className="p-4">
                    <div className={`h-9 w-9 rounded-xl bg-${item.color}-100 flex items-center justify-center mb-3`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-600`} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}