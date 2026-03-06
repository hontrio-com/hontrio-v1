'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Sparkles, Save, RotateCcw, Upload, Loader2,
  CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, ArrowRight,
  RefreshCw, Globe, Check, Copy, History, ExternalLink,
  Smartphone, Monitor, Code2, Link2, Hash,
  ChevronDown, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
type Product = {
  id: string; original_title: string; optimized_title: string | null
  original_description: string | null; optimized_short_description: string | null
  optimized_long_description: string | null; meta_description: string | null
  focus_keyword: string | null; secondary_keywords: string[] | null
  seo_score: number; seo_suggestions: string[] | null
  price: number | null; category: string | null; status: string
  external_id: string | null; original_images: string[] | null
  original_short_description: string | null
}
type SectionKey = 'title' | 'meta_description' | 'short_description' | 'long_description' | 'focus_keyword'
type SectionState = { current: string; original: string; modified: string | null; generating: boolean; saved: boolean }
type HistoryVersion = {
  id: string; label: string; created_at: string; seo_score: number
  optimized_title: string | null; meta_description: string | null; focus_keyword: string | null
}
// ─── Live SEO Score ────────────────────────────────────────────────────────────
// ─── calcLiveScore ────────────────────────────────────────────────────────────
// Identic algoritmic cu lib/seo/score.ts calculateSeoScore.
// Client component — nu poate importa direct din lib, dar logica e sincronizata.
function calcLiveScore(s: Record<SectionKey, SectionState>) {
  const title  = s.title.current.trim()
  const meta   = s.meta_description.current.trim()
  const short  = s.short_description.current.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const long   = s.long_description.current.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const kw     = s.focus_keyword.current.trim().toLowerCase()

  const tLen       = title.length
  const mLen       = meta.length
  const longWords  = long.split(/\s+/).filter(Boolean).length
  const allText    = (short + ' ' + long).toLowerCase()
  const totalWords = allText.split(/\s+/).filter(Boolean).length || 1
  const kwCount    = kw ? allText.split(kw).length - 1 : 0
  const density    = kw ? (kwCount / totalWords) * 100 : 0

  const checks = [
    { label: `Titlu 50-70 car. (${tLen})`,           pts: tLen >= 50 && tLen <= 70 ? 15 : tLen > 0 ? 7 : 0,     max: 15, ok: tLen >= 50 && tLen <= 70 },
    { label: 'Keyword în titlu',                      pts: kw && title.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0, max: 10, ok: !kw || title.toLowerCase().includes(kw) },
    { label: `Meta 120-155 car. (${mLen})`,           pts: mLen >= 120 && mLen <= 155 ? 15 : mLen > 0 ? 7 : 0,   max: 15, ok: mLen >= 120 && mLen <= 155 },
    { label: 'Keyword în meta',                       pts: kw && meta.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0, max: 10, ok: !kw || meta.toLowerCase().includes(kw) },
    { label: 'Descriere scurtă',                      pts: short.length >= 80 ? 15 : short.length > 0 ? 7 : 0,   max: 15, ok: short.length >= 80 },
    { label: `Desc. lungă 200+ cuv. (${longWords})`,  pts: longWords >= 200 ? 20 : longWords > 0 ? 8 : 0,         max: 20, ok: longWords >= 200 },
    { label: 'Focus keyword setat',                   pts: kw.length >= 2 ? 8 : 0,                                max: 8,  ok: kw.length >= 2 },
    { label: `Density ${density.toFixed(1)}% (0.5-2.5%)`, pts: density >= 0.5 && density <= 2.5 ? 7 : 0,         max: 7,  ok: density >= 0.5 && density <= 2.5 },
  ]
  return { score: Math.min(100, checks.reduce((a, c) => a + c.pts, 0)), breakdown: checks }
}

// ─── Char Counter ─────────────────────────────────────────────────────────────
function CharCounter({ value, min, max }: { value: string; min?: number; max: number }) {
  const len = value.replace(/<[^>]*>/g, '').length
  const pct = Math.min(100, (len / max) * 100)
  const over = len > max, near = len >= max * 0.85
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${over ? 'text-red-500' : near ? 'text-amber-500' : 'text-gray-400'}`}>{len}/{max}</span>
      {min && len > 0 && len < min && <span className="text-[11px] text-amber-500">min {min}</span>}
    </div>
  )
}

// ─── Google Preview ───────────────────────────────────────────────────────────
function GooglePreview({ title, description, url, mobile }: { title: string; description: string; url: string; mobile: boolean }) {
  const maxT = mobile ? 55 : 60, maxD = mobile ? 120 : 155
  const t = title || 'Titlu produs'
  const d = description || 'Meta description lipsă — Google va alege automat un snippet.'
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
        <Globe className="h-3 w-3" />Preview Google — {mobile ? 'Mobile' : 'Desktop'}
      </p>
      <div className={`${mobile ? 'max-w-[360px]' : 'max-w-full'} mx-auto`}>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold">M</div>
          magazinul-tau.ro › {url.substring(0, 30)}
        </div>
        <p className={`font-medium leading-tight ${title.length > maxT ? 'text-red-500' : 'text-blue-700'}`} style={{ fontSize: mobile ? 15 : 18 }}>
          {t.length > maxT ? t.substring(0, maxT) + '…' : t}
        </p>
        <p className="text-sm text-gray-600 leading-snug mt-0.5">
          {d.length > maxD ? d.substring(0, maxD) + '…' : d}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
        {[
          { label: `T: ${title.length}/${maxT}`, ok: title.length >= 50 && title.length <= maxT, warn: title.length > maxT },
          { label: `M: ${description.length}/${maxD}`, ok: description.length >= 120 && description.length <= maxD, warn: description.length > maxD },
        ].map((b, i) => (
          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${b.warn ? 'bg-red-50 text-red-500' : b.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{b.label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Live Score Widget ─────────────────────────────────────────────────────────
function LiveScoreWidget({ sections, collapsed, onToggle }: { sections: Record<SectionKey, SectionState>; collapsed: boolean; onToggle: () => void }) {
  const { score, breakdown } = calcLiveScore(sections)
  const c = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const textC = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
  const borderC = score >= 80 ? 'border-emerald-200' : score >= 50 ? 'border-amber-200' : 'border-red-200'
  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${borderC}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors">
        <div className="relative shrink-0 h-14 w-14">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
            <circle cx="28" cy="28" r="22" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 138.2} 138.2`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${textC}`}>{score}</span>
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900">Scor SEO live</p>
          <p className="text-xs text-gray-400">Se actualizează în timp real</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-1.5">
              {breakdown.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${b.ok ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                    {b.ok ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <span className="text-[9px] text-gray-400 font-bold">—</span>}
                  </div>
                  <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{b.label}</span>
                  <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${b.ok ? 'text-emerald-600' : 'text-gray-300'}`}>+{b.pts}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900">Total</span>
                <span className={`text-sm font-bold ${textC}`}>{score}/100</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Keyword Density ──────────────────────────────────────────────────────────
function KeywordDensity({ keyword, shortDesc, longDesc }: { keyword: string; shortDesc: string; longDesc: string }) {
  if (!keyword) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Hash className="h-3 w-3" />Keyword Density</p>
      <p className="text-xs text-gray-400">Setează un focus keyword pentru a vedea densitatea.</p>
    </div>
  )
  const kw = keyword.toLowerCase()
  const text = (shortDesc + ' ' + longDesc).replace(/<[^>]*>/g, '').toLowerCase()
  const words = text.split(/\s+/).filter(Boolean).length || 1
  const count = text.split(kw).length - 1
  const density = (count / words) * 100
  const ok = density >= 0.5 && density <= 2.5
  const low = density < 0.5
  const statusColor = ok ? 'text-emerald-600' : 'text-red-500'
  const statusBg = ok ? 'bg-emerald-50' : 'bg-red-50'
  const statusLabel = ok ? 'Ideal ✓' : low ? 'Prea puțin' : 'Prea mult'
  const inShort = shortDesc.replace(/<[^>]*>/g, '').toLowerCase().includes(kw)
  const inLong  = longDesc.replace(/<[^>]*>/g, '').toLowerCase().includes(kw)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Hash className="h-3 w-3" />Keyword Density</p>
      <div className="flex items-center gap-3 mb-3">
        <div className={`px-3 py-1.5 rounded-xl ${statusBg} shrink-0`}>
          <span className={`text-sm font-bold ${statusColor}`}>{density.toFixed(1)}%</span>
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</p>
          <p className="text-[10px] text-gray-400 truncate">"{keyword}" × {count} în {words} cuv.</p>
        </div>
      </div>
      <div className="flex gap-3 text-[10px] flex-wrap">
        <span className={`flex items-center gap-1 font-medium ${inShort ? 'text-emerald-600' : 'text-red-400'}`}>
          {inShort ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Desc. scurtă
        </span>
        <span className={`flex items-center gap-1 font-medium ${inLong ? 'text-emerald-600' : 'text-red-400'}`}>
          {inLong ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Desc. lungă
        </span>
      </div>
      {low && count > 0 && <p className="text-[10px] text-amber-600 mt-2">↑ Menționează keyword-ul mai des</p>}
      {!ok && !low && <p className="text-[10px] text-red-500 mt-2">↓ Keyword stuffing — reduce frecvența</p>}
    </div>
  )
}

// ─── Duplicate Checker ────────────────────────────────────────────────────────
function DuplicateWarning({ productId, title }: { productId: string; title: string }) {
  const [dup, setDup] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!title || title.length < 10) { setDup(null); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(title)}&per_page=10`)
        const data = await res.json()
        const found = (data.products || []).find((p: any) =>
          p.id !== productId && (p.optimized_title || p.original_title || '').toLowerCase() === title.toLowerCase()
        )
        setDup(found ? (found.optimized_title || found.original_title) : null)
      } catch {}
    }, 700)
  }, [title, productId])
  if (!dup) return null
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 mb-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span><strong>Titlu duplicat:</strong> „{dup}" — Google poate penaliza duplicate content.</span>
    </motion.div>
  )
}

// ─── Section Editor ────────────────────────────────────────────────────────────
function SectionEditor({ label, fieldKey, value, originalValue, generating, saved, onChange, onGenerate, onSave, onRevert, maxChars, minChars, isHtml, placeholder, hint, creditCost }: {
  label: string; fieldKey: SectionKey; value: string; originalValue: string; generating: boolean; saved: boolean
  onChange: (v: string) => void; onGenerate: () => void; onSave: () => void; onRevert: () => void
  maxChars?: number; minChars?: number; isHtml?: boolean; placeholder?: string; hint?: string; creditCost: number
}) {
  const hasChanges = value !== originalValue
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row — fully responsive */}
      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{label}</span>
            {saved && !hasChanges && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle className="h-3 w-3" />Salvat
              </motion.span>
            )}
            {hasChanges && !saved && <span className="text-[11px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Modificat</span>}
          </div>
          {/* Action buttons — wrap on mobile */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasChanges && originalValue && (
              <button onClick={onRevert} className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-amber-50 whitespace-nowrap">
                <RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Revert</span>
              </button>
            )}
            <button onClick={onGenerate} disabled={generating}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Generez...' : 'AI'}
              <span className="text-blue-200 text-[10px]">{creditCost}cr</span>
            </button>
            {hasChanges && (
              <button onClick={onSave}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
                <Save className="h-3.5 w-3.5" />Salvează
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">
        {hint && <p className="text-xs text-gray-400 mb-2 leading-relaxed">{hint}</p>}
        <textarea value={value} onChange={e => onChange(e.target.value)}
          rows={isHtml ? 9 : fieldKey === 'meta_description' ? 3 : fieldKey === 'short_description' ? 4 : 2}
          placeholder={placeholder}
          className={`w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-400 leading-relaxed transition-colors resize-y ${isHtml ? 'font-mono text-xs' : ''}`} />
        {maxChars && <CharCounter value={value} max={maxChars} min={minChars} />}
      </div>
    </div>
  )
}

// ─── Schema Markup ────────────────────────────────────────────────────────────
function SchemaWidget({ productId }: { productId: string }) {
  const [schema, setSchema] = useState(''); const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false); const [show, setShow] = useState(false)
  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/schema', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) })
      const data = await res.json()
      if (res.ok) { setSchema(data.json_ld); setShow(true) }
    } catch {} finally { setLoading(false) }
  }
  function copy() { navigator.clipboard.writeText(schema); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">Schema.org JSON-LD</span>
            <Badge className="text-[10px] bg-purple-50 text-purple-600 border-0 hover:bg-purple-50">Gratis</Badge>
          </div>
          <div className="flex items-center gap-2">
            {schema && (
              <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
                {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" />Copiat!</> : <><Copy className="h-3.5 w-3.5" />Copiază</>}
              </button>
            )}
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-purple-500 hover:bg-purple-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {schema ? 'Regenerează' : 'Generează'}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        {!schema && <p className="text-xs text-gray-400 leading-relaxed">Generează structured data <strong>Product + Offer</strong> — ajută Google să afișeze prețul și disponibilitatea direct în rezultate.</p>}
        {schema && show && (
          <>
            <p className="text-[11px] text-gray-400 mb-2">Adaugă în <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> sau în câmpul JSON-LD din Yoast / Rank Math.</p>
            <pre className="bg-gray-900 text-emerald-400 text-[10px] rounded-xl p-3 overflow-x-auto leading-relaxed font-mono">{schema}</pre>
            <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-2">
              <ExternalLink className="h-3 w-3" />Testează cu Google Rich Results
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Version History ──────────────────────────────────────────────────────────
function HistoryWidget({ productId, onRestore }: { productId: string; onRestore: (v: HistoryVersion) => void }) {
  const [history, setHistory] = useState<HistoryVersion[]>([]); const [loading, setLoading] = useState(false); const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/seo/history?product_id=${productId}`).then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {}).finally(() => setLoading(false))
  }, [open, productId])
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-gray-500 shrink-0" /><span className="text-sm font-semibold text-gray-800">Istoric versiuni</span></div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">
              {loading ? <div className="flex items-center gap-2 py-4 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă...</div>
                : history.length === 0 ? <p className="text-xs text-gray-400 py-3 text-center">Nicio versiune. Se creează automat la fiecare generare AI.</p>
                : (
                  <div className="space-y-1.5">
                    {history.map(v => (
                      <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{v.optimized_title || v.label}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{new Date(v.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            {v.seo_score > 0 && <span className={`text-[10px] font-semibold ${v.seo_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>SEO {v.seo_score}</span>}
                          </div>
                        </div>
                        <button onClick={() => onRestore(v)} className="text-[10px] font-medium text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                          Restaurează
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Internal Linking ─────────────────────────────────────────────────────────
function InternalLinkSuggestions({ productId, longDesc, category }: { productId: string; longDesc: string; category: string | null }) {
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; reason: string }[]>([])
  const [loading, setLoading] = useState(false); const [done, setDone] = useState(false)
  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products?per_page=20${category ? `&category=${encodeURIComponent(category)}` : ''}`)
      const data = await res.json()
      const others = (data.products || []).filter((p: any) => p.id !== productId).slice(0, 12)
      const text = longDesc.replace(/<[^>]*>/g, '').toLowerCase()
      const scored = others.map((p: any) => {
        const t = (p.optimized_title || p.original_title || '').toLowerCase()
        const words = t.split(/\s+/).filter((w: string) => w.length > 4)
        const matches = words.filter((w: string) => text.includes(w)).length
        return { id: p.id, title: p.optimized_title || p.original_title, score: matches }
      }).sort((a: any, b: any) => b.score - a.score).slice(0, 5)
        .map((p: any) => ({ id: p.id, title: p.title, reason: p.score > 0 ? 'Cuvinte comune în descriere' : `Aceeași categorie: ${category}` }))
      setSuggestions(scored); setDone(true)
    } catch {} finally { setLoading(false) }
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">Linkuri interne sugerate</span>
            <Badge className="text-[10px] bg-teal-50 text-teal-600 border-0 hover:bg-teal-50">Gratis</Badge>
          </div>
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {done ? 'Reîncarcă' : 'Sugerează'}
          </button>
        </div>
      </div>
      <div className="p-4">
        {!done && !loading && <p className="text-xs text-gray-400 leading-relaxed">Analizează descrierea și sugerează produse din catalog care pot fi linkuite natural.</p>}
        {loading && <div className="flex items-center gap-2 py-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Analizez...</div>}
        {done && suggestions.length === 0 && <p className="text-xs text-gray-400">Nicio sugestie. Completează descrierea lungă pentru rezultate mai bune.</p>}
        {done && suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 bg-teal-50/60 rounded-xl">
                <Link2 className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{s.title}</p>
                  <p className="text-[10px] text-teal-600">{s.reason}</p>
                </div>
                <Link href={`/seo/${s.id}`} target="_blank" className="text-[10px] text-teal-500 hover:text-teal-700 font-medium px-2 py-1 rounded hover:bg-teal-100 transition-colors shrink-0">Deschide</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── HTML Preview ─────────────────────────────────────────────────────────────
function LongDescPreview({ html }: { html: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mt-2">
      <button onClick={() => setShow(!show)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{show ? 'Ascunde preview' : 'Preview HTML randat'}
      </button>
      <AnimatePresence>
        {show && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductSEOPage() {
  const params = useParams(); const router = useRouter()
  const productId = params.id as string
  const [product, setProduct] = useState<Product | null>(null); const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false); const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false); const [credits, setCredits] = useState<number | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [scoreCollapsed, setScoreCollapsed] = useState(false)
  const [activeTab] = useState<'editor'>('editor')

  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    title:             { current: '', original: '', modified: null, generating: false, saved: false },
    meta_description:  { current: '', original: '', modified: null, generating: false, saved: false },
    short_description: { current: '', original: '', modified: null, generating: false, saved: false },
    long_description:  { current: '', original: '', modified: null, generating: false, saved: false },
    focus_keyword:     { current: '', original: '', modified: null, generating: false, saved: false },
  })

  useEffect(() => { loadProduct() }, [productId])

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${productId}`)
      const data = await res.json()
      if (!res.ok) { router.push('/seo'); return }
      const p: Product = data.product
      setProduct(p)
      setSections({
        title:             { current: p.optimized_title || p.original_title || '', original: p.original_title || '', modified: null, generating: false, saved: !!p.optimized_title },
        meta_description:  { current: p.meta_description || '', original: '', modified: null, generating: false, saved: !!p.meta_description },
        short_description: { current: p.optimized_short_description || p.original_short_description || '', original: p.original_short_description || '', modified: null, generating: false, saved: !!p.optimized_short_description },
        long_description:  { current: p.optimized_long_description || p.original_description || '', original: p.original_description || '', modified: null, generating: false, saved: !!p.optimized_long_description },
        focus_keyword:     { current: p.focus_keyword || '', original: '', modified: null, generating: false, saved: !!p.focus_keyword },
      })
    } catch { router.push('/seo') } finally { setLoading(false) }
  }

  function upd(key: SectionKey, patch: Partial<SectionState>) { setSections(prev => ({ ...prev, [key]: { ...prev[key], ...patch } })) }
  function handleChange(key: SectionKey, value: string) { upd(key, { current: value, modified: value, saved: false }) }

  async function saveSnapshot(label: string) {
    try {
      await fetch('/api/seo/history', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, label, snapshot: {
          optimized_title: sections.title.current, meta_description: sections.meta_description.current,
          optimized_short_description: sections.short_description.current, optimized_long_description: sections.long_description.current,
          focus_keyword: sections.focus_keyword.current, seo_score: calcLiveScore(sections).score,
        }}),
      })
    } catch {}
  }

  async function handleGenerate(section: SectionKey) {
    upd(section, { generating: true })
    try {
      const res = await fetch('/api/seo/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, section }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Eroare'); return }
      const r = data.result
      const map: Record<SectionKey, string> = { title: r.optimized_title || '', meta_description: r.meta_description || '', short_description: r.optimized_short_description || '', long_description: r.optimized_long_description || '', focus_keyword: r.focus_keyword || '' }
      upd(section, { current: map[section], modified: map[section], saved: false })
      if (data.credits_remaining !== undefined) setCredits(data.credits_remaining)
    } catch { alert('Eroare la conexiune') } finally { upd(section, { generating: false }) }
  }

  async function handleGenerateAll() {
    setGeneratingAll(true)
    await saveSnapshot('Înainte de Generare tot')
    try {
      const res = await fetch('/api/seo/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, section: 'all' }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Eroare'); return }
      const r = data.result
      setSections(prev => ({
        title:             { ...prev.title,             current: r.optimized_title || prev.title.current,                         modified: r.optimized_title, saved: false },
        meta_description:  { ...prev.meta_description,  current: r.meta_description || prev.meta_description.current,             modified: r.meta_description, saved: false },
        short_description: { ...prev.short_description, current: r.optimized_short_description || prev.short_description.current, modified: r.optimized_short_description, saved: false },
        long_description:  { ...prev.long_description,  current: r.optimized_long_description || prev.long_description.current,   modified: r.optimized_long_description, saved: false },
        focus_keyword:     { ...prev.focus_keyword,     current: r.focus_keyword || prev.focus_keyword.current,                   modified: r.focus_keyword, saved: false },
      }))
      if (data.credits_remaining !== undefined) setCredits(data.credits_remaining)
    } catch { alert('Eroare la conexiune') } finally { setGeneratingAll(false) }
  }

  async function handleSave(section: SectionKey) {
    const fieldMap: Record<SectionKey, string> = { title: 'optimized_title', meta_description: 'meta_description', short_description: 'optimized_short_description', long_description: 'optimized_long_description', focus_keyword: 'focus_keyword' }
    try {
      const res = await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, fields: { [fieldMap[section]]: sections[section].current } }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      upd(section, { saved: true, modified: null, original: sections[section].current })
    } catch { alert('Eroare la salvare') }
  }

  async function handleSaveAll() {
    const fieldMap: Record<SectionKey, string> = { title: 'optimized_title', meta_description: 'meta_description', short_description: 'optimized_short_description', long_description: 'optimized_long_description', focus_keyword: 'focus_keyword' }
    const fields: Record<string, string> = {}
    for (const [k, s] of Object.entries(sections)) { if (s.current.trim()) fields[fieldMap[k as SectionKey]] = s.current }
    try {
      const res = await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, fields }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setSections(prev => { const n = { ...prev }; for (const k of Object.keys(n) as SectionKey[]) n[k] = { ...n[k], saved: true, modified: null }; return n })
    } catch { alert('Eroare la salvare') }
  }

  async function handleRevert(section: SectionKey) {
    const fieldMap: Record<SectionKey, string> = { title: 'optimized_title', meta_description: 'meta_description', short_description: 'optimized_short_description', long_description: 'optimized_long_description', focus_keyword: 'focus_keyword' }
    const origMap: Record<SectionKey, string> = { title: product?.original_title || '', meta_description: '', short_description: product?.original_description?.replace(/<[^>]*>/g, '').substring(0, 300) || '', long_description: product?.original_description || '', focus_keyword: '' }
    try {
      await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, action: 'revert', field: fieldMap[section] }) })
      upd(section, { current: origMap[section], modified: null, saved: false })
    } catch { alert('Eroare la revert') }
  }

  async function handlePublish() {
    setPublishing(true); setPublishResult(null)
    try {
      await handleSaveAll()
      const res = await fetch(`/api/products/${productId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setPublishResult({ error: data.error }); return }
      setPublishResult({ success: true })
    } catch { setPublishResult({ error: 'Eroare la publicare' }) } finally { setPublishing(false) }
  }

  function handleRestoreVersion(v: HistoryVersion) {
    setSections(prev => ({
      ...prev,
      title:            { ...prev.title,            current: v.optimized_title || prev.title.current, modified: v.optimized_title, saved: false },
      meta_description: { ...prev.meta_description, current: v.meta_description || prev.meta_description.current, modified: v.meta_description, saved: false },
      focus_keyword:    { ...prev.focus_keyword,    current: v.focus_keyword || prev.focus_keyword.current, modified: v.focus_keyword, saved: false },
    }))
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
  if (!product) return null

  const anyUnsaved = Object.values(sections).some(s => s.modified !== null)
  const liveScore  = calcLiveScore(sections).score
  const scoreColor = liveScore >= 80 ? 'text-emerald-600' : liveScore >= 50 ? 'text-amber-600' : liveScore > 0 ? 'text-red-500' : 'text-gray-400'
  const previewUrl = product.category ? `${product.category}/${(product.original_title || '').toLowerCase().replace(/\s+/g, '-').substring(0, 30)}` : 'produs'

  return (
    <div className="space-y-4 max-w-5xl">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/seo" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3">
          <ChevronLeft className="h-4 w-4" />Înapoi la SEO
        </Link>

        {/* Title + actions — responsive */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 truncate">{product.optimized_title || product.original_title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {product.category && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{product.category}</span>}
              {product.focus_keyword && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{product.focus_keyword}</span>}
              <span className={`text-xs font-bold ${scoreColor} bg-gray-50 px-2.5 py-0.5 rounded-full`}>SEO Live: {liveScore}/100</span>
            </div>
          </div>

          {/* Action buttons — wrap properly on mobile */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {anyUnsaved && (
              <Button onClick={handleSaveAll} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1.5 h-8 text-xs">
                <Save className="h-3.5 w-3.5" />Salvează tot
              </Button>
            )}
            <Button onClick={handleGenerateAll} disabled={generatingAll} size="sm" variant="outline"
              className="rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 h-8 text-xs">
              {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{generatingAll ? 'Generez...' : 'Generează tot'}</span>
              <span className="sm:hidden">{generatingAll ? '...' : 'AI tot'}</span>
              <span className="text-blue-300 text-[10px]">5cr</span>
            </Button>
            <Button onClick={handlePublish} disabled={publishing} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl gap-1.5 h-8 text-xs">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{publishing ? 'Publicare...' : 'Publică în magazin'}</span>
              <span className="sm:hidden">{publishing ? '...' : 'Publică'}</span>
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {publishResult && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${publishResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {publishResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {publishResult.success ? 'Publicat cu succes în WooCommerce!' : publishResult.error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── EDITOR TAB ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: editors */}
          <div className="lg:col-span-2 space-y-4">

            {/* Preview toggle */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                  {[{ id: 'desktop', icon: Monitor }, { id: 'mobile', icon: Smartphone }].map(m => (
                    <button key={m.id} onClick={() => setPreviewMode(m.id as any)}
                      className={`p-1.5 rounded-md transition-all ${previewMode === m.id ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                      <m.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">Preview {previewMode === 'mobile' ? 'mobil (55/120 car.)' : 'desktop (60/155 car.)'}</span>
              </div>
              <GooglePreview title={sections.title.current} description={sections.meta_description.current} url={previewUrl} mobile={previewMode === 'mobile'} />
            </motion.div>

            {/* SEO Suggestions */}
            {product.seo_suggestions && product.seo_suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Sugestii SEO</p>
                  <ul className="space-y-1.5">
                    {product.seo_suggestions.map((s, i) => <li key={i} className="flex items-start gap-2 text-xs text-amber-700"><ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s}</li>)}
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Section editors */}
            {([
              { key: 'title', label: 'Titlu SEO (Title Tag)', maxChars: 70, minChars: 50, placeholder: 'Titlu optimizat — 50-70 caractere', hint: 'Apare în Google și tab browser. Include keyword-ul principal în primele cuvinte.', creditCost: 1 },
              { key: 'meta_description', label: 'Meta Description', maxChars: 155, minChars: 120, placeholder: 'Meta description — max 155 car., include CTA', hint: 'Apare sub titlu în Google. Crește CTR cu un beneficiu clar și CTA.', creditCost: 1 },
              { key: 'focus_keyword', label: 'Focus Keyword', maxChars: 60, placeholder: 'ex: mop spin inox, tricou bumbac organic', hint: 'Query-ul principal al cumpărătorilor. 2-4 cuvinte, natural și specific.', creditCost: 1 },
              { key: 'short_description', label: 'Descriere Scurtă', maxChars: 350, minChars: 80, placeholder: 'Descriere scurtă — apare înainte de butonul Adaugă în coș', hint: '2-4 propoziții care conving clientul. Structura HTML existentă e păstrată.', creditCost: 2, isHtml: /<[a-z][\s\S]*>/i.test(sections.short_description.current) },
              { key: 'long_description', label: 'Descriere Lungă (HTML)', placeholder: '<h3>Titlu</h3><p>Conținut...</p>', hint: 'Editor HTML. Structura existentă e PĂSTRATĂ — AI optimizează textul, nu tagurile.', creditCost: 2, isHtml: true },
            ] as any[]).map((cfg, i) => (
              <motion.div key={cfg.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
                {cfg.key === 'title' && <DuplicateWarning productId={productId} title={sections.title.current} />}
                <SectionEditor
                  label={cfg.label} fieldKey={cfg.key as SectionKey}
                  value={sections[cfg.key as SectionKey].current} originalValue={sections[cfg.key as SectionKey].original}
                  generating={sections[cfg.key as SectionKey].generating} saved={sections[cfg.key as SectionKey].saved}
                  onChange={v => handleChange(cfg.key, v)} onGenerate={() => handleGenerate(cfg.key)}
                  onSave={() => handleSave(cfg.key)} onRevert={() => handleRevert(cfg.key)}
                  maxChars={cfg.maxChars} minChars={cfg.minChars} isHtml={cfg.isHtml}
                  placeholder={cfg.placeholder} hint={cfg.hint} creditCost={cfg.creditCost}
                />
                {cfg.key === 'focus_keyword' && product.secondary_keywords && product.secondary_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1 mt-2">
                    <span className="text-xs text-gray-400">Keywords secundare:</span>
                    {product.secondary_keywords.map((kw, ki) => <span key={ki} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{kw}</span>)}
                  </div>
                )}
                {cfg.key === 'long_description' && sections.long_description.current && <LongDescPreview html={sections.long_description.current} />}
              </motion.div>
            ))}
          </div>

          {/* Right: widgets — cleaner, no competitor */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <LiveScoreWidget sections={sections} collapsed={scoreCollapsed} onToggle={() => setScoreCollapsed(!scoreCollapsed)} />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <KeywordDensity keyword={sections.focus_keyword.current} shortDesc={sections.short_description.current} longDesc={sections.long_description.current} />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <HistoryWidget productId={productId} onRestore={handleRestoreVersion} />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <SchemaWidget productId={productId} />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <InternalLinkSuggestions productId={productId} longDesc={sections.long_description.current} category={product.category} />
            </motion.div>
          </div>
        </div>

      {/* ── Sticky bottom bar ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="sticky bottom-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm min-w-0">
            {anyUnsaved
              ? <span className="text-blue-600 font-medium text-xs sm:text-sm">Modificări nesalvate</span>
              : <span className="text-emerald-600 font-medium flex items-center gap-1.5 text-xs sm:text-sm"><CheckCircle className="h-4 w-4 shrink-0" />Totul salvat</span>
            }
            {credits !== null && <span className="text-xs text-gray-400 ml-2">Credite: {credits}</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            {anyUnsaved && (
              <Button onClick={handleSaveAll} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl gap-1.5 h-8 text-xs">
                <Save className="h-3.5 w-3.5" /><span className="hidden sm:inline">Salvează tot</span><span className="sm:hidden">Salvează</span>
              </Button>
            )}
            <Button onClick={handlePublish} disabled={publishing} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl gap-1.5 h-8 text-xs">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{publishing ? 'Publicare...' : 'Publică în magazin'}</span>
              <span className="sm:hidden">Publică</span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}