'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCredits } from '@/hooks/use-credits'
import { triggerCreditsRefresh } from '@/hooks/use-credits'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle, AlertCircle,
  Package, FileText, ImageIcon, DollarSign, Tag, Layers, Settings,
  Wand2, Save, Send, Plus, X, Eye, ImagePlus, ExternalLink,
  Download, Grid3X3, Palette, Check,
} from 'lucide-react'
import Link from 'next/link'

type ProductForm = {
  title: string; short_description: string; long_description: string
  regular_price: string; sale_price: string; sku: string; category: string
  tags: string[]; product_type: 'simple' | 'variable'; manage_stock: boolean
  stock_quantity: string; weight: string
  dimensions: { length: string; width: string; height: string }
  meta_description: string; attributes: { name: string; values: string[] }[]
  ai_title: string; ai_short_description: string; ai_long_description: string
  ai_meta_description: string; ai_benefits: string[]
}

type GenImage = { id: string; url: string; style: string }

const steps = [
  { id: 'basic', label: 'Informații', icon: Package },
  { id: 'details', label: 'Detalii', icon: Settings },
  { id: 'ai', label: 'Conținut AI', icon: Sparkles },
  { id: 'images', label: 'Imagini AI', icon: ImageIcon },
  { id: 'review', label: 'Revizuire', icon: Eye },
]

const styleOptions = [
  { value: 'white_bg', label: 'Fundal Alb', desc: 'Clean, profesional', icon: '🤍', cost: 2 },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Produs în context real', icon: '🏡', cost: 3 },
  { value: 'premium_dark', label: 'Premium Dark', desc: 'Luxos, dramatic', icon: '🖤', cost: 3 },
  { value: 'industrial', label: 'Industrial', desc: 'Raw, autentic', icon: '🏭', cost: 3 },
  { value: 'seasonal', label: 'Seasonal', desc: 'Festiv, sezonier', icon: '🎄', cost: 4 },
  { value: 'auto', label: 'Auto AI', desc: 'AI-ul alege', icon: '🤖', cost: 3 },
]

export default function NewProductPage() {
  const router = useRouter()
  const { credits: userCredits } = useCredits()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generatingAI, setGeneratingAI] = useState<string | null>(null)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [tagInput, setTagInput] = useState('')
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrValues, setNewAttrValues] = useState('')
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [autoGenerateImg, setAutoGenerateImg] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GenImage[]>([])
  const [primaryImageId, setPrimaryImageId] = useState<string | null>(null)
  const [secondaryImageIds, setSecondaryImageIds] = useState<string[]>([])
  const [savedProductId, setSavedProductId] = useState<string | null>(null)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [uploadingRef, setUploadingRef] = useState(false)

  const [form, setForm] = useState<ProductForm>({
    title: '', short_description: '', long_description: '',
    regular_price: '', sale_price: '', sku: '', category: '',
    tags: [], product_type: 'simple', manage_stock: false,
    stock_quantity: '', weight: '',
    dimensions: { length: '', width: '', height: '' },
    meta_description: '', attributes: [],
    ai_title: '', ai_short_description: '', ai_long_description: '',
    ai_meta_description: '', ai_benefits: [],
  })

  const updateForm = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      updateForm('tags', [...form.tags, tagInput.trim()]); setTagInput('')
    }
  }
  const removeTag = (tag: string) => updateForm('tags', form.tags.filter(t => t !== tag))

  const addAttribute = () => {
    if (newAttrName.trim() && newAttrValues.trim()) {
      const values = newAttrValues.split(',').map(v => v.trim()).filter(Boolean)
      updateForm('attributes', [...form.attributes, { name: newAttrName.trim(), values }])
      setNewAttrName(''); setNewAttrValues('')
    }
  }
  const removeAttribute = (i: number) => updateForm('attributes', form.attributes.filter((_, idx) => idx !== i))

  const ensureSaved = async (): Promise<string | null> => {
    if (savedProductId) return savedProductId
    try {
      const res = await fetch('/api/products/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, publish: false, original_images: referenceImageUrl ? [referenceImageUrl] : [] }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error }); return null }
      setSavedProductId(data.product_id)
      return data.product_id
    } catch { setMessage({ type: 'error', text: 'Eroare la salvare' }); return null }
  }

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage({ type: 'error', text: 'Doar fișiere imagine (JPG, PNG, WebP)' }); return }
    if (file.size > 10 * 1024 * 1024) { setMessage({ type: 'error', text: 'Imaginea trebuie să fie sub 10MB' }); return }

    setUploadingRef(true); setMessage({ type: '', text: '' })
    try {
      // Save product first to get an ID for organizing uploads
      const productId = await ensureSaved()
      if (!productId) { setUploadingRef(false); return }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('product_id', productId)

      const res = await fetch('/api/upload/product-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Eroare la upload' }); return }

      setReferenceImageUrl(data.url)

      // Update the product with the original image
      await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_images: [data.url] }),
      })

      setMessage({ type: 'success', text: 'Imagine încărcată cu succes!' })
    } catch { setMessage({ type: 'error', text: 'Eroare la încărcare' }) }
    finally { setUploadingRef(false) }
  }

  const handleGenerateAI = async (section: string) => {
    const cost = section === 'all' ? 5 : 2
    if (userCredits < cost) { setMessage({ type: 'error', text: 'Credite insuficiente' }); return }
    if (!form.title.trim()) { setMessage({ type: 'error', text: 'Completează titlul' }); return }
    setGeneratingAI(section); setMessage({ type: '', text: '' })
    try {
      const body: any = { title: form.title, short_description: form.short_description, category: form.category, price: form.regular_price }
      if (section !== 'all') body.section = section
      const res = await fetch('/api/generate/text-new-product', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
      if (section === 'all') {
        setForm(prev => ({ ...prev, ai_title: data.optimized_title || prev.title, ai_short_description: data.short_description || '', ai_long_description: data.long_description || '', ai_meta_description: data.meta_description || '', ai_benefits: data.benefits || [] }))
        setMessage({ type: 'success', text: 'Conținut AI generat! 5 credite utilizate.' })
      } else {
        const map: Record<string, string> = { title: 'ai_title', short_description: 'ai_short_description', long_description: 'ai_long_description', meta_description: 'ai_meta_description', benefits: 'ai_benefits' }
        setForm(prev => ({ ...prev, [map[section]]: data.value }))
        setMessage({ type: 'success', text: 'Secțiune generată! 2 credite utilizate.' })
      }
      triggerCreditsRefresh()
    } catch { setMessage({ type: 'error', text: 'Eroare la generare' }) }
    finally { setGeneratingAI(null) }
  }

  const handleGenerateImages = async () => {
    if (!referenceImageUrl) { setMessage({ type: 'error', text: 'Încarcă o imagine de referință înainte de a genera!' }); return }
    const styles = autoGenerateImg ? ['white_bg', 'lifestyle', 'premium_dark'] : selectedStyles
    if (styles.length === 0) { setMessage({ type: 'error', text: 'Selectează cel puțin un stil' }); return }
    const productId = await ensureSaved()
    if (!productId) return
    setGeneratingImages(true); setMessage({ type: '', text: '' })
    let ok = 0, fail = 0
    for (const style of styles) {
      try {
        const res = await fetch('/api/generate/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, style, reference_image_url: referenceImageUrl }) })
        if (res.ok) { const d = await res.json(); if (d.image) setGeneratedImages(prev => [...prev, { id: d.image.id, url: d.image.generated_image_url, style }]); ok++ }
        else { const d = await res.json().catch(() => ({})); setMessage({ type: 'error', text: d.error || 'Eroare generare' }); fail++ }
      } catch { fail++ }
    }
    if (ok > 0) setMessage({ type: 'success', text: `${ok} ${ok === 1 ? 'imagine generată' : 'imagini generate'}!` })
    else if (fail > 0 && ok === 0) setMessage({ type: 'error', text: 'Nicio imagine generată' })
    setGeneratingImages(false); setSelectedStyles([]); setAutoGenerateImg(false); triggerCreditsRefresh()
  }

  const toggleStyle = (s: string) => { setAutoGenerateImg(false); setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]) }

  const totalImgCost = autoGenerateImg ? 8 : selectedStyles.reduce((sum, s) => sum + (styleOptions.find(x => x.value === s)?.cost || 3), 0)

  // Build selected image URLs for saving/publishing
  const getSelectedImageUrls = () => {
    const primary = primaryImageId ? generatedImages.find(i => i.id === primaryImageId) : null
    const secondary = generatedImages.filter(i => secondaryImageIds.includes(i.id))
    // If no primary selected but we have images, use the first one
    const allSelected = primary
      ? [primary, ...secondary.filter(s => s.id !== primary.id)]
      : generatedImages.length > 0 ? [generatedImages[0], ...secondary] : []
    return allSelected.map(i => i.url)
  }

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim()) { setMessage({ type: 'error', text: 'Titlul este obligatoriu' }); return }
    publish ? setPublishing(true) : setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const selectedImageUrls = getSelectedImageUrls()

      if (savedProductId && publish) {
        // Update images on product before publishing
        if (selectedImageUrls.length > 0) {
          await fetch(`/api/products/${savedProductId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generated_images: selectedImageUrls }),
          })
        }
        const res = await fetch(`/api/products/${savedProductId}/publish`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
        setMessage({ type: 'success', text: 'Produs publicat!' })
        setTimeout(() => router.push(`/products/${savedProductId}`), 1000)
      } else if (savedProductId && !publish) {
        if (selectedImageUrls.length > 0) {
          await fetch(`/api/products/${savedProductId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generated_images: selectedImageUrls }),
          })
        }
        setMessage({ type: 'success', text: 'Produs salvat!' })
        setTimeout(() => router.push(`/products/${savedProductId}`), 1000)
      } else {
        const res = await fetch('/api/products/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, publish, generated_images: selectedImageUrls }),
        })
        const data = await res.json()
        if (!res.ok) { setMessage({ type: 'error', text: data.error }); return }
        if (publish && data.product_id) {
          const pubRes = await fetch(`/api/products/${data.product_id}/publish`, { method: 'POST' })
          if (!pubRes.ok) { const pd = await pubRes.json(); setMessage({ type: 'error', text: pd.error || 'Salvat dar nu publicat' }) }
          else setMessage({ type: 'success', text: 'Produs creat și publicat!' })
        } else {
          setMessage({ type: 'success', text: 'Produs salvat ca draft!' })
        }
        setTimeout(() => router.push(data.product_id ? `/products/${data.product_id}` : '/products'), 1000)
      }
    } catch { setMessage({ type: 'error', text: 'Eroare la salvare' }) }
    finally { setSaving(false); setPublishing(false) }
  }

  const canGoNext = () => { if (currentStep === 0) return form.title.trim().length > 0; return true }
  const goNext = () => { if (canGoNext()) setCurrentStep(prev => Math.min(prev + 1, steps.length - 1)) }
  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0))

  const AIBtn = ({ section, isSmall = false }: { section: string; isSmall?: boolean }) => {
    const active = generatingAI === section, any = generatingAI !== null, cost = section === 'all' ? 5 : 2
    if (isSmall) return (
      <button onClick={() => handleGenerateAI(section)} disabled={any || userCredits < cost}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${active ? 'bg-blue-100 text-blue-600' : userCredits < cost ? 'text-gray-300' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'} ${any && !active ? 'opacity-40' : ''}`}>
        {active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {active ? '...' : `AI ${cost}cr`}
      </button>
    )
    return (
      <Button onClick={() => handleGenerateAI(section)} disabled={any || userCredits < cost || !form.title.trim()} variant="outline" className="rounded-xl h-9 text-xs gap-1.5">
        {active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {active ? 'Se generează...' : `Generează tot — ${cost} credite`}
      </Button>
    )
  }

  const dt = form.ai_title || form.title
  const ds = form.ai_short_description || form.short_description
  const dl = form.ai_long_description || form.long_description
  const dm = form.ai_meta_description || form.meta_description

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/products"><Button variant="ghost" size="sm" className="rounded-xl text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4 mr-1" />Produse</Button></Link>
            <div><h1 className="text-xl font-bold text-gray-900">Produs nou</h1><p className="text-xs text-gray-400 mt-0.5">Creează un produs complet cu AI</p></div>
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs"><Sparkles className="h-3 w-3 mr-1" />{userCredits} credite</Badge>
        </div>
      </motion.div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <button key={step.id} onClick={() => i <= currentStep && setCurrentStep(i)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${i === currentStep ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : i < currentStep ? 'bg-green-50 text-green-700 cursor-pointer' : 'bg-gray-50 text-gray-400'}`}>
            <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === currentStep ? 'bg-blue-600 text-white' : i < currentStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {i < currentStep ? <CheckCircle className="h-3 w-3" /> : i + 1}
            </div>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* STEP 0: BASIC */}
        {currentStep === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1"><Package className="h-5 w-5 text-blue-600" /><h2 className="text-base font-semibold text-gray-900">Informații de bază</h2></div>
              <div className="space-y-2"><Label className="text-sm text-gray-600">Titlul produsului *</Label><Input value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Ex: Miere de albine polifloră 500g" className="h-11 rounded-xl border-gray-200" /></div>
              <div className="space-y-2"><Label className="text-sm text-gray-600">Descriere scurtă</Label><textarea value={form.short_description} onChange={e => updateForm('short_description', e.target.value)} placeholder="2-3 propoziții..." rows={3} className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
              <div className="space-y-2"><Label className="text-sm text-gray-600">Descriere completă</Label><textarea value={form.long_description} onChange={e => updateForm('long_description', e.target.value)} placeholder="Descriere detaliată..." rows={5} className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-sm text-gray-600">Categorie</Label><Input value={form.category} onChange={e => updateForm('category', e.target.value)} placeholder="Ex: Produse apicole" className="h-11 rounded-xl border-gray-200" /></div>
                <div className="space-y-2"><Label className="text-sm text-gray-600">SKU</Label><Input value={form.sku} onChange={e => updateForm('sku', e.target.value)} placeholder="Ex: MIERE-500" className="h-11 rounded-xl border-gray-200" /></div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Etichete</Label>
                <div className="flex gap-2"><Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Adaugă etichetă..." className="h-10 rounded-xl border-gray-200 flex-1" /><Button onClick={addTag} variant="outline" className="rounded-xl h-10 px-3"><Plus className="h-4 w-4" /></Button></div>
                {form.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{form.tags.map(t => <Badge key={t} variant="secondary" className="bg-gray-100 text-gray-700 text-xs pl-2.5 pr-1 py-1 gap-1">{t}<button onClick={() => removeTag(t)} className="hover:text-red-500"><X className="h-3 w-3" /></button></Badge>)}</div>}
              </div>
              <div className="space-y-2"><Label className="text-sm text-gray-600">Tip produs</Label>
                <div className="flex gap-2">{[{ v: 'simple', l: 'Simplu', d: 'Standard' }, { v: 'variable', l: 'Variabil', d: 'Cu variații' }].map(t => (
                  <button key={t.v} onClick={() => updateForm('product_type', t.v)} className={`flex-1 p-3.5 rounded-xl border-2 text-left transition-all ${form.product_type === t.v ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}><p className="text-sm font-medium text-gray-900">{t.l}</p><p className="text-[11px] text-gray-400">{t.d}</p></button>
                ))}</div>
              </div>
            </CardContent></Card>
          </motion.div>
        )}

        {/* STEP 1: DETAILS */}
        {currentStep === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" /><h2 className="text-base font-semibold text-gray-900">Prețuri</h2></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-sm text-gray-600">Preț regular (RON)</Label><Input type="number" value={form.regular_price} onChange={e => updateForm('regular_price', e.target.value)} placeholder="0.00" className="h-11 rounded-xl border-gray-200" /></div>
                <div className="space-y-2"><Label className="text-sm text-gray-600">Preț reducere</Label><Input type="number" value={form.sale_price} onChange={e => updateForm('sale_price', e.target.value)} placeholder="0.00" className="h-11 rounded-xl border-gray-200" /></div>
              </div>
            </CardContent></Card>
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2"><Package className="h-5 w-5 text-orange-600" /><h2 className="text-base font-semibold text-gray-900">Inventar</h2></div>
              <div className="flex items-center gap-3">
                <button onClick={() => updateForm('manage_stock', !form.manage_stock)} className={`h-5 w-9 rounded-full transition-all relative ${form.manage_stock ? 'bg-blue-600' : 'bg-gray-200'}`}><div className={`h-4 w-4 rounded-full bg-white shadow absolute top-0.5 transition-all ${form.manage_stock ? 'left-[18px]' : 'left-0.5'}`} /></button>
                <Label className="text-sm text-gray-700">Gestionează stocul</Label>
              </div>
              {form.manage_stock && <div className="space-y-2"><Label className="text-sm text-gray-600">Cantitate</Label><Input type="number" value={form.stock_quantity} onChange={e => updateForm('stock_quantity', e.target.value)} placeholder="0" className="h-11 rounded-xl border-gray-200 max-w-xs" /></div>}
            </CardContent></Card>
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-purple-600" /><h2 className="text-base font-semibold text-gray-900">Livrare</h2></div>
              <div className="space-y-2"><Label className="text-sm text-gray-600">Greutate (kg)</Label><Input type="number" value={form.weight} onChange={e => updateForm('weight', e.target.value)} placeholder="0.00" className="h-11 rounded-xl border-gray-200 max-w-xs" /></div>
              <div><Label className="text-sm text-gray-600 mb-2 block">Dimensiuni (cm)</Label><div className="grid grid-cols-3 gap-3">
                <Input type="number" value={form.dimensions.length} onChange={e => updateForm('dimensions', { ...form.dimensions, length: e.target.value })} placeholder="L" className="h-10 rounded-xl border-gray-200 text-sm" />
                <Input type="number" value={form.dimensions.width} onChange={e => updateForm('dimensions', { ...form.dimensions, width: e.target.value })} placeholder="l" className="h-10 rounded-xl border-gray-200 text-sm" />
                <Input type="number" value={form.dimensions.height} onChange={e => updateForm('dimensions', { ...form.dimensions, height: e.target.value })} placeholder="H" className="h-10 rounded-xl border-gray-200 text-sm" />
              </div></div>
            </CardContent></Card>
            {form.product_type === 'variable' && (
              <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2"><Tag className="h-5 w-5 text-indigo-600" /><h2 className="text-base font-semibold text-gray-900">Atribute</h2></div>
                {form.attributes.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{a.name}</p><div className="flex flex-wrap gap-1 mt-1">{a.values.map((v, j) => <Badge key={j} variant="secondary" className="bg-white text-[11px]">{v}</Badge>)}</div></div>
                    <button onClick={() => removeAttribute(i)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input value={newAttrName} onChange={e => setNewAttrName(e.target.value)} placeholder="Nume (ex: Mărime)" className="h-10 rounded-xl border-gray-200 text-sm" />
                  <Input value={newAttrValues} onChange={e => setNewAttrValues(e.target.value)} placeholder="Valori: S, M, L" className="h-10 rounded-xl border-gray-200 text-sm sm:col-span-2" />
                </div>
                <Button onClick={addAttribute} variant="outline" className="rounded-xl h-9 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />Adaugă</Button>
              </CardContent></Card>
            )}
          </motion.div>
        )}

        {/* STEP 2: AI CONTENT */}
        {currentStep === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50"><CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0"><Wand2 className="h-5 w-5 text-blue-600" /></div>
                  <div><p className="text-sm font-semibold text-blue-900">Generează tot conținutul cu AI</p><p className="text-xs text-blue-600">Titlu, descrieri, meta, beneficii — un click</p></div>
                </div>
                <AIBtn section="all" />
              </div>
            </CardContent></Card>

            {[
              { s: 'title', l: 'Titlu SEO', f: form.ai_title, c: 'blue', I: FileText },
              { s: 'meta_description', l: 'Meta Description', f: form.ai_meta_description, c: 'purple', I: Tag },
              { s: 'short_description', l: 'Descriere scurtă', f: form.ai_short_description, c: 'green', I: Sparkles },
            ].map(item => (
              <Card key={item.s} className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-7 w-7 rounded-lg bg-${item.c}-100 flex items-center justify-center`}><item.I className={`h-3.5 w-3.5 text-${item.c}-600`} /></div>
                    <span className="text-sm font-semibold text-gray-900">{item.l}</span>
                  </div>
                  <AIBtn section={item.s} isSmall />
                </div>
                {item.f ? <div className={`p-3 bg-${item.c}-50 rounded-xl`}><p className="text-sm text-gray-700">{item.f}</p><p className={`text-[11px] text-${item.c}-600 mt-1`}>{item.f.length} car</p></div> : <p className="text-sm text-gray-400 italic">Click AI pentru a genera</p>}
              </CardContent></Card>
            ))}

            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center"><Layers className="h-3.5 w-3.5 text-orange-600" /></div><span className="text-sm font-semibold text-gray-900">Descriere completă</span></div>
                <AIBtn section="long_description" isSmall />
              </div>
              {form.ai_long_description ? <div className="p-3 bg-orange-50 rounded-xl prose prose-sm max-w-none [&_h3]:text-sm [&_h3]:font-semibold [&_p]:text-sm [&_li]:text-sm" dangerouslySetInnerHTML={{ __html: form.ai_long_description }} /> : <p className="text-sm text-gray-400 italic">Click AI pentru a genera</p>}
            </CardContent></Card>

            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /></div><span className="text-sm font-semibold text-gray-900">Beneficii</span></div>
                <AIBtn section="benefits" isSmall />
              </div>
              {form.ai_benefits.length > 0 ? <div className="space-y-2">{form.ai_benefits.map((b, i) => <div key={i} className="flex items-start gap-2.5 p-2.5 bg-emerald-50/50 rounded-xl"><CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /><span className="text-sm text-gray-700">{b}</span></div>)}</div> : <p className="text-sm text-gray-400 italic">Click AI pentru a genera</p>}
            </CardContent></Card>
          </motion.div>
        )}

        {/* STEP 3: AI IMAGES */}
        {currentStep === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

            {/* UPLOAD IMAGINE REFERINTA - OBLIGATORIU */}
            <Card className={`rounded-2xl border-2 shadow-sm transition-all ${referenceImageUrl ? 'border-green-200 bg-green-50/30' : 'border-orange-300 bg-orange-50/30'}`}><CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${referenceImageUrl ? 'bg-green-100' : 'bg-orange-100'}`}>
                  {referenceImageUrl ? <CheckCircle className="h-4 w-4 text-green-600" /> : <ImageIcon className="h-4 w-4 text-orange-600" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {referenceImageUrl ? 'Imagine de referință încărcată' : 'Încarcă imaginea produsului'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {referenceImageUrl ? 'AI-ul va transforma această imagine în diferite stiluri' : 'Obligatoriu — AI-ul modifică imaginea ta, nu generează de la zero'}
                  </p>
                </div>
              </div>

              {referenceImageUrl ? (
                <div className="flex items-start gap-4">
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-white shadow-md shrink-0">
                    <img src={referenceImageUrl} alt="Referință" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="p-3 bg-green-50 rounded-xl">
                      <p className="text-xs text-green-700 font-medium">Imagine pregătită pentru transformare</p>
                      <p className="text-[11px] text-green-600 mt-1">Nano Banana Pro va păstra produsul exact din imagine și va schimba doar fundalul și ambianța.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                      <ImageIcon className="h-3.5 w-3.5" />Schimbă imaginea
                      <input type="file" accept="image/*" onChange={handleUploadReference} className="hidden" />
                    </label>
                  </div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${uploadingRef ? 'border-blue-300 bg-blue-50' : 'border-orange-300 hover:border-blue-400 hover:bg-blue-50/50'}`}>
                  {uploadingRef ? (
                    <><Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" /><p className="text-sm text-blue-600 font-medium">Se încarcă...</p></>
                  ) : (
                    <>
                      <div className="h-14 w-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-3"><ImagePlus className="h-7 w-7 text-orange-500" /></div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">Click pentru a încărca imaginea produsului</p>
                      <p className="text-xs text-gray-500 mb-1">JPG, PNG sau WebP — max 10MB</p>
                      <p className="text-[11px] text-orange-600 font-medium">Fără imagine nu poți genera stiluri AI</p>
                    </>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadReference} className="hidden" disabled={uploadingRef} />
                </label>
              )}
            </CardContent></Card>

            {/* SELECTARE STILURI - doar daca avem referinta */}
            <Card className={`rounded-2xl border-0 shadow-sm transition-opacity ${referenceImageUrl ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}><CardContent className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center"><Wand2 className="h-4 w-4 text-white" /></div>
                <div><h3 className="text-sm font-semibold text-gray-900">Alege stilurile</h3><p className="text-xs text-gray-400">AI-ul transformă imaginea ta în stilurile selectate</p></div>
              </div>
              <button onClick={() => { setAutoGenerateImg(!autoGenerateImg); setSelectedStyles([]) }}
                className={`w-full p-4 rounded-xl border-2 transition-all mb-4 text-left ${autoGenerateImg ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${autoGenerateImg ? 'bg-blue-100' : 'bg-gray-100'}`}><Sparkles className={`h-5 w-5 ${autoGenerateImg ? 'text-blue-600' : 'text-gray-400'}`} /></div>
                  <div className="flex-1"><p className="text-sm font-medium text-gray-900">Generare automată — 3 stiluri</p><p className="text-xs text-gray-500">White, Lifestyle, Premium Dark</p></div>
                  <Badge className={`${autoGenerateImg ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'} border-0 text-xs`}>8 cr</Badge>
                </div>
              </button>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Sau alege manual</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {styleOptions.map(s => {
                  const sel = selectedStyles.includes(s.value)
                  return <button key={s.value} onClick={() => toggleStyle(s.value)} disabled={autoGenerateImg}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${autoGenerateImg ? 'opacity-40 cursor-not-allowed' : sel ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="text-lg mb-1">{s.icon}</div><p className="text-sm font-medium text-gray-900">{s.label}</p><p className="text-[11px] text-gray-400">{s.desc}</p>
                    <Badge className={`mt-2 text-[10px] border-0 ${sel ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{s.cost} cr</Badge>
                  </button>
                })}
              </div>
              <div className="mt-5">
                <Button onClick={handleGenerateImages} disabled={!referenceImageUrl || generatingImages || (!autoGenerateImg && selectedStyles.length === 0) || userCredits < totalImgCost} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 w-full">
                  {generatingImages ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează...</> : <><ImagePlus className="h-4 w-4 mr-2" />Generează {autoGenerateImg ? '3 imagini' : `${selectedStyles.length} img`}{totalImgCost > 0 && ` — ${totalImgCost} cr`}</>}
                </Button>
                {!referenceImageUrl && <p className="text-xs text-orange-600 text-center mt-2">Încarcă o imagine de referință mai sus pentru a genera</p>}
              </div>
              {generatingImages && <div className="mt-4 p-3 bg-blue-50 rounded-xl"><p className="text-xs text-blue-600 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />10-30 sec/imagine. Produsul se salvează automat...</p></div>}
            </CardContent></Card>

            {generatedImages.length > 0 && (
              <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center"><Grid3X3 className="h-3.5 w-3.5 text-purple-600" /></div><span className="text-sm font-semibold text-gray-900">Imagini generate ({generatedImages.length})</span></div>
                  <p className="text-[11px] text-gray-400">Click pentru a seta ca principală, dublu-click pentru secundară</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {generatedImages.map(img => {
                    const isPrimary = primaryImageId === img.id
                    const isSecondary = secondaryImageIds.includes(img.id)
                    return (
                    <div key={img.id} className={`group relative rounded-xl overflow-hidden bg-gray-100 aspect-square cursor-pointer ring-2 transition-all ${isPrimary ? 'ring-blue-500 ring-offset-2' : isSecondary ? 'ring-green-500 ring-offset-2' : 'ring-transparent hover:ring-gray-200'}`}
                      onClick={() => {
                        if (isPrimary) { setPrimaryImageId(null) }
                        else {
                          setSecondaryImageIds(prev => prev.filter(x => x !== img.id))
                          setPrimaryImageId(img.id)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (isSecondary) { setSecondaryImageIds(prev => prev.filter(x => x !== img.id)) }
                        else if (!isPrimary) { setSecondaryImageIds(prev => [...prev, img.id]) }
                      }}
                    >
                      <img src={img.url} alt={img.style} className="w-full h-full object-cover" />
                      {isPrimary && <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><Check className="h-3 w-3" />Principală</div>}
                      {isSecondary && <div className="absolute top-2 left-2 px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><Check className="h-3 w-3" />Secundară</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3"><div className="flex items-center justify-between">
                          <Badge className="bg-white/20 backdrop-blur text-white border-0 text-[10px]">{styleOptions.find(x => x.value === img.style)?.label || img.style}</Badge>
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); if (isSecondary) setSecondaryImageIds(prev => prev.filter(x => x !== img.id)); else if (!isPrimary) setSecondaryImageIds(prev => [...prev, img.id]) }} className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-green-500/50" title="Setează ca secundară"><Plus className="h-3 w-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); window.open(img.url, '_blank') }} className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30"><ExternalLink className="h-3 w-3" /></button>
                          </div>
                        </div></div>
                      </div>
                    </div>
                  )})}
                </div>
                {generatedImages.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm bg-blue-600" /><span className="text-gray-600">Imagine principală (click) — prima imagine din WooCommerce</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm bg-green-600" /><span className="text-gray-600">Imagini secundare (butonul +) — galeria produsului</span>
                    </div>
                    <p className="text-[11px] text-gray-400">{primaryImageId ? '1 imagine principală' : 'Nicio imagine principală'} + {secondaryImageIds.length} secundare selectate</p>
                  </div>
                )}
              </CardContent></Card>
            )}

            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50"><CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2"><Palette className="h-4 w-4 text-blue-600" /><span className="text-sm font-semibold text-blue-900">Sfat pro</span></div>
              <p className="text-xs text-blue-700 leading-relaxed">Fundal alb pentru marketplace-uri. Lifestyle și Premium pentru social media. Generează mai multe variante și alege cele mai bune.</p>
            </CardContent></Card>
          </motion.div>
        )}

        {/* STEP 4: REVIEW */}
        {currentStep === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5"><Eye className="h-5 w-5 text-blue-600" /><h2 className="text-base font-semibold text-gray-900">Revizuire produs</h2></div>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl"><p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Titlu</p><p className="text-base font-medium text-gray-900">{dt || '—'}</p></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[11px] text-gray-400">Preț</p><p className="text-sm font-semibold text-gray-900">{form.regular_price ? `${form.regular_price} RON` : '—'}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[11px] text-gray-400">Categorie</p><p className="text-sm text-gray-900">{form.category || '—'}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[11px] text-gray-400">Tip</p><p className="text-sm text-gray-900 capitalize">{form.product_type}</p></div>
                </div>
                {ds && <div className="p-4 bg-gray-50 rounded-xl"><p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Descriere scurtă</p><p className="text-sm text-gray-700">{ds}</p></div>}
                {dm && <div className="p-4 bg-purple-50 rounded-xl"><p className="text-[11px] font-medium text-purple-400 uppercase tracking-wider mb-1">Meta Description</p><p className="text-sm text-gray-700">{dm}</p></div>}
                {generatedImages.length > 0 && <div className="p-4 bg-gray-50 rounded-xl"><p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Imagini AI ({generatedImages.length}){primaryImageId && <span className="text-blue-600 ml-1">· 1 principală</span>}{secondaryImageIds.length > 0 && <span className="text-green-600 ml-1">· {secondaryImageIds.length} secundare</span>}</p><div className="flex gap-2 overflow-x-auto">{generatedImages.map(img => { const isPri = primaryImageId === img.id; const isSec = secondaryImageIds.includes(img.id); return <div key={img.id} className={`relative shrink-0 ${isPri ? 'ring-2 ring-blue-500 ring-offset-1 rounded-lg' : isSec ? 'ring-2 ring-green-500 ring-offset-1 rounded-lg' : ''}`}><img src={img.url} className="h-20 w-20 rounded-lg object-cover" />{isPri && <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></div>}{isSec && <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-600 rounded-full flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></div>}</div> })}</div></div>}
                <Separator />
                <div className="space-y-2">{[
                  { l: 'Titlu', ok: !!dt }, { l: 'Preț', ok: !!form.regular_price }, { l: 'Categorie', ok: !!form.category },
                  { l: 'Descriere scurtă', ok: !!ds }, { l: 'Meta Description', ok: !!dm }, { l: 'Descriere completă', ok: !!dl },
                  { l: 'Imagini AI', ok: generatedImages.length > 0 },
                ].map((item, i) => <div key={i} className="flex items-center gap-2.5">{item.ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 border-gray-200" />}<span className={`text-sm ${item.ok ? 'text-gray-700' : 'text-gray-400'}`}>{item.l}</span></div>)}</div>
              </div>
            </CardContent></Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => handleSave(false)} disabled={saving || publishing} variant="outline" className="rounded-xl h-11 flex-1">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</> : <><Save className="h-4 w-4 mr-2" />Salvează ca draft</>}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving || publishing} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 flex-1">
                {publishing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se publică...</> : <><Send className="h-4 w-4 mr-2" />Creează și publică</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentStep < 4 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={currentStep === 0} className="rounded-xl text-gray-500"><ArrowLeft className="h-4 w-4 mr-2" />Înapoi</Button>
          <Button onClick={goNext} disabled={!canGoNext()} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">Continuă<ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      )}
    </div>
  )
}