'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UpgradePrompt } from '@/components/upgrade-prompt'
import { useSession } from 'next-auth/react'
import { triggerCreditsRefresh } from '@/hooks/use-credits'
import { useCredits } from '@/hooks/use-credits'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  ImageIcon,
  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  Eye,
  Star,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Wand2,
  Layers,
  Target,
  ExternalLink,
  Palette,
  Download,
  ImagePlus,
  Crown,
  Grid3X3,
  RefreshCw,
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
  id: string
  style: string
  generated_image_url: string
  quality_score: number
  status: string
  credits_used: number
  processing_time_ms: number | null
  created_at: string
}

const styleOptions = [
  { value: 'white_bg', label: 'Fundal Alb', desc: 'Clean, profesional', icon: '🤍', cost: 2 },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Produs în context real', icon: '🏡', cost: 3 },
  { value: 'premium_dark', label: 'Premium Dark', desc: 'Luxos, dramatic', icon: '🖤', cost: 3 },
  { value: 'industrial', label: 'Industrial', desc: 'Raw, autentic', icon: '🏭', cost: 3 },
  { value: 'seasonal', label: 'Seasonal', desc: 'Festiv, sezonier', icon: '🎄', cost: 4 },
  { value: 'auto', label: 'Auto AI', desc: 'Lăsați AI-ul să aleagă', icon: '🤖', cost: 3 },
]

type SectionKey = 'title' | 'meta_description' | 'short_description' | 'long_description' | 'benefits'

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
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
  const [showOriginalDesc, setShowOriginalDesc] = useState(false)
  const [activeTab, setActiveTab] = useState('content')
  const [regeneratingSection, setRegeneratingSection] = useState<SectionKey | null>(null)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products/${id}`)
      const data = await res.json()
      if (data.product) setProduct(data.product)
      if (data.images) setGeneratedImages(data.images)
    } catch {
      console.error('Error loading product')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateText = async () => {
    setGeneratingText(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error })
        return
      }
      setMessage({ type: 'success', text: 'Conținut generat cu succes! 5 credite utilizate.' })
      fetchProduct()
      triggerCreditsRefresh()
    } catch {
      setMessage({ type: 'error', text: 'Eroare la generarea textului' })
    } finally {
      setGeneratingText(false)
    }
  }

  const handleRegenerateSection = async (section: SectionKey) => {
    if (userCredits < 2) {
      setMessage({ type: 'error', text: 'Credite insuficiente (necesare: 2)' })
      return
    }
    setRegeneratingSection(section)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/generate/text-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: id, section }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      const sectionLabels: Record<SectionKey, string> = {
        title: 'Titlul',
        meta_description: 'Meta Description',
        short_description: 'Descrierea scurtă',
        long_description: 'Descrierea completă',
        benefits: 'Beneficiile',
      }

      setMessage({ type: 'success', text: `${sectionLabels[section]} regenerat cu succes! 2 credite utilizate.` })
      fetchProduct()
      triggerCreditsRefresh()
    } catch {
      setMessage({ type: 'error', text: 'Eroare la regenerare' })
    } finally {
      setRegeneratingSection(null)
    }
  }

  const handleGenerateImages = async () => {
    const stylesToGenerate = autoGenerate
      ? ['white_bg', 'lifestyle', 'premium_dark']
      : selectedStyles

    if (stylesToGenerate.length === 0) {
      setMessage({ type: 'error', text: 'Selectează cel puțin un stil de imagine' })
      return
    }

    setGeneratingImages(true)
    setMessage({ type: '', text: '' })

    let successCount = 0
    let failCount = 0

    for (const style of stylesToGenerate) {
      try {
        const res = await fetch('/api/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: id, style }),
        })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      setMessage({
        type: 'success',
        text: `${successCount} ${successCount === 1 ? 'imagine generată' : 'imagini generate'} cu succes!${failCount > 0 ? ` (${failCount} eșuate)` : ''}`,
      })
      fetchProduct()
    } else {
      setMessage({ type: 'error', text: 'Nicio imagine nu a putut fi generată' })
    }

    setGeneratingImages(false)
    setSelectedStyles([])
    setAutoGenerate(false)
    triggerCreditsRefresh()
  }

  const handlePublish = async () => {
    setPublishing(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`/api/products/${id}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error })
        return
      }
      setMessage({ type: 'success', text: 'Produs publicat cu succes în magazin!' })
      fetchProduct()
      triggerCreditsRefresh()
    } catch {
      setMessage({ type: 'error', text: 'Eroare la publicare' })
    } finally {
      setPublishing(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const toggleStyle = (style: string) => {
    setAutoGenerate(false)
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    )
  }

  const totalImageCost = autoGenerate
    ? styleOptions.filter(s => ['white_bg', 'lifestyle', 'premium_dark'].includes(s.value)).reduce((sum, s) => sum + s.cost, 0)
    : selectedStyles.reduce((sum, style) => {
        const opt = styleOptions.find(s => s.value === style)
        return sum + (opt?.cost || 3)
      }, 0)

  // Section regenerate button component
  const SectionRegenButton = ({ section, label }: { section: SectionKey; label: string }) => {
    const isRegenerating = regeneratingSection === section
    const isAnyRegenerating = regeneratingSection !== null

    if (userCredits < 2) return null

    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleRegenerateSection(section) }}
        disabled={isAnyRegenerating}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
          isRegenerating
            ? 'bg-blue-100 text-blue-600'
            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
        } ${isAnyRegenerating && !isRegenerating ? 'opacity-40 cursor-not-allowed' : ''}`}
        title={`Regenerează ${label} — 2 credite`}
      >
        {isRegenerating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        {isRegenerating ? 'Se regenerează...' : '2 cr'}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-white rounded-2xl animate-pulse" />
          <div className="h-96 bg-white rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Produsul nu a fost găsit</p>
        <Link href="/products">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la produse
          </Button>
        </Link>
      </div>
    )
  }

  const hasOptimizedContent = product.optimized_title || product.optimized_short_description

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeIn} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="rounded-xl text-gray-500 hover:text-gray-900 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Produse
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              {product.original_images && product.original_images[0] && (
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 hidden sm:block">
                  <img src={product.original_images[0]} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {product.optimized_title || product.original_title}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`text-[11px] border-0 ${
                    product.status === 'published' ? 'bg-green-100 text-green-700' :
                    product.status === 'optimized' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {product.status === 'published' ? '✓ Publicat' :
                     product.status === 'optimized' ? '✓ Optimizat' : 'Draft'}
                  </Badge>
                  {product.category && (
                    <span className="text-xs text-gray-400">{product.category}</span>
                  )}
                  {product.price && (
                    <span className="text-xs font-medium text-gray-600">{product.price} RON</span>
                  )}
                  {product.seo_score > 0 && (
                    <Badge variant="outline" className={`text-[11px] ${
                      product.seo_score >= 80 ? 'border-green-200 text-green-600' :
                      product.seo_score >= 50 ? 'border-yellow-200 text-yellow-600' :
                      'border-red-200 text-red-500'
                    }`}>
                      SEO {product.seo_score}/100
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={handlePublish}
            disabled={publishing || !hasOptimizedContent}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5 shrink-0"
          >
            {publishing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se publică...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Publică în magazin</>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <motion.div {...fadeIn} transition={{ duration: 0.3, delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto">
            <TabsTrigger value="content" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <FileText className="h-4 w-4 mr-2" />
              Conținut AI
            </TabsTrigger>
            <TabsTrigger value="images" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              Imagini AI
            </TabsTrigger>
            <TabsTrigger value="seo" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <Target className="h-4 w-4 mr-2" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="original" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <Eye className="h-4 w-4 mr-2" />
              Original
            </TabsTrigger>
          </TabsList>

          {/* ===== CONTENT TAB ===== */}
          <TabsContent value="content" className="space-y-6">
            {!hasOptimizedContent ? (
              <Card className="border-dashed border-2 border-blue-200 rounded-2xl shadow-none bg-blue-50/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
                    <Wand2 className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Generează conținut optimizat</h3>
                  <p className="text-gray-500 text-sm text-center max-w-md mb-6">
                    AI-ul va genera titlu optimizat SEO, descrieri persuasive, beneficii, meta description și scor SEO personalizat.
                  </p>
                  {userCredits < 5 ? (
                    <UpgradePrompt
                      credits={userCredits}
                      plan={userPlan}
                      variant="inline"
                      action="generarea de text"
                    />
                  ) : (
                    <Button
                      onClick={handleGenerateText}
                      disabled={generatingText}
                      className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6"
                    >
                      {generatingText ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează conținutul...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />Generează cu AI — 5 credite</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {/* Optimized title */}
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Titlu optimizat</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SectionRegenButton section="title" label="titlul" />
                          <button
                            onClick={() => copyToClipboard(product.optimized_title || '', 'title')}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            {copiedField === 'title' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={product.optimized_title}
                          initial={{ opacity: 0.5 }}
                          animate={{ opacity: 1 }}
                          className="text-base font-medium text-gray-900 leading-relaxed"
                        >
                          {product.optimized_title}
                        </motion.p>
                      </AnimatePresence>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400">{product.optimized_title?.length || 0} caractere</span>
                        {(product.optimized_title?.length || 0) >= 50 && (product.optimized_title?.length || 0) <= 70 && (
                          <Badge className="bg-green-50 text-green-600 text-[10px] border-0">Lungime ideală</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Meta description */}
                  {product.meta_description && (
                    <Card className="rounded-2xl border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Target className="h-3.5 w-3.5 text-purple-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">Meta Description</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <SectionRegenButton section="meta_description" label="meta description" />
                            <button
                              onClick={() => copyToClipboard(product.meta_description || '', 'meta')}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {copiedField === 'meta' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={product.meta_description}
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-gray-700 leading-relaxed"
                          >
                            {product.meta_description}
                          </motion.p>
                        </AnimatePresence>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-400">{product.meta_description.length} caractere</span>
                          {product.meta_description.length <= 155 && (
                            <Badge className="bg-green-50 text-green-600 text-[10px] border-0">Lungime optimă</Badge>
                          )}
                        </div>
                        <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                          <p className="text-xs text-gray-400 mb-2">Previzualizare Google</p>
                          <p className="text-blue-700 text-sm font-medium hover:underline cursor-default">
                            {product.optimized_title}
                          </p>
                          <p className="text-green-700 text-xs">stupinamaria.inovex.ro › produs</p>
                          <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">{product.meta_description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Short description */}
                  {product.optimized_short_description && (
                    <Card className="rounded-2xl border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
                              <Sparkles className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">Descriere scurtă</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <SectionRegenButton section="short_description" label="descrierea scurtă" />
                            <button
                              onClick={() => copyToClipboard(product.optimized_short_description || '', 'short')}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {copiedField === 'short' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={product.optimized_short_description}
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-gray-700 leading-relaxed"
                          >
                            {product.optimized_short_description}
                          </motion.p>
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  )}

                  {/* Long description */}
                  {product.optimized_long_description && (
                    <Card className="rounded-2xl border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center">
                              <Layers className="h-3.5 w-3.5 text-orange-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">Descriere completă</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <SectionRegenButton section="long_description" label="descrierea completă" />
                            <button
                              onClick={() => copyToClipboard(product.optimized_long_description || '', 'long')}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {copiedField === 'long' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={product.optimized_long_description?.substring(0, 50)}
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            className="prose prose-sm max-w-none text-gray-700 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm [&_ul]:space-y-1"
                            dangerouslySetInnerHTML={{ __html: product.optimized_long_description }}
                          />
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {/* Benefits */}
                  {product.benefits && product.benefits.length > 0 && (
                    <Card className="rounded-2xl border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">Beneficii produs</span>
                          </div>
                          <SectionRegenButton section="benefits" label="beneficiile" />
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={product.benefits.join(',')}
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            className="space-y-2"
                          >
                            {product.benefits.map((b, i) => (
                              <div key={i} className="flex items-start gap-2.5 p-2.5 bg-emerald-50/50 rounded-xl">
                                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-sm text-gray-700">{b}</span>
                              </div>
                            ))}
                          </motion.div>
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  )}

                  {/* Regenerate all */}
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      {userCredits < 5 ? (
                        <UpgradePrompt
                          credits={userCredits}
                          plan={userPlan}
                          variant="inline"
                          action="regenerarea conținutului"
                        />
                      ) : (
                        <>
                          <Button
                            onClick={handleGenerateText}
                            disabled={generatingText || regeneratingSection !== null}
                            variant="outline"
                            className="w-full rounded-xl h-10 border-gray-200"
                          >
                            {generatingText ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se regenerează tot...</>
                            ) : (
                              <><RotateCcw className="h-4 w-4 mr-2" />Regenerează tot — 5 credite</>
                            )}
                          </Button>
                          <p className="text-[11px] text-gray-400 text-center mt-2">
                            Sau folosește butoanele <RefreshCw className="h-3 w-3 inline" /> de pe fiecare secțiune (2 credite/secțiune)
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== IMAGES TAB ===== */}
          <TabsContent value="images" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <Wand2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Generează imagini cu AI</h3>
                        <p className="text-xs text-gray-400">Selectează stilurile dorite sau lasă AI-ul să aleagă</p>
                      </div>
                    </div>

                    <button
                      onClick={() => { setAutoGenerate(!autoGenerate); setSelectedStyles([]) }}
                      className={`w-full p-4 rounded-xl border-2 transition-all mb-4 text-left ${
                        autoGenerate
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          autoGenerate ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Sparkles className={`h-5 w-5 ${autoGenerate ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Generare automată</p>
                          <p className="text-xs text-gray-500">AI-ul generează 3 imagini din stiluri diferite (White, Lifestyle, Premium)</p>
                        </div>
                        <Badge className={`${autoGenerate ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'} border-0 text-xs`}>
                          8 credite
                        </Badge>
                      </div>
                    </button>

                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Sau alege manual</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {styleOptions.map((style) => {
                        const isSelected = selectedStyles.includes(style.value)
                        return (
                          <button
                            key={style.value}
                            onClick={() => toggleStyle(style.value)}
                            disabled={autoGenerate}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              autoGenerate ? 'opacity-40 cursor-not-allowed' :
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="text-lg mb-1">{style.icon}</div>
                            <p className="text-sm font-medium text-gray-900">{style.label}</p>
                            <p className="text-[11px] text-gray-400">{style.desc}</p>
                            <Badge className={`mt-2 text-[10px] border-0 ${
                              isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {style.cost} credite
                            </Badge>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-5 space-y-3">
                      {userCredits < totalImageCost && totalImageCost > 0 && (
                        <UpgradePrompt
                          credits={userCredits}
                          plan={userPlan}
                          variant="inline"
                          action="generarea de imagini"
                        />
                      )}
                      <Button
                        onClick={handleGenerateImages}
                        disabled={generatingImages || (!autoGenerate && selectedStyles.length === 0) || (userCredits < totalImageCost && totalImageCost > 0)}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6 w-full"
                      >
                        {generatingImages ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează imaginile...</>
                        ) : (
                          <><ImagePlus className="h-4 w-4 mr-2" />
                            Generează {autoGenerate ? '3 imagini' : `${selectedStyles.length} ${selectedStyles.length === 1 ? 'imagine' : 'imagini'}`}
                            {totalImageCost > 0 && ` — ${totalImageCost} credite`}
                          </>
                        )}
                      </Button>
                    </div>

                    {generatingImages && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                        <p className="text-xs text-blue-600 flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generarea durează 10-30 de secunde per imagine. Te rugăm să aștepți...
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {generatedImages.length > 0 && (
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Grid3X3 className="h-3.5 w-3.5 text-purple-600" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">
                            Imagini generate ({generatedImages.length})
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {generatedImages.map((img) => (
                          <div key={img.id} className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square">
                            <img
                              src={img.generated_image_url}
                              alt={img.style}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <div className="flex items-center justify-between">
                                  <Badge className="bg-white/20 backdrop-blur text-white border-0 text-[10px]">
                                    {styleOptions.find(s => s.value === img.style)?.label || img.style}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => window.open(img.generated_image_url, '_blank')}
                                      className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => window.open(img.generated_image_url)}
                                      className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                    >
                                      <Download className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-2 right-2">
                              <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                                img.status === 'published' ? 'bg-green-500' : 'bg-blue-500'
                              }`}>
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="h-3.5 w-3.5 text-gray-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900">Imagini originale</span>
                    </div>
                    {product.original_images && product.original_images.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {product.original_images.map((img, i) => (
                          <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                            <img src={img} alt={`Original ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-200" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Sfat pro</span>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Pentru cele mai bune rezultate, generează imagini în mai multe stiluri și alege cea mai potrivită
                      pentru magazinul tău. Imaginile cu fundal alb performează cel mai bine pe marketplace-uri.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== SEO TAB ===== */}
          <TabsContent value="seo" className="space-y-6">
            {product.seo_score > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <svg className="w-24 h-24 -rotate-90">
                            <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                            <circle
                              cx="48" cy="48" r="40" fill="none"
                              stroke={product.seo_score >= 80 ? '#22c55e' : product.seo_score >= 50 ? '#eab308' : '#ef4444'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${product.seo_score * 2.51} 251`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${
                              product.seo_score >= 80 ? 'text-green-600' :
                              product.seo_score >= 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}>
                              {product.seo_score}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {product.seo_score >= 80 ? 'SEO excelent!' :
                             product.seo_score >= 50 ? 'SEO bun, cu potențial' : 'SEO necesită atenție'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {product.seo_score >= 80
                              ? 'Produsul tău este bine optimizat pentru motoarele de căutare.'
                              : product.seo_score >= 50
                              ? 'Există câteva îmbunătățiri care pot crește vizibilitatea.'
                              : 'Recomandăm regenerarea conținutului pentru un scor mai bun.'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Verificări SEO</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Titlu optimizat', ok: !!product.optimized_title, detail: product.optimized_title ? `${product.optimized_title.length} caractere` : 'Lipsă' },
                          { label: 'Meta description', ok: !!product.meta_description, detail: product.meta_description ? `${product.meta_description.length} caractere` : 'Lipsă' },
                          { label: 'Descriere scurtă', ok: !!product.optimized_short_description, detail: product.optimized_short_description ? 'Completă' : 'Lipsă' },
                          { label: 'Descriere lungă', ok: !!product.optimized_long_description, detail: product.optimized_long_description ? 'Completă' : 'Lipsă' },
                          { label: 'Beneficii produs', ok: (product.benefits?.length || 0) > 0, detail: product.benefits ? `${product.benefits.length} beneficii` : 'Lipsă' },
                          { label: 'Imagini produs', ok: (product.original_images?.length || 0) > 0, detail: `${product.original_images?.length || 0} imagini` },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              {item.ok ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="text-sm text-gray-700">{item.label}</span>
                            </div>
                            <span className={`text-xs ${item.ok ? 'text-green-600' : 'text-red-500'}`}>{item.detail}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  {product.seo_suggestions && product.seo_suggestions.length > 0 && (
                    <Card className="rounded-2xl border-0 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-lg bg-yellow-100 flex items-center justify-center">
                            <Star className="h-3.5 w-3.5 text-yellow-600" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Sugestii AI</span>
                        </div>
                        <div className="space-y-2">
                          {product.seo_suggestions.map((s, i) => (
                            <div key={i} className="p-3 bg-yellow-50/50 rounded-xl">
                              <p className="text-sm text-gray-700">{s}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <Card className="border-dashed border-2 border-gray-200 rounded-2xl shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nicio analiză SEO</h3>
                  <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
                    Generează conținut AI pentru a primi scor SEO și sugestii de optimizare.
                  </p>
                  <Button onClick={() => setActiveTab('content')} variant="outline" className="rounded-xl">
                    Mergi la Conținut AI
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== ORIGINAL TAB ===== */}
          <TabsContent value="original" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Titlu original</h3>
                    <p className="text-gray-700 mb-4">{product.original_title}</p>

                    {product.original_description && (
                      <>
                        <Separator className="my-4" />
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Descriere originală</h3>
                        <div
                          className="prose prose-sm max-w-none text-gray-600 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-800"
                          dangerouslySetInnerHTML={{ __html: product.original_description }}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Imagini originale</h3>
                    {product.original_images && product.original_images.length > 0 ? (
                      <div className="space-y-2">
                        {product.original_images.map((img, i) => (
                          <div key={i} className="rounded-xl overflow-hidden bg-gray-100">
                            <img src={img} alt={`Original ${i + 1}`} className="w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-200" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm mt-4">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalii produs</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">ID extern</span>
                        <span className="text-gray-700 font-mono text-xs">{product.external_id || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Categorie</span>
                        <span className="text-gray-700">{product.category || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Preț</span>
                        <span className="text-gray-700">{product.price ? `${product.price} RON` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status</span>
                        <span className="text-gray-700 capitalize">{product.status}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}