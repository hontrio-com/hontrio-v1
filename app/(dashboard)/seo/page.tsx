'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Loader2, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, RefreshCw, ChevronRight, Monitor, Smartphone,
  Zap, Shield, BarChart3, Globe, Package,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type AuditScore = { performance: number; seo: number; accessibility: number; best_practices: number }
type CWV = { lcp: string; lcp_score: number; fid: string; cls: string; cls_score: number; fcp: string; ttfb: string; speed_index: string }
type Issue = {
  id: string; title: string; description: string; score: number | null
  displayValue: string; impact: 'critical' | 'warning' | 'passed'; fix: string
}
type AuditResult = {
  url: string; strategy: string; scores: AuditScore; cwv: CWV
  seo_issues: Issue[]; perf_issues: Issue[]; fetch_time: string
}
type Product = {
  id: string; original_title: string; optimized_title: string | null
  meta_description: string | null; seo_score: number; status: string
  category: string | null; focus_keyword: string | null
  original_images: string[] | null; thumbnail_url: string | null
}

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

function ScoreRing({ score, size = 80, label }: { score: number; size?: number; label?: string }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-white" style={{ fontSize: size * 0.2 }}>{score}</span>
        </div>
      </div>
      {label && <span className="text-[11px] text-white/60 font-medium">{label}</span>}
    </div>
  )
}

function ImpactBadge({ impact }: { impact: string }) {
  if (impact === 'passed') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" />Trecut</span>
  if (impact === 'critical') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" />Critic</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" />Atenție</span>
}

function CWVBadge({ score, value, label }: { score: number; value: string; label: string }) {
  const color = score >= 0.9 ? 'text-green-400' : score >= 0.5 ? 'text-amber-400' : 'text-red-400'
  const bg = score >= 0.9 ? 'bg-green-500/10' : score >= 0.5 ? 'bg-amber-500/10' : 'bg-red-500/10'
  return (
    <div className={`${bg} rounded-xl px-4 py-3 text-center`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
    </div>
  )
}

export default function SEOPage() {
  const [storeUrl, setStoreUrl] = useState('')
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [auditing, setAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [auditError, setAuditError] = useState('')
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [activeTab, setActiveTab] = useState<'store' | 'products'>('store')

  useEffect(() => {
    fetchProducts()
    fetch('/api/stores').then(r => r.json()).then(d => {
      if (d.store?.store_url) setStoreUrl(d.store.store_url)
    }).catch(() => {})
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?per_page=100')
      const data = await res.json()
      setProducts(data.products || [])
    } catch {} finally { setLoadingProducts(false) }
  }

  const runAudit = async () => {
    if (!storeUrl.trim()) return
    setAuditing(true); setAuditError(''); setAuditResult(null)
    try {
      // Direct call from browser — fiecare user consuma din propria quota anonima
      const url = storeUrl.trim()
      const cats = 'category=performance&category=seo&category=accessibility&category=best-practices'
      // Trimitem key-ul prin backend ca sa nu fie expus client-side
      const auditRes = await fetch('/api/seo/audit-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, strategy }),
      })
      if (!auditRes.ok) {
        const errData = await auditRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Eroare audit')
      }
      const directResult = await auditRes.json()
      setAuditResult(directResult)
      return
    } catch (e: any) { setAuditError(e.message) } finally { setAuditing(false) }
  }

  // Scor efectiv: daca are continut optimizat dar seo_score=0, tratam ca 60
  const effectiveScore = (p: Product) =>
    p.seo_score > 0 ? p.seo_score : (p.optimized_title || p.meta_description || p.focus_keyword) ? 60 : 0
  const optimized = products.filter(p => effectiveScore(p) >= 80).length
  const partial = products.filter(p => effectiveScore(p) > 0 && effectiveScore(p) < 80).length
  const unoptimized = products.filter(p => effectiveScore(p) === 0).length
  const sorted = [...products].sort((a, b) => {
    const sa = effectiveScore(a), sb = effectiveScore(b)
    if (sa === 0 && sb !== 0) return 1
    if (sb === 0 && sa !== 0) return -1
    return sa - sb
  })
  const criticalIssues = auditResult ? auditResult.seo_issues.filter(i => i.impact === 'critical').length : 0
  const warningIssues = auditResult ? auditResult.seo_issues.filter(i => i.impact === 'warning').length : 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Optimizare SEO</h1>
            <p className="text-gray-500 text-sm mt-0.5">Audit complet magazin + optimizare conținut produse</p>
          </div>
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50 gap-1 py-1">
            <Shield className="h-3 w-3" />Conform Google E-E-A-T
          </Badge>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {[
            { id: 'store', label: 'Audit Magazin', icon: Globe },
            { id: 'products', label: 'Produse SEO', icon: Package },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'products' && unoptimized > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unoptimized > 9 ? '9+' : unoptimized}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {activeTab === 'store' && (
        <div className="space-y-5">
          <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
                    <Zap className="h-4 w-4 text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">Audit Google PageSpeed Insights</h2>
                    <p className="text-slate-400 text-xs">Analizează performanța și SEO-ul magazinului tău</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <input type="url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)}
                    placeholder="https://magazinul-tau.ro" onKeyDown={e => e.key === 'Enter' && runAudit()}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all" />
                  <Button onClick={runAudit} disabled={auditing || !storeUrl.trim()}
                    className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl px-5 gap-2 shrink-0">
                    {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {auditing ? 'Analizez...' : 'Analizează'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {[{ id: 'mobile', icon: Smartphone, label: 'Mobile' }, { id: 'desktop', icon: Monitor, label: 'Desktop' }].map(s => (
                    <button key={s.id} onClick={() => setStrategy(s.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        strategy === s.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}>
                      <s.icon className="h-3.5 w-3.5" />{s.label}
                    </button>
                  ))}
                  <span className="text-slate-500 text-xs self-center ml-1">Google recomandă audit mobile-first</span>
                </div>
              </div>
              {auditing && (
                <div className="p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm font-medium">Analizez cu Google PageSpeed Insights...</p>
                  <p className="text-gray-400 text-xs mt-1">Poate dura 15-30 secunde</p>
                </div>
              )}
              {auditError && !auditing && (
                <div className="p-4 flex items-center gap-3 text-red-600 bg-red-50">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Eroare audit</p>
                    <p className="text-xs text-red-500 mt-0.5">{auditError}</p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {auditResult && !auditing && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
              <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white font-semibold text-sm">Rezultate pentru</p>
                      <a href={auditResult.url} target="_blank" rel="noopener" className="text-blue-400 text-xs hover:underline flex items-center gap-1">
                        {auditResult.url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      {strategy === 'mobile' ? <Smartphone className="h-4 w-4 text-slate-400" /> : <Monitor className="h-4 w-4 text-slate-400" />}
                      <span className="text-slate-400 text-xs capitalize">{strategy}</span>
                      <button onClick={runAudit} className="text-slate-400 hover:text-white transition-colors ml-2"><RefreshCw className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="flex gap-6 flex-wrap">
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
                    {criticalIssues > 0 && <span className="flex items-center gap-1.5 text-red-600 font-medium"><XCircle className="h-4 w-4" />{criticalIssues} probleme critice</span>}
                    {warningIssues > 0 && <span className="flex items-center gap-1.5 text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" />{warningIssues} avertismente</span>}
                  </div>
                )}
              </Card>

              {auditResult.seo_issues.length > 0 && (
                <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
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
                              <div className="px-5 pb-4 space-y-3">
                                <div className="bg-gray-50 rounded-xl p-3">
                                  <p className="text-xs text-gray-500 leading-relaxed">{issue.description}</p>
                                </div>
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
                <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
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
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Zap, color: 'amber', title: 'Core Web Vitals', desc: 'LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 — praguri Google pentru experiență bună pe mobile' },
                  { icon: Search, color: 'blue', title: 'Audit SEO tehnic', desc: 'Verificăm: title, meta description, canonical, robots.txt, structured data, alt text, crawlabilitate' },
                  { icon: BarChart3, color: 'green', title: 'Instrucțiuni de fix', desc: 'Fiecare problemă identificată vine cu instrucțiuni detaliate de rezolvare conform Google Guidelines' },
                ].map(item => (
                  <Card key={item.title} className="border-0 shadow-sm rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-xl bg-${item.color}-100 flex items-center justify-center shrink-0`}>
                          <item.icon className={`h-4 w-4 text-${item.color}-600`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-5">
          <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total produse', value: products.length, color: 'text-gray-700', bg: 'bg-gray-50' },
                { label: 'Optimizate', value: optimized, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Parțial', value: partial, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Neoptimizate', value: unoptimized, color: 'text-red-500', bg: 'bg-red-50' },
              ].map(stat => (
                <Card key={stat.label} className={`border-0 shadow-sm rounded-2xl ${stat.bg}`}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Toate produsele</h3>
                <span className="text-xs text-gray-400">{products.length} produse</span>
              </div>
              {loadingProducts ? (
                <div className="space-y-2 p-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Niciun produs sincronizat</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {sorted.map((product, i) => {
                    // Daca produsul are continut optimizat dar seo_score=0, il tratam ca partial optimizat (60)
                    const hasOptimizedContent = !!(product.optimized_title || product.meta_description || product.focus_keyword)
                    const score = product.seo_score > 0 ? product.seo_score : hasOptimizedContent ? 60 : 0
                    const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : score > 0 ? 'text-red-500' : 'text-gray-300'
                    const scoreBg = score >= 80 ? 'bg-green-50' : score >= 50 ? 'bg-amber-50' : score > 0 ? 'bg-red-50' : 'bg-gray-50'
                    return (
                      <motion.div key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                        <Link href={`/seo/${product.id}`}>
                          <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-all group cursor-pointer">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 relative">
                              {(product.thumbnail_url || product.original_images?.[0]) ? (
                                <img src={product.thumbnail_url || product.original_images![0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-4 w-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{product.optimized_title || product.original_title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {product.focus_keyword && (
                                  <span className="text-[11px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-medium">{product.focus_keyword}</span>
                                )}
                                {product.meta_description ? (
                                  <span className="text-xs text-gray-400 truncate max-w-[300px]">{product.meta_description}</span>
                                ) : (
                                  <span className="text-xs text-gray-300 italic">Lipsă meta description</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {score === 0 ? (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-400 border-0 text-[11px]">Neoptimizat</Badge>
                              ) : score >= 80 ? (
                                <Badge className="bg-green-100 text-green-600 border-0 text-[11px] hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Excelent</Badge>
                              ) : score >= 50 ? (
                                <Badge className="bg-amber-100 text-amber-600 border-0 text-[11px] hover:bg-amber-100"><AlertTriangle className="h-3 w-3 mr-1" />De îmbunătățit</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-500 border-0 text-[11px] hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Slab</Badge>
                              )}
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  )
}