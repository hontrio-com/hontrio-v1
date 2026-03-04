'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImageIcon, Loader2, Download, SearchIcon, X, Sparkles,
  Upload, Check, Package, ArrowRight, RefreshCw, AlertCircle,
  CheckCircle, Eye, Wand2, ZoomIn, Coins, Megaphone, Camera,
  Edit3, Star, StarOff, Layers, Zap, Bell, ChevronDown,
  BarChart3, Palette, Globe, Play, Pause, StopCircle, Trash2,
  ExternalLink, Copy, ChevronRight, Settings, TrendingUp,
  Monitor, Smartphone, Clock, Plus, Minus, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { triggerCreditsRefresh, useCredits } from '@/hooks/use-credits'

// ─── Types ────────────────────────────────────────────────────────────────────
type Product = {
  id: string; original_title: string; optimized_title: string | null
  original_images: string[] | null; thumbnail_url: string | null
  category: string | null; price: number | null; total_sales?: number | null
}
type GeneratedImage = {
  id: string; product_id: string; style: string
  generated_image_url: string; original_image_url: string | null
  status: string; credits_used: number; created_at: string
  product_title: string; rating?: number | null
  wc_published_at?: string | null; prompt?: string | null
  variants?: string[] | null
}
type BrandKit = {
  logo_url?: string | null; primary_color: string; secondary_color: string
  accent_color: string; brand_name: string; font_style: string; tone: string
  detected_style?: any; style_summary?: string
}
type BulkJob = {
  id: string; status: string; style: string; total_products: number
  completed_count: number; failed_count: number; auto_publish: boolean
  credits_used: number; created_at: string; estimated_minutes?: number
}
type StyleTemplate = {
  id: string; name: string; style: string; description: string; is_default: boolean
}
type PromoText = {
  headline: string; subtitle: string; benefits: string[]; cta: string; price_text: string | null
}
type ProductStep = 'select_image' | 'select_style' | 'generating' | 'done'
type PromoStep = 'select_image' | 'select_style' | 'edit_text' | 'generating' | 'done'
type MainTab = 'generator' | 'bulk' | 'brand' | 'gallery'
type GenTab = 'product' | 'promo' | 'banner' | 'before_after'

// ─── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_STYLES = [
  { value: 'white_bg',     label: 'Simplu',        desc: 'Fundal alb, studio profesional', cost: 2, gradient: 'from-gray-50 to-white',        dark: false },
  { value: 'lifestyle',    label: 'Lifestyle',     desc: 'Produs în context real',          cost: 3, gradient: 'from-amber-50 to-orange-50',   dark: false },
  { value: 'premium_dark', label: 'Premium Dark',  desc: 'Luxos și dramatic',               cost: 3, gradient: 'from-gray-900 to-gray-800',    dark: true  },
  { value: 'industrial',   label: 'Industrial',    desc: 'Raw, texturi naturale',           cost: 3, gradient: 'from-stone-100 to-stone-200',  dark: false },
  { value: 'seasonal',     label: 'De sezon',      desc: 'Festiv, cadouri',                 cost: 4, gradient: 'from-red-50 to-green-50',      dark: false },
  { value: 'manual',       label: 'Manual',        desc: 'Descrii tu scena dorită',         cost: 3, gradient: 'from-blue-50 to-indigo-50',    dark: false },
]
const PROMO_STYLES = [
  { value: 'modern_minimalist', label: 'Modern Minimalist', desc: 'Clean, premium',         cost: 4, gradient: 'from-gray-50 to-white',       dark: false },
  { value: 'bold_dynamic',      label: 'Bold & Dynamic',    desc: 'Energic, impact',        cost: 4, gradient: 'from-blue-600 to-blue-800',   dark: true  },
  { value: 'elegant_luxury',    label: 'Elegant Luxury',    desc: 'Accente aurii, premium', cost: 4, gradient: 'from-yellow-900 to-stone-900',dark: true  },
  { value: 'vibrant_sale',      label: 'Vibrant Sale',      desc: 'Culori vii, urgență',    cost: 4, gradient: 'from-orange-400 to-yellow-400',dark: false },
  { value: 'dark_premium',      label: 'Dark Premium',      desc: 'Neon, dramatic',         cost: 4, gradient: 'from-gray-950 to-slate-900',  dark: true  },
  { value: 'gradient_pop',      label: 'Gradient Pop',      desc: 'Vibrant, social media',  cost: 4, gradient: 'from-pink-500 to-violet-600', dark: true  },
]
const BANNER_ASPECTS = ['16:9', '4:3', '1:1', '2:1']
const ALL_STYLES = [...PRODUCT_STYLES, ...PROMO_STYLES.map(s => ({ ...s, value: `promo_${s.value}` }))]

function styleLabel(val: string) { return ALL_STYLES.find(s => s.value === val)?.label || val }
function styleCost(val: string)  { return ALL_STYLES.find(s => s.value === val)?.cost || 3 }

// ─── Season detector ──────────────────────────────────────────────────────────
function getCurrentSeason(): { label: string; style: string; reason: string } | null {
  const m = new Date().getMonth() + 1
  if (m === 11) return { label: 'Black Friday', style: 'bold_dynamic', reason: 'Noiembrie — sezon Black Friday' }
  if (m === 12) return { label: 'Crăciun', style: 'seasonal', reason: 'Decembrie — sezon Crăciun' }
  if (m === 2) return { label: "Valentine Day", style: 'elegant_luxury', reason: 'Februarie — Valentine Day' }
  if (m >= 3 && m <= 5) return { label: 'Primăvară', style: 'lifestyle', reason: 'Sezon de primăvară' }
  if (m >= 6 && m <= 8) return { label: 'Vară', style: 'lifestyle', reason: 'Sezon de vară' }
  return null
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────
function StepDots({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className={`h-2 rounded-full transition-all ${i < idx ? 'bg-emerald-400 w-2' : i === idx ? 'bg-gray-900 w-4' : 'bg-gray-200 w-2'}`} />
      ))}
    </div>
  )
}

function ZoomModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        src={url} alt="" onClick={e => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
      <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
    </motion.div>
  )
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>
          {n <= (hover || value || 0)
            ? <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            : <Star className="h-4 w-4 text-gray-300" />}
        </button>
      ))}
    </div>
  )
}

// ─── Product Picker ───────────────────────────────────────────────────────────
function ProductPicker({ onSelect, onClose }: { onSelect: (p: Product) => void; onClose: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const fetch_ = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100', parent_only: 'true' })
      if (q) params.set('search', q)
      const res = await fetch('/api/products?' + params)
      const data = await res.json()
      setProducts(data.products || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => { const t = setTimeout(() => fetch_(search), 350); return () => clearTimeout(t) }, [search, fetch_])
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white mt-3" onClick={e => e.stopPropagation()}>
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" placeholder="Caută produs..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-gray-400" />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
          : products.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Niciun produs găsit</p>
          : products.map(p => {
              const img = p.thumbnail_url || p.original_images?.[0]
              return (
                <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-gray-300 m-3" />}
                  </div>
                  <p className="text-sm text-gray-800 leading-snug">{p.optimized_title || p.original_title}</p>
                </button>
              )
            })}
      </div>
      <div className="p-2 border-t border-gray-100">
        <button onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Închide</button>
      </div>
    </div>
  )
}

// ─── Image Source Selector ────────────────────────────────────────────────────
function ImageSourceSelector({ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage,
  uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-900">Alege imaginea de referință</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${showPicker || selectedProduct ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          onClick={() => setShowPicker(true)}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-gray-600" /></div>
            <div><p className="font-semibold text-sm text-gray-900">Din magazinul tău</p><p className="text-xs text-gray-500 mt-0.5">Selectează un produs sincronizat</p></div>
          </div>
          {selectedProduct && (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-200">
              <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {selectedProductImage ? <img src={selectedProductImage} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-gray-300 m-3" />}
              </div>
              <p className="text-xs font-medium text-gray-800 flex-1 truncate">{selectedProduct.optimized_title || selectedProduct.original_title}</p>
              <button onClick={e => { e.stopPropagation(); setSelectedProduct(null); setSelectedProductImage(null) }} className="text-gray-300 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {showPicker && !selectedProduct && (
            <ProductPicker onSelect={p => { setSelectedProduct(p); setSelectedProductImage(p.thumbnail_url || p.original_images?.[0] || null); setUploadedImage(null); setShowPicker(false) }} onClose={() => setShowPicker(false)} />
          )}
        </div>
        <div className={`rounded-2xl border-2 p-4 cursor-pointer transition-all ${uploadedImage ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><Upload className="h-5 w-5 text-gray-600" /></div>
            <div><p className="font-semibold text-sm text-gray-900">Încarcă o imagine</p><p className="text-xs text-gray-500 mt-0.5">JPG sau PNG de pe calculator</p></div>
          </div>
          {uploadedImage ? (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-200">
              <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0"><img src={uploadedImage} alt="" className="h-full w-full object-cover" /></div>
              <p className="text-xs text-gray-600 flex-1">Imaginea ta</p>
              <button onClick={e => { e.stopPropagation(); setUploadedImage(null); setUploadedImageFile(null) }} className="text-gray-300 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="mt-3 border-2 border-dashed border-gray-200 rounded-xl py-5 text-center">
              <Upload className="h-4 w-4 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Apasă pentru a selecta</p>
            </div>
          )}
        </div>
      </div>
      {selectedProduct?.original_images && selectedProduct.original_images.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alege imaginea de referință</p>
          <div className="flex gap-2 flex-wrap">
            {selectedProduct.original_images.map((img: string, i: number) => (
              <button key={i} onClick={() => setSelectedProductImage(img)}
                className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${selectedProductImage === img ? 'border-gray-900' : 'border-gray-200 hover:border-gray-400'}`}>
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SSE Progress Hook ────────────────────────────────────────────────────────
function useGenerationProgress(taskId: string | null, imageRecordId: string | null, onDone: (urls: string[]) => void, onError: (msg: string) => void) {
  useEffect(() => {
    if (!taskId) return
    const url = `/api/generate/progress?task_id=${taskId}${imageRecordId ? `&image_record_id=${imageRecordId}` : ''}`
    const es = new EventSource(url)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'done') { es.close(); onDone(data.urls || [data.primary_url]) }
        if (data.type === 'error') { es.close(); onError(data.message || 'Eroare') }
        if (data.type === 'timeout') { es.close(); onError('Timeout — revino în câteva minute') }
      } catch {}
    }
    es.onerror = () => { es.close(); onError('Conexiunea a fost întreruptă') }
    return () => { es.close() }
  }, [taskId])
}

// ─── Generating Screen ────────────────────────────────────────────────────────
function GeneratingScreen({ taskId, imageRecordId, onDone, onError, icon: Icon = Sparkles, color = 'bg-gray-900', variantCount = 1 }: {
  taskId: string | null; imageRecordId: string | null
  onDone: (urls: string[]) => void; onError: (msg: string) => void
  icon?: any; color?: string; variantCount?: number
}) {
  useGenerationProgress(taskId, imageRecordId, onDone, onError)
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="relative mb-8">
        <div className={`h-24 w-24 rounded-3xl ${color} flex items-center justify-center shadow-2xl`}>
          <Icon className="h-11 w-11 text-white" />
        </div>
        <div className={`absolute inset-0 rounded-3xl ${color} animate-ping opacity-15`} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">AI generează imaginea...</h2>
      <p className="text-sm text-gray-500 mb-6">
        GPT construiește promptul detaliat → Nano Banana Pro generează
        {variantCount > 1 && <span className="ml-1 font-medium text-gray-700">{variantCount} variante</span>}
      </p>
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-100">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">20 – 60 secunde</span>
      </div>
    </div>
  )
}

// ─── Style Selector (shared) ──────────────────────────────────────────────────
function StyleSelector({ styles, selected, onSelect, credits, seasonSuggestion }: {
  styles: typeof PRODUCT_STYLES; selected: string | null; onSelect: (v: string) => void
  credits: number; seasonSuggestion?: { label: string; style: string; reason: string } | null
}) {
  return (
    <div className="space-y-3">
      {seasonSuggestion && styles.find(s => s.value === seasonSuggestion.style) && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => onSelect(seasonSuggestion.style)}>
          <Bell className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Recomandat acum — {seasonSuggestion.label}</p>
            <p className="text-[10px] text-amber-600">{seasonSuggestion.reason}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected === seasonSuggestion.style ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-700'}`}>
            {selected === seasonSuggestion.style ? 'Selectat' : 'Selectează'}
          </span>
        </motion.div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {styles.map(style => {
          const sel = selected === style.value
          const canAfford = credits >= style.cost
          return (
            <button key={style.value} onClick={() => canAfford && onSelect(style.value)} disabled={!canAfford}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all bg-gradient-to-br ${style.gradient} ${!canAfford ? 'opacity-40 cursor-not-allowed' : sel ? 'border-gray-900 ring-2 ring-gray-200' : 'border-gray-200 hover:border-gray-400'}`}>
              {sel && <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-gray-900 flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>}
              <p className={`font-bold text-sm mb-1 ${style.dark ? 'text-white' : 'text-gray-900'}`}>{style.label}</p>
              <p className={`text-xs leading-snug ${style.dark ? 'text-gray-300' : 'text-gray-500'}`}>{style.desc}</p>
              <Badge className={`mt-2 text-[10px] border-0 ${style.dark ? 'bg-white/20 text-white' : 'bg-white/80 text-gray-600'}`}>{style.cost} cr</Badge>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PRODUCT IMAGE GENERATOR ──────────────────────────────────────────────────
function ProductGenerator({ onImageGenerated, brandKit }: { onImageGenerated: (img: GeneratedImage) => void; brandKit: BrandKit | null }) {
  const { credits } = useCredits()
  const season = getCurrentSeason()
  const [step, setStep] = useState<ProductStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [manualDesc, setManualDesc] = useState('')
  const [variantCount, setVariantCount] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [imageRecordId, setImageRecordId] = useState<string | null>(null)
  const [lastUrls, setLastUrls] = useState<string[]>([])
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeImage = uploadedImage || selectedProductImage
  const styleDef = PRODUCT_STYLES.find(s => s.value === selectedStyle)

  const handleFileUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadedImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => { setUploadedImage(ev.target?.result as string); setSelectedProductImage(null) }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!activeImage || !selectedStyle) return
    setError(null); setStep('generating'); setTaskId(null); setImageRecordId(null)
    try {
      const body: Record<string, unknown> = { style: selectedStyle, num_variants: variantCount, manual_description: selectedStyle === 'manual' ? manualDesc : undefined }
      if (selectedProduct) body.product_id = selectedProduct.id
      if (uploadedImage && !selectedProduct) body.reference_image_base64 = uploadedImage
      if (selectedProduct && selectedProductImage !== (selectedProduct.thumbnail_url || selectedProduct.original_images?.[0])) body.reference_image_url = selectedProductImage

      const res = await fetch('/api/generate/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('select_style'); return }

      if (data.mode === 'async' && data.task_id) {
        setTaskId(data.task_id); setImageRecordId(data.image_record_id)
        // SSE hook will fire onDone
      } else {
        handleDone([data.image?.generated_image_url], data.image_record_id)
      }
      triggerCreditsRefresh()
    } catch { setError('Eroare de conexiune.'); setStep('select_style') }
  }

  const handleDone = async (urls: string[], recId?: string) => {
    if (!urls[0]) { setError('Imaginea nu a putut fi generată'); setStep('select_style'); return }
    const finalId = recId || imageRecordId
    setLastUrls(urls); setSelectedVariant(0); setImageRecordId(finalId)
    // Fetch real record from DB
    if (finalId) {
      try {
        const res = await fetch('/api/images')
        const data = await res.json()
        const found = (data.images || []).find((img: GeneratedImage) => img.id === finalId)
        if (found) { onImageGenerated(found); setStep('done'); return }
      } catch {}
    }
    // Fallback to local object
    const newImg: GeneratedImage = {
      id: finalId || Date.now().toString(),
      product_id: selectedProduct?.id || '',
      style: selectedStyle!, generated_image_url: urls[0],
      original_image_url: activeImage, status: 'completed',
      credits_used: (styleDef?.cost || 3) * variantCount,
      created_at: new Date().toISOString(),
      product_title: selectedProduct?.optimized_title || selectedProduct?.original_title || 'Upload manual',
      variants: urls.length > 1 ? urls : null,
    }
    onImageGenerated(newImg); setStep('done')
  }

  const handleRate = async (r: number) => {
    setRating(r)
    if (imageRecordId) {
      await fetch('/api/images/rate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ image_id: imageRecordId, rating: r }) })
    }
  }

  const handlePublish = async () => {
    if (!selectedProduct || !imageRecordId) return
    setPublishing(true)
    const res = await fetch('/api/generate/publish-to-woo', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ image_id: imageRecordId, product_id: selectedProduct.id, set_as_main: true }),
    })
    const data = await res.json()
    if (res.ok) { setPublished(true) } else { setError(data.error) }
    setPublishing(false)
  }

  const reset = () => { setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null); setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null); setManualDesc(''); setError(null); setLastUrls([]); setTaskId(null); setImageRecordId(null); setPublished(false); setRating(null); setVariantCount(1) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <StepDots steps={['select_image','select_style','generating']} current={step} />
        <div className="flex items-center gap-3">
          {step !== 'select_image' && step !== 'generating' && (
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Resetează</button>
          )}
        </div>
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          {step === 'select_image' && (
            <motion.div key="s1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <ImageSourceSelector {...{ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage, uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-bold text-gray-500 mb-1.5">Sfaturi pentru rezultate optime</p>
                <ul className="space-y-1">
                  {['Fundal alb sau uni — AI reproduce mai fidel produsul','Produsul să ocupe 70%+ din imagine','Rezoluție minimă: 800×800px','Evită mâini sau alte obiecte'].map((tip,i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500"><span className="text-gray-400 mt-0.5 shrink-0">·</span>{tip}</li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep('select_style')} disabled={!activeImage} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  Continuă <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'select_style' && (
            <motion.div key="s2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                {activeImage && <img src={activeImage} alt="" className="h-14 w-14 rounded-xl object-cover border border-gray-200 cursor-zoom-in" onClick={() => setZoomUrl(activeImage!)} />}
                <div><h2 className="text-sm font-bold text-gray-900">Alege stilul imaginii</h2>{selectedProduct && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{selectedProduct.optimized_title || selectedProduct.original_title}</p>}</div>
              </div>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

              <StyleSelector styles={PRODUCT_STYLES} selected={selectedStyle} onSelect={setSelectedStyle} credits={credits} seasonSuggestion={season} />

              {/* Variant count */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Număr de variante</p>
                  <p className="text-xs text-gray-400 mt-0.5">Generează mai multe și alege cea mai bună</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setVariantCount(v => Math.max(1,v-1))} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40" disabled={variantCount<=1}><Minus className="h-3.5 w-3.5"/></button>
                  <span className="text-sm font-bold text-gray-900 w-6 text-center">{variantCount}</span>
                  <button onClick={() => setVariantCount(v => Math.min(4,v+1))} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40" disabled={variantCount>=4}><Plus className="h-3.5 w-3.5"/></button>
                  <span className="text-xs text-gray-400 ml-1">{styleDef ? `= ${styleDef.cost * variantCount} cr` : ''}</span>
                </div>
              </div>

              {selectedStyle === 'manual' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">Descrie scena dorită</label>
                    <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Ex: Produs pe raft din lemn rustic, lumină naturală de la fereastră..." className="w-full h-24 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-gray-400 resize-none" />
                  </div>
                </motion.div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => { setStep('select_image'); setError(null) }} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={handleGenerate} disabled={!selectedStyle || credits < (styleDef?.cost || 0) * variantCount || (selectedStyle === 'manual' && !manualDesc.trim())}
                  className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  <Wand2 className="h-4 w-4 mr-2" /> Generează {styleDef && <Badge className="ml-2 bg-white/20 text-white border-0">{styleDef.cost * variantCount} cr</Badge>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GeneratingScreen taskId={taskId} imageRecordId={imageRecordId} onDone={handleDone} onError={err => { setError(err); setStep('select_style') }} variantCount={variantCount} />
            </motion.div>
          )}

          {step === 'done' && lastUrls.length > 0 && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-emerald-700">{lastUrls.length > 1 ? `${lastUrls.length} variante generate!` : 'Imagine generată cu succes!'}</p>
              </div>

              {/* Variant selector */}
              {lastUrls.length > 1 && (
                <div className="flex gap-2">
                  {lastUrls.map((url, i) => (
                    <button key={i} onClick={() => setSelectedVariant(i)}
                      className={`flex-1 aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedVariant === i ? 'border-gray-900 ring-2 ring-gray-200' : 'border-gray-200 hover:border-gray-400'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Main preview */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Original', url: activeImage },
                  { label: lastUrls.length > 1 ? `Varianta ${selectedVariant + 1}` : 'Generat AI', url: lastUrls[selectedVariant] },
                ].map(item => item.url && (
                  <div key={item.label} className="space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-zoom-in" onClick={() => setZoomUrl(item.url!)}>
                      <img src={item.url!} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Rating */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-700">Evaluează rezultatul</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Ajuți AI-ul să înțeleagă preferințele tale</p>
                </div>
                <StarRating value={rating} onChange={handleRate} />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(lastUrls[selectedVariant], '_blank')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700">
                  <Download className="h-4 w-4" /> Descarcă
                </button>
                {selectedProduct && (
                  <button onClick={handlePublish} disabled={publishing || published}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <CheckCircle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {published ? 'Publicat!' : 'Publică în WooCommerce'}
                  </button>
                )}
              </div>

              {/* Regenerate options */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Regenerare</p>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  {[
                    { label: 'Poster nou', icon: <RefreshCw className="h-4 w-4"/>, action: reset },
                    { label: 'Alt stil', icon: <Wand2 className="h-4 w-4"/>, action: () => setStep('select_style') },
                    { label: 'Mai multe variante', icon: <Layers className="h-4 w-4"/>, action: () => { setVariantCount(3); setStep('select_style') } },
                  ].map(b => (
                    <button key={b.label} onClick={b.action} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group">
                      <span className="text-gray-400 group-hover:text-gray-700 transition-colors">{b.icon}</span>
                      <span className="text-xs text-gray-500 group-hover:text-gray-700 text-center leading-tight">{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </div>
  )
}

// ─── PROMO GENERATOR ─────────────────────────────────────────────────────────
function PromoGenerator({ onImageGenerated, brandKit }: { onImageGenerated: (img: GeneratedImage) => void; brandKit: BrandKit | null }) {
  const { credits } = useCredits()
  const season = getCurrentSeason()
  const [step, setStep] = useState<PromoStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [promoText, setPromoText] = useState<PromoText | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [imageRecordId, setImageRecordId] = useState<string | null>(null)
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const PROMO_COST = 4

  const activeImage = uploadedImage || selectedProductImage

  const handleFileUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setUploadedImage(ev.target?.result as string); setSelectedProductImage(null); setUploadedImageFile(file) }
    reader.readAsDataURL(file)
  }

  const handleStyleSelect = async (styleVal: string) => {
    setSelectedStyle(styleVal)
    if (!selectedProduct) return
    setLoadingText(true)
    try {
      const res = await fetch('/api/generate/promo', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'generate_text', product_id: selectedProduct.id, style: styleVal }) })
      const data = await res.json()
      if (res.ok && data.promoText) setPromoText(data.promoText)
    } catch {} finally { setLoadingText(false) }
  }

  const handleGenerate = async () => {
    if (!activeImage || !selectedStyle || !promoText) return
    setError(null); setStep('generating'); setTaskId(null)
    try {
      const body: Record<string, unknown> = { style: selectedStyle, promo_text: promoText }
      if (selectedProduct) body.product_id = selectedProduct.id
      if (uploadedImage && !selectedProduct) body.reference_image_base64 = uploadedImage
      const res = await fetch('/api/generate/promo', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('edit_text'); return }
      if (data.mode === 'async' && data.task_id) {
        setTaskId(data.task_id); setImageRecordId(data.image_record_id)
      } else {
        handleDone([data.image?.generated_image_url], data.image_record_id)
      }
      triggerCreditsRefresh()
    } catch { setError('Eroare de conexiune.'); setStep('edit_text') }
  }

  const handleDone = async (urls: string[], recId?: string) => {
    if (!urls[0]) { setError('Generarea a eșuat'); setStep('edit_text'); return }
    const finalId = recId || imageRecordId
    setLastUrl(urls[0]); setImageRecordId(finalId)
    if (finalId) {
      try {
        const res = await fetch('/api/images')
        const data = await res.json()
        const found = (data.images || []).find((img: GeneratedImage) => img.id === finalId)
        if (found) { onImageGenerated(found); setStep('done'); return }
      } catch {}
    }
    onImageGenerated({ id: finalId || Date.now().toString(), product_id: selectedProduct?.id||'', style: `promo_${selectedStyle}`, generated_image_url: urls[0], original_image_url: activeImage, status:'completed', credits_used: PROMO_COST, created_at: new Date().toISOString(), product_title: selectedProduct?.optimized_title||selectedProduct?.original_title||'Upload' })
    setStep('done')
  }

  const handlePublish = async () => {
    if (!selectedProduct || !imageRecordId) return
    setPublishing(true)
    const res = await fetch('/api/generate/publish-to-woo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_id: imageRecordId, product_id: selectedProduct.id, set_as_main: false }) })
    if (res.ok) setPublished(true)
    setPublishing(false)
  }

  const reset = () => { setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null); setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null); setPromoText(null); setError(null); setLastUrl(null); setTaskId(null); setPublished(false); setRating(null) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <StepDots steps={['select_image','select_style','edit_text','generating']} current={step} />
        {step !== 'select_image' && step !== 'generating' && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Resetează</button>
        )}
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          {step === 'select_image' && (
            <motion.div key="p1" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
              <ImageSourceSelector {...{selectedProduct,setSelectedProduct,selectedProductImage,setSelectedProductImage,uploadedImage,setUploadedImage,setUploadedImageFile,showPicker,setShowPicker,fileInputRef}} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />
              <div className="flex justify-end">
                <Button onClick={() => setStep('select_style')} disabled={!activeImage} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  Continuă <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'select_style' && (
            <motion.div key="p2" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
              <div className="flex items-center gap-3">
                {activeImage && <img src={activeImage} alt="" className="h-14 w-14 rounded-xl object-cover border border-gray-200"/>}
                <div><h2 className="text-sm font-bold text-gray-900">Alege stilul posterului</h2><p className="text-xs text-gray-400 mt-0.5">GPT generează textele automat după selecție</p></div>
              </div>
              <StyleSelector styles={PROMO_STYLES} selected={selectedStyle} onSelect={handleStyleSelect} credits={credits} seasonSuggestion={season ? { ...season, style: `promo_${season.style}` } : null} />
              {selectedStyle && !loadingText && promoText && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /><p className="text-sm text-emerald-700">Texte generate! Apasă continuă pentru a le edita.</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => { setStep('select_image'); setSelectedStyle(null); setPromoText(null) }} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={() => { if (!promoText) setPromoText({ headline:'Titlu Produs', subtitle:'Subtitlu', benefits:['Beneficiu 1','Beneficiu 2','Beneficiu 3'], cta:'Comandă Acum', price_text:null }); setStep('edit_text') }}
                  disabled={!selectedStyle || loadingText} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  {loadingText ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Se generează...</> : <>Editează textele <Edit3 className="h-4 w-4 ml-2"/></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'edit_text' && promoText && (
            <motion.div key="p3" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900">Editează textele posterului</h2>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
              <div className="space-y-3">
                {[
                  { key:'headline', label:'Titlu principal', max:30, placeholder:'Cel Mai Bun Preț' },
                  { key:'subtitle', label:'Subtitlu', max:55, placeholder:'Calitate premium la preț imbatabil' },
                ].map(({key,label,max,placeholder}) => {
                  const val = (promoText as any)[key] as string
                  const len = val.length
                  const color = len > max ? 'text-red-500' : len > max*0.8 ? 'text-amber-500' : 'text-emerald-500'
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
                        <span className={`text-xs font-medium ${color}`}>{len}/{max}</span>
                      </div>
                      <input value={val} onChange={e => e.target.value.length <= max+10 && setPromoText(pt => pt ? {...pt,[key]:e.target.value} : pt)}
                        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" placeholder={placeholder} />
                      <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${len>max?'bg-red-400':len>max*0.8?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${Math.min(100,(len/max)*100)}%`}} />
                      </div>
                    </div>
                  )
                })}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Beneficii</label>
                  <div className="mt-1.5 space-y-2">
                    {promoText.benefits.map((b,i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-emerald-500 text-sm shrink-0">✓</span>
                        <input value={b} onChange={e => e.target.value.length<=35 && setPromoText(pt => pt?{...pt,benefits:pt.benefits.map((x,j)=>j===i?e.target.value:x)}:pt)}
                          className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" placeholder={`Beneficiu ${i+1}`} />
                        <span className="text-xs text-gray-400 w-8 text-right shrink-0">{b.length}/35</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">CTA (buton)</label>
                    <input value={promoText.cta} onChange={e => e.target.value.length<=22 && setPromoText(pt => pt?{...pt,cta:e.target.value}:pt)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" placeholder="Comandă Acum" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Preț (opțional)</label>
                    <input value={promoText.price_text||''} onChange={e => setPromoText(pt => pt?{...pt,price_text:e.target.value||null}:pt)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" placeholder="Doar 299 RON" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setStep('select_style')} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={handleGenerate} disabled={credits < PROMO_COST} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  <Wand2 className="h-4 w-4 mr-2"/> Generează <Badge className="ml-2 bg-white/20 text-white border-0">{PROMO_COST} cr</Badge>
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div key="pgen" initial={{opacity:0}} animate={{opacity:1}}>
              <GeneratingScreen taskId={taskId} imageRecordId={imageRecordId} onDone={handleDone} onError={err => { setError(err); setStep('edit_text') }} icon={Megaphone} color="bg-gray-700" />
            </motion.div>
          )}

          {step === 'done' && lastUrl && (
            <motion.div key="pdone" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600"/><p className="text-sm font-medium text-emerald-700">Poster promoțional generat!</p>
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 max-w-sm mx-auto cursor-zoom-in" onClick={() => setZoomUrl(lastUrl)}>
                <img src={lastUrl} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div><p className="text-xs font-bold text-gray-700">Evaluează rezultatul</p></div>
                <StarRating value={rating} onChange={async r => { setRating(r); if(imageRecordId) await fetch('/api/images/rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_id:imageRecordId,rating:r})}) }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(lastUrl,'_blank')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"><Download className="h-4 w-4"/>Descarcă</button>
                {selectedProduct && <button onClick={handlePublish} disabled={publishing||published} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border ${published?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                  {publishing?<Loader2 className="h-4 w-4 animate-spin"/>:published?<CheckCircle className="h-4 w-4"/>:<Globe className="h-4 w-4"/>}
                  {published?'Publicat!':'Publică în WooCommerce'}
                </button>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{label:'Poster nou',icon:<RefreshCw className="h-4 w-4"/>,action:reset},{label:'Alt stil',icon:<Wand2 className="h-4 w-4"/>,action:()=>setStep('select_style')},{label:'Editează text',icon:<Edit3 className="h-4 w-4"/>,action:()=>setStep('edit_text')}].map(b=>(
                  <button key={b.label} onClick={b.action} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group">
                    <span className="text-gray-400 group-hover:text-gray-700">{b.icon}</span>
                    <span className="text-xs text-gray-500 group-hover:text-gray-700 text-center">{b.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </div>
  )
}

// ─── BANNER GENERATOR ─────────────────────────────────────────────────────────
function BannerGenerator({ onImageGenerated }: { onImageGenerated: (img: GeneratedImage) => void }) {
  const { credits } = useCredits()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [bannerStyle, setBannerStyle] = useState('modern')
  const [aspect, setAspect] = useState('16:9')
  const [loading, setLoading] = useState(false)
  const [loadingCats, setLoadingCats] = useState(true)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [imageRecordId, setImageRecordId] = useState<string | null>(null)
  const [step, setStep] = useState<'form'|'generating'|'done'>('form')
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const BANNER_COST = 5

  useEffect(() => {
    fetch('/api/products/categories').then(r=>r.json()).then(d => {
      setCategories(d.categories || [])
      setLoadingCats(false)
    }).catch(() => setLoadingCats(false))
  }, [])

  const handleGenerate = async () => {
    if (!selectedCategory) { setError('Selectează o categorie'); return }
    setLoading(true); setError(''); setStep('generating'); setTaskId(null)
    const res = await fetch('/api/generate/banner', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ category: selectedCategory, banner_style: bannerStyle, aspect_ratio: aspect }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error||'Eroare'); setStep('form'); setLoading(false); return }
    if (data.task_id) { setTaskId(data.task_id); setImageRecordId(data.image_record_id) }
    else { handleDone([data.image?.generated_image_url]) }
    triggerCreditsRefresh()
    setLoading(false)
  }

  const handleDone = (urls: string[]) => {
    if (!urls[0]) { setError('Generarea a eșuat'); setStep('form'); return }
    setLastUrl(urls[0]); setStep('done')
    onImageGenerated({ id: Date.now().toString(), product_id: '', style: `banner_${bannerStyle}`, generated_image_url: urls[0], original_image_url: null, status:'completed', credits_used: BANNER_COST, created_at: new Date().toISOString(), product_title: `Banner — ${selectedCategory}` })
  }

  const BANNER_STYLES = [
    { value:'modern',    label:'Modern',    desc:'Clean, minimal, spațiu alb' },
    { value:'seasonal',  label:'Sezonier',  desc:'Festiv, cadouri, ocazii' },
    { value:'bold',      label:'Bold',      desc:'Energic, impact vizual maxim' },
    { value:'luxury',    label:'Luxury',    desc:'Premium, elegant, rafinat' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Banner categorii</h2>
        <p className="text-xs text-gray-400 mt-0.5">Bannere automate pentru paginile de categorie din magazin</p>
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Categorie</label>
                {loadingCats ? <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin"/>Se încarcă categoriile...</div>
                : categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setSelectedCategory(c.name)}
                        className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${selectedCategory===c.name?'border-gray-900 bg-gray-900 text-white':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} placeholder="Ex: Electronice, Îmbrăcăminte..."
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" />
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stil banner</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BANNER_STYLES.map(s => (
                    <button key={s.value} onClick={() => setBannerStyle(s.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${bannerStyle===s.value?'border-gray-900 bg-gray-50':'border-gray-200 hover:border-gray-300'}`}>
                      <p className="text-sm font-bold text-gray-900">{s.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Format</label>
                <div className="flex gap-2">
                  {BANNER_ASPECTS.map(a => (
                    <button key={a} onClick={() => setAspect(a)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${aspect===a?'border-gray-900 bg-gray-900 text-white':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {a}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">16:9 = website · 1:1 = social media · 2:1 = email header</p>
              </div>
              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-gray-400">{BANNER_COST} credite</p>
                <Button onClick={handleGenerate} disabled={!selectedCategory||credits<BANNER_COST} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
                  <Wand2 className="h-4 w-4 mr-2"/>Generează banner
                </Button>
              </div>
            </motion.div>
          )}
          {step === 'generating' && (
            <motion.div key="gen" initial={{opacity:0}} animate={{opacity:1}}>
              <GeneratingScreen taskId={taskId} imageRecordId={imageRecordId} onDone={handleDone} onError={err=>{setError(err);setStep('form')}} icon={Monitor} color="bg-gray-800" />
            </motion.div>
          )}
          {step === 'done' && lastUrl && (
            <motion.div key="done" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600"/><p className="text-sm font-medium text-emerald-700">Banner generat!</p>
              </div>
              <div className="rounded-2xl overflow-hidden bg-gray-100 cursor-zoom-in" onClick={() => setZoomUrl(lastUrl)}>
                <img src={lastUrl} alt="" className="w-full object-contain" />
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={() => window.open(lastUrl,'_blank')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"><Download className="h-4 w-4"/>Descarcă</button>
                <button onClick={() => { setStep('form'); setLastUrl(null) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"><RefreshCw className="h-4 w-4"/>Alt banner</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </div>
  )
}

// ─── BEFORE/AFTER TAB ────────────────────────────────────────────────────────
function BeforeAfterTab() {
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImg, setSelectedImg] = useState<GeneratedImage | null>(null)
  const [beforeAfterData, setBeforeAfterData] = useState<{ before_url: string; after_url: string; composite_url?: string | null } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sliderPos, setSliderPos] = useState(50)
  const [exportLoading, setExportLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    fetch('/api/images')
      .then(r => r.json())
      .then(d => {
        const imgs = (d.images || []).filter((img: GeneratedImage) =>
          img.original_image_url &&
          img.generated_image_url &&
          img.generated_image_url !== img.original_image_url
        )
        setGallery(imgs)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (img: GeneratedImage) => {
    setSelectedImg(img); setGenerating(true); setBeforeAfterData(null); setSliderPos(50)
    const res = await fetch('/api/generate/before-after', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_id: img.id }) })
    const data = await res.json()
    if (res.ok) setBeforeAfterData({ before_url: data.before_url, after_url: data.after_url, composite_url: data.composite_url })
    setGenerating(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setSliderPos(Math.round(x * 100))
  }

  const handleExport = async () => {
    if (!beforeAfterData?.composite_url) {
      // Client-side: download the after image
      window.open(beforeAfterData?.after_url, '_blank'); return
    }
    setExportLoading(true)
    const a = document.createElement('a'); a.href = beforeAfterData.composite_url
    a.download = `before-after-${Date.now()}.jpg`; a.click()
    setExportLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Before & After</h2>
        <p className="text-xs text-gray-400">Slider interactiv + export imagine compusă pentru social media</p>
      </div>

      {!selectedImg ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">Alege o imagine din galerie</p>
          </div>
          {loading ? <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400"/></div>
          : gallery.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Generează mai întâi o imagine din tab-ul Generator</div>
          : <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-4">
              {gallery.map(img => (
                <button key={img.id} onClick={() => handleSelect(img)} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 hover:border-gray-900 transition-all">
                  <img src={img.generated_image_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold">Selectează</span>
                  </div>
                </button>
              ))}
            </div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedImg(null); setBeforeAfterData(null) }} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
            <p className="text-sm font-semibold text-gray-800">{selectedImg.product_title}</p>
          </div>

          {generating && <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-gray-400"/><p className="text-sm text-gray-500">Se generează composita...</p></div>}

          {beforeAfterData && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Slider Before / After</p>
                <div className="flex gap-2">
                  <button onClick={handleExport} disabled={exportLoading} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    {exportLoading?<Loader2 className="h-3 w-3 animate-spin"/>:<Download className="h-3 w-3"/>}Export imagine
                  </button>
                </div>
              </div>
              {/* Slider */}
              <div ref={containerRef} className="relative aspect-square select-none cursor-col-resize"
                onMouseMove={handleMouseMove} onMouseDown={() => isDragging.current=true}
                onMouseUp={() => isDragging.current=false} onMouseLeave={() => isDragging.current=false}>
                {/* Before */}
                <img src={beforeAfterData.before_url} alt="Înainte" className="absolute inset-0 w-full h-full object-cover" />
                {/* After - clip */}
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100-sliderPos}% 0 0)` }}>
                  <img src={beforeAfterData.after_url} alt="După" className="w-full h-full object-cover" />
                </div>
                {/* Divider */}
                <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${sliderPos}%` }}>
                  <div className="absolute inset-y-0 w-0.5 bg-white shadow-lg" style={{ left: '-1px' }} />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-xl flex items-center justify-center">
                    <ChevronRight className="h-3 w-3 text-gray-600 -ml-0.5" />
                    <ChevronRight className="h-3 w-3 text-gray-600 -ml-2.5 rotate-180" />
                  </div>
                </div>
                {/* Labels */}
                <div className="absolute bottom-3 left-3 text-[10px] font-black text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur">ÎNAINTE</div>
                <div className="absolute bottom-3 right-3 text-[10px] font-black text-white bg-gray-900/70 px-2 py-0.5 rounded-full backdrop-blur">DUPĂ AI</div>
              </div>
              {/* Slider control */}
              <div className="p-4">
                <input type="range" min={0} max={100} value={sliderPos} onChange={e => setSliderPos(Number(e.target.value))}
                  className="w-full accent-gray-900" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BULK TAB ─────────────────────────────────────────────────────────────────
function BulkTab() {
  const { credits } = useCredits()
  const [jobs, setJobs] = useState<BulkJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProds, setLoadingProds] = useState(false)
  const [style, setStyle] = useState('white_bg')
  const [priority, setPriority] = useState('normal')
  const [autoPublish, setAutoPublish] = useState(false)
  const [maxProducts, setMaxProducts] = useState(50)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [estimate, setEstimate] = useState<{ credits: number; products: number; minutes: number } | null>(null)

  const STYLE_COSTS: Record<string, number> = { white_bg:2, lifestyle:3, premium_dark:3, industrial:3, seasonal:4, manual:3 }
  const creditCost = STYLE_COSTS[style] || 3

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/images/bulk')
    const data = await res.json()
    setJobs(data.jobs || [])
    setLoadingJobs(false)
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  const loadProducts = async () => {
    setLoadingProds(true)
    const params = new URLSearchParams({ per_page: '200', parent_only: 'true' })
    const res = await fetch('/api/products?' + params)
    const data = await res.json()
    setProducts(data.products || [])
    setLoadingProds(false)
  }

  const handleEstimate = () => {
    const count = selectedIds.length || maxProducts
    setEstimate({ credits: count * creditCost, products: count, minutes: Math.ceil(count * 1.5) })
    setShowConfirm(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true); setError(''); setShowConfirm(false)
    const body: any = { style, auto_publish: autoPublish, max_products: maxProducts, priority }
    if (selectedIds.length > 0) body.product_ids = selectedIds
    const res = await fetch('/api/images/bulk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error||'Eroare'); setSubmitting(false); return }
    await loadJobs()
    setSubmitting(false); setSelectedIds([])
    triggerCreditsRefresh()
  }

  const cancelJob = async (id: string) => {
    await fetch('/api/images/bulk', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await loadJobs()
  }

  const jobStatusColor = (s: string) => ({ queued:'text-amber-600 bg-amber-50', processing:'text-blue-600 bg-blue-50', completed:'text-emerald-600 bg-emerald-50', failed:'text-red-500 bg-red-50', cancelled:'text-gray-400 bg-gray-100' }[s] || 'text-gray-400 bg-gray-100')
  const jobStatusLabel = (s: string) => ({ queued:'În coadă', processing:'În procesare', completed:'Finalizat', failed:'Eșuat', cancelled:'Anulat' }[s] || s)

  const PRIORITY_OPTIONS = [
    { value:'normal',     label:'Toate produsele',      desc:'Procesează tot catalogul' },
    { value:'no_image',   label:'Fără imagine bună',    desc:'Produse cu imagine lipsă' },
    { value:'high_sales', label:'Cele mai vândute',     desc:'Prioritizează top vânzări' },
    { value:'manual',     label:'Selectie manuală',     desc:'Alegi tu produsele' },
  ]

  return (
    <div className="space-y-4">
      {/* Config form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Generare în masă</h2>
          <p className="text-xs text-gray-400 mt-0.5">Procesează sute de produse automat în background</p>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}

          {/* Style */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Stil imagine</label>
            <div className="grid grid-cols-3 gap-2">
              {PRODUCT_STYLES.filter(s => s.value !== 'manual').map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all bg-gradient-to-br ${s.gradient} ${style===s.value?'border-gray-900':'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-xs font-bold ${s.dark?'text-white':'text-gray-900'}`}>{s.label}</p>
                  <Badge className={`mt-1 text-[10px] border-0 ${s.dark?'bg-white/20 text-white':'bg-white/80 text-gray-600'}`}>{s.cost} cr</Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Selectie produse</label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p.value} onClick={() => { setPriority(p.value); if(p.value==='manual') loadProducts() }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${priority===p.value?'border-gray-900 bg-gray-50':'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-bold text-gray-900">{p.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Manual selection */}
          {priority === 'manual' && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} className="overflow-hidden">
              {loadingProds ? <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><Loader2 className="h-4 w-4 animate-spin"/>Se încarcă...</div>
              : <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{selectedIds.length} produse selectate</p>
                    <button onClick={() => setSelectedIds(selectedIds.length===products.length ? [] : products.map(p=>p.id))} className="text-xs text-gray-500 hover:text-gray-800">
                      {selectedIds.length===products.length?'Deselectează tot':'Selectează tot'}
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {products.map(p => {
                      const checked = selectedIds.includes(p.id)
                      return (
                        <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev,p.id] : prev.filter(id=>id!==p.id))} className="rounded" />
                          <div className="h-8 w-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            {(p.thumbnail_url||p.original_images?.[0]) && <img src={p.thumbnail_url||p.original_images![0]} alt="" className="h-full w-full object-cover"/>}
                          </div>
                          <p className="text-xs text-gray-700 truncate flex-1">{p.optimized_title||p.original_title}</p>
                        </label>
                      )
                    })}
                  </div>
                </div>}
            </motion.div>
          )}

          {/* Max products (non-manual) */}
          {priority !== 'manual' && (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Număr maxim produse ({maxProducts})</label>
              <input type="range" min={10} max={200} step={10} value={maxProducts} onChange={e=>setMaxProducts(Number(e.target.value))} className="w-full accent-gray-900" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>10</span><span>100</span><span>200</span></div>
            </div>
          )}

          {/* Auto-publish toggle */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">Auto-publică în WooCommerce</p>
              <p className="text-xs text-gray-400 mt-0.5">Înlocuiește automat imaginea principală după generare</p>
            </div>
            <button onClick={() => setAutoPublish(!autoPublish)} className="transition-colors">
              {autoPublish ? <ToggleRight className="h-7 w-7 text-emerald-500"/> : <ToggleLeft className="h-7 w-7 text-gray-300"/>}
            </button>
          </div>

          {/* Estimate + Submit */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-gray-400">
              ~{((selectedIds.length||maxProducts)*creditCost).toLocaleString()} credite estimate · ai {credits} disponibile
            </div>
            <Button onClick={handleEstimate} disabled={submitting || credits < creditCost} className="bg-gray-900 hover:bg-gray-700 rounded-xl h-10 px-5 text-sm">
              {submitting?<><Loader2 className="h-4 w-4 animate-spin mr-2"/>Se procesează...</>:<><Zap className="h-4 w-4 mr-2"/>Lansează job</>}
            </Button>
          </div>

          {/* Confirm modal */}
          <AnimatePresence>
            {showConfirm && estimate && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="border-2 border-gray-900 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Confirmare job</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[{label:'Produse',val:estimate.products},{label:'Credite',val:estimate.credits},{label:'Timp est.',val:`~${estimate.minutes}min`}].map(x=>(
                    <div key={x.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-lg font-bold text-gray-900">{x.val}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{x.label}</p>
                    </div>
                  ))}
                </div>
                {estimate.credits > credits && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0"/>Credite insuficiente! Îți lipsesc {estimate.credits-credits} credite.</div>}
                <div className="flex gap-2">
                  <button onClick={()=>setShowConfirm(false)} className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50">Anulează</button>
                  <button onClick={handleSubmit} disabled={estimate.credits>credits||submitting} className="flex-1 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 rounded-xl py-2 flex items-center justify-center gap-2">
                    {submitting?<Loader2 className="h-4 w-4 animate-spin"/>:<Zap className="h-4 w-4"/>}Confirmă
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Job-uri active & istorice</h3>
            <button onClick={loadJobs} className="text-gray-400 hover:text-gray-600"><RefreshCw className="h-3.5 w-3.5"/></button>
          </div>
          <div className="divide-y divide-gray-50">
            {jobs.map(job => {
              const pct = job.total_products > 0 ? Math.round(((job.completed_count+job.failed_count)/job.total_products)*100) : 0
              return (
                <div key={job.id} className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{styleLabel(job.style)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${jobStatusColor(job.status)}`}>{jobStatusLabel(job.status)}</span>
                        {job.auto_publish && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Auto-publish</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{job.completed_count}/{job.total_products} completate · {job.credits_used} cr · {new Date(job.created_at).toLocaleDateString('ro-RO')}</p>
                    </div>
                    {(job.status==='queued'||job.status==='processing') && (
                      <button onClick={() => cancelJob(job.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 shrink-0"><StopCircle className="h-3.5 w-3.5"/>Anulează</button>
                    )}
                  </div>
                  {(job.status==='processing'||job.status==='queued') && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gray-900 rounded-full" animate={{width:`${pct}%`}} transition={{duration:0.5}} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {loadingJobs && <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400"/><span className="text-sm text-gray-500">Se încarcă job-urile...</span></div>}
    </div>
  )
}

// ─── BRAND KIT TAB ───────────────────────────────────────────────────────────
function BrandTab() {
  const [kit, setKit] = useState<BrandKit | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [ratingStats, setRatingStats] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaults: BrandKit = { logo_url:null, primary_color:'#000000', secondary_color:'#ffffff', accent_color:'#3b82f6', brand_name:'', font_style:'modern', tone:'professional' }

  useEffect(() => {
    Promise.all([
      fetch('/api/brand-kit').then(r=>r.json()),
      fetch('/api/images/rate').then(r=>r.json()),
    ]).then(([bData, rData]) => {
      setKit(bData.brand_kit || defaults)
      if (bData.brand_kit?.logo_url) setLogoPreview(bData.brand_kit.logo_url)
      setRatingStats(rData.style_stats || [])
      setLoading(false)
    })
  }, [])

  const handleLogoUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { const b64 = ev.target?.result as string; setLogoBase64(b64); setLogoPreview(b64) }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!kit) return
    setSaving(true); setSaved(false)
    const payload: any = { ...kit }
    if (logoBase64) { payload.logo_base64 = logoBase64; delete payload.logo_url }
    const res = await fetch('/api/brand-kit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) { setKit(data.brand_kit); if(data.logo_url) setLogoPreview(data.logo_url); setSaved(true); setTimeout(()=>setSaved(false),2000) }
    setSaving(false)
  }

  const handleDetect = async () => {
    setDetecting(true)
    const res = await fetch('/api/brand-kit', { method:'PATCH' })
    const data = await res.json()
    if (res.ok && data.detected) {
      setKit(prev => prev ? { ...prev, ...data.detected, font_style: data.detected.font_suggestion||prev.font_style, tone: data.detected.tone_suggestion||prev.tone } : prev)
    }
    setDetecting(false)
  }

  const FONT_STYLES = ['modern','classic','bold','minimal']
  const TONES = ['professional','friendly','luxury','playful']

  const STYLE_LABELS: Record<string,string> = { white_bg:'Simplu', lifestyle:'Lifestyle', premium_dark:'Premium Dark', industrial:'Industrial', seasonal:'De sezon', manual:'Manual' }

  if (loading) return <div className="bg-white rounded-2xl border border-gray-100 p-8 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-gray-400"/><span className="text-sm text-gray-500">Se încarcă...</span></div>
  if (!kit) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Brand Kit</h2>
          <p className="text-xs text-gray-400 mt-0.5">Defini-ți identitatea vizuală — aplicată automat în toate generările</p>
        </div>
        <button onClick={handleDetect} disabled={detecting} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 shrink-0">
          {detecting?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<TrendingUp className="h-3.5 w-3.5"/>}AI Detectează
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Logo + Name */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Identitate</h3>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Logo</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors shrink-0" onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-contain p-1"/>
                : <Plus className="h-5 w-5 text-gray-300"/>}
              </div>
              <div>
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-gray-600 font-semibold hover:text-gray-900">Încarcă logo</button>
                <p className="text-[10px] text-gray-400 mt-0.5">PNG transparent recomandat</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} className="hidden"/>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Numele brandului</label>
            <input value={kit.brand_name} onChange={e => setKit(k => k ? {...k,brand_name:e.target.value} : k)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400" placeholder="Ex: MagazinulMeu" />
          </div>
        </div>

        {/* Colors */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Culori</h3>
          {[
            { key:'primary_color',   label:'Culoare principală' },
            { key:'secondary_color', label:'Culoare secundară' },
            { key:'accent_color',    label:'Accent' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <input type="color" value={(kit as any)[key]} onChange={e => setKit(k => k ? {...k,[key]:e.target.value} : k)}
                className="h-9 w-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-[10px] font-mono text-gray-400">{(kit as any)[key]}</p>
              </div>
              <div className="h-9 w-24 rounded-xl border border-gray-200" style={{ backgroundColor: (kit as any)[key] }} />
            </div>
          ))}
        </div>

        {/* Style + Tone */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Stil & Ton</h3>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Font style</label>
            <div className="flex gap-2 flex-wrap">
              {FONT_STYLES.map(f => (
                <button key={f} onClick={() => setKit(k => k ? {...k,font_style:f} : k)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all capitalize ${kit.font_style===f?'border-gray-900 bg-gray-900 text-white':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Ton brand</label>
            <div className="flex gap-2 flex-wrap">
              {TONES.map(t => (
                <button key={t} onClick={() => setKit(k => k ? {...k,tone:t} : k)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all capitalize ${kit.tone===t?'border-gray-900 bg-gray-900 text-white':'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {kit.style_summary && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stil detectat AI</p>
              <p className="text-xs text-gray-700">{kit.style_summary}</p>
            </div>
          )}
        </div>

        {/* Rating stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Istoricul preferințelor</h3>
          {ratingStats.length === 0
            ? <p className="text-xs text-gray-400">Evaluează imaginile generate pentru a vedea statistici</p>
            : <div className="space-y-2">
                {ratingStats.map(s => (
                  <div key={s.style} className="flex items-center gap-3">
                    <p className="text-xs text-gray-700 w-28 shrink-0">{STYLE_LABELS[s.style]||s.style}</p>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{width:`${(s.avg_rating/5)*100}%`}} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400"/>
                      <span className="text-xs font-bold text-gray-700">{s.avg_rating}</span>
                      <span className="text-[10px] text-gray-400">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className={`rounded-xl h-10 px-6 text-sm transition-colors ${saved?'bg-emerald-600 hover:bg-emerald-600':'bg-gray-900 hover:bg-gray-700'}`}>
          {saving?<><Loader2 className="h-4 w-4 animate-spin mr-2"/>Salvez...</>:saved?<><CheckCircle className="h-4 w-4 mr-2"/>Salvat!</>:<>Salvează Brand Kit</>}
        </Button>
      </div>
    </div>
  )
}

// ─── GALLERY TAB ─────────────────────────────────────────────────────────────
function GalleryTab({ gallery, onUpdate }: { gallery: GeneratedImage[]; onUpdate: () => void }) {
  const [filter, setFilter] = useState<'all'|'product'|'promo'|'banner'|'published'>('all')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<GeneratedImage | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const filtered = gallery.filter(img => {
    const isPromo = img.style.startsWith('promo_')
    const isBanner = img.style.startsWith('banner_')
    const isPublished = !!img.wc_published_at
    const matchFilter = filter==='all' || (filter==='promo'&&isPromo) || (filter==='banner'&&isBanner) || (filter==='published'&&isPublished) || (filter==='product'&&!isPromo&&!isBanner)
    const matchSearch = !search || img.product_title?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const handlePublish = async (img: GeneratedImage, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!img.product_id) return
    setPublishing(img.id)
    await fetch('/api/generate/publish-to-woo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_id: img.id, product_id: img.product_id, set_as_main: true }) })
    setPublishing(null); onUpdate()
  }

  const handleRate = async (img: GeneratedImage, r: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/images/rate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_id: img.id, rating: r }) })
    onUpdate()
  }

  const handleDownloadAll = async (imgs: GeneratedImage[]) => {
    for (const img of imgs.slice(0,25)) {
      const a = document.createElement('a'); a.href = img.generated_image_url
      a.download = `ai-${img.product_title?.replace(/\s+/g,'_')}-${img.style}.png`; a.target='_blank'; a.click()
      await new Promise(r => setTimeout(r, 400))
    }
  }

  const FILTER_OPTIONS = [
    { value:'all', label:'Toate' },
    { value:'product', label:'Produs' },
    { value:'promo', label:'Promo' },
    { value:'banner', label:'Banner' },
    { value:'published', label:'Publicate' },
  ]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter===f.value?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"/>
          <Input placeholder="Caută..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-white" />
        </div>
        {filtered.length > 0 && (
          <button onClick={() => handleDownloadAll(filtered)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-2 rounded-xl hover:bg-gray-50 shrink-0">
            <Download className="h-3.5 w-3.5"/>Export ZIP ({Math.min(filtered.length,25)})
          </button>
        )}
      </div>

      {gallery.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <ImageIcon className="h-10 w-10 text-gray-200 mx-auto mb-3"/>
          <p className="text-gray-400 text-sm">Nicio imagine generată încă.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 text-sm">Nicio imagine pentru filtrul selectat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((img, i) => {
            const isPromo = img.style.startsWith('promo_')
            const isBanner = img.style.startsWith('banner_')
            const isPublished = !!img.wc_published_at
            return (
              <motion.div key={img.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i*0.02,0.3)}}>
                <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer" onClick={() => setPreview(img)}>
                  <div className="relative aspect-square bg-gray-50 overflow-hidden">
                    <img src={img.generated_image_url} alt={img.product_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                      <Badge className={`border-0 text-[10px] ${isPromo?'bg-gray-700/80 text-white':isBanner?'bg-blue-700/80 text-white':'bg-black/50 text-white'} backdrop-blur`}>
                        {isPromo?'Promo':isBanner?'Banner':styleLabel(img.style)}
                      </Badge>
                      {isPublished && <Badge className="border-0 text-[10px] bg-emerald-600/80 text-white backdrop-blur">Live</Badge>}
                    </div>
                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                      <button onClick={e=>{e.stopPropagation();window.open(img.generated_image_url,'_blank')}}
                        className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg">
                        <Download className="h-4 w-4"/>
                      </button>
                      {img.product_id && !isPublished && (
                        <button onClick={e=>handlePublish(img,e)}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 delay-75 transition-all h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg">
                          {publishing===img.id?<Loader2 className="h-4 w-4 animate-spin"/>:<Globe className="h-4 w-4"/>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-gray-900 line-clamp-1">{img.product_title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400">{new Date(img.created_at).toLocaleDateString('ro-RO')}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n=>(
                          <button key={n} onClick={e=>handleRate(img,n,e)}>
                            <Star className={`h-2.5 w-2.5 ${n<=(img.rating||0)?'text-amber-400 fill-amber-400':'text-gray-200'}`}/>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setPreview(null)}>
            <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9}}
              className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={e=>e.stopPropagation()}>
              <div className="aspect-square bg-gray-50"><img src={preview.generated_image_url} alt={preview.product_title} className="w-full h-full object-contain"/></div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{preview.product_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{styleLabel(preview.style)} · {preview.credits_used} credite · {new Date(preview.created_at).toLocaleDateString('ro-RO')}</p>
                  </div>
                  <StarRating value={preview.rating||null} onChange={async r => { await fetch('/api/images/rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_id:preview.id,rating:r})}); setPreview(p=>p?{...p,rating:r}:p); onUpdate() }} />
                </div>
                {preview.prompt && (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prompt AI folosit</p>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{preview.prompt}</p>
                  </div>
                )}
                {/* Variants */}
                {preview.variants && preview.variants.length > 1 && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Variante generate</p>
                    <div className="flex gap-2">
                      {preview.variants.map((url,i) => (
                        <div key={i} className="h-16 w-16 rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:border-gray-900" onClick={()=>setPreview(p=>p?{...p,generated_image_url:url}:p)}>
                          <img src={url} alt="" className="w-full h-full object-cover"/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={()=>window.open(preview.generated_image_url,'_blank')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-700 flex-1 justify-center">
                    <Download className="h-4 w-4"/>Descarcă
                  </button>
                  {preview.product_id && !preview.wc_published_at && (
                    <button onClick={e=>handlePublish(preview,e)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                      <Globe className="h-4 w-4"/>Publică
                    </button>
                  )}
                  <button onClick={()=>setPreview(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">Închide</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ImagesPage() {
  const { credits } = useCredits()
  const [mainTab, setMainTab] = useState<MainTab>('generator')
  const [genTab, setGenTab] = useState<GenTab>('product')
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const season = getCurrentSeason()

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/images')
      const data = await res.json()
      setGallery(data.images || [])
    } finally { setGalleryLoading(false) }
  }, [])

  const fetchBrandKit = useCallback(async () => {
    const res = await fetch('/api/brand-kit')
    const data = await res.json()
    setBrandKit(data.brand_kit)
  }, [])

  useEffect(() => { fetchGallery(); fetchBrandKit() }, [fetchGallery, fetchBrandKit])

  const handleNewImage = (img: GeneratedImage) => {
    setGallery(prev => {
      const exists = prev.find(i => i.id === img.id)
      return exists ? prev.map(i => i.id === img.id ? img : i) : [img, ...prev]
    })
    // Refresh from DB after 2s to confirm saved record
    setTimeout(() => fetchGallery(), 2000)
  }

  const MAIN_TABS: { value: MainTab; label: string; icon: any }[] = [
    { value: 'generator', label: 'Generator', icon: Wand2 },
    { value: 'bulk',      label: 'Masă',      icon: Layers },
    { value: 'brand',     label: 'Brand Kit', icon: Palette },
    { value: 'gallery',   label: 'Galerie',   icon: ImageIcon },
  ]

  const GEN_TABS: { value: GenTab; label: string; badge?: string }[] = [
    { value: 'product',     label: 'Imagine Produs' },
    { value: 'promo',       label: 'Poster Promo' },
    { value: 'banner',      label: 'Banner Categorie' },
    { value: 'before_after',label: 'Before & After' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imagini AI</h1>
          <p className="text-sm text-gray-400 mt-0.5">Generare, bulk processing, brand kit și galerie</p>
        </div>
        <div className="flex items-center gap-2">
          {season && (
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-500"/>
              <span className="text-xs font-semibold text-amber-700">{season.label}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-gray-500"/>
            <span className="text-sm font-bold text-gray-700">{credits}</span>
            <span className="text-xs text-gray-400">credite</span>
          </div>
        </div>
      </div>

      {/* ── Main tabs ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {MAIN_TABS.map(t => {
          const Icon = t.icon
          const isActive = mainTab === t.value
          return (
            <button key={t.value} onClick={() => setMainTab(t.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4"/>
              {t.label}
              {t.value === 'gallery' && gallery.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'}`}>{gallery.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {/* GENERATOR TAB */}
        {mainTab === 'generator' && (
          <motion.div key="generator" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-4">
            {/* Gen sub-tabs */}
            <div className="flex gap-2 border-b border-gray-100 pb-0">
              {GEN_TABS.map(t => (
                <button key={t.value} onClick={() => setGenTab(t.value)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${genTab===t.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.label}
                  {t.badge && <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px]">{t.badge}</Badge>}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {genTab === 'product' && (
                <motion.div key="gen-product" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                  <ProductGenerator onImageGenerated={handleNewImage} brandKit={brandKit} />
                </motion.div>
              )}
              {genTab === 'promo' && (
                <motion.div key="gen-promo" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                  <PromoGenerator onImageGenerated={handleNewImage} brandKit={brandKit} />
                </motion.div>
              )}
              {genTab === 'banner' && (
                <motion.div key="gen-banner" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                  <BannerGenerator onImageGenerated={handleNewImage} />
                </motion.div>
              )}
              {genTab === 'before_after' && (
                <motion.div key="gen-ba" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                  <BeforeAfterTab />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* BULK TAB */}
        {mainTab === 'bulk' && (
          <motion.div key="bulk" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <BulkTab />
          </motion.div>
        )}

        {/* BRAND TAB */}
        {mainTab === 'brand' && (
          <motion.div key="brand" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <BrandTab />
          </motion.div>
        )}

        {/* GALLERY TAB */}
        {mainTab === 'gallery' && (
          <motion.div key="gallery" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            {galleryLoading
              ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(8)].map((_,i)=><div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse"/>)}</div>
              : <GalleryTab gallery={gallery} onUpdate={fetchGallery} />
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}