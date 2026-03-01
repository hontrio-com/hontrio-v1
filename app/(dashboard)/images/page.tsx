'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ImageIcon, Loader2, Download, SearchIcon, X, Sparkles,
  Upload, Check, Package, ArrowRight, RefreshCw, AlertCircle,
  CheckCircle, Eye, Wand2, Image as ImageLucide, ZoomIn, Coins,
  Megaphone, Camera, Edit3, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { triggerCreditsRefresh, useCredits } from '@/hooks/use-credits'

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  original_title: string
  optimized_title: string | null
  original_images: string[] | null
  thumbnail_url: string | null
  category: string | null
  price: number | null
}

type GeneratedImage = {
  id: string
  product_id: string
  style: string
  generated_image_url: string
  original_image_url: string | null
  status: string
  credits_used: number
  created_at: string
  product_title: string
}

type PromoText = {
  headline: string
  subtitle: string
  benefits: string[]
  cta: string
  price_text: string | null
}

type ProductStep = 'select_image' | 'select_style' | 'generating' | 'done'
type PromoStep = 'select_image' | 'select_style' | 'edit_text' | 'generating' | 'done'

// ─── Product Styles ───────────────────────────────────────────────────────────

const PRODUCT_STYLES = [
  { value: 'white_bg', label: 'Simplu', desc: 'Fundal alb, studio profesional', icon: '⬜', cost: 2, gradient: 'from-gray-50 to-white', dark: false },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Produs în context real', icon: '🏡', cost: 3, gradient: 'from-amber-50 to-orange-50', dark: false },
  { value: 'premium_dark', label: 'Premium Dark', desc: 'Luxos și dramatic', icon: '🖤', cost: 3, gradient: 'from-gray-900 to-gray-800', dark: true },
  { value: 'industrial', label: 'Industrial', desc: 'Raw, texturi naturale', icon: '🏭', cost: 3, gradient: 'from-stone-100 to-stone-200', dark: false },
  { value: 'seasonal', label: 'De sezon', desc: 'Festiv, perfect pentru cadouri', icon: '🎄', cost: 4, gradient: 'from-red-50 to-green-50', dark: false },
  { value: 'manual', label: 'Manual', desc: 'Descrii tu scena dorită', icon: '✏️', cost: 3, gradient: 'from-blue-50 to-indigo-50', dark: false },
]

// ─── Promo Styles ─────────────────────────────────────────────────────────────

const PROMO_STYLES = [
  { value: 'modern_minimalist', label: 'Modern Minimalist', desc: 'Clean, elegant, spațiu alb, premium', icon: '◻️', cost: 4, gradient: 'from-gray-50 to-white', dark: false },
  { value: 'bold_dynamic', label: 'Bold & Dynamic', desc: 'Energic, culori puternice, impact', icon: '⚡', cost: 4, gradient: 'from-blue-600 to-blue-800', dark: true },
  { value: 'elegant_luxury', label: 'Elegant Luxury', desc: 'Ton întunecat, accente aurii, premium', icon: '✨', cost: 4, gradient: 'from-yellow-900 to-stone-900', dark: true },
  { value: 'vibrant_sale', label: 'Vibrant Sale', desc: 'Culori vii, urgență, ofertă în prim-plan', icon: '🔥', cost: 4, gradient: 'from-orange-400 to-yellow-400', dark: false },
  { value: 'dark_premium', label: 'Dark Premium', desc: 'Fundal negru, accente neon, dramatic', icon: '🌑', cost: 4, gradient: 'from-gray-950 to-slate-900', dark: true },
  { value: 'gradient_pop', label: 'Gradient Pop', desc: 'Gradient vibrant, modern, social media', icon: '🌈', cost: 4, gradient: 'from-pink-500 to-violet-600', dark: true },
]

// ─── Reusable Components ──────────────────────────────────────────────────────

function StepDots({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full transition-all ${i < idx ? 'bg-green-400' : i === idx ? 'bg-blue-600 w-4' : 'bg-gray-200'}`} />
        </div>
      ))}
    </div>
  )
}

function ZoomModal({ url, label, onClose }: { url: string; label?: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.img
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        src={url} alt={label || ''} onClick={e => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
      />
      <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
    </motion.div>
  )
}

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
  useEffect(() => {
    const t = setTimeout(() => fetch_(search), 350)
    return () => clearTimeout(t)
  }, [search, fetch_])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white mt-3" onClick={e => e.stopPropagation()}>
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text" placeholder="Caută produs..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-blue-300"
          />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-blue-500" /></div>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Niciun produs găsit</p>
        ) : products.map(p => {
          const img = p.thumbnail_url || p.original_images?.[0]
          return (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left">
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

// ─── Image Source Selector (shared) ──────────────────────────────────────────

function ImageSourceSelector({
  selectedProduct, setSelectedProduct,
  selectedProductImage, setSelectedProductImage,
  uploadedImage, setUploadedImage, setUploadedImageFile,
  showPicker, setShowPicker,
  fileInputRef,
}: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Alege imaginea de referință</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Din magazin */}
        <div
          className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${showPicker || selectedProduct ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'}`}
          onClick={() => setShowPicker(true)}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Din magazinul tău</p>
              <p className="text-sm text-gray-500 mt-0.5">Selectează un produs sincronizat</p>
            </div>
          </div>
          {selectedProduct && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-200">
              <div className="h-12 w-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {selectedProductImage ? <img src={selectedProductImage} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-gray-300 m-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.optimized_title || selectedProduct.original_title}</p>
                <p className="text-xs text-blue-600">Selectat ✓</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setSelectedProduct(null); setSelectedProductImage(null) }} className="text-gray-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {showPicker && !selectedProduct && (
            <ProductPicker onSelect={p => { setSelectedProduct(p); setSelectedProductImage(p.thumbnail_url || p.original_images?.[0] || null); setUploadedImage(null); setShowPicker(false) }} onClose={() => setShowPicker(false)} />
          )}
        </div>

        {/* Upload manual */}
        <div
          className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${uploadedImage ? 'border-purple-500 bg-purple-50/40' : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <Upload className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Încarcă o imagine</p>
              <p className="text-sm text-gray-500 mt-0.5">JPG sau PNG de pe calculator</p>
            </div>
          </div>
          {uploadedImage ? (
            <div className="mt-4 flex items-center gap-3 p-3 bg-white rounded-xl border border-purple-200">
              <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0"><img src={uploadedImage} alt="" className="h-full w-full object-cover" /></div>
              <div className="flex-1"><p className="text-xs text-purple-600">Imaginea ta ✓</p></div>
              <button onClick={e => { e.stopPropagation(); setUploadedImage(null); setUploadedImageFile(null) }} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="mt-4 border-2 border-dashed border-gray-200 rounded-xl py-6 text-center">
              <Upload className="h-5 w-5 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Apasă pentru a selecta</p>
            </div>
          )}
        </div>
      </div>

      {/* Multiple product images picker */}
      {selectedProduct?.original_images && selectedProduct.original_images.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alege imaginea de referință</p>
          <div className="flex gap-2 flex-wrap">
            {selectedProduct.original_images.map((img: string, i: number) => (
              <button key={i} onClick={() => setSelectedProductImage(img)}
                className={`h-16 w-16 rounded-xl overflow-hidden border-2 transition-all ${selectedProductImage === img ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400'}`}>
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PRODUCT IMAGE GENERATOR ─────────────────────────────────────────────────

function ProductGenerator({ onImageGenerated }: { onImageGenerated: (img: GeneratedImage) => void }) {
  const { credits } = useCredits()
  const [step, setStep] = useState<ProductStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [manualDesc, setManualDesc] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GeneratedImage | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeImage = uploadedImage || selectedProductImage
  const styleDef = PRODUCT_STYLES.find(s => s.value === selectedStyle)

  const handleFileUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => { setUploadedImage(ev.target?.result as string); setSelectedProductImage(null) }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!activeImage || !selectedStyle) return
    setGenerating(true); setError(null); setStep('generating')
    try {
      const body: Record<string, unknown> = { style: selectedStyle, manual_description: selectedStyle === 'manual' ? manualDesc : undefined }
      if (selectedProduct) body.product_id = selectedProduct.id
      if (uploadedImage && !selectedProduct) body.reference_image_base64 = uploadedImage
      if (selectedProduct && selectedProductImage !== (selectedProduct.thumbnail_url || selectedProduct.original_images?.[0])) body.reference_image_url = selectedProductImage

      const res = await fetch('/api/generate/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('select_style'); return }

      const newImg: GeneratedImage = {
        id: data.image.id, product_id: selectedProduct?.id || '',
        style: selectedStyle, generated_image_url: data.image.generated_image_url,
        original_image_url: activeImage, status: 'completed',
        credits_used: data.image.credits_used || styleDef?.cost || 3,
        created_at: new Date().toISOString(),
        product_title: selectedProduct?.optimized_title || selectedProduct?.original_title || 'Upload manual',
      }
      setLastResult(newImg); onImageGenerated(newImg); setStep('done')
      triggerCreditsRefresh()
    } catch { setError('Eroare de conexiune.'); setStep('select_style') }
    finally { setGenerating(false) }
  }

  const reset = () => { setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null); setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null); setManualDesc(''); setError(null); setLastResult(null) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <StepDots steps={['select_image', 'select_style', 'generating']} current={step} />
        {step !== 'select_image' && step !== 'generating' && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Resetează</button>
        )}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* STEP 1 */}
          {step === 'select_image' && (
            <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <ImageSourceSelector {...{ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage, uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />

              {/* Tips pentru calitate imagine */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-blue-500 mt-0.5 shrink-0">💡</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">Sfaturi pentru rezultate optime</p>
                    <ul className="space-y-1">
                      {[
                        'Folosește imagini cu fundal alb sau uni — AI-ul reproduce mai fidel produsul',
                        'Asigură-te că produsul ocupă cel puțin 70% din imagine',
                        'Evită imagini cu alte obiecte, mâini sau persoane în jur',
                        'Rezoluție minimă recomandată: 800×800px',
                        'Imaginile clare și bine iluminate dau cele mai bune rezultate',
                      ].map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-blue-600">
                          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep('select_style')} disabled={!activeImage} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  Continuă <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 'select_style' && (
            <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center gap-4">
                {activeImage && <img src={activeImage} alt="" className="h-16 w-16 rounded-xl object-cover border border-gray-200 cursor-zoom-in" onClick={() => setZoomUrl(activeImage)} />}
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Alege stilul imaginii</h2>
                  {selectedProduct && <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{selectedProduct.optimized_title || selectedProduct.original_title}</p>}
                </div>
              </div>
              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRODUCT_STYLES.map(style => {
                  const sel = selectedStyle === style.value
                  return (
                    <button key={style.value} onClick={() => setSelectedStyle(style.value)} disabled={credits < style.cost}
                      className={`relative p-4 rounded-2xl border-2 text-left transition-all bg-gradient-to-br ${style.gradient} ${!( credits >= style.cost) ? 'opacity-40 cursor-not-allowed' : sel ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-200'}`}>
                      {sel && <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>}
                      <span className="text-2xl mb-2 block">{style.icon}</span>
                      <p className={`font-semibold text-sm ${style.dark ? 'text-white' : 'text-gray-900'}`}>{style.label}</p>
                      <p className={`text-xs mt-0.5 ${style.dark ? 'text-gray-300' : 'text-gray-500'}`}>{style.desc}</p>
                      <Badge className={`mt-2 text-[10px] border-0 ${style.dark ? 'bg-white/20 text-white' : 'bg-white/80 text-gray-600'}`}>{style.cost} cr</Badge>
                    </button>
                  )
                })}
              </div>
              <AnimatePresence>
                {selectedStyle === 'manual' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 space-y-2">
                      <label className="text-sm font-medium text-gray-700">Descrie scena dorită</label>
                      <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Ex: Produs pe raft din lemn rustic, lumină naturală de la fereastră..." className="w-full h-24 text-sm px-3 py-2 rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400 resize-none" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => { setStep('select_image'); setError(null) }} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={handleGenerate} disabled={!selectedStyle || generating || (selectedStyle === 'manual' && !manualDesc.trim()) || credits < (styleDef?.cost || 0)} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  <Wand2 className="h-4 w-4 mr-2" /> Generează {styleDef && <Badge className="ml-2 bg-white/20 text-white border-0">{styleDef.cost} cr</Badge>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* GENERATING */}
          {step === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-center">
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center"><Sparkles className="h-9 w-9 text-white" /></div>
                <div className="absolute inset-0 rounded-2xl bg-blue-600 animate-ping opacity-20" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">AI generează imaginea...</h2>
              <p className="text-sm text-gray-500 mb-4">GPT construiește promptul → Nano Banana Pro generează</p>
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 20–60 secunde</div>
            </motion.div>
          )}

          {/* DONE */}
          {step === 'done' && lastResult && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-700">Imagine generată cu succes!</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Referință originală', url: lastResult.original_image_url }, { label: 'Generată', url: lastResult.generated_image_url }].map(item => item.url && (
                  <div key={item.label} className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{item.label}</p>
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-zoom-in" onClick={() => setZoomUrl(item.url!)}>
                      <img src={item.url!} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.open(lastResult.generated_image_url, '_blank')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
                  <Download className="h-4 w-4" /> Descarcă
                </button>
                <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                  <Wand2 className="h-4 w-4" /> Generează altă imagine
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{zoomUrl && <ZoomModal url={zoomUrl} onClose={() => setZoomUrl(null)} />}</AnimatePresence>
    </div>
  )
}

// ─── PROMO IMAGE GENERATOR ────────────────────────────────────────────────────

function PromoGenerator({ onImageGenerated }: { onImageGenerated: (img: GeneratedImage) => void }) {
  const { credits } = useCredits()
  const [step, setStep] = useState<PromoStep>('select_image')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [promoText, setPromoText] = useState<PromoText | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GeneratedImage | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeImage = uploadedImage || selectedProductImage
  const styleDef = PROMO_STYLES.find(s => s.value === selectedStyle)
  const PROMO_COST = 4

  const handleFileUpload = (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => { setUploadedImage(ev.target?.result as string); setSelectedProductImage(null) }
    reader.readAsDataURL(file)
  }

  const handleStyleSelect = async (styleVal: string) => {
    setSelectedStyle(styleVal)
    if (!selectedProduct) return
    setLoadingText(true)
    try {
      const res = await fetch('/api/generate/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_text', product_id: selectedProduct.id, style: styleVal }),
      })
      const data = await res.json()
      if (res.ok && data.promoText) setPromoText(data.promoText)
    } catch {}
    finally { setLoadingText(false) }
  }

  const handleContinueToEdit = () => {
    if (!promoText && selectedProduct) return
    if (!promoText) {
      setPromoText({ headline: 'Titlu Produs', subtitle: 'Subtitlu beneficiu principal', benefits: ['Beneficiu 1', 'Beneficiu 2', 'Beneficiu 3'], cta: 'Comandă Acum', price_text: null })
    }
    setStep('edit_text')
  }

  const handleGenerate = async () => {
    if (!activeImage || !selectedStyle || !promoText) return
    setGenerating(true); setError(null); setStep('generating')
    try {
      const body: Record<string, unknown> = { style: selectedStyle, promo_text: promoText }
      if (selectedProduct) body.product_id = selectedProduct.id
      if (uploadedImage && !selectedProduct) body.reference_image_base64 = uploadedImage
      if (selectedProduct && selectedProductImage !== (selectedProduct.thumbnail_url || selectedProduct.original_images?.[0])) body.reference_image_url = selectedProductImage

      const res = await fetch('/api/generate/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setStep('edit_text'); return }

      const newImg: GeneratedImage = {
        id: data.image.id, product_id: selectedProduct?.id || '',
        style: `promo_${selectedStyle}`, generated_image_url: data.image.generated_image_url,
        original_image_url: activeImage, status: 'completed',
        credits_used: PROMO_COST, created_at: new Date().toISOString(),
        product_title: selectedProduct?.optimized_title || selectedProduct?.original_title || 'Upload manual',
      }
      setLastResult(newImg); onImageGenerated(newImg); setStep('done')
      triggerCreditsRefresh()
    } catch { setError('Eroare de conexiune.'); setStep('edit_text') }
    finally { setGenerating(false) }
  }

  const reset = () => { setStep('select_image'); setSelectedProduct(null); setSelectedProductImage(null); setUploadedImage(null); setUploadedImageFile(null); setSelectedStyle(null); setPromoText(null); setError(null); setLastResult(null) }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <StepDots steps={['select_image', 'select_style', 'edit_text', 'generating']} current={step} />
        {step !== 'select_image' && step !== 'generating' && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Resetează</button>
        )}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* STEP 1 */}
          {step === 'select_image' && (
            <motion.div key="p1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <ImageSourceSelector {...{ selectedProduct, setSelectedProduct, selectedProductImage, setSelectedProductImage, uploadedImage, setUploadedImage, setUploadedImageFile, showPicker, setShowPicker, fileInputRef }} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} className="hidden" />

              {/* Tips pentru calitate poster */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-blue-500 mt-0.5 shrink-0">💡</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">Sfaturi pentru rezultate optime</p>
                    <ul className="space-y-1">
                      {[
                        'Folosește imagini cu fundal alb sau uni — AI-ul reproduce mai fidel produsul',
                        'Asigură-te că produsul ocupă cel puțin 70% din imagine',
                        'Evită imagini cu alte obiecte, mâini sau persoane în jur',
                        'Rezoluție minimă recomandată: 800×800px',
                        'Imaginile clare și bine iluminate dau cele mai bune rezultate',
                      ].map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-blue-600">
                          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep('select_style')} disabled={!activeImage} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  Continuă <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — stil */}
          {step === 'select_style' && (
            <motion.div key="p2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="flex items-center gap-4">
                {activeImage && <img src={activeImage} alt="" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />}
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Alege stilul posterului</h2>
                  <p className="text-sm text-gray-400 mt-0.5">GPT va genera textele automat după selecție</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROMO_STYLES.map(style => {
                  const sel = selectedStyle === style.value
                  const isLoading = loadingText && sel
                  return (
                    <button key={style.value} onClick={() => handleStyleSelect(style.value)} disabled={credits < PROMO_COST || loadingText}
                      className={`relative p-4 rounded-2xl border-2 text-left transition-all bg-gradient-to-br ${style.gradient} ${credits < PROMO_COST ? 'opacity-40 cursor-not-allowed' : sel ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-200'}`}>
                      {isLoading && <div className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center"><Loader2 className="h-5 w-5 text-white animate-spin" /></div>}
                      {sel && !isLoading && <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>}
                      <span className="text-2xl mb-2 block">{style.icon}</span>
                      <p className={`font-semibold text-sm ${style.dark ? 'text-white' : 'text-gray-900'}`}>{style.label}</p>
                      <p className={`text-xs mt-0.5 leading-snug ${style.dark ? 'text-gray-300' : 'text-gray-500'}`}>{style.desc}</p>
                      <Badge className={`mt-2 text-[10px] border-0 ${style.dark ? 'bg-white/20 text-white' : 'bg-white/80 text-gray-600'}`}>{PROMO_COST} cr</Badge>
                    </button>
                  )
                })}
              </div>
              {selectedStyle && !loadingText && promoText && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm text-green-700">Textele au fost generate! Apasă continuă pentru a le edita.</p>
                </div>
              )}
              {!selectedProduct && selectedStyle && !loadingText && !promoText && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700">Niciun produs selectat — vei completa textele manual.</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => { setStep('select_image'); setSelectedStyle(null); setPromoText(null) }} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={handleContinueToEdit} disabled={!selectedStyle || loadingText} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  {loadingText ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Se generează textele...</> : <>Editează textele <Edit3 className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — edit text */}
          {step === 'edit_text' && promoText && (
            <motion.div key="p3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Edit3 className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Editează textele posterului</h2>
                  <p className="text-sm text-gray-400">Generate de AI — modifică ce dorești</p>
                </div>
              </div>

              {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

              <div className="space-y-3">
                {/* Headline */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Titlu principal</label>
                    <span className={`text-xs font-medium ${promoText.headline.length > 30 ? 'text-red-500' : promoText.headline.length > 22 ? 'text-amber-500' : 'text-green-500'}`}>
                      {promoText.headline.length}/30
                    </span>
                  </div>
                  <input value={promoText.headline}
                    onChange={e => e.target.value.length <= 40 && setPromoText(pt => pt ? { ...pt, headline: e.target.value } : pt)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400 font-semibold"
                    placeholder="Ex: Cel Mai Bun Preț" />
                  <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${promoText.headline.length > 30 ? 'bg-red-400' : promoText.headline.length > 22 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(100, (promoText.headline.length / 30) * 100)}%` }} />
                  </div>
                  {promoText.headline.length > 30 && <p className="text-xs text-red-500 mt-1">Prea lung — poate fi tăiat pe poster</p>}
                </div>

                {/* Subtitle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtitlu</label>
                    <span className={`text-xs font-medium ${promoText.subtitle.length > 55 ? 'text-red-500' : promoText.subtitle.length > 42 ? 'text-amber-500' : 'text-green-500'}`}>
                      {promoText.subtitle.length}/55
                    </span>
                  </div>
                  <input value={promoText.subtitle}
                    onChange={e => e.target.value.length <= 70 && setPromoText(pt => pt ? { ...pt, subtitle: e.target.value } : pt)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400"
                    placeholder="Ex: Calitate premium la preț imbatabil" />
                  <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${promoText.subtitle.length > 55 ? 'bg-red-400' : promoText.subtitle.length > 42 ? 'bg-amber-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(100, (promoText.subtitle.length / 55) * 100)}%` }} />
                  </div>
                </div>

                {/* Benefits */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Beneficii (3 puncte)</label>
                  <div className="mt-1.5 space-y-2">
                    {promoText.benefits.map((b, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 text-sm shrink-0">✓</span>
                          <input value={b}
                            onChange={e => e.target.value.length <= 30 && setPromoText(pt => pt ? { ...pt, benefits: pt.benefits.map((x, j) => j === i ? e.target.value : x) } : pt)}
                            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400"
                            placeholder={`Beneficiu ${i + 1}`} />
                          <span className={`text-xs w-10 text-right shrink-0 ${b.length > 25 ? 'text-amber-500' : 'text-gray-400'}`}>{b.length}/30</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA + Preț */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CTA (buton)</label>
                      <span className={`text-xs ${promoText.cta.length > 18 ? 'text-red-500' : 'text-gray-400'}`}>{promoText.cta.length}/18</span>
                    </div>
                    <input value={promoText.cta}
                      onChange={e => e.target.value.length <= 22 && setPromoText(pt => pt ? { ...pt, cta: e.target.value } : pt)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400"
                      placeholder="Comandă Acum" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Preț (opțional)</label>
                    <input value={promoText.price_text || ''}
                      onChange={e => setPromoText(pt => pt ? { ...pt, price_text: e.target.value || null } : pt)}
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-blue-400"
                      placeholder="Doar 299 RON" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-600">💡 Textele sunt aplicate direct pe imagine după generare — vor fi clare și corecte indiferent de model.</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setStep('select_style')} className="text-sm text-gray-400 hover:text-gray-600">← Înapoi</button>
                <Button onClick={handleGenerate} disabled={generating || credits < PROMO_COST} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
                  <Wand2 className="h-4 w-4 mr-2" /> Generează posterul <Badge className="ml-2 bg-white/20 text-white border-0">{PROMO_COST} cr</Badge>
                </Button>
              </div>
            </motion.div>
          )}

          {/* GENERATING */}
          {step === 'generating' && (
            <motion.div key="pgen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-center">
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-purple-600 flex items-center justify-center"><Megaphone className="h-9 w-9 text-white" /></div>
                <div className="absolute inset-0 rounded-2xl bg-purple-600 animate-ping opacity-20" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Se generează posterul promoțional...</h2>
              <p className="text-sm text-gray-500 mb-4">GPT construiește compoziția → Nano Banana Pro generează</p>
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> 30–90 secunde</div>
            </motion.div>
          )}

          {/* DONE */}
          {step === 'done' && lastResult && (
            <motion.div key="pdone" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-700">Poster promoțional generat cu succes!</p>
              </div>

              <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 max-w-sm mx-auto cursor-zoom-in" onClick={() => setZoomUrl(lastResult.generated_image_url)}>
                <img src={lastResult.generated_image_url} alt="" className="w-full h-full object-contain" />
              </div>

              {/* Acțiuni principale */}
              <div className="flex gap-3 justify-center">
                <button onClick={() => window.open(lastResult.generated_image_url, '_blank')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
                  <Download className="h-4 w-4" /> Descarcă
                </button>
              </div>

              {/* Regenerare selectivă */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Regenerare selectivă</p>
                </div>
                <div className="p-3 grid grid-cols-3 gap-2">
                  {/* Regenerează tot */}
                  <button onClick={reset}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                    <RefreshCw className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                    <span className="text-xs text-gray-500 group-hover:text-blue-600 text-center leading-tight">Poster nou</span>
                  </button>

                  {/* Schimbă stilul — păstrează textele */}
                  <button onClick={() => { setStep('select_style') }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all group">
                    <Wand2 className="h-4 w-4 text-gray-400 group-hover:text-purple-500" />
                    <span className="text-xs text-gray-500 group-hover:text-purple-600 text-center leading-tight">Alt stil</span>
                  </button>

                  {/* Editează textele — regenerează cu aceleași setări */}
                  <button onClick={() => { setStep('edit_text') }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group">
                    <Edit3 className="h-4 w-4 text-gray-400 group-hover:text-green-500" />
                    <span className="text-xs text-gray-500 group-hover:text-green-600 text-center leading-tight">Editează text</span>
                  </button>
                </div>
                <div className="px-4 pb-3">
                  <p className="text-xs text-gray-400 text-center">
                    <span className="font-medium text-gray-500">Alt stil</span> și <span className="font-medium text-gray-500">Editează text</span> păstrează produsul selectat
                  </p>
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

// ─── GALLERY ──────────────────────────────────────────────────────────────────

const ALL_STYLES = [...PRODUCT_STYLES, ...PROMO_STYLES.map(s => ({ ...s, value: `promo_${s.value}` }))]
function styleLabel(val: string) {
  return ALL_STYLES.find(s => s.value === val)?.label || val
}
function styleIcon(val: string) {
  return ALL_STYLES.find(s => s.value === val)?.icon || '🖼️'
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const { credits } = useCredits()
  const [activeTab, setActiveTab] = useState<'product' | 'promo'>('product')
  const [gallery, setGallery] = useState<GeneratedImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [gallerySearch, setGallerySearch] = useState('')
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'product' | 'promo'>('all')
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null)

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch('/api/images')
      const data = await res.json()
      setGallery(data.images || [])
    } finally { setGalleryLoading(false) }
  }, [])

  useEffect(() => { fetchGallery() }, [fetchGallery])

  const handleNewImage = (img: GeneratedImage) => setGallery(prev => [img, ...prev])

  const filteredGallery = gallery.filter(img => {
    const matchSearch = !gallerySearch || img.product_title?.toLowerCase().includes(gallerySearch.toLowerCase())
    const isPromo = img.style.startsWith('promo_')
    const matchFilter = galleryFilter === 'all' || (galleryFilter === 'promo' && isPromo) || (galleryFilter === 'product' && !isPromo)
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imagini AI</h1>
          <p className="text-sm text-gray-400 mt-0.5">Generează imagini de produs și postere promoționale</p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
          <Coins className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-semibold text-amber-700">{credits} credite</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('product')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'product' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Camera className="h-4 w-4" /> Imagine Produs
        </button>
        <button
          onClick={() => setActiveTab('promo')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'promo' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Megaphone className="h-4 w-4" /> Poster Promoțional
          <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px]">NOU</Badge>
        </button>
      </div>

      {/* Generator */}
      <AnimatePresence mode="wait">
        {activeTab === 'product' ? (
          <motion.div key="product-gen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ProductGenerator onImageGenerated={handleNewImage} />
          </motion.div>
        ) : (
          <motion.div key="promo-gen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PromoGenerator onImageGenerated={handleNewImage} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Galerie</h2>
            <p className="text-sm text-gray-400 mt-0.5">{filteredGallery.length} imagini</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'product', 'promo'] as const).map(f => (
                <button key={f} onClick={() => setGalleryFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${galleryFilter === f ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f === 'all' ? 'Toate' : f === 'product' ? 'Produs' : 'Promo'}
                </button>
              ))}
            </div>
            <div className="relative w-44">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input placeholder="Caută..." value={gallerySearch} onChange={e => setGallerySearch(e.target.value)} className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-white" />
            </div>
          </div>
        </div>

        {galleryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ImageLucide className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{gallerySearch ? 'Nicio imagine găsită' : 'Nicio imagine generată încă.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredGallery.map((img, i) => {
              const isPromo = img.style.startsWith('promo_')
              return (
                <motion.div key={img.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer" onClick={() => setPreviewImage(img)}>
                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                      <img src={img.generated_image_url} alt={img.product_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-2 left-2 flex gap-1">
                        <Badge className={`border-0 text-[10px] ${isPromo ? 'bg-purple-500/80 text-white backdrop-blur' : 'bg-black/50 text-white backdrop-blur'}`}>
                          {styleIcon(img.style)} {isPromo ? 'Promo' : styleLabel(img.style)}
                        </Badge>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                        <button onClick={e => { e.stopPropagation(); window.open(img.generated_image_url, '_blank') }}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setPreviewImage(img) }}
                          className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 delay-75 transition-all h-9 w-9 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:bg-white shadow-lg">
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{img.product_title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400">{new Date(img.created_at).toLocaleDateString('ro-RO')}</span>
                        <span className="text-[10px] text-gray-400">{img.credits_used} cr</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="aspect-square bg-gray-50"><img src={previewImage.generated_image_url} alt={previewImage.product_title} className="w-full h-full object-contain" /></div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{previewImage.product_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{styleLabel(previewImage.style)} · {previewImage.credits_used} credite</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.open(previewImage.generated_image_url, '_blank')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-800">
                    <Download className="h-4 w-4" /> Descarcă
                  </button>
                  <button onClick={() => setPreviewImage(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">Închide</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}