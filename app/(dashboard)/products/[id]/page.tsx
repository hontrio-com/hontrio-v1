'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UpgradePrompt } from '@/components/upgrade-prompt'
import { triggerCreditsRefresh, useCredits } from '@/hooks/use-credits'
import {
  Loader2, ArrowLeft, Sparkles, ImageIcon, FileText, Send,
  CheckCircle, AlertCircle, Eye, Copy, Check, RotateCcw,
  Wand2, Layers, Target, ExternalLink, Download, ImagePlus,
  RefreshCw, X, ChevronDown, ChevronUp, Zap, Star, Grid3X3,
} from 'lucide-react'
import Link from 'next/link'

type Product = {
  id: string
  original_title: string
  optimized_title: string | null
  original_description: string
  optimized_short_description: string | null
  optimized_long_description: string | null
  benefits: string[] | null
  specifications: Record<string, string> | null
  meta_description: string | null
  seo_score: number
  seo_suggestions: string[] | null
  original_images: string[] | null
  status: string
  category: string | null
  price: number | null
  external_id: string | null
}

type GeneratedImage = {
  id: string; style: string; generated_image_url: string
  quality_score: number; status: string; credits_used: number
  processing_time_ms: number | null; created_at: string
}

type SectionKey = 'title' | 'meta_description' | 'short_description' | 'long_description' | 'benefits'

const styleOptions = [
  { value: 'white_bg', label: 'Fundal Alb', desc: 'Clean, profesional', icon: '🤍', cost: 2 },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Produs în context real', icon: '🏡', cost: 3 },
  { value: 'premium_dark', label: 'Premium Dark', desc: 'Luxos, dramatic', icon: '🖤', cost: 3 },
  { value: 'industrial', label: 'Industrial', desc: 'Raw, autentic', icon: '🏭', cost: 3 },
  { value: 'seasonal', label: 'Seasonal', desc: 'Festiv, sezonier', icon: '🎄', cost: 4 },
  { value: 'auto', label: 'Auto AI', desc: 'AI alege stilul', icon: '🤖', cost: 3 },
]

// Reusable AI Section Generate Button
function AiGenButton({ label, onClick, loading, disabled, cost }: {
  label: string; onClick: () => void; loading: boolean; disabled: boolean; cost: number
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        loading ? 'bg-blue-100 text-blue-600' :
        'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 hover:border-blue-300'
      } ${disabled && !loading ? 'opacity-40 cursor-not-allowed' : ''}`}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? 'Se generează...' : label}
      {!loading && <Badge className="bg-blue-600 text-white text-[9px] border-0 h-4 px-1.5">{cost} cr</Badge>}
    </button>
  )
}

// Reusable Copy Button
function CopyBtn({ text, field, copiedField, onCopy }: {
  text: string; field: string; copiedField: string; onCopy: (t: string, f: string) => void
}) {
  return (
    <button onClick={() => onCopy(text, field)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Copiază">
      {copiedField === field ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { credits: userCredits, plan: userPlan } = useCredits()
  const [product, setProduct] = useState<Product | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingText, setGeneratingText] = useState(false)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [copiedField, setCopiedField] = useState('')
  const [regeneratingSection, setRegeneratingSection] = useState<SectionKey | null>(null)
  const [selectedMainImage, setSelectedMainImage] = useState(0)
  const [showOriginalDesc, setShowOriginalDesc] = useState(false)
  const [imagesTab, setImagesTab] = useState<'generated' | 'original'>('original')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => { fetchProduct() }, [id])

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products/${id}`)
      const data = await res.json()
      if (data.product) setProduct(data.product)
      if (data.images) setGeneratedImages(data.images)
    } catch {} finally { setLoading(false) }
  }

  const handleGenerateAll = async () => {
    setGeneratingText(true); setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/generate/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: id }) })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
      setMessage({ type: 'success', text: 'Conținut generat cu succes! 5 credite utilizate.' })
      fetchProduct(); triggerCreditsRefresh()
    } catch { setMessage({ type: 'error', text: 'Eroare la generare' }) }
    finally { setGeneratingText(false) }
  }

  const handleRegenerateSection = async (section: SectionKey) => {
    if (userCredits < 2) { setMessage({ type: 'error', text: 'Credite insuficiente (necesare: 2)' }); return }
    setRegeneratingSection(section); setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/generate/text-section', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: id, section }) })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
      const labels: Record<SectionKey, string> = { title: 'Titlul', meta_description: 'Meta Description', short_description: 'Descrierea scurtă', long_description: 'Descrierea completă', benefits: 'Beneficiile' }
      setMessage({ type: 'success', text: `${labels[section]} regenerat cu succes! 2 credite utilizate.` })
      fetchProduct(); triggerCreditsRefresh()
    } catch { setMessage({ type: 'error', text: 'Eroare la regenerare' }) }
    finally { setRegeneratingSection(null) }
  }

  const handleGenerateImages = async () => {
    const styles = autoGenerate ? ['white_bg', 'lifestyle', 'premium_dark'] : selectedStyles
    if (styles.length === 0) { setMessage({ type: 'error', text: 'Selectează cel puțin un stil' }); return }
    setGeneratingImages(true); setMessage({ type: '', text: '' })
    let ok = 0, fail = 0
    for (const style of styles) {
      try {
        const res = await fetch('/api/generate/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: id, style }) })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    if (ok > 0) { setMessage({ type: 'success', text: `${ok} ${ok === 1 ? 'imagine generată' : 'imagini generate'} cu succes!${fail > 0 ? ` (${fail} eșuate)` : ''}` }); fetchProduct() }
    else { setMessage({ type: 'error', text: 'Nicio imagine generată' }) }
    setGeneratingImages(false); setSelectedStyles([]); setAutoGenerate(false); triggerCreditsRefresh()
  }

  const handlePublish = async () => {
    setPublishing(true); setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`/api/products/${id}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
      setMessage({ type: 'success', text: 'Produs publicat cu succes în magazin!' })
      fetchProduct(); triggerCreditsRefresh()
    } catch { setMessage({ type: 'error', text: 'Eroare la publicare' }) }
    finally { setPublishing(false) }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text); setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const toggleStyle = (s: string) => { setAutoGenerate(false); setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]) }

  const totalImageCost = autoGenerate
    ? styleOptions.filter(s => ['white_bg', 'lifestyle', 'premium_dark'].includes(s.value)).reduce((a, s) => a + s.cost, 0)
    : selectedStyles.reduce((a, s) => a + (styleOptions.find(x => x.value === s)?.cost || 3), 0)

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[600px] bg-white rounded-2xl animate-pulse" />
        <div className="h-[400px] bg-white rounded-2xl animate-pulse" />
      </div>
    </div>
  )

  if (!product) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Produsul nu a fost găsit</p>
      <Link href="/products"><Button variant="outline" className="rounded-xl"><ArrowLeft className="h-4 w-4 mr-2" />Înapoi la produse</Button></Link>
    </div>
  )

  const hasOpt = product.optimized_title || product.optimized_short_description
  const allImages = product.original_images || []

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ===== HEADER ===== */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="rounded-xl text-gray-500 hover:text-gray-900 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />Produse
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 line-clamp-1">{product.optimized_title || product.original_title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-[11px] border-0 font-semibold ${
                product.status === 'published' ? 'bg-green-100 text-green-700' :
                product.status === 'optimized' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {product.status === 'published' ? '✓ Publicat' : product.status === 'optimized' ? '✓ Optimizat' : '⏳ Draft'}
              </Badge>
              {product.category && <span className="text-xs text-gray-400">{product.category}</span>}
              {product.price && <span className="text-xs font-medium text-gray-600">{product.price} RON</span>}
              {product.seo_score > 0 && (
                <Badge variant="outline" className={`text-[11px] ${product.seo_score >= 80 ? 'border-green-200 text-green-600' : product.seo_score >= 50 ? 'border-yellow-200 text-yellow-600' : 'border-red-200 text-red-500'}`}>
                  SEO {product.seo_score}/100
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {!hasOpt && (
              <Button onClick={handleGenerateAll} disabled={generatingText || userCredits < 5} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 px-4 text-sm">
                {generatingText ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează...</> : <><Sparkles className="h-4 w-4 mr-2" />Generează tot — 5 cr</>}
              </Button>
            )}
            <Button onClick={handlePublish} disabled={publishing || !hasOpt} className="bg-green-600 hover:bg-green-700 rounded-xl h-9 px-4 text-sm">
              {publishing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se publică...</> : <><Send className="h-4 w-4 mr-2" />Publică</>}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto opacity-50 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== WOOCOMMERCE-STYLE LAYOUT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* LEFT COLUMN — Main content */}
        <div className="lg:col-span-2 space-y-4">

          {/* TITLU */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Titlu produs</span>
              </div>
              <div className="flex items-center gap-1">
                {product.optimized_title && <CopyBtn text={product.optimized_title} field="title" copiedField={copiedField} onCopy={copyToClipboard} />}
                <AiGenButton label={product.optimized_title ? 'Regenerează' : 'Generează cu AI'} onClick={() => handleRegenerateSection('title')} loading={regeneratingSection === 'title'} disabled={regeneratingSection !== null && regeneratingSection !== 'title'} cost={2} />
              </div>
            </div>
            <div className="p-5">
              {product.optimized_title ? (
                <div>
                  <p className="text-base font-medium text-gray-900 leading-relaxed">{product.optimized_title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">{product.optimized_title.length} caractere</span>
                    {product.optimized_title.length >= 50 && product.optimized_title.length <= 70 && (
                      <Badge className="bg-green-50 text-green-600 text-[10px] border-0">Lungime ideală SEO</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">Original: <span className="text-gray-500">{product.original_title}</span></p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">{product.original_title}</p>
              )}
            </div>
          </div>

          {/* DESCRIERE LUNGĂ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-gray-900">Descriere lungă</span>
              </div>
              <div className="flex items-center gap-1">
                {product.optimized_long_description && <CopyBtn text={product.optimized_long_description} field="long" copiedField={copiedField} onCopy={copyToClipboard} />}
                <AiGenButton label={product.optimized_long_description ? 'Regenerează' : 'Generează cu AI'} onClick={() => handleRegenerateSection('long_description')} loading={regeneratingSection === 'long_description'} disabled={regeneratingSection !== null && regeneratingSection !== 'long_description'} cost={2} />
              </div>
            </div>
            <div className="p-5">
              {product.optimized_long_description ? (
                <div>
                  <div className="prose prose-sm max-w-none text-gray-700 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_ul]:space-y-1"
                    dangerouslySetInnerHTML={{ __html: product.optimized_long_description }} />
                  <button onClick={() => setShowOriginalDesc(!showOriginalDesc)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-3 pt-3 border-t border-gray-50">
                    {showOriginalDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showOriginalDesc ? 'Ascunde originalul' : 'Vezi descrierea originală'}
                  </button>
                  <AnimatePresence>
                    {showOriginalDesc && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 p-3 bg-gray-50 rounded-xl">
                        <div className="prose prose-sm max-w-none text-gray-500 text-xs" dangerouslySetInnerHTML={{ __html: product.original_description || 'Fără descriere originală' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  {product.original_description ? (
                    <div className="prose prose-sm max-w-none text-gray-500 italic" dangerouslySetInnerHTML={{ __html: product.original_description }} />
                  ) : <p className="italic">Nicio descriere disponibilă</p>}
                </div>
              )}
            </div>
          </div>

          {/* DESCRIERE SCURTĂ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold text-gray-900">Descriere scurtă</span>
              </div>
              <div className="flex items-center gap-1">
                {product.optimized_short_description && <CopyBtn text={product.optimized_short_description} field="short" copiedField={copiedField} onCopy={copyToClipboard} />}
                <AiGenButton label={product.optimized_short_description ? 'Regenerează' : 'Generează cu AI'} onClick={() => handleRegenerateSection('short_description')} loading={regeneratingSection === 'short_description'} disabled={regeneratingSection !== null && regeneratingSection !== 'short_description'} cost={2} />
              </div>
            </div>
            <div className="p-5">
              {product.optimized_short_description ? (
                <p className="text-sm text-gray-700 leading-relaxed">{product.optimized_short_description}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">Nicio descriere scurtă generată</p>
              )}
            </div>
          </div>

          {/* META DESCRIPTION + SEO */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-900">Meta Description & SEO</span>
                {product.seo_score > 0 && (
                  <div className={`h-6 px-2 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    product.seo_score >= 80 ? 'bg-green-100 text-green-700' : product.seo_score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                  }`}>SEO {product.seo_score}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {product.meta_description && <CopyBtn text={product.meta_description} field="meta" copiedField={copiedField} onCopy={copyToClipboard} />}
                <AiGenButton label={product.meta_description ? 'Regenerează' : 'Generează cu AI'} onClick={() => handleRegenerateSection('meta_description')} loading={regeneratingSection === 'meta_description'} disabled={regeneratingSection !== null && regeneratingSection !== 'meta_description'} cost={2} />
              </div>
            </div>
            <div className="p-5 space-y-4">
              {product.meta_description ? (
                <>
                  <p className="text-sm text-gray-700 leading-relaxed">{product.meta_description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{product.meta_description.length} caractere</span>
                    {product.meta_description.length <= 155 && <Badge className="bg-green-50 text-green-600 text-[10px] border-0">Lungime optimă</Badge>}
                  </div>
                  {/* Google Preview */}
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Previzualizare Google</p>
                    <p className="text-blue-700 text-sm font-medium">{product.optimized_title || product.original_title}</p>
                    <p className="text-green-700 text-xs">magazin.ro › produs</p>
                    <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">{product.meta_description}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">Nicio meta description generată</p>
              )}
              {/* SEO Checks */}
              {product.seo_score > 0 && (
                <div className="space-y-2 pt-3 border-t border-gray-50">
                  {[
                    { label: 'Titlu optimizat', ok: !!product.optimized_title },
                    { label: 'Meta description', ok: !!product.meta_description },
                    { label: 'Descriere scurtă', ok: !!product.optimized_short_description },
                    { label: 'Descriere lungă', ok: !!product.optimized_long_description },
                    { label: 'Beneficii', ok: (product.benefits?.length || 0) > 0 },
                    { label: 'Imagini', ok: (product.original_images?.length || 0) > 0 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {item.ok ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                      <span className={item.ok ? 'text-gray-600' : 'text-red-500'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* BENEFICII */}
          {product.benefits && product.benefits.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-gray-900">Beneficii produs</span>
                </div>
                <AiGenButton label="Regenerează" onClick={() => handleRegenerateSection('benefits')} loading={regeneratingSection === 'benefits'} disabled={regeneratingSection !== null && regeneratingSection !== 'benefits'} cost={2} />
              </div>
              <div className="p-5 space-y-2">
                {product.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-emerald-50/50 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-700">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Images */}
        <div className="space-y-4">

          {/* IMAGINE PRINCIPALĂ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Imagine principală</span>
              </div>
            </div>
            <div className="p-4">
              {allImages.length > 0 ? (
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50">
                  <img src={allImages[selectedMainImage] || allImages[0]} alt={product.original_title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-gray-200" />
                </div>
              )}
            </div>
          </div>

          {/* GALERIE IMAGINI */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-900">Galerie imagini</span>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[11px]">
                  <button onClick={() => setImagesTab('original')} className={`px-2.5 py-1 transition-colors ${imagesTab === 'original' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
                    Magazin ({allImages.length})
                  </button>
                  <button onClick={() => setImagesTab('generated')} className={`px-2.5 py-1 transition-colors ${imagesTab === 'generated' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
                    AI ({generatedImages.length})
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              {imagesTab === 'original' ? (
                allImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {allImages.map((img, i) => (
                      <button key={i} onClick={() => setSelectedMainImage(i)}
                        className={`aspect-square rounded-lg overflow-hidden bg-gray-50 border-2 transition-all ${selectedMainImage === i ? 'border-blue-500 ring-1 ring-blue-200' : 'border-transparent hover:border-gray-200'}`}>
                        <img src={img} alt={`${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Nicio imagine din magazin</p>
                )
              ) : (
                generatedImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {generatedImages.map((img) => (
                      <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden bg-gray-50">
                        <img src={img.generated_image_url} alt={img.style} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <Badge className="bg-white/20 backdrop-blur text-white border-0 text-[9px] mb-1">
                              {styleOptions.find(s => s.value === img.style)?.label || img.style}
                            </Badge>
                            <div className="flex gap-1">
                              <button onClick={() => window.open(img.generated_image_url, '_blank')} className="h-6 w-6 rounded bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30">
                                <ExternalLink className="h-3 w-3" />
                              </button>
                              <button onClick={() => window.open(img.generated_image_url)} className="h-6 w-6 rounded bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30">
                                <Download className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Nicio imagine AI generată</p>
                )
              )}
            </div>
          </div>

          {/* GENERARE IMAGINI AI */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-900">Generează imagini AI</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <button onClick={() => { setAutoGenerate(!autoGenerate); setSelectedStyles([]) }}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${autoGenerate ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-2.5">
                  <Sparkles className={`h-4 w-4 ${autoGenerate ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-900">Auto — 3 imagini</p>
                    <p className="text-[10px] text-gray-400">White, Lifestyle, Premium</p>
                  </div>
                  <Badge className={`text-[10px] border-0 ${autoGenerate ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>8 cr</Badge>
                </div>
              </button>

              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sau alege manual</p>
              <div className="grid grid-cols-2 gap-2">
                {styleOptions.map((style) => {
                  const sel = selectedStyles.includes(style.value)
                  return (
                    <button key={style.value} onClick={() => toggleStyle(style.value)} disabled={autoGenerate}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all text-[11px] ${
                        autoGenerate ? 'opacity-40 cursor-not-allowed' :
                        sel ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <span className="text-sm">{style.icon}</span>
                      <p className="font-medium text-gray-900 mt-0.5">{style.label}</p>
                      <p className="text-gray-400 text-[10px]">{style.cost} cr</p>
                    </button>
                  )
                })}
              </div>

              {userCredits < totalImageCost && totalImageCost > 0 && (
                <UpgradePrompt credits={userCredits} plan={userPlan} variant="inline" action="generarea de imagini" />
              )}

              <Button onClick={handleGenerateImages}
                disabled={generatingImages || (!autoGenerate && selectedStyles.length === 0) || (userCredits < totalImageCost && totalImageCost > 0)}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 w-full text-sm">
                {generatingImages ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează...</> :
                  <><ImagePlus className="h-4 w-4 mr-2" />Generează {autoGenerate ? '3' : selectedStyles.length} {(autoGenerate ? 3 : selectedStyles.length) === 1 ? 'imagine' : 'imagini'}{totalImageCost > 0 && ` — ${totalImageCost} cr`}</>
                }
              </Button>

              {generatingImages && (
                <p className="text-[10px] text-blue-500 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />10-30 secunde per imagine...
                </p>
              )}
            </div>
          </div>

          {/* Regenerate All */}
          {hasOpt && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {userCredits < 5 ? (
                <UpgradePrompt credits={userCredits} plan={userPlan} variant="inline" action="regenerarea conținutului" />
              ) : (
                <>
                  <Button onClick={handleGenerateAll} disabled={generatingText || regeneratingSection !== null} variant="outline" className="w-full rounded-xl h-9 border-gray-200 text-sm">
                    {generatingText ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se regenerează...</> : <><RotateCcw className="h-4 w-4 mr-2" />Regenerează tot — 5 credite</>}
                  </Button>
                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    Sau folosește butoanele <Sparkles className="h-3 w-3 inline text-blue-400" /> de pe fiecare secțiune (2 cr/secțiune)
                  </p>
                </>
              )}
            </div>
          )}

          {/* Product details card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-900 mb-3">Detalii produs</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">ID extern</span><span className="text-gray-600 font-mono">{product.external_id || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Categorie</span><span className="text-gray-600">{product.category || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Preț</span><span className="text-gray-600">{product.price ? `${product.price} RON` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Status</span><span className="text-gray-600 capitalize">{product.status}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}