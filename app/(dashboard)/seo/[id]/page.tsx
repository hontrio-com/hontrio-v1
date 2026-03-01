'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Sparkles, Save, RotateCcw, Upload, Loader2,
  CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Info,
  RefreshCw, Globe, ArrowRight, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Product = {
  id: string
  original_title: string
  optimized_title: string | null
  original_description: string | null
  optimized_short_description: string | null
  optimized_long_description: string | null
  meta_description: string | null
  focus_keyword: string | null
  secondary_keywords: string[] | null
  seo_score: number
  seo_suggestions: string[] | null
  price: number | null
  category: string | null
  status: string
  external_id: string | null
  original_images: string[] | null
}

type SectionKey = 'title' | 'meta_description' | 'short_description' | 'long_description' | 'focus_keyword'

type SectionState = {
  current: string
  original: string
  modified: string | null  // what user has edited, null = no local edits
  generating: boolean
  saved: boolean
  justReverted: boolean
}

// ─── CHAR COUNTER ─────────────────────────────────────────────────────────────
function CharCounter({ value, min, max }: { value: string; min?: number; max: number }) {
  const len = value.replace(/<[^>]*>/g, '').length
  const pct = Math.min(100, (len / max) * 100)
  const color = len > max ? 'bg-red-500' : len >= (max * 0.85) ? 'bg-amber-500' : 'bg-green-500'
  const textColor = len > max ? 'text-red-500' : len >= (max * 0.85) ? 'text-amber-500' : 'text-gray-400'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-medium tabular-nums ${textColor}`}>{len}/{max}</span>
      {min && len < min && <span className="text-[11px] text-amber-500">min {min} car.</span>}
    </div>
  )
}

// ─── GOOGLE PREVIEW ───────────────────────────────────────────────────────────
function GooglePreview({ title, description, url }: { title: string; description: string; url: string }) {
  const cleanTitle = title || 'Titlu produs'
  const cleanDesc = description || 'Meta description lipsă — Google va alege automat un snippet din conținut.'
  const displayTitle = cleanTitle.length > 60 ? cleanTitle.substring(0, 57) + '...' : cleanTitle
  const displayDesc = cleanDesc.length > 160 ? cleanDesc.substring(0, 157) + '...' : cleanDesc

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Globe className="h-3 w-3" />Preview Google Search
      </p>
      <div className="space-y-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[9px]">M</div>
          <span>magazinul-tau.ro</span>
          <span>›</span>
          <span>{url}</span>
        </div>
        {/* Title */}
        <p className="text-[17px] text-blue-700 font-medium leading-tight cursor-pointer hover:underline">
          {displayTitle}
        </p>
        {/* Description */}
        <p className="text-sm text-gray-600 leading-snug">
          {displayDesc}
        </p>
      </div>
    </div>
  )
}

// ─── SECTION EDITOR ───────────────────────────────────────────────────────────
function SectionEditor({
  label, fieldKey, value, originalValue, generating, saved, justReverted,
  onChange, onGenerate, onSave, onRevert,
  maxChars, minChars, isHtml, placeholder, hint,
  creditCost,
}: {
  label: string; fieldKey: SectionKey; value: string; originalValue: string
  generating: boolean; saved: boolean; justReverted: boolean
  onChange: (v: string) => void
  onGenerate: () => void; onSave: () => void; onRevert: () => void
  maxChars?: number; minChars?: number; isHtml?: boolean
  placeholder?: string; hint?: string; creditCost: number
}) {
  const hasChanges = value !== originalValue
  const isEmpty = !value.trim()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {saved && !hasChanges && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle className="h-3 w-3" />Salvat
            </motion.span>
          )}
          {justReverted && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
              <RotateCcz className="h-3 w-3" />Revertit
            </span>
          )}
          {hasChanges && !saved && (
            <span className="text-[11px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Modificat</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Revert button */}
          {(hasChanges || value !== originalValue) && originalValue && (
            <button onClick={onRevert} className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50">
              <RotateCcz className="h-3.5 w-3.5" />Revert
            </button>
          )}
          {/* Generate button */}
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-all"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Generez...' : `Optimizează AI`}
            <span className="text-blue-200 text-[10px]">{creditCost}cr</span>
          </button>
          {/* Save button */}
          {hasChanges && (
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-all"
            >
              <Save className="h-3.5 w-3.5" />Salvează
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="p-4">
        {hint && <p className="text-xs text-gray-400 mb-2 leading-relaxed">{hint}</p>}
        {isHtml ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={8}
            placeholder={placeholder}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-400 font-mono resize-y leading-relaxed transition-colors"
          />
        ) : (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={fieldKey === 'meta_description' ? 3 : fieldKey === 'short_description' ? 4 : 2}
            placeholder={placeholder}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-400 resize-none leading-relaxed transition-colors"
          />
        )}
        {maxChars && <CharCounter value={value} max={maxChars} min={minChars} />}
      </div>
    </div>
  )
}

// Fix RotateCcz import
const RotateCcz = RotateCcw

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProductSEOPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)

  // Per-section state: current value + tracking
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    title: { current: '', original: '', modified: null, generating: false, saved: false, justReverted: false },
    meta_description: { current: '', original: '', modified: null, generating: false, saved: false, justReverted: false },
    short_description: { current: '', original: '', modified: null, generating: false, saved: false, justReverted: false },
    long_description: { current: '', original: '', modified: null, generating: false, saved: false, justReverted: false },
    focus_keyword: { current: '', original: '', modified: null, generating: false, saved: false, justReverted: false },
  })

  useEffect(() => {
    loadProduct()
  }, [productId])

  const loadProduct = async () => {
    try {
      const res = await fetch(`/api/products/${productId}`)
      const data = await res.json()
      if (!res.ok) { router.push('/seo'); return }
      const p: Product = data.product
      setProduct(p)
      setSections({
        title: { current: p.optimized_title || p.original_title || '', original: p.original_title || '', modified: null, generating: false, saved: !!p.optimized_title, justReverted: false },
        meta_description: { current: p.meta_description || '', original: '', modified: null, generating: false, saved: !!p.meta_description, justReverted: false },
        short_description: { current: p.optimized_short_description || '', original: p.original_description ? p.original_description.replace(/<[^>]*>/g, '').substring(0, 300) : '', modified: null, generating: false, saved: !!p.optimized_short_description, justReverted: false },
        long_description: { current: p.optimized_long_description || p.original_description || '', original: p.original_description || '', modified: null, generating: false, saved: !!p.optimized_long_description, justReverted: false },
        focus_keyword: { current: p.focus_keyword || '', original: '', modified: null, generating: false, saved: !!p.focus_keyword, justReverted: false },
      })
    } catch { router.push('/seo') } finally { setLoading(false) }
  }

  const updateSection = (key: SectionKey, patch: Partial<SectionState>) => {
    setSections(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const handleChange = (key: SectionKey, value: string) => {
    updateSection(key, { current: value, modified: value, saved: false })
  }

  const handleGenerate = async (section: SectionKey) => {
    updateSection(section, { generating: true })
    try {
      const res = await fetch('/api/seo/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, section }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Eroare la generare'); return }

      const r = data.result
      let newValue = ''
      switch (section) {
        case 'title': newValue = r.optimized_title || ''; break
        case 'meta_description': newValue = r.meta_description || ''; break
        case 'short_description': newValue = r.optimized_short_description || ''; break
        case 'long_description': newValue = r.optimized_long_description || ''; break
        case 'focus_keyword': newValue = r.focus_keyword || ''; break
      }
      updateSection(section, { current: newValue, modified: newValue, saved: false })
      if (data.credits_remaining !== undefined) setCredits(data.credits_remaining)
    } catch { alert('Eroare la conexiune') } finally {
      updateSection(section, { generating: false })
    }
  }

  const handleGenerateAll = async () => {
    setGeneratingAll(true)
    try {
      const res = await fetch('/api/seo/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, section: 'all' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Eroare'); return }
      const r = data.result
      setSections(prev => ({
        title: { ...prev.title, current: r.optimized_title || prev.title.current, modified: r.optimized_title, saved: false },
        meta_description: { ...prev.meta_description, current: r.meta_description || prev.meta_description.current, modified: r.meta_description, saved: false },
        short_description: { ...prev.short_description, current: r.optimized_short_description || prev.short_description.current, modified: r.optimized_short_description, saved: false },
        long_description: { ...prev.long_description, current: r.optimized_long_description || prev.long_description.current, modified: r.optimized_long_description, saved: false },
        focus_keyword: { ...prev.focus_keyword, current: r.focus_keyword || prev.focus_keyword.current, modified: r.focus_keyword, saved: false },
      }))
      if (data.credits_remaining !== undefined) setCredits(data.credits_remaining)
    } catch { alert('Eroare la conexiune') } finally { setGeneratingAll(false) }
  }

  const handleSave = async (section: SectionKey) => {
    const s = sections[section]
    const fieldMap: Record<SectionKey, string> = {
      title: 'optimized_title',
      meta_description: 'meta_description',
      short_description: 'optimized_short_description',
      long_description: 'optimized_long_description',
      focus_keyword: 'focus_keyword',
    }
    try {
      const res = await fetch('/api/seo/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, fields: { [fieldMap[section]]: s.current } }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      updateSection(section, { saved: true, modified: null, original: s.current })
    } catch { alert('Eroare la salvare') }
  }

  const handleSaveAll = async () => {
    const fieldMap: Record<SectionKey, string> = {
      title: 'optimized_title',
      meta_description: 'meta_description',
      short_description: 'optimized_short_description',
      long_description: 'optimized_long_description',
      focus_keyword: 'focus_keyword',
    }
    const fields: Record<string, string> = {}
    for (const [key, s] of Object.entries(sections)) {
      if (s.current.trim()) fields[fieldMap[key as SectionKey]] = s.current
    }
    try {
      const res = await fetch('/api/seo/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, fields }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setSections(prev => {
        const next = { ...prev }
        for (const key of Object.keys(next) as SectionKey[]) {
          next[key] = { ...next[key], saved: true, modified: null }
        }
        return next
      })
    } catch { alert('Eroare la salvare') }
  }

  const handleRevert = async (section: SectionKey) => {
    const fieldMap: Record<SectionKey, string> = {
      title: 'optimized_title',
      meta_description: 'meta_description',
      short_description: 'optimized_short_description',
      long_description: 'optimized_long_description',
      focus_keyword: 'focus_keyword',
    }
    const originalValue: Record<SectionKey, string> = {
      title: product?.original_title || '',
      meta_description: '',
      short_description: product?.original_description?.replace(/<[^>]*>/g, '').substring(0, 300) || '',
      long_description: product?.original_description || '',
      focus_keyword: '',
    }
    try {
      await fetch('/api/seo/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, action: 'revert', field: fieldMap[section] }),
      })
      updateSection(section, { current: originalValue[section], modified: null, saved: false, justReverted: true })
      setTimeout(() => updateSection(section, { justReverted: false }), 3000)
    } catch { alert('Eroare la revert') }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setPublishResult(null)
    try {
      // First save all unsaved changes
      await handleSaveAll()
      const res = await fetch(`/api/products/${productId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setPublishResult({ error: data.error }); return }
      setPublishResult({ success: true })
    } catch { setPublishResult({ error: 'Eroare la publicare' }) } finally { setPublishing(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (!product) return null

  const anyUnsaved = Object.values(sections).some(s => s.modified !== null)
  const seoScore = product.seo_score
  const scoreColor = seoScore >= 80 ? 'text-green-600' : seoScore >= 50 ? 'text-amber-600' : seoScore > 0 ? 'text-red-500' : 'text-gray-400'
  const scoreBg = seoScore >= 80 ? 'bg-green-50' : seoScore >= 50 ? 'bg-amber-50' : seoScore > 0 ? 'bg-red-50' : 'bg-gray-50'

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link href="/seo" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3">
          <ChevronLeft className="h-4 w-4" />Înapoi la SEO
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{product.optimized_title || product.original_title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {product.category && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{product.category}</span>}
              {product.focus_keyword && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{product.focus_keyword}</span>}
              {seoScore > 0 && (
                <span className={`text-xs font-bold ${scoreColor} ${scoreBg} px-2.5 py-0.5 rounded-full`}>
                  SEO {seoScore}/100
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {anyUnsaved && (
              <Button onClick={handleSaveAll} size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl gap-1.5">
                <Save className="h-3.5 w-3.5" />Salvează tot
              </Button>
            )}
            <Button
              onClick={handleGenerateAll}
              disabled={generatingAll}
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingAll ? 'Generez...' : 'Generează tot'}
              <span className="text-blue-300 text-[10px]">5cr</span>
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing}
              size="sm"
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl gap-1.5"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {publishing ? 'Publicare...' : 'Publică în magazin'}
            </Button>
          </div>
        </div>

        {/* Publish result */}
        <AnimatePresence>
          {publishResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                publishResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {publishResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {publishResult.success ? 'Publicat cu succes în WooCommerce!' : publishResult.error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Google Preview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
        <GooglePreview
          title={sections.title.current}
          description={sections.meta_description.current}
          url={product.category ? `${product.category}/${product.original_title?.toLowerCase().replace(/\s+/g, '-').substring(0, 30)}` : 'produs'}
        />
      </motion.div>

      {/* SEO Suggestions */}
      {product.seo_suggestions && product.seo_suggestions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />Sugestii SEO pentru acest produs
            </p>
            <ul className="space-y-1.5">
              {product.seo_suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />{s}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Section editors */}
      <div className="space-y-4">
        {/* TITLE */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <SectionEditor
            label="Titlu SEO (Title Tag)"
            fieldKey="title"
            value={sections.title.current}
            originalValue={sections.title.original}
            generating={sections.title.generating}
            saved={sections.title.saved}
            justReverted={sections.title.justReverted}
            onChange={v => handleChange('title', v)}
            onGenerate={() => handleGenerate('title')}
            onSave={() => handleSave('title')}
            onRevert={() => handleRevert('title')}
            maxChars={70}
            minChars={50}
            placeholder="Titlu optimizat SEO — 50-70 caractere"
            hint="Apare în tab-ul browserului și în rezultatele Google. Include cuvântul cheie principal în primele cuvinte."
            creditCost={1}
          />
        </motion.div>

        {/* META DESCRIPTION */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.13 }}>
          <SectionEditor
            label="Meta Description"
            fieldKey="meta_description"
            value={sections.meta_description.current}
            originalValue={sections.meta_description.original}
            generating={sections.meta_description.generating}
            saved={sections.meta_description.saved}
            justReverted={sections.meta_description.justReverted}
            onChange={v => handleChange('meta_description', v)}
            onGenerate={() => handleGenerate('meta_description')}
            onSave={() => handleSave('meta_description')}
            onRevert={() => handleRevert('meta_description')}
            maxChars={155}
            minChars={120}
            placeholder="Meta description — max 155 caractere, include CTA"
            hint="Apare sub titlu în Google. Nu influențează direct rankingul, dar crește click-through rate-ul (CTR). Include un beneficiu clar și CTA."
            creditCost={1}
          />
        </motion.div>

        {/* FOCUS KEYWORD */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <SectionEditor
            label="Cuvânt Cheie Principal (Focus Keyword)"
            fieldKey="focus_keyword"
            value={sections.focus_keyword.current}
            originalValue={sections.focus_keyword.original}
            generating={sections.focus_keyword.generating}
            saved={sections.focus_keyword.saved}
            justReverted={sections.focus_keyword.justReverted}
            onChange={v => handleChange('focus_keyword', v)}
            onGenerate={() => handleGenerate('focus_keyword')}
            onSave={() => handleSave('focus_keyword')}
            onRevert={() => handleRevert('focus_keyword')}
            maxChars={60}
            placeholder="ex: mop spin inox, tricou bumbac organic"
            hint="Query-ul principal pe care cumpărătorii îl folosesc în Google pentru a găsi produsul. 2-4 cuvinte, specific și natural."
            creditCost={1}
          />
          {/* Secondary keywords preview */}
          {product.secondary_keywords && product.secondary_keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 px-1">
              <span className="text-xs text-gray-400">Keywords secundare:</span>
              {product.secondary_keywords.map((kw, i) => (
                <span key={i} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          )}
        </motion.div>

        {/* SHORT DESCRIPTION */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}>
          <SectionEditor
            label="Descriere Scurtă"
            fieldKey="short_description"
            value={sections.short_description.current}
            originalValue={sections.short_description.original}
            generating={sections.short_description.generating}
            saved={sections.short_description.saved}
            justReverted={sections.short_description.justReverted}
            onChange={v => handleChange('short_description', v)}
            onGenerate={() => handleGenerate('short_description')}
            onSave={() => handleSave('short_description')}
            onRevert={() => handleRevert('short_description')}
            maxChars={350}
            minChars={80}
            isHtml={/<[a-z][\s\S]*>/i.test(sections.short_description.current)}
            placeholder="Descriere scurtă — apare sub titlu în pagina produsului, înainte de butonul Adaugă în coș"
            hint="Convinge clientul în 2-4 propoziții. Dacă originalul are HTML/liste, structura HTML este păstrată și doar textul este optimizat."
            creditCost={2}
          />
        </motion.div>

        {/* LONG DESCRIPTION */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <SectionEditor
            label="Descriere Lungă (HTML)"
            fieldKey="long_description"
            value={sections.long_description.current}
            originalValue={sections.long_description.original}
            generating={sections.long_description.generating}
            saved={sections.long_description.saved}
            justReverted={sections.long_description.justReverted}
            onChange={v => handleChange('long_description', v)}
            onGenerate={() => handleGenerate('long_description')}
            onSave={() => handleSave('long_description')}
            onRevert={() => handleRevert('long_description')}
            isHtml
            placeholder="<h3>Titlu secțiune</h3><p>Conținut...</p>"
            hint="Editor HTML direct. Structura (taguri, tabele, liste) este PĂSTRATĂ identică dacă există. AI-ul optimizează SEO-ul textului fără a modifica structura HTML."
            creditCost={2}
          />

          {/* HTML Preview toggle */}
          {sections.long_description.current && (
            <LongDescPreview html={sections.long_description.current} />
          )}
        </motion.div>
      </div>

      {/* Bottom publish bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}>
        <div className="sticky bottom-4 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            {anyUnsaved ? (
              <span className="text-blue-600 font-medium">Ai modificări nesalvate</span>
            ) : (
              <span className="text-green-600 font-medium flex items-center gap-1.5"><CheckCircle className="h-4 w-4" />Totul salvat</span>
            )}
          </div>
          <div className="flex gap-2">
            {anyUnsaved && (
              <Button onClick={handleSaveAll} size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl gap-1.5">
                <Save className="h-3.5 w-3.5" />Salvează tot
              </Button>
            )}
            <Button onClick={handlePublish} disabled={publishing} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl gap-1.5">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Publică în magazin
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Long description HTML preview component
function LongDescPreview({ html }: { html: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mt-2">
      <button onClick={() => setShow(!show)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {show ? 'Ascunde preview' : 'Preview HTML randat'}
      </button>
      <AnimatePresence>
        {show && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: html }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}