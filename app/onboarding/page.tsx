'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Store,
  Plug,
  Package,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Zap,
  Crown,
  Rocket,
  Gift,
  BarChart3,
  ImageIcon,
  Target,
  Shield,
  RefreshCw,
  AlertCircle,
  PartyPopper,
  ChevronRight,
  Globe,
  X,
  Play,
  ExternalLink,
  Info,
  Copy,
  Check,
} from 'lucide-react'

const steps = [
  { id: 'welcome', label: 'Bine ai venit' },
  { id: 'business', label: 'Afacerea ta' },
  { id: 'connect', label: 'Conectează magazin' },
  { id: 'sync', label: 'Sincronizare' },
  { id: 'plan', label: 'Alege planul' },
  { id: 'complete', label: 'Gata!' },
]

const plans = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    credits: 20,
    icon: Gift,
    color: 'gray',
    features: ['20 credite gratuite', '1 magazin', 'Toate funcțiile AI'],
    recommended: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    credits: 200,
    icon: Zap,
    color: 'blue',
    features: ['200 credite/lună', 'Suport prioritar', 'Analiză SEO completă'],
    recommended: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    credits: 500,
    icon: Rocket,
    color: 'indigo',
    features: ['500 credite/lună', '3 magazine', 'Generare în masă'],
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 249,
    credits: 2000,
    icon: Crown,
    color: 'purple',
    features: ['2000 credite/lună', 'Magazine nelimitate', 'Manager dedicat'],
    recommended: false,
  },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)
  const [showKeys, setShowKeys] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [error, setError] = useState('')
  const [storeConnected, setStoreConnected] = useState(false)
  const [productsSynced, setProductsSynced] = useState(false)
  const [showVideoTutorial, setShowVideoTutorial] = useState(false)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const [businessForm, setBusinessForm] = useState({
    businessName: '',
    website: '',
    tone: 'professional',
    niche: '',
  })

  const [storeForm, setStoreForm] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
  })

  const userName = session?.user?.name?.split(' ')[0] || 'Utilizator'

  const goNext = () => {
    setDirection(1)
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    setError('')
  }

  const goBack = () => {
    setDirection(-1)
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setError('')
  }

  const handleConnectStore = async () => {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) {
      setError('Completează toate câmpurile')
      return
    }
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/stores/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Eroare la conectare')
        return
      }
      setStoreConnected(true)
      setTimeout(() => goNext(), 800)
    } catch {
      setError('Eroare de conexiune')
    } finally {
      setConnecting(false)
    }
  }

  const handleSyncProducts = async () => {
    setSyncing(true)
    setError('')
    try {
      const storesRes = await fetch('/api/stores')
      const storesData = await storesRes.json()
      if (!storesData.store) {
        setError('Niciun magazin conectat')
        return
      }
      const res = await fetch(`/api/stores/${storesData.store.id}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Eroare la sincronizare')
        return
      }
      setSyncedCount(data.synced || 0)
      setProductsSynced(true)
      setTimeout(() => goNext(), 1200)
    } catch {
      setError('Eroare la sincronizare')
    } finally {
      setSyncing(false)
    }
  }

  const handleComplete = async () => {
    router.push('/dashboard')
  }

  const progress = ((currentStep) / (steps.length - 1)) * 100

  const tutorialSteps = [
    {
      step: 1,
      title: 'Accesează panoul WordPress',
      description: 'Conectează-te la panoul de administrare WordPress al magazinului tău. De obicei, adresa este magazinul-tau.ro/wp-admin.',
      tip: 'Asigură-te că ai drepturi de administrator.',
    },
    {
      step: 2,
      title: 'Navighează la WooCommerce → Settings',
      description: 'În meniul din stânga WordPress, dă click pe WooCommerce, apoi pe Settings (Setări).',
      tip: null,
    },
    {
      step: 3,
      title: 'Deschide tab-ul Advanced',
      description: 'În pagina de Settings, click pe tab-ul Advanced (Avansat) din partea de sus a paginii.',
      tip: null,
    },
    {
      step: 4,
      title: 'Click pe REST API',
      description: 'Sub tab-ul Advanced, vei vedea mai multe sub-tab-uri. Click pe REST API.',
      tip: null,
    },
    {
      step: 5,
      title: 'Creează o cheie nouă',
      description: 'Click pe butonul Add Key (Adaugă Cheie). Completează câmpurile: Description: "HONTRIO", User: selectează contul tău de admin, Permissions: selectează Read/Write.',
      tip: 'Este important să selectezi Read/Write, nu doar Read.',
    },
    {
      step: 6,
      title: 'Generează și copiază cheile',
      description: 'Click pe Generate API Key. Vei primi două chei: Consumer Key (ck_...) și Consumer Secret (cs_...). Copiază-le și lipește-le în câmpurile de mai sus.',
      tip: 'Salvează cheile într-un loc sigur. Consumer Secret-ul nu va mai fi afișat după ce închizi pagina.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
      {/* Top bar */}
      <div className="h-16 flex items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">HONTRIO</span>
        </div>

        {currentStep < steps.length - 1 && currentStep > 0 && (
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            Sari peste
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {currentStep > 0 && currentStep < steps.length - 1 && (
        <div className="px-6 lg:px-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Pasul {currentStep} din {steps.length - 2}</span>
              <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {steps.slice(1, -1).map((step, i) => (
                <div key={step.id} className="flex items-center gap-1.5">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    i + 1 < currentStep
                      ? 'bg-blue-600 text-white'
                      : i + 1 === currentStep
                      ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i + 1 < currentStep ? <CheckCircle className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={`text-[11px] hidden sm:block ${
                    i + 1 <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            {/* ===== STEP 0: WELCOME ===== */}
            {currentStep === 0 && (
              <motion.div
                key="welcome"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="mb-8"
                >
                  <div className="relative inline-flex">
                    <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-200/50">
                      <Sparkles className="h-12 w-12 text-white" />
                    </div>
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-xl bg-yellow-400 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-sm">✨</span>
                    </motion.div>
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      className="absolute -bottom-1 -left-3 h-7 w-7 rounded-lg bg-green-400 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-xs">🚀</span>
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-3xl font-bold text-gray-900 mb-3">
                    Bine ai venit, {userName}! 🎉
                  </h1>
                  <p className="text-gray-600 text-lg max-w-lg mx-auto mb-3">
                    Hai să îți configurăm platforma. În câteva minute vei fi gata să creezi, optimizezi și publici produse cu AI.
                  </p>
                  <p className="text-gray-400 text-sm max-w-md mx-auto mb-10">
                    Vei parcurge 4 pași simpli: configurarea brandului, conectarea magazinului, sincronizarea produselor și alegerea planului potrivit.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="grid grid-cols-3 gap-3 mb-10 max-w-lg mx-auto"
                >
                  {[
                    { icon: BarChart3, label: 'Analiză SEO', desc: 'Scor și sugestii', color: 'blue' },
                    { icon: ImageIcon, label: 'Imagini AI', desc: '6 stiluri pro', color: 'purple' },
                    { icon: Target, label: 'Conversii +40%', desc: 'Conținut optimizat', color: 'green' },
                  ].map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                    >
                      <f.icon className={`h-5 w-5 text-${f.color}-500 mx-auto mb-1.5`} />
                      <p className="text-xs font-medium text-gray-700">{f.label}</p>
                      <p className="text-[10px] text-gray-400">{f.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={goNext}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 text-base shadow-lg shadow-blue-200/50"
                  >
                    Hai să începem
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ===== STEP 1: BUSINESS INFO ===== */}
            {currentStep === 1 && (
              <motion.div
                key="business"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <Store className="h-7 w-7 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Spune-ne despre afacerea ta</h2>
                  <p className="text-gray-500 mt-1">Aceste informații ajută AI-ul să genereze conținut potrivit</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Numele afacerii</Label>
                      <Input
                        value={businessForm.businessName}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, businessName: e.target.value }))}
                        placeholder="Ex: Magazinul Meu"
                        className="h-11 rounded-xl border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Website</Label>
                      <Input
                        value={businessForm.website}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://magazinul-meu.ro"
                        className="h-11 rounded-xl border-gray-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Nișa / Industrie</Label>
                    <Input
                      value={businessForm.niche}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, niche: e.target.value }))}
                      placeholder="Ex: Fashion, Electronice, Beauty, Food..."
                      className="h-11 rounded-xl border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Tonul comunicării</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'professional', label: 'Profesional', emoji: '💼', desc: 'Serios, de încredere' },
                        { value: 'friendly', label: 'Prietenos', emoji: '😊', desc: 'Cald, accesibil' },
                        { value: 'luxury', label: 'Premium', emoji: '✨', desc: 'Elegant, sofisticat' },
                        { value: 'casual', label: 'Casual', emoji: '🤙', desc: 'Relaxat, informal' },
                      ].map(tone => (
                        <button
                          key={tone.value}
                          onClick={() => setBusinessForm(prev => ({ ...prev, tone: tone.value }))}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                            businessForm.tone === tone.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-base">{tone.emoji}</span>
                            <span className="text-sm font-medium text-gray-900">{tone.label}</span>
                          </div>
                          <p className="text-[11px] text-gray-400">{tone.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <Button variant="ghost" onClick={goBack} className="rounded-xl text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Înapoi
                  </Button>
                  <Button onClick={goNext} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6">
                    Continuă
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ===== STEP 2: CONNECT STORE ===== */}
            {currentStep === 2 && (
              <motion.div
                key="connect"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="text-center mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <Plug className="h-7 w-7 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Conectează magazinul</h2>
                  <p className="text-gray-500 mt-1">Vom importa produsele automat din WooCommerce</p>
                </div>

                {storeConnected ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center"
                  >
                    <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Magazin conectat!</h3>
                    <p className="text-gray-500 text-sm">Trecem la sincronizarea produselor...</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Video tutorial button */}
                    <button
                      onClick={() => setShowVideoTutorial(!showVideoTutorial)}
                      className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 text-left transition-all hover:shadow-md hover:shadow-blue-100/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <Play className="h-5 w-5 text-blue-600 ml-0.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900">Nu știi cum să obții cheile API?</p>
                          <p className="text-xs text-blue-600">Click aici pentru tutorialul pas cu pas</p>
                        </div>
                        <motion.div
                          animate={{ rotate: showVideoTutorial ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className={`h-5 w-5 text-blue-400 transition-transform ${showVideoTutorial ? 'rotate-90' : ''}`} />
                        </motion.div>
                      </div>
                    </button>

                    {/* Tutorial expandable */}
                    <AnimatePresence>
                      {showVideoTutorial && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                            {/* Video placeholder */}
                            <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
                              <div className="text-center">
                                <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3 cursor-pointer hover:bg-white/30 transition-colors">
                                  <Play className="h-6 w-6 text-white ml-1" />
                                </div>
                                <p className="text-white/80 text-sm font-medium">Video Tutorial</p>
                                <p className="text-white/50 text-xs">Cum obții cheile API WooCommerce</p>
                              </div>
                              {/* Replace this div with actual video embed: */}
                              {/* <iframe src="YOUR_VIDEO_URL" className="absolute inset-0 w-full h-full" /> */}
                            </div>

                            <div className="flex items-center gap-2 py-2">
                              <div className="h-px flex-1 bg-gray-100" />
                              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Sau urmează pașii</span>
                              <div className="h-px flex-1 bg-gray-100" />
                            </div>

                            {/* Step by step tutorial */}
                            <div className="space-y-2">
                              {tutorialSteps.map((item) => (
                                <button
                                  key={item.step}
                                  onClick={() => setExpandedStep(expandedStep === item.step ? null : item.step)}
                                  className="w-full text-left"
                                >
                                  <div className={`p-3.5 rounded-xl border transition-all ${
                                    expandedStep === item.step
                                      ? 'border-blue-200 bg-blue-50/50'
                                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                  }`}>
                                    <div className="flex items-center gap-3">
                                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                        expandedStep === item.step
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        {item.step}
                                      </div>
                                      <span className={`text-sm font-medium ${
                                        expandedStep === item.step ? 'text-blue-900' : 'text-gray-700'
                                      }`}>
                                        {item.title}
                                      </span>
                                    </div>

                                    <AnimatePresence>
                                      {expandedStep === item.step && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <p className="text-sm text-gray-600 mt-2.5 ml-10 leading-relaxed">
                                            {item.description}
                                          </p>
                                          {item.tip && (
                                            <div className="mt-2 ml-10 flex items-start gap-2 p-2.5 bg-yellow-50 rounded-lg">
                                              <Info className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                                              <span className="text-xs text-yellow-700">{item.tip}</span>
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Quick link */}
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                              <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="text-xs text-gray-500 flex-1">
                                Accesează direct: <strong>magazinul-tau.ro/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys</strong>
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Connection form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">URL Magazin</Label>
                        <Input
                          value={storeForm.store_url}
                          onChange={(e) => setStoreForm(prev => ({ ...prev, store_url: e.target.value }))}
                          placeholder="https://magazinul-tau.ro"
                          className="h-11 rounded-xl border-gray-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-gray-600">Consumer Key</Label>
                          <button
                            onClick={() => setShowKeys(!showKeys)}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                          >
                            {showKeys ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showKeys ? 'Ascunde' : 'Arată'}
                          </button>
                        </div>
                        <Input
                          type={showKeys ? 'text' : 'password'}
                          value={storeForm.consumer_key}
                          onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_key: e.target.value }))}
                          placeholder="ck_xxxxxxxxxxxxxxxx"
                          className="h-11 rounded-xl border-gray-200 font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Consumer Secret</Label>
                        <Input
                          type={showKeys ? 'text' : 'password'}
                          value={storeForm.consumer_secret}
                          onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_secret: e.target.value }))}
                          placeholder="cs_xxxxxxxxxxxxxxxx"
                          className="h-11 rounded-xl border-gray-200 font-mono text-sm"
                        />
                      </div>

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl"
                        >
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm text-red-600">{error}</span>
                        </motion.div>
                      )}

                      <Button
                        onClick={handleConnectStore}
                        disabled={connecting}
                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-11"
                      >
                        {connecting ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</>
                        ) : (
                          <><Plug className="h-4 w-4 mr-2" />Conectează magazinul</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-6">
                  <Button variant="ghost" onClick={goBack} className="rounded-xl text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Înapoi
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="rounded-xl text-gray-400">
                    Sari peste
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ===== STEP 3: SYNC PRODUCTS ===== */}
            {currentStep === 3 && (
              <motion.div
                key="sync"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Sincronizează produsele</h2>
                  <p className="text-gray-500 mt-1">Importăm produsele din magazinul tău WooCommerce</p>
                </div>

                {productsSynced ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center"
                  >
                    <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {syncedCount} produse sincronizate!
                    </h3>
                    <p className="text-gray-500 text-sm">Mai avem un singur pas...</p>
                  </motion.div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                    {syncing ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="relative mx-auto mb-6 w-20 h-20">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0"
                          >
                            <RefreshCw className="h-20 w-20 text-blue-200" />
                          </motion.div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-8 w-8 text-blue-600" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Se sincronizează...</h3>
                        <p className="text-gray-500 text-sm">Importăm produsele din magazinul tău. Poate dura câteva secunde.</p>
                        <div className="flex items-center justify-center gap-1 mt-4">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                              className="h-2 w-2 rounded-full bg-blue-500"
                            />
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <>
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                          <RefreshCw className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Gata de sincronizare</h3>
                        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                          Vom importa toate produsele din magazinul tău WooCommerce. Produsele vor fi gata de optimizare imediat.
                        </p>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-4 text-left"
                          >
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="text-sm text-red-600">{error}</span>
                          </motion.div>
                        )}

                        <Button
                          onClick={handleSyncProducts}
                          className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizează acum
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-6">
                  <Button variant="ghost" onClick={goBack} className="rounded-xl text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Înapoi
                  </Button>
                  {!syncing && (
                    <Button variant="ghost" onClick={goNext} className="rounded-xl text-gray-400">
                      Sari peste
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== STEP 4: CHOOSE PLAN ===== */}
            {currentStep === 4 && (
              <motion.div
                key="plan"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                    <Crown className="h-7 w-7 text-yellow-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Alege planul potrivit</h2>
                  <p className="text-gray-500 mt-1">Poți începe gratuit și face upgrade oricând</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${
                        selectedPlan === plan.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100/50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      {plan.recommended && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-blue-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg">
                            RECOMANDAT
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          plan.color === 'gray' ? 'bg-gray-100' :
                          plan.color === 'blue' ? 'bg-blue-100' :
                          plan.color === 'indigo' ? 'bg-indigo-100' :
                          'bg-purple-100'
                        }`}>
                          <plan.icon className={`h-5 w-5 ${
                            plan.color === 'gray' ? 'text-gray-600' :
                            plan.color === 'blue' ? 'text-blue-600' :
                            plan.color === 'indigo' ? 'text-indigo-600' :
                            'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                          <p className="text-xs text-gray-400">
                            {plan.price === 0 ? 'Gratuit' : `${plan.price} RON/lună`}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                            <span className="text-xs text-gray-600">{f}</span>
                          </div>
                        ))}
                      </div>

                      {selectedPlan === plan.id && (
                        <motion.div layoutId="selectedPlan" className="absolute top-3 right-3">
                          <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={goBack} className="rounded-xl text-gray-500">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Înapoi
                  </Button>
                  <Button onClick={goNext} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6">
                    {selectedPlan === 'free' ? 'Continuă gratuit' : `Alege ${plans.find(p => p.id === selectedPlan)?.name}`}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ===== STEP 5: COMPLETE ===== */}
            {currentStep === 5 && (
              <motion.div
                key="complete"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="mb-8"
                >
                  <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto shadow-xl shadow-green-200/50">
                    <PartyPopper className="h-12 w-12 text-white" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Totul e pregătit! 🚀</h2>
                  <p className="text-gray-500 text-lg max-w-md mx-auto mb-2">
                    Contul tău HONTRIO este configurat și gata de utilizare.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-md mx-auto mb-8 text-left"
                >
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Rezumat configurare</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-700">Cont creat</span>
                      </div>
                      <Badge className="bg-green-50 text-green-600 border-0 text-[10px]">Activ</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {storeConnected ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-200" />
                        )}
                        <span className="text-sm text-gray-700">Magazin conectat</span>
                      </div>
                      <Badge className={`border-0 text-[10px] ${storeConnected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {storeConnected ? 'Conectat' : 'Sari peste'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {productsSynced ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-200" />
                        )}
                        <span className="text-sm text-gray-700">Produse sincronizate</span>
                      </div>
                      <Badge className={`border-0 text-[10px] ${productsSynced ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {productsSynced ? `${syncedCount} produse` : 'Sari peste'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-700">Plan selectat</span>
                      </div>
                      <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px] capitalize">
                        {plans.find(p => p.id === selectedPlan)?.name}
                      </Badge>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={handleComplete}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 text-base shadow-lg shadow-blue-200/50"
                  >
                    Mergi la Dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}