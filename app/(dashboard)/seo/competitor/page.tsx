'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, XCircle, CheckCircle, Globe, Search, BarChart3,
  AlertTriangle, ExternalLink, RefreshCw, ArrowUp, ArrowDown,
  Minus, Bell, Clock, Hash, Shield,
  FileText, DollarSign, Link2, Sparkles, Copy, ChevronDown,
  Monitor, Smartphone, CheckSquare, Trash2, Plus, Download,
} from 'lucide-react'
import { normalizeUrl, hostnameOnly, calcCompetitorScore } from '@/lib/competitor/url-utils'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreAnalysis = {
  url: string; title: string; meta_description: string; h1: string
  headings: string[]; focus_keywords: string[]; content_length_estimate: number
  strengths: string[]; weaknesses: string[]; opportunities: string[]
}
type ComparisonResult = {
  my_store: StoreAnalysis; competitor: StoreAnalysis
  verdict: {
    winner_title: Winner; winner_meta: Winner; winner_keywords: Winner
    overall_score_you: number; overall_score_competitor: number
    summary: string; top_actions: string[]
  }
}
type Winner = 'tu' | 'competitor' | 'egal'
type MonitorItem = {
  id: string; competitor_url: string; competitor_label: string
  is_active: boolean; last_checked_at: string | null
  check_frequency_hours: number; latest_score: number | null
}
type AlertItem = {
  id: string; alert_type: string; field_changed: string
  old_value: string; new_value: string; is_read: boolean
  created_at: string; competitor_monitors: { competitor_url: string; competitor_label: string }
}
type Snapshot = { id: string; seo_score: number; captured_at: string }
type KeywordGap = {
  gap_keywords: string[]; my_advantages: string[]; common_keywords: string[]
  opportunities: string[]; analysis_summary: string; top_priority: string
}
type TechData = {
  my_store: { url: string; pagespeed: { mobile: any; desktop: any }; technical: any }
  competitor: { url: string; pagespeed: { mobile: any; desktop: any }; technical: any }
}
type PricingData = {
  my_usps: string[]; competitor_usps: string[]; missing_usps: string[]
  my_ctas: string[]; competitor_ctas: string[]; cta_recommendations: string[]
  price_positioning: string; price_insight: string
  my_detected_prices: number[]; their_detected_prices: number[]
  pricing_recommendations: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hn(url: string) { try { return new URL(url.startsWith('http') ? url : 'https://'+url).hostname.replace('www.','') } catch { return url } }

function charStatus(len: number, min: number, max: number) {
  if (!len) return { text: 'Necompletat', cls: 'text-neutral-300' }
  if (len >= min && len <= max) return { text: `${len} car. — ideal`, cls: 'text-emerald-600' }
  if (len < min) return { text: `${len} car. — sub ${min}`, cls: 'text-amber-600' }
  return { text: `${len} car. — peste ${max}`, cls: 'text-red-500' }
}

function alertLabel(type: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    title_changed:    { text: 'Titlu schimbat',    color: 'text-neutral-700' },
    meta_changed:     { text: 'Meta schimbat',      color: 'text-neutral-700' },
    keywords_changed: { text: 'Keywords schimbate', color: 'text-neutral-700' },
    score_drop:       { text: 'Scor scăzut',        color: 'text-red-500'     },
    score_rise:       { text: 'Scor crescut',        color: 'text-emerald-600' },
  }
  return map[type] || { text: type, color: 'text-neutral-500' }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md'; className?: string
}) {
  const base  = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const vars  = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
  }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${vars[variant]} ${className}`}>{children}</button>
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] font-medium text-neutral-400 uppercase tracking-wide ${className}`}>{children}</p>
}

// ─── Shared components ────────────────────────────────────────────────────────

function ScoreCircle({ score, you, size = 72 }: { score: number; you: boolean; size?: number }) {
  const r    = size / 2 - 6
  const circ = 2 * Math.PI * r
  const c    = score >= 70 ? (you ? '#111827' : '#6b7280') : score >= 45 ? '#d97706' : '#ef4444'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f5f5f5" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${(score/100)*circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black text-neutral-900 tabular-nums" style={{ fontSize: size > 60 ? 15 : 12 }}>{score}</span>
      </div>
    </div>
  )
}

function MetricBar({ label, you, them }: { label: string; you: number; them: number }) {
  const max    = Math.max(you, them, 1)
  const youWin = you > them
  const draw   = you === them
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center py-3 border-b border-neutral-50 last:border-0">
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-[12px] font-bold tabular-nums ${youWin || draw ? 'text-neutral-900' : 'text-neutral-300'}`}>{you}</span>
        <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden flex justify-end">
          <motion.div className={`h-full rounded-full ${youWin || draw ? 'bg-neutral-900' : 'bg-neutral-200'}`}
            initial={{ width: 0 }} animate={{ width: `${(you / max) * 100}%` }} transition={{ duration: 0.7 }} />
        </div>
      </div>
      <div className="text-center w-20">
        <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">{label}</p>
        <p className={`text-[9px] font-bold mt-0.5 ${youWin ? 'text-emerald-600' : draw ? 'text-neutral-400' : 'text-red-500'}`}>
          {youWin ? 'Tu' : draw ? 'Egal' : 'Competitor'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full ${!youWin && !draw ? 'bg-red-400' : 'bg-neutral-200'}`}
            initial={{ width: 0 }} animate={{ width: `${(them / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.06 }} />
        </div>
        <span className={`text-[12px] font-bold tabular-nums ${!youWin && !draw ? 'text-neutral-900' : 'text-neutral-300'}`}>{them}</span>
      </div>
    </div>
  )
}

function FieldRow({ label, mine, theirs, minLen, maxLen, winner, onSteal }: {
  label: string; mine: string; theirs: string; minLen?: number; maxLen?: number
  winner: Winner; onSteal?: (field: string, val: string) => void
}) {
  const ms       = minLen && maxLen ? charStatus(mine.length, minLen, maxLen) : null
  const ts       = minLen && maxLen ? charStatus(theirs.length, minLen, maxLen) : null
  const fieldKey = label.includes('Titlu') ? 'title' : label.includes('Meta') ? 'meta_description' : 'focus_keyword'
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <div className="flex items-center gap-2">
          {onSteal && theirs && winner === 'competitor' && (
            <button onClick={() => onSteal(fieldKey, theirs)}
              className="flex items-center gap-1 text-[10px] font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-lg transition-colors">
              <Sparkles className="h-2.5 w-2.5" />Steal this
            </button>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
            ${winner === 'tu' ? 'text-emerald-700 bg-emerald-50' : winner === 'competitor' ? 'text-red-600 bg-red-50' : 'text-neutral-400 bg-neutral-100'}`}>
            {winner === 'tu' ? 'Tu câștigă' : winner === 'competitor' ? 'Competitor câștigă' : 'Egal'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
        {[
          { val: mine,   status: ms, winner: winner === 'tu',         tag: 'Tu',         dot: 'bg-neutral-900' },
          { val: theirs, status: ts, winner: winner === 'competitor',  tag: 'Competitor', dot: 'bg-red-400'     },
        ].map((side, i) => (
          <div key={i} className={`p-4 ${side.winner ? 'bg-emerald-50/20' : ''}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${side.dot}`} />
              <SectionLabel>{side.tag}</SectionLabel>
            </div>
            <p className={`text-[13px] leading-relaxed ${side.val ? 'text-neutral-800' : 'text-neutral-300 italic text-[11px]'}`}>
              {side.val || 'Necompletat'}
            </p>
            {side.status && side.val && <p className={`text-[10px] mt-1.5 font-medium ${side.status.cls}`}>{side.status.text}</p>}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Steal Modal ──────────────────────────────────────────────────────────────

function StealModal({ open, field, myCurrent, competitorValue, competitorUrl, onClose, onApplied }: {
  open: boolean; field: string; myCurrent: string; competitorValue: string; competitorUrl: string
  onClose: () => void; onApplied: (val: string) => void
}) {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<{ improved_value: string; explanation: string; char_count: number } | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied]   = useState(false)

  useEffect(() => { if (open && !result) generate() }, [open])

  async function generate() {
    setLoading(true); setResult(null)
    const res  = await fetch('/api/competitor/steal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, my_current: myCurrent, competitor_value: competitorValue, competitor_url: competitorUrl, apply: false }),
    })
    const data = await res.json()
    if (res.ok) setResult(data)
    setLoading(false)
  }

  async function apply() {
    if (!result) return
    setApplying(true)
    setApplying(false)
    setApplied(true)
    onApplied(result.improved_value)
    setTimeout(onClose, 1000)
  }

  if (!open) return null
  const fieldLabels: Record<string, string> = { title: 'Titlu SEO', meta_description: 'Meta Description', focus_keyword: 'Focus Keyword' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-neutral-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neutral-500" />Steal This — {fieldLabels[field] || field}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">AI generează o variantă superioară ambelor</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'Varianta ta', val: myCurrent, dot: 'bg-neutral-900' }, { label: 'Competitor', val: competitorValue, dot: 'bg-red-400' }].map((s, i) => (
              <div key={i} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <SectionLabel>{s.label}</SectionLabel>
                </div>
                <p className="text-[12px] text-neutral-700 leading-relaxed">{s.val || '—'}</p>
              </div>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
              <SectionLabel className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Variantă AI generată</SectionLabel>
            </div>
            <div className="p-4 min-h-[60px] flex items-center">
              {loading ? (
                <div className="flex items-center gap-2 text-neutral-400 text-[12px]">
                  <Loader2 className="h-4 w-4 animate-spin" />Se generează...
                </div>
              ) : result ? (
                <div className="space-y-2 w-full">
                  <p className="text-[13px] text-neutral-900 font-medium leading-relaxed">{result.improved_value}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-neutral-400 italic">{result.explanation}</p>
                    <span className="text-[10px] font-medium text-neutral-400 tabular-nums">{result.char_count} car.</span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
        <div className="px-5 py-4 border-t border-neutral-100 flex items-center justify-between">
          <Btn variant="ghost" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw className="h-3 w-3" />Regenerează
          </Btn>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={onClose}>Anulează</Btn>
            {result && !applied && (
              <Btn size="sm" onClick={apply} disabled={applying}>
                {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Aplică
              </Btn>
            )}
            {applied && <span className="text-[12px] font-medium text-emerald-600 flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Aplicat!</span>}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────

function TabOverview({ result, onSteal }: {
  result: ComparisonResult | null
  onSteal: (field: string, val: string, current: string) => void
}) {
  if (!result) return (
    <Card className="p-12 text-center">
      <BarChart3 className="h-10 w-10 text-neutral-200 mx-auto mb-4" />
      <p className="text-[14px] font-semibold text-neutral-700 mb-1">Nicio analiză efectuată</p>
      <p className="text-[12px] text-neutral-400 max-w-xs mx-auto">Introdu URL-ul competitorului și apasă Analizează pentru a vedea comparația completă.</p>
    </Card>
  )

  const r      = result
  const youWin = r.verdict.overall_score_you > r.verdict.overall_score_competitor
  const draw   = r.verdict.overall_score_you === r.verdict.overall_score_competitor
  const diff   = r.verdict.overall_score_you - r.verdict.overall_score_competitor

  return (
    <div className="space-y-4">

      {/* Verdict */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center space-y-1.5">
              <ScoreCircle score={r.verdict.overall_score_you} you={true} />
              <SectionLabel>Tu</SectionLabel>
            </div>
            <div className="flex flex-col items-center gap-1 pb-5">
              {draw ? <Minus className="h-4 w-4 text-neutral-300" /> : youWin ? <ArrowUp className="h-5 w-5 text-emerald-500" /> : <ArrowDown className="h-5 w-5 text-red-400" />}
              <span className={`text-[12px] font-bold tabular-nums ${youWin ? 'text-emerald-600' : draw ? 'text-neutral-400' : 'text-red-500'}`}>
                {draw ? '0' : diff > 0 ? `+${diff}` : String(diff)}
              </span>
            </div>
            <div className="text-center space-y-1.5">
              <ScoreCircle score={r.verdict.overall_score_competitor} you={false} />
              <SectionLabel>Competitor</SectionLabel>
            </div>
          </div>
          <div className="flex-1 min-w-0 sm:border-l sm:border-neutral-100 sm:pl-6">
            <p className="text-[15px] font-semibold text-neutral-900 mb-1.5 leading-snug">
              {youWin ? 'Magazinul tău este mai bine optimizat SEO' : draw ? 'Egalitate — detaliile fac diferența' : 'Competitorul te depășește la SEO'}
            </p>
            <p className="text-[13px] text-neutral-500 leading-relaxed">{r.verdict.summary}</p>
          </div>
        </div>
      </Card>

      {/* Metric bars */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-neutral-900">Comparație metrici</p>
          <div className="flex items-center gap-3">
            {[{ dot: 'bg-neutral-900', lbl: 'Tu' }, { dot: 'bg-red-400', lbl: 'Competitor' }].map(x => (
              <span key={x.lbl} className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400">
                <span className={`w-2 h-2 rounded-full ${x.dot}`} />{x.lbl}
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-1">
          <MetricBar label="Titlu"    you={r.my_store.title?.length || 0}             them={r.competitor.title?.length || 0} />
          <MetricBar label="Meta"     you={r.my_store.meta_description?.length || 0}  them={r.competitor.meta_description?.length || 0} />
          <MetricBar label="Keywords" you={r.my_store.focus_keywords?.length || 0}    them={r.competitor.focus_keywords?.length || 0} />
          <MetricBar label="Headings" you={r.my_store.headings?.length || 0}          them={r.competitor.headings?.length || 0} />
        </div>
      </Card>

      {/* Field compare */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <p className="text-[13px] font-semibold text-neutral-900">Comparație câmpuri SEO</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Apasă "Steal this" pentru a genera o variantă îmbunătățită cu AI</p>
        </div>
        <div className="p-4 space-y-3">
          <FieldRow label="Titlu SEO" mine={r.my_store.title || ''} theirs={r.competitor.title || ''} minLen={50} maxLen={70} winner={r.verdict.winner_title}
            onSteal={(f, v) => onSteal(f, v, r.my_store.title || '')} />
          <FieldRow label="Meta Description" mine={r.my_store.meta_description || ''} theirs={r.competitor.meta_description || ''} minLen={120} maxLen={155} winner={r.verdict.winner_meta}
            onSteal={(f, v) => onSteal(f, v, r.my_store.meta_description || '')} />
          {(r.my_store.h1 || r.competitor.h1) && (
            <FieldRow label="H1 principal" mine={r.my_store.h1 || ''} theirs={r.competitor.h1 || ''} winner="egal" />
          )}
        </div>
      </Card>

      {/* Keywords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Keywords tale',       kws: r.my_store.focus_keywords,  bg: 'bg-neutral-100', text: 'text-neutral-700' },
          { label: 'Keywords competitor', kws: r.competitor.focus_keywords, bg: 'bg-red-50',      text: 'text-red-700'     },
        ].map(({ label, kws, bg, text }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-neutral-900">{label}</p>
              <span className="text-[10px] font-medium text-neutral-400">{kws?.length || 0} detectate</span>
            </div>
            {kws?.length > 0
              ? <div className="flex flex-wrap gap-1.5">{kws.map((kw, i) => <span key={i} className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${bg} ${text}`}>{kw}</span>)}</div>
              : <p className="text-[12px] text-neutral-300">Niciun keyword detectat</p>}
          </Card>
        ))}
      </div>

      {/* Actions */}
      {r.verdict.top_actions?.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-[13px] font-semibold text-neutral-900">Plan de acțiune</p>
          </div>
          <div className="p-4 space-y-2">
            {r.verdict.top_actions.map((action, i) => (
              <div key={i} className="flex items-start gap-4 p-3.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                <span className="text-[11px] font-bold text-neutral-300 tabular-nums mt-0.5 shrink-0">0{i + 1}</span>
                <p className="text-[13px] text-neutral-700 leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── TAB: MONITOR ─────────────────────────────────────────────────────────────

function TabMonitor({ competitorUrl }: { competitorUrl: string }) {
  const [monitors, setMonitors]   = useState<MonitorItem[]>([])
  const [alerts, setAlerts]       = useState<AlertItem[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({})
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [newLabel, setNewLabel]   = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [mRes, aRes] = await Promise.all([fetch('/api/competitor/monitors'), fetch('/api/competitor/alerts?unread=false')])
    const [mData, aData] = await Promise.all([mRes.json(), aRes.json()])
    setMonitors(mData.monitors || [])
    setAlerts(aData.alerts || [])
    setLoading(false)
  }

  async function addMonitor() {
    if (!competitorUrl) return
    setAdding(true)
    const res = await fetch('/api/competitor/monitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_url: competitorUrl, competitor_label: newLabel || hn(competitorUrl) }),
    })
    if (res.ok) { await loadAll(); setNewLabel('') }
    setAdding(false)
  }

  async function removeMonitor(id: string) {
    await fetch('/api/competitor/monitors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMonitors(prev => prev.filter(m => m.id !== id))
  }

  async function toggleMonitor(id: string, is_active: boolean) {
    const res = await fetch('/api/competitor/monitors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active }) })
    if (res.ok) setMonitors(prev => prev.map(m => m.id === id ? { ...m, is_active } : m))
  }

  async function markAllRead() {
    await fetch('/api/competitor/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
  }

  async function loadSnapshots(monitorId: string) {
    if (snapshots[monitorId]) return
    const res  = await fetch(`/api/competitor/snapshots?monitor_id=${monitorId}&limit=30`)
    const data = await res.json()
    setSnapshots(prev => ({ ...prev, [monitorId]: data.snapshots || [] }))
  }

  const unread = alerts.filter(a => !a.is_read).length

  if (loading) return <Card className="p-8 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /><span className="text-[13px] text-neutral-500">Se încarcă...</span></Card>

  return (
    <div className="space-y-4">

      {/* Add monitor */}
      <Card className="p-5">
        <p className="text-[13px] font-semibold text-neutral-900 mb-3">Adaugă competitor la monitorizare</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-neutral-200 rounded-xl px-3.5 py-2.5">
            <Globe className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
            <span className="text-[13px] text-neutral-500 truncate">{competitorUrl || 'Introdu URL competitor mai sus'}</span>
          </div>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Etichetă (ex: Principalul competitor)"
            className="flex-1 min-w-[180px] border border-neutral-200 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-neutral-400 transition-colors" />
          <Btn onClick={addMonitor} disabled={adding || !competitorUrl}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adaugă
          </Btn>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2">Verificăm automat în fiecare zi la 06:00. Primești alertă când detectăm schimbări.</p>
      </Card>

      {/* Monitors */}
      {monitors.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-[13px] font-semibold text-neutral-900">Competitori monitorizați ({monitors.length}/10)</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {monitors.map(m => (
              <div key={m.id}>
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-neutral-800">{m.competitor_label}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                        {m.is_active ? 'Activ' : 'Oprit'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400 flex-wrap">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{hn(m.competitor_url)}</span>
                      {m.last_checked_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Ultima: {new Date(m.last_checked_at).toLocaleDateString('ro-RO')}</span>}
                      {m.latest_score !== null && <span className="font-semibold text-neutral-600">SEO: {m.latest_score}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => loadSnapshots(m.id)} className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors">Istoric</button>
                    <button onClick={() => toggleMonitor(m.id, !m.is_active)}
                      className={`w-9 h-5 rounded-full transition-all relative ${m.is_active ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${m.is_active ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => removeMonitor(m.id)} className="text-neutral-300 hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {snapshots[m.id] && (
                  <div className="px-4 pb-4">
                    <div className="bg-neutral-50 rounded-xl p-3">
                      <SectionLabel className="mb-3 block">Evoluție scor SEO</SectionLabel>
                      {snapshots[m.id].length === 0
                        ? <p className="text-[11px] text-neutral-400">Niciun snapshot. Prima verificare va fi mâine la 06:00.</p>
                        : (
                          <div className="flex items-end gap-0.5 h-12">
                            {snapshots[m.id].map((s, i) => {
                              const pct   = (s.seo_score / 100) * 100
                              const color = s.seo_score >= 70 ? 'bg-emerald-400' : s.seo_score >= 45 ? 'bg-amber-400' : 'bg-red-400'
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center" title={`${s.seo_score} — ${new Date(s.captured_at).toLocaleDateString('ro-RO')}`}>
                                  <div className={`w-full rounded-sm ${color}`} style={{ height: `${pct}%`, minHeight: 2 }} />
                                </div>
                              )
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Alerts */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-neutral-900">Alerte schimbări</p>
            {unread > 0 && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">{unread}</span>}
          </div>
          {unread > 0 && (
            <Btn variant="ghost" size="sm" onClick={markAllRead}>
              <CheckSquare className="h-3 w-3" />Marchează toate citite
            </Btn>
          )}
        </div>
        {alerts.length === 0
          ? <div className="p-8 text-center"><Bell className="h-8 w-8 text-neutral-200 mx-auto mb-2" /><p className="text-[13px] text-neutral-400">Nicio alertă. Monitorizările active vor trimite alerte la schimbări.</p></div>
          : (
            <div className="divide-y divide-neutral-50">
              {alerts.slice(0, 20).map(a => {
                const lbl = alertLabel(a.alert_type)
                return (
                  <div key={a.id} className={`flex items-start gap-4 px-4 py-3.5 ${!a.is_read ? 'bg-neutral-50' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!a.is_read ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-semibold ${lbl.color}`}>{lbl.text}</span>
                        <span className="text-[10px] text-neutral-400">{a.competitor_monitors?.competitor_label || hn(a.competitor_monitors?.competitor_url || '')}</span>
                      </div>
                      {a.old_value && a.new_value && (
                        <div className="text-[11px] text-neutral-600">
                          <span className="text-red-400 line-through">{a.old_value.substring(0, 60)}</span>
                          {' → '}
                          <span className="text-emerald-600">{a.new_value.substring(0, 60)}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 shrink-0">{new Date(a.created_at).toLocaleDateString('ro-RO')}</span>
                  </div>
                )
              })}
            </div>
          )}
      </Card>
    </div>
  )
}

// ─── TAB: KEYWORDS ────────────────────────────────────────────────────────────

function TabKeywords({ myUrl, competitorUrl }: { myUrl: string; competitorUrl: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<KeywordGap | null>(null)
  const [error, setError]     = useState('')

  async function analyze() {
    if (!myUrl || !competitorUrl) { setError('URL-urile lipsesc'); return }
    setLoading(true); setError(''); setResult(null)
    const res  = await fetch('/api/competitor/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ my_url: myUrl, competitor_url: competitorUrl }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Eroare'); setLoading(false); return }
    setResult(data.result); setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">Keyword Gap Analysis</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Keywords pe care le are competitorul și tu nu. Direct acționabile.</p>
            <p className="text-[10px] text-neutral-300 mt-1">2 credite</p>
          </div>
          <Btn onClick={analyze} disabled={loading || !myUrl || !competitorUrl}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hash className="h-3.5 w-3.5" />}
            {loading ? 'Analizez...' : 'Analizează keywords'}
          </Btn>
        </div>
        {error && <p className="text-[11px] text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5" />{error}</p>}
      </Card>

      {loading && <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto mb-2" /><p className="text-[13px] text-neutral-500">Analizez ambele pagini...</p></Card>}

      {result && (
        <div className="space-y-4">
          {result.top_priority && (
            <Card className="p-5 border-2 border-neutral-900">
              <SectionLabel>Prioritate maximă</SectionLabel>
              <p className="text-[17px] font-bold text-neutral-900 mt-1">{result.top_priority}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Adaugă acest keyword în titlul și meta description-ul celor mai importante produse.</p>
            </Card>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Keywords lipsă (gap)',   items: result.gap_keywords,     bg: 'bg-red-50',     text: 'text-red-700',     desc: 'Le are competitorul, tu nu' },
              { title: 'Avantajele tale',         items: result.my_advantages,    bg: 'bg-emerald-50', text: 'text-emerald-700', desc: 'Le ai tu, competitorul nu' },
              { title: 'Oportunitate nouă',       items: result.opportunities,    bg: 'bg-neutral-100',text: 'text-neutral-600', desc: 'Nici tu, nici competitorul' },
              { title: 'Keywords comune',         items: result.common_keywords,  bg: 'bg-neutral-100',text: 'text-neutral-500', desc: 'Amândoi le folosiți' },
            ].map(({ title, items, bg, text, desc }) => (
              <Card key={title} className="p-4">
                <p className="text-[13px] font-semibold text-neutral-900 mb-0.5">{title}</p>
                <p className="text-[10px] text-neutral-400 mb-3">{desc}</p>
                {items?.length > 0
                  ? <div className="flex flex-wrap gap-1.5">{items.map((kw, i) => <span key={i} className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${bg} ${text}`}>{kw}</span>)}</div>
                  : <p className="text-[11px] text-neutral-300">—</p>}
              </Card>
            ))}
          </div>
          {result.analysis_summary && (
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
              <p className="text-[12px] text-neutral-600 leading-relaxed">{result.analysis_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: TECHNICAL ───────────────────────────────────────────────────────────

function TabTechnical({ myUrl, competitorUrl }: { myUrl: string; competitorUrl: string }) {
  const [loading, setLoading] = useState(false)
  const [data, setData]       = useState<TechData | null>(null)
  const [error, setError]     = useState('')
  const [device, setDevice]   = useState<'mobile' | 'desktop'>('mobile')

  async function analyze() {
    if (!myUrl || !competitorUrl) { setError('URL-urile lipsesc'); return }
    setLoading(true); setError(''); setData(null)
    const res  = await fetch('/api/competitor/technical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ my_url: myUrl, competitor_url: competitorUrl }) })
    const d    = await res.json()
    if (!res.ok) { setError(d.error || 'Eroare'); setLoading(false); return }
    setData(d); setLoading(false)
  }

  function TechCheck({ label, mine, theirs, good, invert = false }: { label: string; mine: any; theirs: any; good?: boolean; invert?: boolean }) {
    const mineOk   = good !== undefined ? (invert ? !mine   : !!mine)   : mine
    const theirsOk = good !== undefined ? (invert ? !theirs : !!theirs) : theirs
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-neutral-50 last:border-0">
        <div className="flex items-center justify-end gap-2">
          {mineOk ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
          <span className={`text-[11px] ${mineOk ? 'text-neutral-700' : 'text-neutral-400'} text-right`}>{String(mine || '—').substring(0, 40)}</span>
        </div>
        <span className="text-[10px] font-medium text-neutral-400 text-center uppercase tracking-wide w-24">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${theirsOk ? 'text-neutral-700' : 'text-neutral-400'}`}>{String(theirs || '—').substring(0, 40)}</span>
          {theirsOk ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">Analiză tehnică SEO</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">PageSpeed, Core Web Vitals, Schema markup, Open Graph</p>
            <p className="text-[10px] text-neutral-300 mt-1">Gratuit — Google PageSpeed API</p>
          </div>
          <Btn onClick={analyze} disabled={loading || !myUrl || !competitorUrl}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            {loading ? 'Analizez...' : 'Analizează tehnic'}
          </Btn>
        </div>
        {error && <p className="text-[11px] text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5" />{error}</p>}
      </Card>

      {loading && <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto mb-2" /><p className="text-[13px] text-neutral-500">Se rulează PageSpeed + analiză tehnică...</p><p className="text-[11px] text-neutral-400 mt-1">Poate dura 15-20 secunde</p></Card>}

      {data && (
        <div className="space-y-4">
          {/* PageSpeed */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-neutral-900">PageSpeed Performance</p>
              <div className="flex gap-0.5 p-0.5 bg-neutral-100 rounded-lg">
                {(['mobile', 'desktop'] as const).map(d => {
                  const Icon = d === 'mobile' ? Smartphone : Monitor
                  return (
                    <button key={d} onClick={() => setDevice(d)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${device === d ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-400 hover:text-neutral-600'}`}>
                      <Icon className="h-3 w-3" />{d === 'mobile' ? 'Mobil' : 'Desktop'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-neutral-100">
              {[{ label: 'Tu', ps: data.my_store.pagespeed[device], you: true }, { label: 'Competitor', ps: data.competitor.pagespeed[device], you: false }].map(({ label, ps, you }) => (
                <div key={label} className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${you ? 'bg-neutral-900' : 'bg-red-400'}`} />
                    <SectionLabel>{label}</SectionLabel>
                  </div>
                  {ps ? (
                    <div className="space-y-2">
                      <p className={`text-[26px] font-black tabular-nums ${ps.performance_score >= 90 ? 'text-emerald-600' : ps.performance_score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {ps.performance_score ?? '—'}
                      </p>
                      {[['FCP', ps.fcp], ['LCP', ps.lcp], ['CLS', ps.cls], ['TBT', ps.tbt]].map(([k, v]) => (
                        <div key={k as string} className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400 font-mono">{k}</span>
                          <span className="font-medium text-neutral-700">{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[11px] text-neutral-400">Date indisponibile</p>}
                </div>
              ))}
            </div>
          </Card>

          {/* Technical checks */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-neutral-900">Verificări SEO tehnic</p>
              <div className="flex items-center gap-3">
                {[{ dot: 'bg-neutral-900', lbl: 'Tu' }, { dot: 'bg-red-400', lbl: 'Competitor' }].map(x => (
                  <span key={x.lbl} className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400">
                    <span className={`w-2 h-2 rounded-full ${x.dot}`} />{x.lbl}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-1">
              <TechCheck label="Canonical"    mine={data.my_store.technical.has_canonical}       theirs={data.competitor.technical.has_canonical}       good />
              <TechCheck label="Viewport"     mine={data.my_store.technical.has_viewport}        theirs={data.competitor.technical.has_viewport}        good />
              <TechCheck label="OG Tags"      mine={data.my_store.technical.has_og_tags}         theirs={data.competitor.technical.has_og_tags}         good />
              <TechCheck label="OG Image"     mine={data.my_store.technical.has_og_image}        theirs={data.competitor.technical.has_og_image}        good />
              <TechCheck label="Hreflang"     mine={data.my_store.technical.has_hreflang}        theirs={data.competitor.technical.has_hreflang}        good />
              <TechCheck label="Img fără ALT" mine={data.my_store.technical.images_without_alt}  theirs={data.competitor.technical.images_without_alt}  invert good />
              <TechCheck label="Limbă"        mine={data.my_store.technical.lang || '—'}         theirs={data.competitor.technical.lang || '—'} />
            </div>
          </Card>

          {/* Schema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: 'Schema.org — Tu', types: data.my_store.technical.schema_types, dot: 'bg-neutral-900' }, { label: 'Schema.org — Competitor', types: data.competitor.technical.schema_types, dot: 'bg-red-400' }].map(({ label, types, dot }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <p className="text-[13px] font-semibold text-neutral-900">{label}</p>
                </div>
                {types?.length > 0
                  ? <div className="flex flex-wrap gap-1.5">{types.map((t: string, i: number) => <span key={i} className="text-[11px] bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-lg font-medium">{t}</span>)}</div>
                  : <p className="text-[11px] text-neutral-300">Niciun Schema.org detectat</p>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB: PRICING ─────────────────────────────────────────────────────────────

function TabPricing({ myUrl, competitorUrl }: { myUrl: string; competitorUrl: string }) {
  const [loading, setLoading] = useState(false)
  const [data, setData]       = useState<PricingData | null>(null)
  const [error, setError]     = useState('')

  async function analyze() {
    if (!myUrl || !competitorUrl) { setError('URL-urile lipsesc'); return }
    setLoading(true); setError(''); setData(null)
    const res  = await fetch('/api/competitor/pricing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ my_url: myUrl, competitor_url: competitorUrl }) })
    const d    = await res.json()
    if (!res.ok) { setError(d.error || 'Eroare'); setLoading(false); return }
    setData(d.result); setLoading(false)
  }

  const posColors: Record<string, string>  = { mai_ieftin: 'text-emerald-700 bg-emerald-50', similar: 'text-neutral-600 bg-neutral-100', mai_scump: 'text-amber-700 bg-amber-50', necunoscut: 'text-neutral-500 bg-neutral-100' }
  const posLabels: Record<string, string>  = { mai_ieftin: 'Mai ieftin decât competitorul', similar: 'Prețuri similare', mai_scump: 'Mai scump decât competitorul', necunoscut: 'Poziționare necunoscută' }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">Pricing, USP & CTA Benchmark</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Comparație prețuri, promisiuni unice, call-to-action-uri</p>
            <p className="text-[10px] text-neutral-300 mt-1">2 credite</p>
          </div>
          <Btn onClick={analyze} disabled={loading || !myUrl || !competitorUrl}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
            {loading ? 'Analizez...' : 'Analizează pricing'}
          </Btn>
        </div>
        {error && <p className="text-[11px] text-red-500 flex items-center gap-1.5 mt-3"><XCircle className="h-3.5 w-3.5" />{error}</p>}
      </Card>

      {loading && <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto mb-2" /><p className="text-[13px] text-neutral-500">Extrag prețuri, USP-uri și CTA-uri...</p></Card>}

      {data && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel className="mb-3 block">Poziționare preț</SectionLabel>
            <span className={`inline-block text-[13px] font-semibold px-3 py-1.5 rounded-full ${posColors[data.price_positioning] || posColors.necunoscut}`}>
              {posLabels[data.price_positioning] || data.price_positioning}
            </span>
            {data.price_insight && <p className="text-[13px] text-neutral-600 mt-3 leading-relaxed">{data.price_insight}</p>}
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: 'Prețuri detectate — Tu', prices: data.my_detected_prices, dot: 'bg-neutral-900' }, { label: 'Prețuri detectate — Competitor', prices: data.their_detected_prices, dot: 'bg-red-400' }].map(({ label, prices, dot }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-3"><div className={`w-1.5 h-1.5 rounded-full ${dot}`} /><p className="text-[13px] font-semibold text-neutral-900">{label}</p></div>
                {prices?.length > 0
                  ? <div className="flex flex-wrap gap-1.5">{prices.map((p, i) => <span key={i} className="text-[13px] font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 px-3 py-1 rounded-xl tabular-nums">{p.toFixed(2)} RON</span>)}</div>
                  : <p className="text-[11px] text-neutral-300">Niciun preț detectat</p>}
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: 'USP-urile tale', items: data.my_usps, dot: 'bg-neutral-900' }, { label: 'USP-urile competitorului', items: data.competitor_usps, dot: 'bg-red-400' }].map(({ label, items, dot }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-3"><div className={`w-1.5 h-1.5 rounded-full ${dot}`} /><p className="text-[13px] font-semibold text-neutral-900">{label}</p></div>
                {items?.length > 0
                  ? <div className="space-y-2">{items.map((s, i) => <div key={i} className="flex items-start gap-2 text-[12px] text-neutral-600"><CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{s}</div>)}</div>
                  : <p className="text-[11px] text-neutral-300">Niciun USP detectat</p>}
              </Card>
            ))}
          </div>

          {data.missing_usps?.length > 0 && (
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-neutral-900 mb-3">Promisiuni pe care competitorul le face și TU nu le menționezi</p>
              <div className="space-y-2">
                {data.missing_usps.map((u, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-amber-800">{u}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.cta_recommendations?.length > 0 && (
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-neutral-900 mb-3">Recomandări CTA</p>
              <div className="space-y-2">
                {data.cta_recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-4 p-3.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <span className="text-[11px] font-bold text-neutral-300 shrink-0 tabular-nums">0{i + 1}</span>
                    <p className="text-[13px] text-neutral-700">{r}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: REPORTS ─────────────────────────────────────────────────────────────

function TabReports({ myUrl, competitorUrl, result }: { myUrl: string; competitorUrl: string; result: ComparisonResult | null }) {
  const [generating, setGenerating] = useState(false)
  const [report, setReport]         = useState<any>(null)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [error, setError]           = useState('')

  useEffect(() => { loadPast() }, [])

  async function loadPast() {
    const res  = await fetch('/api/competitor/reports')
    const data = await res.json()
    setPastReports(data.reports || [])
  }

  async function generate() {
    if (!result) { setError('Rulează mai întâi analiza Overview'); return }
    setGenerating(true); setError('')
    const res  = await fetch('/api/competitor/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_url: competitorUrl, my_analysis: result.my_store, competitor_analysis: result.competitor }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Eroare'); setGenerating(false); return }
    setReport(data.report); await loadPast(); setGenerating(false)
  }

  async function openReport(id: string) {
    const res  = await fetch(`/api/competitor/reports?id=${id}`)
    const data = await res.json()
    if (res.ok && data.report) { setReport(data.report); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  function downloadReport(r: any) {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `seo-battle-${hn(r.competitor_url || '')}-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  const impactColor: Record<string, string> = { mare: 'text-red-500', mediu: 'text-amber-500', mic: 'text-neutral-400' }
  const effortColor: Record<string, string> = { mic: 'text-emerald-600', mediu: 'text-amber-600', mare: 'text-red-500' }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">Raport SEO Battle</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Raport complet cu scor detaliat, acțiuni prioritizate și strategie.</p>
            {!result && <p className="text-[10px] text-amber-600 mt-1">Rulează analiza din tab-ul Overview mai întâi.</p>}
            <p className="text-[10px] text-neutral-300 mt-1">3 credite</p>
          </div>
          <Btn onClick={generate} disabled={generating || !result}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {generating ? 'Generez...' : 'Generează raport'}
          </Btn>
        </div>
        {error && <p className="text-[11px] text-red-500 flex items-center gap-1.5 mt-2"><XCircle className="h-3.5 w-3.5" />{error}</p>}
      </Card>

      {generating && <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto mb-2" /><p className="text-[13px] text-neutral-500">Se generează raportul complet...</p></Card>}

      {report && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-neutral-900">Sumar executiv</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Generat: {new Date(report.generated_at).toLocaleString('ro-RO')}</p>
              </div>
              <Btn variant="outline" size="sm" onClick={() => downloadReport(report)}>
                <Download className="h-3 w-3" />JSON
              </Btn>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <ScoreCircle score={report.my_score || 0} you={true} size={56} />
                  <SectionLabel>Tu</SectionLabel>
                </div>
                <span className="text-neutral-300 font-bold">vs</span>
                <div className="flex items-center gap-3">
                  <ScoreCircle score={report.competitor_score || 0} you={false} size={56} />
                  <SectionLabel>Competitor</SectionLabel>
                </div>
                <span className={`ml-2 text-[13px] font-semibold px-3 py-1.5 rounded-full
                  ${report.overall_winner === 'tu' ? 'text-emerald-700 bg-emerald-50' : report.overall_winner === 'competitor' ? 'text-red-600 bg-red-50' : 'text-neutral-600 bg-neutral-100'}`}>
                  {report.overall_winner === 'tu' ? 'Tu câștigă' : report.overall_winner === 'competitor' ? 'Competitor câștigă' : 'Egalitate'}
                </span>
              </div>
              <p className="text-[13px] text-neutral-700 leading-relaxed">{report.executive_summary}</p>
            </div>
          </Card>

          {report.immediate_actions?.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-[13px] font-semibold text-neutral-900">Acțiuni imediate — matrice priorități</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">Sortate după impact / efort</p>
              </div>
              <div className="p-4 space-y-2">
                {report.immediate_actions.map((a: any) => (
                  <div key={a.priority} className="flex items-start gap-4 p-4 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <span className="text-[13px] font-black text-neutral-200 shrink-0">0{a.priority}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-neutral-800 font-medium leading-snug">{a.action}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] font-semibold ${impactColor[a.impact]}`}>Impact: {a.impact}</span>
                        <span className="text-neutral-200">·</span>
                        <span className={`text-[10px] font-semibold ${effortColor[a.effort]}`}>Efort: {a.effort}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {report.long_term_strategy && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-5">
              <SectionLabel className="mb-2 block">Strategie termen lung</SectionLabel>
              <p className="text-[13px] text-neutral-700 leading-relaxed">{report.long_term_strategy}</p>
            </div>
          )}
        </div>
      )}

      {pastReports.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-[13px] font-semibold text-neutral-900">Rapoarte anterioare</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {pastReports.map((r: any) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-neutral-700 truncate">{hn(r.competitor_url)}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{new Date(r.generated_at).toLocaleDateString('ro-RO')}{r.my_score ? ` · ${r.my_score} vs ${r.competitor_score}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full
                    ${r.overall_winner === 'tu' ? 'text-emerald-600 bg-emerald-50' : r.overall_winner === 'competitor' ? 'text-red-500 bg-red-50' : 'text-neutral-400 bg-neutral-100'}`}>
                    {r.overall_winner === 'tu' ? 'Tu' : r.overall_winner === 'competitor' ? 'Competitor' : 'Egal'}
                  </span>
                  <Btn variant="ghost" size="sm" onClick={() => openReport(r.id)}>Deschide</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',     icon: BarChart3  },
  { id: 'monitor',    label: 'Monitor',      icon: Bell       },
  { id: 'keywords',   label: 'Keywords',     icon: Hash       },
  { id: 'technical',  label: 'Tehnic',       icon: Shield     },
  { id: 'pricing',    label: 'Pricing & USP', icon: DollarSign },
  { id: 'reports',    label: 'Rapoarte',     icon: FileText   },
] as const

type TabId = typeof TABS[number]['id']

export default function CompetitorPage() {
  const [myUrl, setMyUrl]                 = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [inputVal, setInputVal]           = useState('')
  const [loading, setLoading]             = useState(false)
  const [result, setResult]               = useState<ComparisonResult | null>(null)
  const [error, setError]                 = useState('')
  const [activeTab, setActiveTab]         = useState<TabId>('overview')
  const [savedUrls, setSavedUrls]         = useState<string[]>([])
  const [stealModal, setStealModal]       = useState<{ field: string; val: string; current: string } | null>(null)

  useEffect(() => {
    async function loadStoreUrl() {
      try {
        const res  = await fetch('/api/stores')
        const data = await res.json()
        if (data.store?.store_url) { setMyUrl(data.store.store_url); return }
        const res2  = await fetch('/api/user/me')
        const data2 = await res2.json()
        if (data2.user?.store_url) setMyUrl(data2.user.store_url)
      } catch {}
    }
    loadStoreUrl()
    try { setSavedUrls(JSON.parse(localStorage.getItem('seo_competitor_urls') || '[]')) } catch {}
  }, [])

  function handleUrlInput(raw: string) {
    setInputVal(raw)
    if (!raw.trim()) { setCompetitorUrl(''); return }
    setCompetitorUrl(normalizeUrl(raw))
  }

  function saveUrl(url: string) {
    const u = [url, ...savedUrls.filter(x => x !== url)].slice(0, 6)
    setSavedUrls(u)
    try { localStorage.setItem('seo_competitor_urls', JSON.stringify(u)) } catch {}
  }

  async function analyze() {
    if (!competitorUrl.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const [myRes, theirRes] = await Promise.all([
        fetch('/api/competitor/analyze-my-store'),
        fetch('/api/seo/competitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competitor_url: competitorUrl, product_id: null }) }),
      ])
      const myData   = await myRes.json()
      const theirData = await theirRes.json()
      if (!myRes.ok)    { setError(myData.error || 'Eroare la încărcarea magazinului tău'); setLoading(false); return }
      if (!theirRes.ok) { setError(theirData.error || 'Nu pot accesa URL-ul competitorului'); setLoading(false); return }

      if (myData.store_url && !myUrl) setMyUrl(myData.store_url)

      const my   = { url: myUrl || myData.store_url || '', ...myData.analysis } as StoreAnalysis
      const them = { url: competitorUrl, ...theirData.analysis }                as StoreAnalysis
      const ms   = calcCompetitorScore(my)
      const ts   = calcCompetitorScore(them)

      const titleOk = (s: StoreAnalysis) => s.title?.length >= 50 && s.title?.length <= 70
      const metaOk  = (s: StoreAnalysis) => s.meta_description?.length >= 120 && s.meta_description?.length <= 155

      const wt = (!my.title ? 'competitor' : !them.title ? 'tu' : titleOk(my) && !titleOk(them) ? 'tu' : !titleOk(my) && titleOk(them) ? 'competitor' : 'egal') as Winner
      const wm = (!my.meta_description ? 'competitor' : !them.meta_description ? 'tu' : metaOk(my) && !metaOk(them) ? 'tu' : !metaOk(my) && metaOk(them) ? 'competitor' : 'egal') as Winner
      const wk = ((my.focus_keywords?.length || 0) > (them.focus_keywords?.length || 0) ? 'tu' : (my.focus_keywords?.length || 0) < (them.focus_keywords?.length || 0) ? 'competitor' : 'egal') as Winner

      setResult({
        my_store: my, competitor: them,
        verdict: {
          winner_title: wt, winner_meta: wm, winner_keywords: wk,
          overall_score_you: ms, overall_score_competitor: ts,
          summary: ms > ts ? `Scor SEO ${ms} vs ${ts}. Magazinul tău e mai bine optimizat.` : ms === ts ? `Scor egal ${ms}. Detaliile fac diferența.` : `Scor SEO ${ms} vs ${ts}. Competitorul e mai bine optimizat — aplică planul de acțiune.`,
          top_actions: them.opportunities?.slice(0, 4) || my.weaknesses?.slice(0, 4) || [],
        },
      })
      saveUrl(competitorUrl)
      setActiveTab('overview')
    } catch (e: any) { setError('Eroare: ' + e.message) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-5xl space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">Analiză Competitori</h1>
        <p className="text-[13px] text-neutral-400 mt-1">Monitorizează, compară și depășește orice competitor SEO</p>
      </div>

      {/* Input card */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-2">URL Competitor</p>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex-1 flex items-center gap-2.5 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus-within:border-neutral-400 transition-colors min-w-[200px]">
              <Globe className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
              <input
                value={inputVal} onChange={e => handleUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyze()}
                placeholder="competitor.ro sau https://competitor.ro"
                className="flex-1 text-[13px] text-neutral-800 placeholder-neutral-300 focus:outline-none bg-transparent min-w-0" />
              {inputVal && competitorUrl && inputVal !== competitorUrl && (
                <span className="text-[10px] text-neutral-400 shrink-0 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">{hn(competitorUrl)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Btn onClick={analyze} disabled={loading || !competitorUrl.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Analizez...' : 'Analizează'}
              </Btn>
            </div>
          </div>
          {error && <p className="text-[11px] text-red-500 flex items-center gap-1.5 mt-2"><XCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}

          {myUrl && (
            <p className="text-[10px] text-neutral-400 mt-2 flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              Magazinul tău: <span className="font-mono text-neutral-600">{hn(myUrl)}</span>
            </p>
          )}

          {savedUrls.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[9px] font-medium text-neutral-300 uppercase tracking-wide">Recenți</span>
              {savedUrls.map((u, i) => (
                <button key={i} onClick={() => { setInputVal(u); setCompetitorUrl(u) }}
                  className={`group flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all
                    ${competitorUrl === u ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
                  {hn(u)}
                  <span onClick={e => { e.stopPropagation(); const u2 = savedUrls.filter(x => x !== u); setSavedUrls(u2); try { localStorage.setItem('seo_competitor_urls', JSON.stringify(u2)) } catch {} }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[13px] leading-none">×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-50 bg-neutral-50 flex gap-4 flex-wrap">
          {[
            'Magazin tău: gratuit (din DB)',
            'Competitor: 3 credite',
            'Keywords gap: 2 credite',
            'Pricing & USP: 2 credite',
            'Raport Battle: 3 credite',
          ].map(t => <span key={t} className="text-[10px] text-neutral-400 font-medium">{t}</span>)}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium whitespace-nowrap transition-all shrink-0
                ${activeTab === tab.id ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'}`}>
              <Icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === 'overview'  && <TabOverview  result={result} onSteal={(f, v, c) => setStealModal({ field: f, val: v, current: c })} />}
          {activeTab === 'monitor'   && <TabMonitor   competitorUrl={competitorUrl} />}
          {activeTab === 'keywords'  && <TabKeywords  myUrl={myUrl} competitorUrl={competitorUrl} />}
          {activeTab === 'technical' && <TabTechnical myUrl={myUrl} competitorUrl={competitorUrl} />}
          {activeTab === 'pricing'   && <TabPricing   myUrl={myUrl} competitorUrl={competitorUrl} />}
          {activeTab === 'reports'   && <TabReports   myUrl={myUrl} competitorUrl={competitorUrl} result={result} />}
        </motion.div>
      </AnimatePresence>

      {/* Steal Modal */}
      <AnimatePresence>
        {stealModal && (
          <StealModal
            open={true}
            field={stealModal.field}
            myCurrent={stealModal.current}
            competitorValue={stealModal.val}
            competitorUrl={competitorUrl}
            onClose={() => setStealModal(null)}
            onApplied={val => {
              if (result && stealModal.field === 'title')            setResult(r => r ? { ...r, my_store: { ...r.my_store, title: val } } : r)
              if (result && stealModal.field === 'meta_description') setResult(r => r ? { ...r, my_store: { ...r.my_store, meta_description: val } } : r)
              setStealModal(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}