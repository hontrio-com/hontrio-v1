'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Sparkles, Save, RotateCcw, Upload, Loader2,
  CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, ArrowRight,
  RefreshCw, Globe, Check, Copy, History, ExternalLink,
  Smartphone, Monitor, Code2, Link2, Hash, ChevronDown, Clock,
} from 'lucide-react'
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

// ─── Live Score ───────────────────────────────────────────────────────────────

function calcLiveScore(s: Record<SectionKey, SectionState>) {
  const title     = s.title.current.trim()
  const meta      = s.meta_description.current.trim()
  const short     = s.short_description.current.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const long      = s.long_description.current.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const kw        = s.focus_keyword.current.trim().toLowerCase()
  const tLen      = title.length
  const mLen      = meta.length
  const longWords = long.split(/\s+/).filter(Boolean).length
  const allText   = (short + ' ' + long).toLowerCase()
  const totalWords = allText.split(/\s+/).filter(Boolean).length || 1
  const kwCount   = kw ? allText.split(kw).length - 1 : 0
  const density   = kw ? (kwCount / totalWords) * 100 : 0
  const checks = [
    { label: `Titlu 50-70 car. (${tLen})`,            pts: tLen >= 50 && tLen <= 70 ? 15 : tLen > 0 ? 7 : 0,      max: 15, ok: tLen >= 50 && tLen <= 70 },
    { label: 'Keyword în titlu',                       pts: kw && title.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0, max: 10, ok: !kw || title.toLowerCase().includes(kw) },
    { label: `Meta 120-155 car. (${mLen})`,            pts: mLen >= 120 && mLen <= 155 ? 15 : mLen > 0 ? 7 : 0,    max: 15, ok: mLen >= 120 && mLen <= 155 },
    { label: 'Keyword în meta',                        pts: kw && meta.toLowerCase().includes(kw) ? 10 : !kw ? 5 : 0, max: 10, ok: !kw || meta.toLowerCase().includes(kw) },
    { label: 'Descriere scurtă',                       pts: short.length >= 80 ? 15 : short.length > 0 ? 7 : 0,    max: 15, ok: short.length >= 80 },
    { label: `Desc. lungă 200+ cuv. (${longWords})`,   pts: longWords >= 200 ? 20 : longWords > 0 ? 8 : 0,          max: 20, ok: longWords >= 200 },
    { label: 'Focus keyword setat',                    pts: kw.length >= 2 ? 8 : 0,                                 max: 8,  ok: kw.length >= 2 },
    { label: `Density ${density.toFixed(1)}% (0.5-2.5%)`, pts: density >= 0.5 && density <= 2.5 ? 7 : 0,          max: 7,  ok: density >= 0.5 && density <= 2.5 },
  ]
  return { score: Math.min(100, checks.reduce((a, c) => a + c.pts, 0)), breakdown: checks }
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost' | 'success'; size?: 'sm' | 'md'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const variants = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ─── Char Counter ─────────────────────────────────────────────────────────────

function CharCounter({ value, min, max }: { value: string; min?: number; max: number }) {
  const len  = value.replace(/<[^>]*>/g, '').length
  const pct  = Math.min(100, (len / max) * 100)
  const over = len > max
  const near = len >= max * 0.85
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : near ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${over ? 'text-red-500' : near ? 'text-amber-500' : 'text-neutral-400'}`}>{len}/{max}</span>
      {min && len > 0 && len < min && <span className="text-[11px] text-amber-500">min {min}</span>}
    </div>
  )
}

// ─── Google Preview ───────────────────────────────────────────────────────────

function GooglePreview({ title, description, url, mobile }: { title: string; description: string; url: string; mobile: boolean }) {
  const { t } = useT()
  const maxT = mobile ? 55 : 60
  const maxD = mobile ? 120 : 155
  const t = title || t('seo.field_title')
  const d = description || 'Meta description lipsă — Google va alege automat un snippet.'
  return (
    <Card className="p-4">
      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
        <Globe className="h-3 w-3" />Preview Google — {mobile ? 'Mobile' : 'Desktop'}
      </p>
      <div className={`${mobile ? 'max-w-[360px]' : 'max-w-full'} mx-auto`}>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
          <div className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-bold text-neutral-600">M</div>
          magazinul-tau.ro › {url.substring(0, 30)}
        </div>
        <p className={`font-medium leading-tight ${title.length > maxT ? 'text-red-500' : 'text-neutral-900'}`} style={{ fontSize: mobile ? 15 : 17 }}>
          {t.length > maxT ? t.substring(0, maxT) + '…' : t}
        </p>
        <p className="text-[13px] text-neutral-500 leading-snug mt-0.5">
          {d.length > maxD ? d.substring(0, maxD) + '…' : d}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100 flex-wrap">
        {[
          { label: `T: ${title.length}/${maxT}`, ok: title.length >= 50 && title.length <= maxT, warn: title.length > maxT },
          { label: `M: ${description.length}/${maxD}`, ok: description.length >= 120 && description.length <= maxD, warn: description.length > maxD },
        ].map((b, i) => (
          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium
            ${b.warn ? 'bg-red-50 text-red-500' : b.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {b.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

// ─── Live Score Widget ────────────────────────────────────────────────────────

function LiveScoreWidget({ sections, collapsed, onToggle }: {
  const { t } = useT()
  sections: Record<SectionKey, SectionState>; collapsed: boolean; onToggle: () => void
}) {
  const { score, breakdown } = calcLiveScore(sections)
  const c      = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const textC  = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
  const borderC = score >= 80 ? 'border-emerald-200' : score >= 50 ? 'border-amber-200' : 'border-red-200'
  return (
    <Card className={`overflow-hidden border-2 ${borderC}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors">
        <div className="relative shrink-0 h-14 w-14">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#f5f5f5" strokeWidth="5" />
            <circle cx="28" cy="28" r="22" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 138.2} 138.2`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[14px] font-black tabular-nums ${textC}`}>{score}</span>
          </div>
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-semibold text-neutral-900">{t('seo.live_seo_score')}</p>
          <p className="text-[12px] text-neutral-400">Se actualizează în timp real</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 border-t border-neutral-100">
              <div className="pt-3 space-y-1.5">
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${b.ok ? 'bg-emerald-100' : 'bg-neutral-100'}`}>
                      {b.ok
                        ? <Check className="h-2.5 w-2.5 text-emerald-600" />
                        : <span className="text-[9px] text-neutral-400 font-bold">—</span>}
                    </div>
                    <span className="text-[11px] text-neutral-600 flex-1 min-w-0 truncate">{b.label}</span>
                    <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${b.ok ? 'text-emerald-600' : 'text-neutral-300'}`}>+{b.pts}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-neutral-900">Total</span>
                <span className={`text-[14px] font-black tabular-nums ${textC}`}>{score}/100</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

// ─── Keyword Density ──────────────────────────────────────────────────────────

function KeywordDensity({ keyword, shortDesc, longDesc }: { keyword: string; shortDesc: string; longDesc: string }) {
  if (!keyword) return (
    <Card className="p-4">
      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Hash className="h-3 w-3" />Keyword Density</p>
      <p className="text-[12px] text-neutral-400">Setează un focus keyword pentru a vedea densitatea.</p>
    </Card>
  )
  const kw      = keyword.toLowerCase()
  const text    = (shortDesc + ' ' + longDesc).replace(/<[^>]*>/g, '').toLowerCase()
  const words   = text.split(/\s+/).filter(Boolean).length || 1
  const count   = text.split(kw).length - 1
  const density = (count / words) * 100
  const ok      = density >= 0.5 && density <= 2.5
  const low     = density < 0.5
  const inShort = shortDesc.replace(/<[^>]*>/g, '').toLowerCase().includes(kw)
  const inLong  = longDesc.replace(/<[^>]*>/g, '').toLowerCase().includes(kw)
  return (
    <Card className="p-4">
      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Hash className="h-3 w-3" />Keyword Density</p>
      <div className="flex items-center gap-3 mb-3">
        <div className={`px-3 py-1.5 rounded-xl shrink-0 ${ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <span className={`text-[14px] font-bold tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>{density.toFixed(1)}%</span>
        </div>
        <div className="min-w-0">
          <p className={`text-[12px] font-semibold ${ok ? 'text-emerald-600' : 'text-red-500'}`}>{ok ? 'Ideal ✓' : low ? 'Prea puțin' : 'Prea mult'}</p>
          <p className="text-[10px] text-neutral-400 truncate">"{keyword}" × {count} în {words} cuv.</p>
        </div>
      </div>
      <div className="flex gap-3 text-[11px] flex-wrap">
        <span className={`flex items-center gap-1 font-medium ${inShort ? 'text-emerald-600' : 'text-red-400'}`}>
          {inShort ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Desc. scurtă
        </span>
        <span className={`flex items-center gap-1 font-medium ${inLong ? 'text-emerald-600' : 'text-red-400'}`}>
          {inLong ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Desc. lungă
        </span>
      </div>
      {low && count > 0 && <p className="text-[10px] text-amber-600 mt-2">↑ Menționează keyword-ul mai des</p>}
      {!ok && !low && <p className="text-[10px] text-red-500 mt-2">↓ Keyword stuffing — reduce frecvența</p>}
    </Card>
  )
}

// ─── Duplicate Warning ────────────────────────────────────────────────────────

function DuplicateWarning({ productId, title }: { productId: string; title: string }) {
  const { t } = useT()
  const [dup, setDup] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!title || title.length < 10) { setDup(null); return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/products?search=${encodeURIComponent(title)}&per_page=10`)
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
      className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-[12px] text-amber-700 mb-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span><strong>{t('seo.duplicate_title')}:</strong> „{dup}" — Google poate penaliza duplicate content.</span>
    </motion.div>
  )
}

// ─── Section Editor ───────────────────────────────────────────────────────────

function SectionEditor({ label, fieldKey, value, originalValue, generating, saved, onChange, onGenerate, onSave, onRevert, maxChars, minChars, isHtml, placeholder, hint, creditCost }: {
  label: string; fieldKey: SectionKey; value: string; originalValue: string
  generating: boolean; saved: boolean
  onChange: (v: string) => void; onGenerate: () => void; onSave: () => void; onRevert: () => void
  maxChars?: number; minChars?: number; isHtml?: boolean; placeholder?: string; hint?: string; creditCost: number
}) {
  const hasChanges = value !== originalValue
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-neutral-800">{label}</span>
            {saved && !hasChanges && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle className="h-2.5 w-2.5" />Salvat
              </motion.span>
            )}
            {hasChanges && !saved && <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full font-medium">Modificat</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasChanges && originalValue && (
              <Btn variant="ghost" size="sm" onClick={onRevert}>
                <RotateCcw className="h-3 w-3" />Revert
              </Btn>
            )}
            <Btn variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generating ? 'Generez...' : 'AI'}
              <span className="text-neutral-300 text-[9px]">{creditCost}cr</span>
            </Btn>
            {hasChanges && (
              <Btn variant="success" size="sm" onClick={onSave}>
                <Save className="h-3 w-3" />Salvează
              </Btn>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">
        {hint && <p className="text-[11px] text-neutral-400 mb-2 leading-relaxed">{hint}</p>}
        <textarea value={value} onChange={e => onChange(e.target.value)}
          rows={isHtml ? 9 : fieldKey === 'meta_description' ? 3 : fieldKey === 'short_description' ? 4 : 2}
          placeholder={placeholder}
          className={`w-full text-[13px] text-neutral-700 border border-neutral-200 rounded-xl p-3 focus:outline-none focus:border-neutral-400 leading-relaxed transition-colors resize-y ${isHtml ? 'font-mono text-[11px]' : ''}`} />
        {maxChars && <CharCounter value={value} max={maxChars} min={minChars} />}
      </div>
    </Card>
  )
}

// ─── Schema Widget ────────────────────────────────────────────────────────────

function SchemaWidget({ productId }: { productId: string }) {
  const { t } = useT()
  const [schema, setSchema]   = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [show, setShow]       = useState(false)
  async function generate() {
    setLoading(true)
    try {
      const res  = await fetch('/api/seo/schema', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) })
      const data = await res.json()
      if (res.ok) { setSchema(data.json_ld); setShow(true) }
    } catch {} finally { setLoading(false) }
  }
  function copy() { navigator.clipboard.writeText(schema); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-[13px] font-semibold text-neutral-800">Schema.org JSON-LD</span>
            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-medium">Gratis</span>
          </div>
          <div className="flex items-center gap-2">
            {schema && (
              <Btn variant="ghost" size="sm" onClick={copy}>
                {copied ? <><Check className="h-3 w-3 text-emerald-500" />{t('common.copied_label')}</> : <><Copy className="h-3 w-3" />{t('common.copy_label')}</>}
              </Btn>
            )}
            <Btn variant="outline" size="sm" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {schema ? t('common.regenerate_label') : t('common.generate_label')}
            </Btn>
          </div>
        </div>
      </div>
      <div className="p-4">
        {!schema && <p className="text-[12px] text-neutral-400 leading-relaxed">Generează structured data <strong>Product + Offer</strong> — ajută Google să afișeze prețul și disponibilitatea direct în rezultate.</p>}
        {schema && show && (
          <>
            <p className="text-[11px] text-neutral-400 mb-2">Adaugă în <code className="bg-neutral-100 px-1 rounded text-neutral-600">&lt;head&gt;</code> sau în câmpul JSON-LD din Yoast / Rank Math.</p>
            <pre className="bg-neutral-900 text-emerald-400 text-[10px] rounded-xl p-3 overflow-x-auto leading-relaxed font-mono">{schema}</pre>
            <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener"
              className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-700 mt-2 transition-colors">
              <ExternalLink className="h-3 w-3" />Testează cu Google Rich Results
            </a>
          </>
        )}
      </div>
    </Card>
  )
}

// ─── History Widget ───────────────────────────────────────────────────────────

function HistoryWidget({ productId, onRestore }: { productId: string; onRestore: (v: HistoryVersion) => void }) {
  const [history, setHistory] = useState<HistoryVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/seo/history?product_id=${productId}`).then(r => r.json()).then(d => setHistory(d.history || [])).catch(() => {}).finally(() => setLoading(false))
  }, [open, productId])
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className="text-[13px] font-semibold text-neutral-800">Istoric versiuni</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-neutral-100">
              {loading
                ? <div className="flex items-center gap-2 py-4 text-[12px] text-neutral-400"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă...</div>
                : history.length === 0
                  ? <p className="text-[11px] text-neutral-400 py-3 text-center">Nicio versiune. Se creează automat la fiecare generare AI.</p>
                  : (
                    <div className="space-y-1 pt-2">
                      {history.map(v => (
                        <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-neutral-800 truncate">{v.optimized_title || v.label}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-neutral-400 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{new Date(v.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {v.seo_score > 0 && <span className={`text-[10px] font-semibold ${v.seo_score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>SEO {v.seo_score}</span>}
                            </div>
                          </div>
                          <button onClick={() => onRestore(v)}
                            className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 px-2 py-1 rounded-lg hover:bg-neutral-100 transition-colors shrink-0 opacity-0 group-hover:opacity-100">
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
    </Card>
  )
}

// ─── Internal Links ───────────────────────────────────────────────────────────

function InternalLinkSuggestions({ productId, longDesc, category }: { productId: string; longDesc: string; category: string | null }) {
  const [suggestions, setSuggestions] = useState<{ id: string; title: string; reason: string }[]>([])
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  async function generate() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/products?per_page=20${category ? `&category=${encodeURIComponent(category)}` : ''}`)
      const data = await res.json()
      const others = (data.products || []).filter((p: any) => p.id !== productId).slice(0, 12)
      const text  = longDesc.replace(/<[^>]*>/g, '').toLowerCase()
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
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-[13px] font-semibold text-neutral-800">Linkuri interne sugerate</span>
            <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-medium">Gratis</span>
          </div>
          <Btn variant="outline" size="sm" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {done ? 'Reîncarcă' : 'Sugerează'}
          </Btn>
        </div>
      </div>
      <div className="p-4">
        {!done && !loading && <p className="text-[12px] text-neutral-400 leading-relaxed">Analizează descrierea și sugerează produse din catalog care pot fi linkuite natural.</p>}
        {loading && <div className="flex items-center gap-2 py-2 text-[12px] text-neutral-400"><Loader2 className="h-4 w-4 animate-spin" />Analizez...</div>}
        {done && suggestions.length === 0 && <p className="text-[12px] text-neutral-400">Nicio sugestie. Completează descrierea lungă pentru rezultate mai bune.</p>}
        {done && suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-xl">
                <Link2 className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-neutral-800 truncate">{s.title}</p>
                  <p className="text-[10px] text-neutral-400">{s.reason}</p>
                </div>
                <Link href={`/seo/${s.id}`} target="_blank"
                  className="text-[10px] font-medium text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded hover:bg-neutral-200 transition-colors shrink-0">
                  Deschide
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── HTML Preview ─────────────────────────────────────────────────────────────

function LongDescPreview({ html }: { html: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mt-2">
      <button onClick={() => setShow(!show)} className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors px-1">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {show ? 'Ascunde preview' : 'Preview HTML randat'}
      </button>
      <AnimatePresence>
        {show && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-2 bg-white border border-neutral-200 rounded-xl p-5 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductSEOPage() {
  const { t } = useT()
  const params    = useParams()
  const router    = useRouter()
  const productId = params.id as string

  const [product, setProduct]             = useState<Product | null>(null)
  const [loading, setLoading]             = useState(true)
  const [publishing, setPublishing]       = useState(false)
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [credits, setCredits]             = useState<number | null>(null)
  const [previewMode, setPreviewMode]     = useState<'desktop' | 'mobile'>('desktop')
  const [scoreCollapsed, setScoreCollapsed] = useState(false)

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
      const res  = await fetch(`/api/products/${productId}`)
      const data = await res.json()
      if (!res.ok) { router.push('/seo'); return }
      const p: Product = data.product
      setProduct(p)
      setSections({
        title:             { current: p.optimized_title || p.original_title || '',                        original: p.original_title || '',               modified: null, generating: false, saved: !!p.optimized_title },
        meta_description:  { current: p.meta_description || '',                                           original: '',                                   modified: null, generating: false, saved: !!p.meta_description },
        short_description: { current: p.optimized_short_description || p.original_short_description || '', original: p.original_short_description || '',  modified: null, generating: false, saved: !!p.optimized_short_description },
        long_description:  { current: p.optimized_long_description || p.original_description || '',       original: p.original_description || '',         modified: null, generating: false, saved: !!p.optimized_long_description },
        focus_keyword:     { current: p.focus_keyword || '',                                              original: '',                                   modified: null, generating: false, saved: !!p.focus_keyword },
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
      const res  = await fetch('/api/seo/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, section }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || t('common.error_generic')); return }
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
      const res  = await fetch('/api/seo/optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, section: 'all' }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Eroare'); return }
      const r = data.result
      setSections(prev => ({
        title:             { ...prev.title,             current: r.optimized_title || prev.title.current,                         modified: r.optimized_title,                saved: false },
        meta_description:  { ...prev.meta_description,  current: r.meta_description || prev.meta_description.current,             modified: r.meta_description,               saved: false },
        short_description: { ...prev.short_description, current: r.optimized_short_description || prev.short_description.current, modified: r.optimized_short_description,    saved: false },
        long_description:  { ...prev.long_description,  current: r.optimized_long_description || prev.long_description.current,   modified: r.optimized_long_description,     saved: false },
        focus_keyword:     { ...prev.focus_keyword,     current: r.focus_keyword || prev.focus_keyword.current,                   modified: r.focus_keyword,                  saved: false },
      }))
      if (data.credits_remaining !== undefined) setCredits(data.credits_remaining)
    } catch { alert('Eroare la conexiune') } finally { setGeneratingAll(false) }
  }

  async function handleSave(section: SectionKey) {
    const fieldMap: Record<SectionKey, string> = { title: 'optimized_title', meta_description: 'meta_description', short_description: 'optimized_short_description', long_description: 'optimized_long_description', focus_keyword: 'focus_keyword' }
    try {
      const res  = await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, fields: { [fieldMap[section]]: sections[section].current } }) })
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
      const res  = await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, fields }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setSections(prev => { const n = { ...prev }; for (const k of Object.keys(n) as SectionKey[]) n[k] = { ...n[k], saved: true, modified: null }; return n })
    } catch { alert('Eroare la salvare') }
  }

  async function handleRevert(section: SectionKey) {
    const fieldMap: Record<SectionKey, string> = { title: 'optimized_title', meta_description: 'meta_description', short_description: 'optimized_short_description', long_description: 'optimized_long_description', focus_keyword: 'focus_keyword' }
    const origMap:  Record<SectionKey, string> = { title: product?.original_title || '', meta_description: '', short_description: product?.original_description?.replace(/<[^>]*>/g, '').substring(0, 300) || '', long_description: product?.original_description || '', focus_keyword: '' }
    try {
      await fetch('/api/seo/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, action: 'revert', field: fieldMap[section] }) })
      upd(section, { current: origMap[section], modified: null, saved: false })
    } catch { alert('Eroare la revert') }
  }

  async function handlePublish() {
    setPublishing(true); setPublishResult(null)
    try {
      await handleSaveAll()
      const res  = await fetch(`/api/products/${productId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setPublishResult({ error: data.error }); return }
      setPublishResult({ success: true })
    } catch { setPublishResult({ error: t('seo.error_publish') }) } finally { setPublishing(false) }
  }

  function handleRestoreVersion(v: HistoryVersion) {
    setSections(prev => ({
      ...prev,
      title:            { ...prev.title,            current: v.optimized_title || prev.title.current,       modified: v.optimized_title,  saved: false },
      meta_description: { ...prev.meta_description, current: v.meta_description || prev.meta_description.current, modified: v.meta_description, saved: false },
      focus_keyword:    { ...prev.focus_keyword,    current: v.focus_keyword || prev.focus_keyword.current, modified: v.focus_keyword,    saved: false },
    }))
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-28 bg-neutral-100 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!product) return null

  const anyUnsaved = Object.values(sections).some(s => s.modified !== null)
  const liveScore  = calcLiveScore(sections).score
  const scoreColor = liveScore >= 80 ? 'text-emerald-600' : liveScore >= 50 ? 'text-amber-600' : liveScore > 0 ? 'text-red-500' : 'text-neutral-400'
  const previewUrl = product.category ? `${product.category}/${(product.original_title || '').toLowerCase().replace(/\s+/g, '-').substring(0, 30)}` : 'produs'

  return (
    <div className="space-y-4 max-w-5xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/seo" className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-700 transition-colors mb-3">
          <ChevronLeft className="h-3.5 w-3.5" />Înapoi la SEO
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-semibold text-neutral-900 truncate">{product.optimized_title || product.original_title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {product.category && <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{product.category}</span>}
              {product.focus_keyword && <span className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full font-medium">{product.focus_keyword}</span>}
              <span className={`text-[11px] font-bold ${scoreColor}`}>SEO Live: {liveScore}/100</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {anyUnsaved && (
              <Btn variant="success" size="sm" onClick={handleSaveAll}>
                <Save className="h-3.5 w-3.5" />Salvează tot
              </Btn>
            )}
            <Btn variant="outline" size="sm" onClick={handleGenerateAll} disabled={generatingAll}>
              {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingAll ? t('common.generating') : t('seo.generate_all')}
              <span className="text-neutral-300 text-[9px]">5cr</span>
            </Btn>
            <Btn size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {publishing ? 'Publicare...' : 'Publică în magazin'}
            </Btn>
          </div>
        </div>

        <AnimatePresence>
          {publishResult && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium ${publishResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {publishResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {publishResult.success ? t('seo.publish_woo_success') : publishResult.error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Editor grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left — editors */}
        <div className="lg:col-span-2 space-y-4">

          {/* Preview toggle */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-0.5 p-0.5 bg-neutral-100 rounded-lg">
                {[{ id: 'desktop', icon: Monitor }, { id: 'mobile', icon: Smartphone }].map(m => {
                  const Icon = m.icon
                  return (
                    <button key={m.id} onClick={() => setPreviewMode(m.id as any)}
                      className={`p-1.5 rounded-md transition-all ${previewMode === m.id ? 'bg-white shadow-sm text-neutral-700' : 'text-neutral-400 hover:text-neutral-600'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  )
                })}
              </div>
              <span className="text-[11px] text-neutral-400">Preview {previewMode === 'mobile' ? 'mobil (55/120 car.)' : 'desktop (60/155 car.)'}</span>
            </div>
            <GooglePreview title={sections.title.current} description={sections.meta_description.current} url={previewUrl} mobile={previewMode === 'mobile'} />
          </motion.div>

          {/* SEO Suggestions */}
          {product.seo_suggestions && product.seo_suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-amber-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Sugestii SEO</p>
                <ul className="space-y-1.5">
                  {product.seo_suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-amber-700"><ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Sections */}
          {([
            { key: 'title',             label: t('seo.title_tag'),     maxChars: 70,  minChars: 50,  placeholder: 'Titlu optimizat — 50-70 caractere',                hint: 'Apare în Google și tab browser. Include keyword-ul principal în primele cuvinte.', creditCost: 1 },
            { key: 'meta_description',  label: 'Meta Description',          maxChars: 155, minChars: 120, placeholder: 'Meta description — max 155 car., include CTA',      hint: 'Apare sub titlu în Google. Crește CTR cu un beneficiu clar și CTA.',           creditCost: 1 },
            { key: 'focus_keyword',     label: 'Focus Keyword',             maxChars: 60,                 placeholder: 'ex: mop spin inox, tricou bumbac organic',          hint: 'Query-ul principal al cumpărătorilor. 2-4 cuvinte, natural și specific.',       creditCost: 1 },
            { key: 'short_description', label: t('seo.short_desc_label'),          maxChars: 350, minChars: 80,  placeholder: 'Descriere scurtă — apare înainte de Adaugă în coș', hint: '2-4 propoziții care conving clientul.',                                          creditCost: 2, isHtml: /<[a-z][\s\S]*>/i.test(sections.short_description.current) },
            { key: 'long_description',  label: t('seo.long_desc_html'),                                  placeholder: '<h3>Titlu</h3><p>Conținut...</p>',                  hint: 'Editor HTML. Structura existentă e PĂSTRATĂ — AI optimizează textul, nu tagurile.', creditCost: 2, isHtml: true },
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
                  <span className="text-[11px] text-neutral-400">Keywords secundare:</span>
                  {product.secondary_keywords.map((kw, ki) => (
                    <span key={ki} className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              )}
              {cfg.key === 'long_description' && sections.long_description.current && (
                <LongDescPreview html={sections.long_description.current} />
              )}
            </motion.div>
          ))}
        </div>

        {/* Right — widgets */}
        <div className="space-y-3">
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

      {/* Sticky bottom bar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-[12px] min-w-0">
          {anyUnsaved
            ? <span className="text-neutral-600 font-medium">Modificări nesalvate</span>
            : <span className="text-emerald-600 font-medium flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 shrink-0" />Totul salvat</span>}
          {credits !== null && <span className="text-neutral-400 ml-2 tabular-nums">{t('seo.credits_remaining')}: {credits}</span>}
        </div>
        <div className="flex gap-2 shrink-0">
          {anyUnsaved && (
            <Btn variant="success" size="sm" onClick={handleSaveAll}>
              <Save className="h-3.5 w-3.5" />Salvează tot
            </Btn>
          )}
          <Btn size="sm" onClick={handlePublish} disabled={publishing}>
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {publishing ? 'Publicare...' : 'Publică'}
          </Btn>
        </div>
      </div>
    </div>
  )
}