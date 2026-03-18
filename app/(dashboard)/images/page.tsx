'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImageIcon, Loader2, Download, Search, X, Sparkles,
  Upload, Check, Package, ArrowRight, RefreshCw, AlertCircle,
  CheckCircle, Wand2, Coins, Megaphone, Camera,
  Edit3, Star, Layers, Zap, Bell, Trash2,
  BarChart3, Palette, Globe, StopCircle,
  Plus, Minus, TrendingUp, FileText, DollarSign,
} from 'lucide-react'
import { triggerCreditsRefresh, useCredits } from '@/hooks/use-credits'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string; original_title: string; optimized_title: string | null
  original_images: string[] | null; thumbnail_url: string | null
  category: string | null; price: number | null
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
  style_summary?: string
}
type BulkJob = {
  id: string; status: string; style: string; total_products: number
  completed_count: number; failed_count: number; auto_publish: boolean
  credits_used: number; created_at: string
}

type ProductStep = 'select_image' | 'select_style' | 'generating' | 'done'
type PromoStep   = 'select_image' | 'select_style' | 'edit_text' | 'generating' | 'done'
type MainTab     = 'generator' | 'bulk' | 'brand' | 'gallery'
type GenTab      = 'product' | 'promo'
type PromoText   = { headline: string; subtitle: string; benefits: string[]; cta: string; price_text: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const getProductStyles = (t: (k: string, p?: Record<string, string | number>) => string) => [
  { value: 'white_bg',     label: t('images.style_simple'),       desc: t('images.white_bg_desc'), cost: 2 },
  { value: 'lifestyle',    label: 'Lifestyle',    desc: t('images.lifestyle_desc'),          cost: 3 },
  { value: 'premium_dark', label: 'Premium Dark', desc: t('images.premium_desc'),               cost: 3 },
  { value: 'industrial',   label: 'Industrial',   desc: t('images.style_industrial_desc'),           cost: 3 },
  { value: 'seasonal',     label: t('images.style_seasonal_label'),     desc: t('images.style_seasonal_short'),                 cost: 4 },
  { value: 'manual',       label: 'Manual',       desc: t('images.manual_desc'),         cost: 3 },
]
const getPromoStyles = (t: (k: string, p?: Record<string, string | number>) => string) => [
  { value: 'modern_minimalist', label: 'Modern Minimalist', desc: t('images.promo_modern_desc'),          cost: 4 },
  { value: 'bold_dynamic',      label: 'Bold & Dynamic',    desc: t('images.promo_bold_desc'),    cost: 4 },
  { value: 'elegant_luxury',    label: 'Elegant Luxury',    desc: t('images.promo_elegant_desc'),  cost: 4 },
  { value: 'vibrant_sale',      label: 'Vibrant Sale',      desc: t('images.seasonal_desc'),     cost: 4 },
  { value: 'dark_premium',      label: 'Dark Premium',      desc: t('images.promo_dark_desc'),          cost: 4 },
  { value: 'gradient_pop',      label: 'Gradient Pop',      desc: t('images.promo_gradient_desc'),   cost: 4 },
]

const getAllStyles = (t: (k: string, p?: Record<string, string | number>) => string) => [...getProductStyles(t), ...getPromoStyles(t).map(s => ({ ...s, value: `promo_${s.value}` }))]
function getStyleLabel(t: (k: string, p?: Record<string, string | number>) => string) { return (val: string) => getAllStyles(t).find(s => s.value === val)?.label || val }

function getCurrentSeason(t: (k: string, p?: Record<string, string | number>) => string) {
  const m = new Date().getMonth() + 1
  if (m === 11) return { label: 'Black Friday', style: 'bold_dynamic', reason: 'Noiembrie — sezon Black Friday' }
  if (m === 12) return { label: t('images.season_christmas'),      style: 'seasonal',    reason: t('images.season_christmas_reason') }
  if (m === 2)  return { label: 'Valentine',    style: 'elegant_luxury', reason: 'Februarie — Valentine Day' }
  if (m >= 3 && m <= 5) return { label: t('images.season_spring'), style: 'lifestyle', reason: t('images.season_spring_reason') }
  if (m >= 6 && m <= 8) return { label: t('images.season_summer'),      style: 'lifestyle', reason: t('images.season_summer_reason') }
  return null
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`} onClick={onClick}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost' | 'success'; size?: 'sm' | 'md'; className?: string
}) {
  const base  = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const vars  = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
    success: 'bg-emerald-600 text-white',
  }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${vars[variant]} ${className}`}>{children}</button>
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] font-medium text-neutral-400 uppercase tracking-wide ${className}`}>{children}</p>
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}>{children}</span>
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepDots({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className={`h-1.5 rounded-full transition-all ${i < idx ? 'bg-emerald-400 w-1.5' : i === idx ? 'bg-neutral-900 w-5' : 'bg-neutral-200 w-1.5'}`} />
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
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
      <button onClick={onClose} className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>
          <Star className={`h-4 w-4 ${n <= (hover || value || 0) ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'}`} />
        </button>
      ))}
    </div>
  )
}

// ─── Product Picker ───────────────────────────────────────────────────────────

function ProductPicker({ onSelect, onClose }: { onSelect: (p: Product) => void; onClose: () => void }) {
  const { t } = useT()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const load = useCallback(async (q = '') => {
    setLoading(true)
    const params = new URLSearchParams({ per_page: '100', parent_only: 'true' })
    if (q) params.set('search', q)
    const res  = await fetch('/api/products?' + params)
    const data = await res.json()
    setProducts(data.products || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setTimeout(() => load(search), 350); return () => clearTimeout(t) }, [search, load])

  return (
    <Card className="overflow-hidden shadow-lg mt-3" onClick={e => e.stopPropagation()}>
      <div className="p-2 border-b border-neutral-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} autoFocus placeholder={t('images.search_product')}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg border border-neutral-200 focus:outline-none focus:border-neutral-400" />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading
          ? <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-neutral-400" /></div>
          : products.length === 0
          ? <p className="text-[12px] text-neutral-400 text-center py-6">{t('images.no_product_found')}</p>
          : products.map(p => {
              const img = p.thumbnail_url || p.original_images?.[0]
              return (
                <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 transition-colors text-left">
                  <div className="h-9 w-9 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-3.5 w-3.5 text-neutral-300 m-2.5" />}
                  </div>
                  <p className="text-[12px] text-neutral-800 leading-snug">{p.optimized_title || p.original_title}</p>
                </button>
              )
            })}
      </div>
      <div className="p-2 border-t border-neutral-100">
        <button onClick={onClose} className="w-full text-[11px] text-neutral-400 hover:text-neutral-600 py-1">{t('common.close_label')}</button>
      </div>
    </Card>
  )
}

// ─── Image Source Selector ────────────────────────────────────────────────────

function ImageSourceSelector({ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage,
  uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }: any) {
  const { t } = useT()
  return (
    <div className="space-y-4">
      <p className="text-[13px] font-semibold text-neutral-900">{t('images.choose_ref_image')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* From store */}
        <div className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${showPicker || selectedProduct ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}
          onClick={() => setShowPicker(true)}>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-neutral-600" /></div>
            <div>
              <p className="text-[13px] font-semibold text-neutral-900">{t('images.from_store')}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.select_product_first')}</p>
            </div>
          </div>
          {selectedProduct && (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-white rounded-xl border border-neutral-200">
              <div className="h-9 w-9 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                {selectedProductImage ? <img src={selectedProductImage} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-3.5 w-3.5 text-neutral-300 m-2.5" />}
              </div>
              <p className="text-[11px] font-medium text-neutral-800 flex-1 truncate">{selectedProduct.optimized_title || selectedProduct.original_title}</p>
              <button onClick={e => { e.stopPropagation(); setSelectedProduct(null); setSelectedProductImage(null) }} className="text-neutral-300 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {showPicker && !selectedProduct && (
            <ProductPicker
              onSelect={p => { setSelectedProduct(p); setSelectedProductImage(p.thumbnail_url || p.original_images?.[0] || null); setUploadedImage(null); setShowPicker(false) }}
              onClose={() => setShowPicker(false)} />
          )}
        </div>
        {/* Upload */}
        <div className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${uploadedImage ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}
          onClick={() => fileInputRef.current?.click()}>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0"><Upload className="h-4 w-4 text-neutral-600" /></div>
            <div>
              <p className="text-[13px] font-semibold text-neutral-900">{t('images.upload_image')}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.gen_jpg_upload')}</p>
            </div>
          </div>
          {uploadedImage ? (
            <div className="mt-3 flex items-center gap-2 p-2.5 bg-white rounded-xl border border-neutral-200">
              <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0"><img src={uploadedImage} alt="" className="h-full w-full object-cover" /></div>
              <p className="text-[11px] text-neutral-600 flex-1">{t('images.your_image')}</p>
              <button onClick={e => { e.stopPropagation(); setUploadedImage(null); setUploadedImageFile(null) }} className="text-neutral-300 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="mt-3 border-2 border-dashed border-neutral-200 rounded-xl py-5 text-center">
              <Upload className="h-4 w-4 text-neutral-300 mx-auto mb-1" />
              <p className="text-[11px] text-neutral-400">{t('images.click_to_select')}</p>
            </div>
          )}
        </div>
      </div>
      {/* Image variants */}
      {selectedProduct?.original_images && selectedProduct.original_images.length > 1 && (
        <div className="space-y-2">
          <SectionLabel>{t('images.choose_ref_image')}</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {selectedProduct.original_images.map((img: string, i: number) => (
              <button key={i} onClick={() => setSelectedProductImage(img)}
                className={`h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${selectedProductImage === img ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'}`}>
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
  const { t } = useT()
  useEffect(() => {
    if (!taskId) return
    const url = `/api/generate/progress?task_id=${taskId}${imageRecordId ? `&image_record_id=${imageRecordId}` : ''}`
    const es = new EventSource(url)
    es.onmessage = e => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'done')    { es.close(); onDone(data.urls || [data.primary_url]) }
        if (data.type === 'error')   { es.close(); onError(data.message || t('common.error_generic')) }
        if (data.type === 'timeout') { es.close(); onError(t('images.error_timeout')) }
      } catch {}
    }
    es.onerror = () => { es.close(); onError(t('images.error_connection_interrupted')) }
    return () => { es.close() }
  }, [taskId])
}

// ─── Generating Screen ────────────────────────────────────────────────────────

function GeneratingScreen({ taskId, imageRecordId, onDone, onError, variantCount = 1 }: {
  taskId: string | null; imageRecordId: string | null
  onDone: (urls: string[]) => void; onError: (msg: string) => void; variantCount?: number
}) {
  const { t } = useT()
  useGenerationProgress(taskId, imageRecordId, onDone, onError)
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="relative mb-8">
        <div className="h-20 w-20 rounded-2xl bg-neutral-900 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-neutral-900 animate-ping opacity-10" />
      </div>
      <p className="text-[17px] font-semibold text-neutral-900 mb-2">{t('images.ai_generating')}</p>
      <p className="text-[13px] text-neutral-400 mb-6">
        {t('images.gpt_builds_prompt')}
        {variantCount > 1 && <span className="ml-1 font-semibold text-neutral-700">{variantCount} variante</span>}
      </p>
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 rounded-full border border-neutral-100">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        <span className="text-[13px] text-neutral-500">{t('images.generation_time')}</span>
      </div>
    </div>
  )
}

// ─── Style Selector ───────────────────────────────────────────────────────────

function StyleSelector({ styles, selected, onSelect, credits, season }: {
  styles: ReturnType<typeof getProductStyles>; selected: string | null; onSelect: (v: string) => void
  credits: number; season?: ReturnType<typeof getCurrentSeason>
}) {
  const { t } = useT()
  return (
    <div className="space-y-3">
      {season && styles.find(s => s.value === season.style) && (
        <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => onSelect(season.style)}>
          <Bell className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-800">{t('images.gen_recommended_now')} — {season.label}</p>
            <p className="text-[10px] text-amber-600">{season.reason}</p>
          </div>
          <Badge className={`${selected === season.style ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-700'}`}>
            {selected === season.style ? t('common.selected_label') : t('common.select')}
          </Badge>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {styles.map(style => {
          const sel      = selected === style.value
          const canAfford = credits >= style.cost
          return (
            <button key={style.value} onClick={() => canAfford && onSelect(style.value)} disabled={!canAfford}
              className={`relative p-3.5 rounded-xl border-2 text-left transition-all ${!canAfford ? 'opacity-40 cursor-not-allowed' : sel ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'}`}>
              {sel && <div className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-neutral-900 flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></div>}
              <p className="text-[12px] font-semibold text-neutral-900 mb-0.5">{style.label}</p>
              <p className="text-[11px] text-neutral-400 leading-snug">{style.desc}</p>
              <Badge className="mt-2 bg-neutral-100 text-neutral-600">{style.cost} cr</Badge>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── PRODUCT IMAGE GENERATOR ──────────────────────────────────────────────────

function ProductGenerator({ onImageGenerated, brandKit }: { onImageGenerated: (img: GeneratedImage) => void; brandKit: BrandKit | null }) {
  const { t } = useT()
  const PRODUCT_STYLES = getProductStyles(t)
  const styleLabel = getStyleLabel(t)
  const { credits }   = useCredits()
  const season        = getCurrentSeason(t)
  const [step, setStep]                     = useState<ProductStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage]   = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle]   = useState<string | null>(null)
  const [manualDesc, setManualDesc]         = useState('')
  const [variantCount, setVariantCount]     = useState(1)
  const [error, setError]                   = useState<string | null>(null)
  const [taskId, setTaskId]                 = useState<string | null>(null)
  const [imageRecordId, setImageRecordId]   = useState<string | null>(null)
  const [lastUrls, setLastUrls]             = useState<string[]>([])
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [zoomUrl, setZoomUrl]               = useState<string | null>(null)
  const [showPicker, setShowPicker]         = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [published, setPublished]           = useState(false)
  const [rating, setRating]                 = useState<number | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)

  const activeImage = uploadedImage || selectedProductImage
  const styleDef    = PRODUCT_STYLES.find(s => s.value === selectedStyle)

  const handleFileUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setUploadedImage(ev.target?.result as string); setSelectedProductImage(null) }
    reader.readAsDataURL(file)
    setUploadedImageFile(file)
  }

  const handleGenerate = async () => {
    if (!activeImage || !selectedStyle) return
    setError(null); setStep('generating'); setTaskId(null); setImageRecordId(null)
    try {
      const body: Record<string, unknown> = { style: selectedStyle, num_variants: variantCount, manual_description: selectedStyle === 'manual' ? manualDesc : undefined }
      if (selectedProduct) body.product_id = selectedProduct.id
      if (uploadedImage && !selectedProduct) body.reference_image_base64 = uploadedImage
      if (selectedProduct && selectedProductImage !== (selectedProduct.thumbnail_url || selectedProduct.original_images?.[0])) body.reference_image_url = selectedProductImage

      const res  = await fetch('/api/generate/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('select_style'); return }
      if (data.mode === 'async' && data.task_id) { setTaskId(data.task_id); setImageRecordId(data.image_record_id) }
      else { handleDone([data.image?.generated_image_url], data.image_record_id) }
      triggerCreditsRefresh()
    } catch { setError(t('images.connection_error')); setStep('select_style') }
  }

  const handleDone = async (urls: string[], recId?: string) => {
    if (!urls[0]) { setError(t('images.error_image_not_generated')); setStep('select_style'); return }
    const finalId = recId || imageRecordId
    setLastUrls(urls); setSelectedVariant(0); setImageRecordId(finalId)
    if (finalId) {
      try {
        const res  = await fetch('/api/images')
        const data = await res.json()
        const found = (data.images || []).find((img: GeneratedImage) => img.id === finalId)
        if (found) { onImageGenerated(found); setStep('done'); return }
      } catch {}
    }
    const newImg: GeneratedImage = {
      id: finalId || Date.now().toString(), product_id: selectedProduct?.id || '',
      style: selectedStyle!, generated_image_url: urls[0], original_image_url: activeImage,
      status: 'completed', credits_used: (styleDef?.cost || 3) * variantCount,
      created_at: new Date().toISOString(),
      product_title: selectedProduct?.optimized_title || selectedProduct?.original_title || t('images.gen_upload_manual'),
      variants: urls.length > 1 ? urls : null,
    }
    onImageGenerated(newImg); setStep('done')
  }

  const handleRate = async (r: number) => {
    setRating(r)
    if (imageRecordId) await fetch('/api/images/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: imageRecordId, rating: r }) })
  }

  const handlePublish = async () => {
    if (!selectedProduct || !imageRecordId) return
    setPublishing(true)
    const res = await fetch('/api/generate/publish-to-woo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: imageRecordId, product_id: selectedProduct.id, set_as_main: true }) })
    if (res.ok) { setPublished(true) } else { const d = await res.json(); setError(d.error) }
    setPublishing(false)
  }

  const reset = () => {
    setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null)
    setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null)
    setManualDesc(''); setError(null); setLastUrls([]); setTaskId(null)
    setImageRecordId(null); setPublished(false); setRating(null); setVariantCount(1)
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
        <StepDots steps={['select_image', 'select_style', 'generating']} current={step} />
        {step !== 'select_image' && step !== 'generating' && (
          <Btn variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-3 w-3" />{t('images.reset')}</Btn>
        )}
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          {/* Step 1 */}
          {step === 'select_image' && (
            <motion.div key="s1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <ImageSourceSelector {...{ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage, uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />
              <div className="bg-neutral-50 rounded-xl border border-neutral-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-neutral-500 mb-1.5">{t('images.gen_tips_title')}</p>
                <ul className="space-y-1">
                  {[t('images.tip_white_bg'), t('images.tip_fill_70'), t('images.tip_min_resolution'), t('images.tip_avoid_hands')].map((tip, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-500"><span className="text-neutral-300 mt-0.5 shrink-0">·</span>{tip}</li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end">
                <Btn onClick={() => setStep('select_style')} disabled={!activeImage}>
                  Continuă <ArrowRight className="h-3.5 w-3.5" />
                </Btn>
              </div>
            </motion.div>
          )}

          {/* Step 2 */}
          {step === 'select_style' && (
            <motion.div key="s2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                {activeImage && <img src={activeImage} alt="" className="h-14 w-14 rounded-xl object-cover border border-neutral-200 cursor-zoom-in" onClick={() => setZoomUrl(activeImage!)} />}
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{t('images.choose_style')}</p>
                  {selectedProduct && <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-xs">{selectedProduct.optimized_title || selectedProduct.original_title}</p>}
                </div>
              </div>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

              <StyleSelector styles={PRODUCT_STYLES} selected={selectedStyle} onSelect={setSelectedStyle} credits={credits} season={season} />

              {/* Variant count */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div>
                  <p className="text-[13px] font-semibold text-neutral-800">{t('images.variant_count')}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.generate_more_pick')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setVariantCount(v => Math.max(1, v - 1))} disabled={variantCount <= 1}
                    className="h-7 w-7 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40 transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-[13px] font-bold text-neutral-900 w-5 text-center tabular-nums">{variantCount}</span>
                  <button onClick={() => setVariantCount(v => Math.min(4, v + 1))} disabled={variantCount >= 4}
                    className="h-7 w-7 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 disabled:opacity-40 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                  {styleDef && <span className="text-[11px] text-neutral-400 ml-1 tabular-nums">{styleDef.cost * variantCount} cr</span>}
                </div>
              </div>

              {/* Manual desc */}
              {selectedStyle === 'manual' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                    <SectionLabel>{t('images.describe_scene')}</SectionLabel>
                    <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                      placeholder={t('images.manual_prompt_placeholder')}
                      className="w-full h-24 text-[12px] px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-neutral-400 resize-none" />
                  </div>
                </motion.div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Btn variant="ghost" onClick={() => { setStep('select_image'); setError(null) }}>{t('common.back_label')}</Btn>
                <Btn onClick={handleGenerate} disabled={!selectedStyle || credits < (styleDef?.cost || 0) * variantCount || (selectedStyle === 'manual' && !manualDesc.trim())}>
                  <Wand2 className="h-3.5 w-3.5" />{t('images.gen_generate_btn')} {styleDef && <Badge className="ml-1 bg-white/20 text-white">{styleDef.cost * variantCount} {t('images.gen_cr')}</Badge>}
                </Btn>
              </div>
            </motion.div>
          )}

          {/* Generating */}
          {step === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GeneratingScreen taskId={taskId} imageRecordId={imageRecordId} onDone={handleDone} onError={err => { setError(err); setStep('select_style') }} variantCount={variantCount} />
            </motion.div>
          )}

          {/* Done */}
          {step === 'done' && lastUrls.length > 0 && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-[13px] font-medium text-emerald-700">{lastUrls.length > 1 ? t('images.gen_variants_success', { count: String(lastUrls.length) }) : t('images.gen_image_success')}</p>
              </div>

              {lastUrls.length > 1 && (
                <div className="flex gap-2">
                  {lastUrls.map((url, i) => (
                    <button key={i} onClick={() => setSelectedVariant(i)}
                      className={`flex-1 aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedVariant === i ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('images.gen_original'), url: activeImage },
                  { label: lastUrls.length > 1 ? t('images.gen_variant_n', { n: String(selectedVariant + 1) }) : t('images.gen_generated_ai'), url: lastUrls[selectedVariant] },
                ].map(item => item.url && (
                  <div key={item.label} className="space-y-1.5">
                    <SectionLabel>{item.label}</SectionLabel>
                    <div className="aspect-square rounded-xl overflow-hidden bg-neutral-100 cursor-zoom-in" onClick={() => setZoomUrl(item.url!)}>
                      <img src={item.url!} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <div>
                  <p className="text-[12px] font-semibold text-neutral-700">{t('images.rate_result')}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{t('images.rate_helps_ai')}</p>
                </div>
                <StarRating value={rating} onChange={handleRate} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(lastUrls[selectedVariant], '_blank')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 transition-colors">
                  <Download className="h-4 w-4" />{t('images.gen_download')}
                </button>
                {selectedProduct && (
                  <button onClick={handlePublish} disabled={publishing || published}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-colors border ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'}`}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <CheckCircle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {published ? t('images.published_ok') : t('images.publish_woo')}
                  </button>
                )}
              </div>

              <Card className="overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100"><SectionLabel>{t('images.gen_regeneration')}</SectionLabel></div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  {[
                    { label: t('images.gen_new_poster'), icon: <RefreshCw className="h-4 w-4" />, action: reset },
                    { label: t('images.gen_other_style'), icon: <Wand2 className="h-4 w-4" />, action: () => setStep('select_style') },
                    { label: 'Mai multe', icon: <Layers className="h-4 w-4" />, action: () => { setVariantCount(3); setStep('select_style') } },
                  ].map(b => (
                    <button key={b.label} onClick={b.action} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all group">
                      <span className="text-neutral-400 group-hover:text-neutral-700 transition-colors">{b.icon}</span>
                      <span className="text-[11px] text-neutral-500 group-hover:text-neutral-700 text-center leading-tight">{b.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </Card>
  )
}

// ─── PROMO GENERATOR ──────────────────────────────────────────────────────────

function PromoGenerator({ onImageGenerated, brandKit }: { onImageGenerated: (img: GeneratedImage) => void; brandKit: BrandKit | null }) {
  const { t } = useT()
  const PROMO_STYLES = getPromoStyles(t)
  const { credits }   = useCredits()
  const season        = getCurrentSeason(t)
  const [step, setStep]                     = useState<PromoStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage]   = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle]   = useState<string | null>(null)
  const [promoText, setPromoText]           = useState<PromoText | null>(null)
  const [loadingText, setLoadingText]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [taskId, setTaskId]                 = useState<string | null>(null)
  const [imageRecordId, setImageRecordId]   = useState<string | null>(null)
  const [lastUrl, setLastUrl]               = useState<string | null>(null)
  const [showPicker, setShowPicker]         = useState(false)
  const [zoomUrl, setZoomUrl]               = useState<string | null>(null)
  const [publishing, setPublishing]         = useState(false)
  const [published, setPublished]           = useState(false)
  const [rating, setRating]                 = useState<number | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
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
      const res  = await fetch('/api/generate/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_text', product_id: selectedProduct.id, style: styleVal }) })
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
      const res  = await fetch('/api/generate/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('edit_text'); return }
      if (data.mode === 'async' && data.task_id) { setTaskId(data.task_id); setImageRecordId(data.image_record_id) }
      else { handleDone([data.image?.generated_image_url], data.image_record_id) }
      triggerCreditsRefresh()
    } catch { setError('Eroare de conexiune.'); setStep('edit_text') }
  }

  const handleDone = async (urls: string[], recId?: string) => {
    if (!urls[0]) { setError(t('images.error_generation_failed')); setStep('edit_text'); return }
    const finalId = recId || imageRecordId
    setLastUrl(urls[0]); setImageRecordId(finalId)
    if (finalId) {
      try {
        const res = await fetch('/api/images'); const data = await res.json()
        const found = (data.images || []).find((img: GeneratedImage) => img.id === finalId)
        if (found) { onImageGenerated(found); setStep('done'); return }
      } catch {}
    }
    onImageGenerated({ id: finalId || Date.now().toString(), product_id: selectedProduct?.id || '', style: `promo_${selectedStyle}`, generated_image_url: urls[0], original_image_url: activeImage, status: 'completed', credits_used: PROMO_COST, created_at: new Date().toISOString(), product_title: selectedProduct?.optimized_title || selectedProduct?.original_title || 'Upload' })
    setStep('done')
  }

  const reset = () => {
    setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null)
    setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null)
    setPromoText(null); setError(null); setLastUrl(null); setTaskId(null); setPublished(false); setRating(null)
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
        <StepDots steps={['select_image', 'select_style', 'edit_text', 'generating']} current={step} />
        {step !== 'select_image' && step !== 'generating' && (
          <Btn variant="ghost" size="sm" onClick={reset}><RefreshCw className="h-3 w-3" />{t('images.reset')}</Btn>
        )}
      </div>
      <div className="p-5">
        <AnimatePresence mode="wait">
          {step === 'select_image' && (
            <motion.div key="p1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <ImageSourceSelector {...{ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage, uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />
              <div className="flex justify-end">
                <Btn onClick={() => setStep('select_style')} disabled={!activeImage}>
                  Continuă <ArrowRight className="h-3.5 w-3.5" />
                </Btn>
              </div>
            </motion.div>
          )}

          {step === 'select_style' && (
            <motion.div key="p2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                {activeImage && <img src={activeImage} alt="" className="h-14 w-14 rounded-xl object-cover border border-neutral-200" />}
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{t('images.choose_poster_style')}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.gpt_auto_texts')}</p>
                </div>
              </div>
              <StyleSelector styles={PROMO_STYLES} selected={selectedStyle} onSelect={handleStyleSelect} credits={credits}
                season={season ? { ...season, style: `promo_${season.style}` } : null} />
              {selectedStyle && !loadingText && promoText && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-[12px] text-emerald-700">{t('images.texts_generated')}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <Btn variant="ghost" onClick={() => { setStep('select_image'); setSelectedStyle(null); setPromoText(null) }}>{t('images.back')}</Btn>
                <Btn onClick={() => { if (!promoText) setPromoText({ headline: 'Titlu Produs', subtitle: 'Subtitlu', benefits: ['Beneficiu 1', 'Beneficiu 2', 'Beneficiu 3'], cta: 'Comandă Acum', price_text: null }); setStep('edit_text') }}
                  disabled={!selectedStyle || loadingText}>
                  {loadingText ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('images.generating')}</> : <>Editează textele <Edit3 className="h-3.5 w-3.5" /></>}
                </Btn>
              </div>
            </motion.div>
          )}

          {step === 'edit_text' && promoText && (
            <motion.div key="p3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <p className="text-[13px] font-semibold text-neutral-900">{t('images.edit_poster_texts')}</p>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              <div className="space-y-3">
                {[{ key: 'headline', label: t('images.poster_headline_label'), max: 30, placeholder: t('images.poster_headline_placeholder') }, { key: 'subtitle', label: t('images.poster_subtitle_label'), max: 55, placeholder: t('images.poster_subtitle_placeholder') }].map(({ key, label, max, placeholder }) => {
                  const val   = (promoText as any)[key] as string
                  const len   = val.length
                  const color = len > max ? 'text-red-500' : len > max * 0.8 ? 'text-amber-500' : 'text-emerald-500'
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <SectionLabel>{label}</SectionLabel>
                        <span className={`text-[10px] font-semibold ${color} tabular-nums`}>{len}/{max}</span>
                      </div>
                      <input value={val} onChange={e => e.target.value.length <= max + 10 && setPromoText(pt => pt ? { ...pt, [key]: e.target.value } : pt)}
                        className="w-full px-3 py-2.5 text-[12px] rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400" placeholder={placeholder} />
                      <div className="mt-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${len > max ? 'bg-red-400' : len > max * 0.8 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, (len / max) * 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div>
                  <SectionLabel className="mb-1.5 block">{t('images.gen_benefits')}</SectionLabel>
                  <div className="space-y-2">
                    {promoText.benefits.map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-emerald-500 text-[13px] shrink-0">✓</span>
                        <input value={b} onChange={e => e.target.value.length <= 35 && setPromoText(pt => pt ? { ...pt, benefits: pt.benefits.map((x, j) => j === i ? e.target.value : x) } : pt)}
                          className="flex-1 px-3 py-2 text-[12px] rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400" placeholder={`Beneficiu ${i + 1}`} />
                        <span className="text-[10px] text-neutral-400 w-8 text-right shrink-0 tabular-nums">{b.length}/35</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{ key: 'cta', label: t('images.poster_cta_label'), max: 22, ph: t('images.poster_cta_placeholder') }, { key: 'price_text', label: t('images.poster_price_label'), max: 20, ph: t('images.poster_price_placeholder') }].map(({ key, label, max, ph }) => (
                    <div key={key}>
                      <SectionLabel className="mb-1.5 block">{label}</SectionLabel>
                      <input value={(promoText as any)[key] || ''} onChange={e => setPromoText(pt => pt ? { ...pt, [key]: e.target.value || null } : pt)}
                        className="w-full px-3 py-2.5 text-[12px] rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400" placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Btn variant="ghost" onClick={() => setStep('select_style')}>{t('images.back')}</Btn>
                <Btn onClick={handleGenerate} disabled={credits < PROMO_COST}>
                  <Wand2 className="h-3.5 w-3.5" />{t('images.gen_generate_btn')} <Badge className="ml-1 bg-white/20 text-white">{PROMO_COST} {t('images.gen_cr')}</Badge>
                </Btn>
              </div>
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div key="pgen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GeneratingScreen taskId={taskId} imageRecordId={imageRecordId} onDone={handleDone} onError={err => { setError(err); setStep('edit_text') }} />
            </motion.div>
          )}

          {step === 'done' && lastUrl && (
            <motion.div key="pdone" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600" /><p className="text-[13px] font-medium text-emerald-700">{t('images.poster_generated')}</p>
              </div>
              <div className="aspect-square rounded-xl overflow-hidden bg-neutral-100 max-w-sm mx-auto cursor-zoom-in" onClick={() => setZoomUrl(lastUrl)}>
                <img src={lastUrl} alt="" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
                <p className="text-[12px] font-semibold text-neutral-700">{t('images.rate_result')}</p>
                <StarRating value={rating} onChange={async r => { setRating(r); if (imageRecordId) await fetch('/api/images/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: imageRecordId, rating: r }) }) }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => window.open(lastUrl, '_blank')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 transition-colors">
                  <Download className="h-4 w-4" />{t('images.gen_download')}
                </button>
                {selectedProduct && (
                  <button onClick={async () => { setPublishing(true); const res = await fetch('/api/generate/publish-to-woo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: imageRecordId, product_id: selectedProduct.id, set_as_main: false }) }); if (res.ok) setPublished(true); setPublishing(false) }} disabled={publishing || published}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-colors border ${published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'}`}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <CheckCircle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    {published ? t('images.published_woo') : t('images.publish_to_woo')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ label: t('images.gen_new_poster'), icon: <RefreshCw className="h-4 w-4" />, action: reset }, { label: t('images.gen_other_style'), icon: <Wand2 className="h-4 w-4" />, action: () => setStep('select_style') }, { label: t('images.gen_edit_text_btn'), icon: <Edit3 className="h-4 w-4" />, action: () => setStep('edit_text') }].map(b => (
                  <button key={b.label} onClick={b.action} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all group">
                    <span className="text-neutral-400 group-hover:text-neutral-700">{b.icon}</span>
                    <span className="text-[11px] text-neutral-500 group-hover:text-neutral-700 text-center">{b.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </Card>
  )
}

// ─── BULK TAB ─────────────────────────────────────────────────────────────────

function BulkTab() {
  const { t } = useT()
  const PRODUCT_STYLES = getProductStyles(t)
  const styleLabel = getStyleLabel(t)
  const { credits }   = useCredits()
  const [jobs, setJobs]         = useState<BulkJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProds, setLoadingProds] = useState(false)
  const [style, setStyle]       = useState('white_bg')
  const [priority, setPriority] = useState('normal')
  const [autoPublish, setAutoPublish] = useState(false)
  const [maxProducts, setMaxProducts] = useState(50)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [estimate, setEstimate] = useState<{ credits: number; products: number; minutes: number } | null>(null)

  const STYLE_COSTS: Record<string, number> = { white_bg: 2, lifestyle: 3, premium_dark: 3, industrial: 3, seasonal: 4, manual: 3 }
  const creditCost = STYLE_COSTS[style] || 3

  const loadJobs = useCallback(async () => {
    const res = await fetch('/api/images/bulk'); const data = await res.json()
    setJobs(data.jobs || []); setLoadingJobs(false)
  }, [])
  useEffect(() => { loadJobs() }, [loadJobs])

  const loadProducts = async () => {
    setLoadingProds(true)
    const res = await fetch('/api/products?' + new URLSearchParams({ per_page: '200', parent_only: 'true' }))
    const data = await res.json(); setProducts(data.products || []); setLoadingProds(false)
  }

  const handleSubmit = async () => {
    setSubmitting(true); setError(''); setShowConfirm(false)
    const body: any = { style, auto_publish: autoPublish, max_products: maxProducts, priority }
    if (selectedIds.length > 0) body.product_ids = selectedIds
    const res  = await fetch('/api/images/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || t('common.error_generic')); setSubmitting(false); return }
    await loadJobs(); setSubmitting(false); setSelectedIds([]); triggerCreditsRefresh()
  }

  const cancelJob = async (id: string) => {
    await fetch('/api/images/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadJobs()
  }

  const jobStatusColor = (s: string) => ({ queued: 'text-amber-600 bg-amber-50', processing: 'text-neutral-900 bg-neutral-100', completed: 'text-emerald-600 bg-emerald-50', failed: 'text-red-500 bg-red-50', cancelled: 'text-neutral-400 bg-neutral-100' }[s] || 'text-neutral-400 bg-neutral-100')
  const jobStatusLabel = (s: string) => ({ queued: t('images.job_queued'), processing: t('images.job_processing'), completed: t('images.job_completed'), failed: t('images.job_failed'), cancelled: t('images.job_cancelled') }[s] || s)

  const PRIORITY_OPTIONS = [
    { value: 'normal',     label: t('images.all_products_bulk'),   desc: t('images.all_products_desc') },
    { value: 'no_image',   label: t('images.no_good_image'), desc: t('images.no_good_image_desc') },
    { value: 'high_sales', label: t('images.best_sellers'),  desc: t('images.best_sellers_desc') },
    { value: 'manual',     label: t('images.manual_selection'),  desc: t('images.manual_selection_desc') },
  ]

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-[13px] font-semibold text-neutral-900">{t('images.bulk_generate')}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.bulk_auto_desc')}</p>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

          <div>
            <SectionLabel className="mb-2 block">Stil imagine</SectionLabel>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PRODUCT_STYLES.filter(s => s.value !== 'manual').map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${style === s.value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}>
                  <p className="text-[11px] font-semibold text-neutral-900">{s.label}</p>
                  <Badge className="mt-1 bg-neutral-100 text-neutral-500">{s.cost} cr</Badge>
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2 block">{t('images.product_selection')}</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p.value} onClick={() => { setPriority(p.value); if (p.value === 'manual') loadProducts() }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${priority === p.value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}>
                  <p className="text-[12px] font-semibold text-neutral-900">{p.label}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {priority === 'manual' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              {loadingProds ? <div className="flex items-center gap-2 text-[12px] text-neutral-400 py-2"><Loader2 className="h-4 w-4 animate-spin" />{t('images.loading')}</div>
              : <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-neutral-500">{selectedIds.length} produse selectate</p>
                    <button onClick={() => setSelectedIds(selectedIds.length === products.length ? [] : products.map(p => p.id))} className="text-[11px] text-neutral-500 hover:text-neutral-800 transition-colors">
                      {selectedIds.length === products.length ? t('images.deselect_all_images') : t('images.select_all_images')}
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                    {products.map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))} className="rounded" />
                        <div className="h-8 w-8 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                          {(p.thumbnail_url || p.original_images?.[0]) && <img src={p.thumbnail_url || p.original_images![0]} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <p className="text-[11px] text-neutral-700 truncate flex-1">{p.optimized_title || p.original_title}</p>
                      </label>
                    ))}
                  </div>
                </div>}
            </motion.div>
          )}

          {priority !== 'manual' && (
            <div>
              <SectionLabel className="mb-2 block">{t('images.bulk_max_products')} ({maxProducts})</SectionLabel>
              <input type="range" min={10} max={200} step={10} value={maxProducts} onChange={e => setMaxProducts(Number(e.target.value))} className="w-full accent-neutral-900" />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1"><span>10</span><span>100</span><span>200</span></div>
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-100">
            <div>
              <p className="text-[13px] font-semibold text-neutral-800">{t('images.auto_publish_woo')}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.auto_replace_main')}</p>
            </div>
            <button onClick={() => setAutoPublish(!autoPublish)}
              className={`w-10 h-5 rounded-full transition-all relative ${autoPublish ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${autoPublish ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-neutral-400 tabular-nums">
              ~{((selectedIds.length || maxProducts) * creditCost).toLocaleString()} {t('images.credits_label_short')} {t('images.credits_estimated_short')} · {credits} {t('images.credits_available')}
            </p>
            <Btn onClick={() => { const count = selectedIds.length || maxProducts; setEstimate({ credits: count * creditCost, products: count, minutes: Math.ceil(count * 1.5) }); setShowConfirm(true) }}
              disabled={submitting || credits < creditCost}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {submitting ? t('images.submitting_job') : t('images.launch_job')}
            </Btn>
          </div>

          <AnimatePresence>
            {showConfirm && estimate && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-2 border-neutral-900 rounded-xl p-4 space-y-3">
                <p className="text-[13px] font-semibold text-neutral-900">Confirmare job</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[{ label: t('images.bulk_products_label'), val: estimate.products }, { label: t('images.bulk_credits_label'), val: estimate.credits }, { label: t('images.bulk_time_est'), val: `~${estimate.minutes}min` }].map(x => (
                    <div key={x.label} className="bg-neutral-50 rounded-xl p-3">
                      <p className="text-[17px] font-bold text-neutral-900 tabular-nums">{x.val}</p>
                      <SectionLabel className="mt-0.5">{x.label}</SectionLabel>
                    </div>
                  ))}
                </div>
                {estimate.credits > credits && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{t('images.credits_insufficient', { count: String(estimate.credits - credits) })}</div>}
                <div className="flex gap-2">
                  <button onClick={() => setShowConfirm(false)} className="flex-1 text-[12px] text-neutral-500 border border-neutral-200 rounded-xl py-2 hover:bg-neutral-50 transition-colors">{t('common.cancel_label')}</button>
                  <button onClick={handleSubmit} disabled={estimate.credits > credits || submitting}
                    className="flex-1 text-[12px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-xl py-2 flex items-center justify-center gap-2 transition-colors">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Confirmă
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {jobs.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-neutral-900">{t('images.bulk_jobs_title')}</p>
            <Btn variant="ghost" size="sm" onClick={loadJobs}><RefreshCw className="h-3 w-3" /></Btn>
          </div>
          <div className="divide-y divide-neutral-50">
            {jobs.map(job => {
              const pct = job.total_products > 0 ? Math.round(((job.completed_count + job.failed_count) / job.total_products) * 100) : 0
              return (
                <div key={job.id} className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-neutral-800">{styleLabel(job.style)}</span>
                        <Badge className={jobStatusColor(job.status)}>{jobStatusLabel(job.status)}</Badge>
                        {job.auto_publish && <Badge className="text-emerald-600 bg-emerald-50">Auto-publish</Badge>}
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{job.completed_count}/{job.total_products} completate · {job.credits_used} cr · {new Date(job.created_at).toLocaleDateString('ro-RO')}</p>
                    </div>
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <Btn variant="ghost" size="sm" onClick={() => cancelJob(job.id)}>
                        <StopCircle className="h-3 w-3 text-red-400" />Anulează
                      </Btn>
                    )}
                  </div>
                  {(job.status === 'processing' || job.status === 'queued') && (
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-neutral-900 rounded-full" animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
      {loadingJobs && <Card className="p-6 flex items-center gap-3"><Loader2 className="h-4 w-4 animate-spin text-neutral-400" /><span className="text-[12px] text-neutral-500">{t('images.loading')}</span></Card>}
    </div>
  )
}

// ─── BRAND KIT TAB ────────────────────────────────────────────────────────────

function BrandTab() {
  const { t } = useT()
  const [kit, setKit]             = useState<BrandKit | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [saved, setSaved]         = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBase64, setLogoBase64]   = useState<string | null>(null)
  const [ratingStats, setRatingStats] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaults: BrandKit = { logo_url: null, primary_color: '#000000', secondary_color: '#ffffff', accent_color: '#3b82f6', brand_name: '', font_style: 'modern', tone: 'professional' }

  useEffect(() => {
    Promise.all([fetch('/api/brand-kit').then(r => r.json()), fetch('/api/images/rate').then(r => r.json())]).then(([bData, rData]) => {
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
    const res  = await fetch('/api/brand-kit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) { setKit(data.brand_kit); if (data.logo_url) setLogoPreview(data.logo_url); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  const handleDetect = async () => {
    setDetecting(true)
    const res  = await fetch('/api/brand-kit', { method: 'PATCH' })
    const data = await res.json()
    if (res.ok && data.detected) setKit(prev => prev ? { ...prev, ...data.detected, font_style: data.detected.font_suggestion || prev.font_style, tone: data.detected.tone_suggestion || prev.tone } : prev)
    setDetecting(false)
  }

  const STYLE_LABELS: Record<string, string> = { white_bg: t('images.style_simple'), lifestyle: 'Lifestyle', premium_dark: 'Premium Dark', industrial: 'Industrial', seasonal: t('images.style_seasonal_label'), manual: 'Manual' }

  if (loading) return <Card className="p-8 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-neutral-400" /><span className="text-[12px] text-neutral-500">{t('images.loading')}</span></Card>
  if (!kit) return null

  return (
    <div className="space-y-4">
      <Card className="p-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-neutral-900">{t('images.brand_kit')}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">{t('images.brand_kit')}</p>
        </div>
        <Btn variant="outline" onClick={handleDetect} disabled={detecting}>
          {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}{t('images.brand_ai_detect')}
        </Btn>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Identitate */}
        <Card className="p-5 space-y-4">
          <SectionLabel>{t('images.brand_identity')}</SectionLabel>
          <div>
            <SectionLabel className="mb-2 block">{t('images.brand_logo')}</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-neutral-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-neutral-400 transition-colors shrink-0" onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-contain p-1" /> : <Plus className="h-5 w-5 text-neutral-300" />}
              </div>
              <div>
                <button onClick={() => fileInputRef.current?.click()} className="text-[12px] text-neutral-600 font-semibold hover:text-neutral-900 transition-colors">{t('images.upload_logo')}</button>
                <p className="text-[10px] text-neutral-400 mt-0.5">{t('images.brand_png_recommended')}</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
            </div>
          </div>
          <div>
            <SectionLabel className="mb-1.5 block">{t('images.brand_name_label')}</SectionLabel>
            <input value={kit.brand_name} onChange={e => setKit(k => k ? { ...k, brand_name: e.target.value } : k)}
              className="w-full px-3 py-2.5 text-[12px] rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400 transition-colors" placeholder={t('images.brand_name_placeholder')} />
          </div>
        </Card>

        {/* Culori */}
        <Card className="p-5 space-y-4">
          <SectionLabel>{t('images.brand_colors')}</SectionLabel>
          {[{ key: 'primary_color', label: t('images.color_primary') }, { key: 'secondary_color', label: t('images.color_secondary') }, { key: 'accent_color', label: t('images.color_accent') }].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <input type="color" value={(kit as any)[key]} onChange={e => setKit(k => k ? { ...k, [key]: e.target.value } : k)} className="h-9 w-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5" />
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-neutral-700">{label}</p>
                <p className="text-[10px] font-mono text-neutral-400">{(kit as any)[key]}</p>
              </div>
              <div className="h-9 w-20 rounded-xl border border-neutral-200" style={{ backgroundColor: (kit as any)[key] }} />
            </div>
          ))}
        </Card>

        {/* Stil & Ton */}
        <Card className="p-5 space-y-4">
          <SectionLabel>{t('images.brand_style_tone')}</SectionLabel>
          {[{ field: 'font_style', label: 'Font style', opts: ['modern', 'classic', 'bold', 'minimal'] }, { field: 'tone', label: t('images.brand_tone_label'), opts: ['professional', 'friendly', 'luxury', 'playful'] }].map(({ field, label, opts }) => (
            <div key={field}>
              <SectionLabel className="mb-2 block">{label}</SectionLabel>
              <div className="flex gap-2 flex-wrap">
                {opts.map(o => (
                  <button key={o} onClick={() => setKit(k => k ? { ...k, [field]: o } : k)}
                    className={`h-7 px-3 rounded-lg border text-[11px] font-medium transition-all capitalize ${(kit as any)[field] === o ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {kit.style_summary && (
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
              <SectionLabel className="mb-1 block">Stil detectat AI</SectionLabel>
              <p className="text-[11px] text-neutral-700">{kit.style_summary}</p>
            </div>
          )}
        </Card>

        {/* Rating stats */}
        <Card className="p-5 space-y-4">
          <SectionLabel>{t('images.rate_result')}</SectionLabel>
          {ratingStats.length === 0
            ? <p className="text-[11px] text-neutral-400">{t('images.rate_helps_ai')}</p>
            : <div className="space-y-3">
                {ratingStats.map(s => (
                  <div key={s.style} className="flex items-center gap-3">
                    <p className="text-[11px] text-neutral-700 w-28 shrink-0">{STYLE_LABELS[s.style] || s.style}</p>
                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(s.avg_rating / 5) * 100}%` }} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-[11px] font-bold text-neutral-700 tabular-nums">{s.avg_rating}</span>
                      <span className="text-[10px] text-neutral-400 tabular-nums">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>}
        </Card>
      </div>

      <div className="flex justify-end">
        <Btn onClick={handleSave} disabled={saving} variant={saved ? 'success' : 'primary'}>
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvez...</> : saved ? <><CheckCircle className="h-3.5 w-3.5" />Salvat!</> : <>{t('images.save_brand_kit')}</>}
        </Btn>
      </div>
    </div>
  )
}

// ─── GALLERY TAB ──────────────────────────────────────────────────────────────

function GalleryTab({ gallery, onUpdate }: { gallery: GeneratedImage[]; onUpdate: () => void }) {
  const { t, locale } = useT()
  const styleLabel = getStyleLabel(t)
  const [filter, setFilter]   = useState<'all' | 'product' | 'promo' | 'published'>('all')
  const [search, setSearch]   = useState('')
  const [preview, setPreview] = useState<GeneratedImage | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)

  const filtered = gallery.filter(img => {
    const isPromo     = img.style.startsWith('promo_')
    const isPublished = !!img.wc_published_at
    const matchFilter = filter === 'all' || (filter === 'promo' && isPromo) || (filter === 'published' && isPublished) || (filter === 'product' && !isPromo)
    const matchSearch = !search || img.product_title?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const handlePublish = async (img: GeneratedImage, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!img.product_id) return
    setPublishing(img.id)
    await fetch('/api/generate/publish-to-woo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: img.id, product_id: img.product_id, set_as_main: true }) })
    setPublishing(null); onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {[{ value: 'all', label: t('images.gallery_all') }, { value: 'product', label: t('images.gallery_product') }, { value: 'promo', label: t('images.gallery_promo') }, { value: 'published', label: t('images.gallery_published') }].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value as any)}
              className={`h-8 px-3 rounded-xl text-[12px] font-medium transition-all ${filter === f.value ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 h-8 text-[12px] rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400 bg-white px-3" />
        </div>
        {filtered.length > 0 && (
          <Btn variant="outline" size="sm" onClick={async () => {
            for (const img of filtered.slice(0, 25)) {
              const a = document.createElement('a'); a.href = img.generated_image_url; a.download = `ai-${img.product_title?.replace(/\s+/g, '_')}-${img.style}.png`; a.target = '_blank'; a.click()
              await new Promise(r => setTimeout(r, 400))
            }
          }}>
            <Download className="h-3 w-3" />Export ({Math.min(filtered.length, 25)})
          </Btn>
        )}
      </div>

      {gallery.length === 0
        ? <Card className="p-16 text-center"><ImageIcon className="h-10 w-10 text-neutral-200 mx-auto mb-3" /><p className="text-neutral-400 text-[13px]">{t('images.no_images_desc')}</p></Card>
        : filtered.length === 0
        ? <Card className="p-10 text-center"><p className="text-neutral-400 text-[13px]">Nicio imagine pentru filtrul selectat.</p></Card>
        : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((img, i) => {
              const isPromo     = img.style.startsWith('promo_')
              const isPublished = !!img.wc_published_at
              return (
                <motion.div key={img.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                  <div className="group bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-md hover:border-neutral-300 transition-all cursor-pointer" onClick={() => setPreview(img)}>
                    <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                      <img src={img.generated_image_url} alt={img.product_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                        <Badge className="bg-black/50 text-white backdrop-blur">{isPromo ? 'Promo' : styleLabel(img.style)}</Badge>
                        {isPublished && <Badge className="bg-emerald-600/80 text-white backdrop-blur">Live</Badge>}
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                        <button onClick={e => { e.stopPropagation(); window.open(img.generated_image_url, '_blank') }}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all h-9 w-9 rounded-xl bg-white/90 flex items-center justify-center text-neutral-700 hover:bg-white shadow-lg">
                          <Download className="h-4 w-4" />
                        </button>
                        {img.product_id && !isPublished && (
                          <button onClick={e => handlePublish(img, e)}
                            className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 delay-75 transition-all h-9 w-9 rounded-xl bg-white/90 flex items-center justify-center text-neutral-700 hover:bg-white shadow-lg">
                            {publishing === img.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] font-medium text-neutral-900 line-clamp-1">{img.product_title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-neutral-400">{new Date(img.created_at).toLocaleDateString('ro-RO')}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} onClick={e => { e.stopPropagation(); fetch('/api/images/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: img.id, rating: n }) }).then(() => onUpdate()) }}>
                              <Star className={`h-2.5 w-2.5 ${n <= (img.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'}`} />
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <div className="aspect-square bg-neutral-50"><img src={preview.generated_image_url} alt={preview.product_title} className="w-full h-full object-contain" /></div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-neutral-900">{preview.product_title}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{styleLabel(preview.style)} · {preview.credits_used} {t('images.credits_label_short')} · {new Date(preview.created_at).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-US')}</p>
                  </div>
                  <StarRating value={preview.rating || null} onChange={async r => { await fetch('/api/images/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_id: preview.id, rating: r }) }); setPreview(p => p ? { ...p, rating: r } : p); onUpdate() }} />
                </div>
                {preview.prompt && (
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <SectionLabel className="mb-1 block">Prompt AI folosit</SectionLabel>
                    <p className="text-[11px] text-neutral-600 leading-relaxed line-clamp-4">{preview.prompt}</p>
                  </div>
                )}
                {preview.variants && preview.variants.length > 1 && (
                  <div>
                    <SectionLabel className="mb-2 block">Variante generate</SectionLabel>
                    <div className="flex gap-2">
                      {preview.variants.map((url, i) => (
                        <div key={i} className="h-16 w-16 rounded-xl overflow-hidden border border-neutral-200 cursor-pointer hover:border-neutral-900 transition-colors" onClick={() => setPreview(p => p ? { ...p, generated_image_url: url } : p)}>
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => window.open(preview.generated_image_url, '_blank')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-[12px] hover:bg-neutral-800 flex-1 justify-center transition-colors">
                    <Download className="h-4 w-4" />{t('images.gen_download')}
                  </button>
                  {preview.product_id && !preview.wc_published_at && (
                    <button onClick={e => handlePublish(preview, e)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-[12px] hover:bg-neutral-50 transition-colors">
                      <Globe className="h-4 w-4" />Publică
                    </button>
                  )}
                  <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-500 text-[12px] hover:bg-neutral-50 transition-colors">{t('common.close_label')}</button>
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
  const { t } = useT()

  const MAIN_TABS: { value: MainTab; label: string; icon: any }[] = [
    { value: 'generator', label: 'Generator', icon: Wand2     },
    { value: 'bulk',      label: t('images.tab_bulk'),      icon: Layers    },
    { value: 'brand',     label: 'Brand Kit', icon: Palette   },
    { value: 'gallery',   label: t('images.gallery_label'),   icon: ImageIcon },
  ]
  const { credits }     = useCredits()
  const [mainTab, setMainTab] = useState<MainTab>('generator')
  const [genTab, setGenTab]   = useState<GenTab>('product')
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const season = getCurrentSeason(t)

  const fetchGallery = useCallback(async () => {
    try { const res = await fetch('/api/images'); const data = await res.json(); setGallery(data.images || []) } finally { setGalleryLoading(false) }
  }, [])
  const fetchBrandKit = useCallback(async () => {
    const res = await fetch('/api/brand-kit'); const data = await res.json(); setBrandKit(data.brand_kit)
  }, [])
  useEffect(() => { fetchGallery(); fetchBrandKit() }, [fetchGallery, fetchBrandKit])

  const handleNewImage = (img: GeneratedImage) => {
    setGallery(prev => { const exists = prev.find(i => i.id === img.id); return exists ? prev.map(i => i.id === img.id ? img : i) : [img, ...prev] })
    setTimeout(() => fetchGallery(), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('images.title')}</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">AI Images</p>
        </div>
        <div className="flex items-center gap-2">
          {season && (
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[12px] font-medium text-amber-700">{season.label}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-neutral-500" />
            <span className="text-[14px] font-bold text-neutral-700 tabular-nums">{credits}</span>
            <span className="text-[11px] text-neutral-400">{t('images.credits_label_short')}</span>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl overflow-x-auto scrollbar-none">
        {MAIN_TABS.map(t => {
          const Icon     = t.icon
          const isActive = mainTab === t.value
          return (
            <button key={t.value} onClick={() => setMainTab(t.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${isActive ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {t.label}
              {t.value === 'gallery' && gallery.length > 0 && (
                <Badge className={`ml-0.5 ${isActive ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-200 text-neutral-500'}`}>{gallery.length}</Badge>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mainTab === 'generator' && (
          <motion.div key="generator" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Gen sub-tabs */}
            <div className="flex gap-1 border-b border-neutral-100">
              {([{ value: 'product', label: t('images.gen_product_image') }, { value: 'promo', label: t('images.gen_poster_promo') }] as const).map(gt => (
                <button key={gt.value} onClick={() => setGenTab(gt.value)}
                  className={`flex items-center h-9 px-4 text-[12px] font-medium border-b-2 transition-all -mb-px ${genTab === gt.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}>
                  {gt.label}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {genTab === 'product' && (
                <motion.div key="gen-product" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <ProductGenerator onImageGenerated={handleNewImage} brandKit={brandKit} />
                </motion.div>
              )}
              {genTab === 'promo' && (
                <motion.div key="gen-promo" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <PromoGenerator onImageGenerated={handleNewImage} brandKit={brandKit} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        {mainTab === 'bulk' && (
          <motion.div key="bulk" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><BulkTab /></motion.div>
        )}
        {mainTab === 'brand' && (
          <motion.div key="brand" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><BrandTab /></motion.div>
        )}
        {mainTab === 'gallery' && (
          <motion.div key="gallery" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {galleryLoading
              ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-neutral-100 animate-pulse" />)}</div>
              : <GalleryTab gallery={gallery} onUpdate={fetchGallery} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}