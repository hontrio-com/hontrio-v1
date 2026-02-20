'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles, ArrowRight, ArrowLeft, Store, Package, Loader2,
  CheckCircle, Eye, EyeOff, Zap, Crown, Rocket, Gift,
  RefreshCw, AlertCircle, PartyPopper, ChevronRight, Globe,
  Play, Info, ExternalLink, Home, Layers, Shield,
} from 'lucide-react'
import Link from 'next/link'

// Steps for the top stepper
const steps = [
  { id: 'welcome', label: 'Bun venit' },
  { id: 'business', label: 'Afacerea ta' },
  { id: 'connect', label: 'Magazin' },
  { id: 'sync', label: 'Produse' },
  { id: 'plan', label: 'Plan' },
  { id: 'complete', label: 'Gata!' },
]

const plans = [
  {
    id: 'free', name: 'Free Trial', price: 0, unit: 'RON', icon: '🎁',
    features: ['20 credite gratuite', '1 magazin conectat', 'Toate funcțiile AI'],
    recommended: false,
  },
  {
    id: 'professional', name: 'Professional', price: 99, unit: 'RON/lună', icon: '🎯',
    features: ['500 credite/lună', '3 magazine conectate', 'Generare în masă', 'Suport prioritar'],
    recommended: true,
  },
  {
    id: 'starter', name: 'Starter', price: 49, unit: 'RON/lună', icon: '⚡',
    features: ['200 credite/lună', 'Suport prioritar', 'Analiză SEO completă'],
    recommended: false,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 249, unit: 'RON/lună', icon: '👑',
    features: ['2000+ credite/lună', 'Magazine nelimitate', 'Manager dedicat'],
    recommended: false, note: 'Adaptat volumului și nevoilor tale',
  },
]

const countries = [
  'România', 'Moldova', 'Bulgaria', 'Ungaria', 'Germania', 'Franța',
  'Italia', 'Spania', 'Austria', 'Olanda', 'Belgia', 'Marea Britanie', 'SUA', 'Altă țară',
]

const languages = [
  { value: 'ro', label: 'Română' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'hu', label: 'Magyar' },
  { value: 'bg', label: 'Български' },
]

const tutorialSteps = [
  { step: 1, title: 'Accesează panoul WordPress', description: 'Conectează-te la panoul de administrare WordPress al magazinului tău. De obicei, adresa este magazinul-tau.ro/wp-admin.', tip: 'Asigură-te că ai drepturi de administrator.' },
  { step: 2, title: 'Navighează la WooCommerce → Settings', description: 'În meniul din stânga WordPress, dă click pe WooCommerce, apoi pe Settings (Setări).', tip: null },
  { step: 3, title: 'Deschide tab-ul Advanced → REST API', description: 'În pagina de Settings, click pe tab-ul Advanced, apoi pe REST API.', tip: null },
  { step: 4, title: 'Creează o cheie nouă', description: 'Click pe Add Key. Completează: Description: "HONTRIO", User: contul tău de admin, Permissions: Read/Write.', tip: 'Este important să selectezi Read/Write, nu doar Read.' },
  { step: 5, title: 'Copiază cheile generate', description: 'Vei primi Consumer Key (ck_...) și Consumer Secret (cs_...). Copiază-le și lipește-le în câmpurile de mai jos.', tip: 'Consumer Secret-ul nu va mai fi afișat după ce închizi pagina.' },
]

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 60 : -60, opacity: 0 }),
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncEstimate, setSyncEstimate] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [error, setError] = useState('')
  const [storeConnected, setStoreConnected] = useState(false)
  const [productsSynced, setProductsSynced] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [expandedTutStep, setExpandedTutStep] = useState<number | null>(null)
  const [gdprConsent] = useState(true)

  const [biz, setBiz] = useState({
    businessName: '', website: '', niche: '', country: '', language: 'ro',
  })
  const [store, setStore] = useState({
    store_url: '', consumer_key: '', consumer_secret: '',
  })

  const userName = session?.user?.name?.split(' ')[0] || 'Utilizator'
  const userLastName = session?.user?.name?.split(' ').slice(-1)[0] || ''

  // Check if onboarding already completed
  useEffect(() => {
    if ((session?.user as any)?.onboardingCompleted) {
      router.push('/dashboard')
    }
  }, [session, router])

  const goNext = () => { setDir(1); setStep(s => Math.min(s + 1, steps.length - 1)); setError('') }
  const goBack = () => { setDir(-1); setStep(s => Math.max(s - 1, 0)); setError('') }

  const handleSaveBusiness = async () => {
    // Save business info when going to next step
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: biz.businessName,
          website: biz.website,
          niche: biz.niche,
          brand_language: biz.language,
          preferences: { country: biz.country },
        }),
      })
    } catch { /* non-blocking */ }
    goNext()
  }

  const handleConnectStore = async () => {
    if (!store.store_url || !store.consumer_key || !store.consumer_secret) {
      setError('Completează toate câmpurile'); return
    }
    setConnecting(true); setError('')
    try {
      const res = await fetch('/api/stores/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Eroare la conectare'); return }
      setStoreConnected(true)
      setTimeout(goNext, 800)
    } catch { setError('Eroare de conexiune') }
    finally { setConnecting(false) }
  }

  const handleSyncProducts = async () => {
    setSyncing(true); setError(''); setSyncedCount(0); setSyncTotal(0); setSyncEstimate('')
    let done = false
    try {
      const storesRes = await fetch('/api/stores')
      const storesData = await storesRes.json()
      if (!storesData.store) { setError('Niciun magazin conectat'); setSyncing(false); return }
      const storeId = storesData.store.id

      fetch(`/api/stores/${storeId}/sync`, { method: 'POST' }).then(async (res) => {
        if (res.ok && !done) {
          done = true; const data = await res.json()
          setSyncedCount(data.synced || 0); setSyncTotal(data.total || 0)
          setProductsSynced(true); setSyncing(false)
          setTimeout(goNext, 1200)
        }
      }).catch(() => {})

      let seenSyncing = false; let phaseStart = Date.now(); let lastPhase = ''
      const poll = setInterval(async () => {
        if (done) { clearInterval(poll); return }
        try {
          const r = await fetch('/api/stores'); const d = await r.json(); const s = d.store
          if (!s) return
          const progress = s.sync_progress || 0; const total = s.sync_total || 0
          if (s.sync_status === 'syncing' || s.sync_status === 'saving') seenSyncing = true
          if (s.sync_status !== lastPhase) { phaseStart = Date.now(); lastPhase = s.sync_status }
          if (seenSyncing && (s.sync_status === 'syncing' || s.sync_status === 'saving')) {
            if (total > 0) setSyncTotal(total)
            if (progress > 0) setSyncedCount(progress)
            if (progress > 0 && total > 0 && progress < total) {
              const elapsed = (Date.now() - phaseStart) / 1000; const rate = progress / elapsed
              const remaining = total - progress; const est = Math.ceil(remaining / rate)
              const label = s.sync_status === 'syncing' ? 'Descărcare' : 'Salvare'
              setSyncEstimate(est > 60 ? `${label}: ~${Math.ceil(est / 60)} min` : est > 5 ? `${label}: ~${est}s` : `${label}: se finalizează...`)
            }
          }
          if (seenSyncing && s.sync_status === 'active' && !done) {
            done = true; clearInterval(poll)
            setSyncedCount(s.products_count || total); setSyncTotal(s.products_count || total)
            setSyncEstimate(''); setProductsSynced(true); setSyncing(false)
            setTimeout(goNext, 1200)
          }
        } catch {}
      }, 3000)
    } catch { setError('Eroare la sincronizare'); setSyncing(false) }
  }

  const handleComplete = async () => {
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: biz.businessName, website: biz.website, niche: biz.niche,
          language: biz.language, country: biz.country, selectedPlan, gdprConsent,
        }),
      })
    } catch { /* non-blocking */ }
    router.push('/dashboard')
  }

  const progress = step / (steps.length - 1) * 100

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-white to-blue-50/30 flex flex-col">
      {/* ===== TOP NAV ===== */}
      <nav className="h-14 flex items-center justify-between px-5 lg:px-10 border-b border-gray-100/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-gray-900">Hontrio</span>
        </div>

        {/* Stepper — desktop */}
        {step > 0 && step < steps.length - 1 && (
          <div className="hidden sm:flex items-center gap-1">
            {steps.slice(1, -1).map((s, i) => {
              const idx = i + 1
              const isDone = step > idx
              const isActive = step === idx
              return (
                <div key={s.id} className="flex items-center">
                  {i > 0 && <div className={`w-8 h-px mx-1 ${isDone ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                  <div className="flex items-center gap-1.5">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${isDone ? 'bg-blue-600 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {isDone ? <CheckCircle className="h-3 w-3" /> : idx}
                    </div>
                    <span className={`text-xs ${isActive ? 'text-gray-900 font-semibold' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {step > 0 && step < steps.length - 1 && (
          <button onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Omite configurarea
          </button>
        )}
        {step === 0 && <div />}
        {step === steps.length - 1 && <div />}
      </nav>

      {/* Progress line */}
      {step > 0 && step < steps.length - 1 && (
        <div className="h-0.5 bg-gray-100">
          <motion.div className="h-full bg-blue-600" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      {/* ===== CONTENT ===== */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ===== STEP 0: WELCOME ===== */}
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                className="text-center">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }} className="mb-8">
                  <div className="h-20 w-20 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto">
                    <Layers className="h-10 w-10 text-blue-600" />
                  </div>
                </motion.div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                  Bine ai venit,
                </h1>
                <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 mb-4">
                  {userLastName || userName}.
                </h1>
                <p className="text-gray-500 text-lg mb-2">
                  Hai să îți configurăm platforma în câteva minute.
                </p>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-10">
                  Vei parcurge 4 pași simpli: configurarea brandului, conectarea magazinului, sincronizarea produselor și alegerea planului potrivit.
                </p>
                <Button onClick={goNext} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 text-base">
                  Hai să începem <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <p className="text-xs text-gray-400 mt-3">• Durează aproximativ 3 minute</p>
              </motion.div>
            )}

            {/* ===== STEP 1: BUSINESS ===== */}
            {step === 1 && (
              <motion.div key="business" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-8">
                  <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <Home className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Spune-ne despre afacerea ta</h2>
                  <p className="text-gray-500 mt-1">Aceste informații ajută AI-ul să genereze conținut perfect adaptat magazinului tău.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Numele magazinului</Label>
                      <Input value={biz.businessName} onChange={e => setBiz(p => ({ ...p, businessName: e.target.value }))}
                        placeholder="Ex: Magazinul Meu" className="h-11 rounded-xl border-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Website</Label>
                      <Input value={biz.website} onChange={e => setBiz(p => ({ ...p, website: e.target.value }))}
                        placeholder="https://magazinul-meu.ro" className="h-11 rounded-xl border-gray-200" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Nișa / Industrie</Label>
                    <Input value={biz.niche} onChange={e => setBiz(p => ({ ...p, niche: e.target.value }))}
                      placeholder="Ex: Fashion, Electronice, Beauty, Food..." className="h-11 rounded-xl border-gray-200" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Țara</Label>
                      <select value={biz.country} onChange={e => setBiz(p => ({ ...p, country: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700">
                        <option value="">Selectează țara</option>
                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Limba principală</Label>
                      <select value={biz.language} onChange={e => setBiz(p => ({ ...p, language: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700">
                        <option value="">Selectează limba</option>
                        {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <p className="text-center text-[11px] text-gray-400 mt-3 sm:hidden">
                  Prin continuare, ești de acord cu{' '}
                  <a href="/privacy" target="_blank" className="underline hover:text-gray-600">politica de confidențialitate</a>
                </p>
              </motion.div>
            )}

            {/* ===== STEP 2: CONNECT STORE ===== */}
            {step === 2 && (
              <motion.div key="connect" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <ExternalLink className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Conectează magazinul</h2>
                  <p className="text-gray-500 mt-1">Vom importa produsele automat din WooCommerce.</p>
                </div>

                {storeConnected ? (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Magazin conectat!</h3>
                    <p className="text-gray-500 text-sm">Trecem la sincronizarea produselor...</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Tutorial banner */}
                    <button onClick={() => setShowTutorial(!showTutorial)}
                      className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left transition-all hover:bg-blue-100/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                          <Play className="h-4 w-4 text-blue-600 ml-0.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900">Nu știi cum să obții cheile API?</p>
                          <p className="text-xs text-blue-600">Click aici pentru tutorialul pas cu pas</p>
                        </div>
                        <ChevronRight className={`h-5 w-5 text-blue-400 transition-transform ${showTutorial ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Tutorial expandable */}
                    <AnimatePresence>
                      {showTutorial && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-2">
                            {tutorialSteps.map(item => (
                              <button key={item.step} onClick={() => setExpandedTutStep(expandedTutStep === item.step ? null : item.step)}
                                className="w-full text-left">
                                <div className={`p-3 rounded-xl border transition-all ${expandedTutStep === item.step ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${expandedTutStep === item.step ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                      {item.step}
                                    </div>
                                    <span className={`text-sm font-medium ${expandedTutStep === item.step ? 'text-blue-900' : 'text-gray-700'}`}>{item.title}</span>
                                  </div>
                                  <AnimatePresence>
                                    {expandedTutStep === item.step && (
                                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                        <p className="text-sm text-gray-600 mt-2 ml-10 leading-relaxed">{item.description}</p>
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
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Connection form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">URL Magazin</Label>
                        <Input value={store.store_url} onChange={e => setStore(p => ({ ...p, store_url: e.target.value }))}
                          placeholder="https://magazinul-tau.ro" className="h-11 rounded-xl border-gray-200" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-gray-600">Consumer Key</Label>
                          <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            {showKeys ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showKeys ? 'Ascunde' : 'Arată'}
                          </button>
                        </div>
                        <Input type={showKeys ? 'text' : 'password'} value={store.consumer_key}
                          onChange={e => setStore(p => ({ ...p, consumer_key: e.target.value }))}
                          placeholder="ck_xxxxxxxxxxxxxxxx" className="h-11 rounded-xl border-gray-200 font-mono text-sm" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-gray-600">Consumer Secret</Label>
                          <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            {showKeys ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showKeys ? 'Ascunde' : 'Arată'}
                          </button>
                        </div>
                        <Input type={showKeys ? 'text' : 'password'} value={store.consumer_secret}
                          onChange={e => setStore(p => ({ ...p, consumer_secret: e.target.value }))}
                          placeholder="cs_xxxxxxxxxxxxxxxx" className="h-11 rounded-xl border-gray-200 font-mono text-sm" />
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm text-red-600">{error}</span>
                        </div>
                      )}

                      <Button onClick={handleConnectStore} disabled={connecting} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-11">
                        {connecting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</>
                          : <><ExternalLink className="h-4 w-4 mr-2" />Conectează magazinul</>}
                      </Button>
                    </div>

                    {/* Help card */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                      <div className="flex -space-x-2 shrink-0">
                        {['M', 'A', 'R'].map((l, i) => (
                          <div key={l} className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white
                            ${i === 0 ? 'bg-purple-500' : i === 1 ? 'bg-amber-500' : 'bg-red-500'}`}>{l}</div>
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Ai nevoie de ajutor cu configurarea?</p>
                        <p className="text-xs text-gray-500">Echipa noastră te ajută gratuit să conectezi magazinul — în mai puțin de 24h.</p>
                      </div>
                      <Link href="/support">
                        <button className="shrink-0 flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors">
                          <Store className="h-3.5 w-3.5" />Contactează-ne
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== STEP 3: SYNC ===== */}
            {step === 3 && (
              <motion.div key="sync" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-8">
                  <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Sincronizează produsele</h2>
                  <p className="text-gray-500 mt-1">Importăm produsele din magazinul tău WooCommerce</p>
                </div>

                {productsSynced ? (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-sm border border-green-200 p-8 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{syncedCount} produse sincronizate!</h3>
                    <p className="text-gray-500 text-sm">Mai avem un singur pas...</p>
                  </motion.div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                    {syncing ? (
                      <div>
                        <div className="relative mx-auto mb-6 w-20 h-20">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0">
                            <RefreshCw className="h-20 w-20 text-blue-200" />
                          </motion.div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-8 w-8 text-blue-600" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Se sincronizează...</h3>
                        <p className="text-gray-500 text-sm mb-4">
                          {syncTotal > 0 ? `${syncedCount} din ${syncTotal} produse importate` : 'Se conectează la magazin...'}
                        </p>
                        {syncTotal > 0 && (
                          <div className="max-w-xs mx-auto mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-blue-600">{Math.round((syncedCount / syncTotal) * 100)}%</span>
                              <span className="text-xs text-gray-400">{syncEstimate}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-blue-600 rounded-full"
                                initial={{ width: '0%' }} animate={{ width: `${Math.min((syncedCount / syncTotal) * 100, 100)}%` }}
                                transition={{ duration: 0.5 }} />
                            </div>
                          </div>
                        )}
                        {syncTotal === 0 && (
                          <div className="flex items-center justify-center gap-1 mt-4">
                            {[0, 1, 2].map(i => (
                              <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                                className="h-2 w-2 rounded-full bg-blue-500" />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                          <RefreshCw className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Gata de sincronizare</h3>
                        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                          Vom importa toate produsele din magazinul tău WooCommerce.
                        </p>
                        {error && (
                          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-4 text-left">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="text-sm text-red-600">{error}</span>
                          </div>
                        )}
                        <Button onClick={handleSyncProducts} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6">
                          <RefreshCw className="h-4 w-4 mr-2" />Sincronizează acum
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== STEP 4: PLAN ===== */}
            {step === 4 && (
              <motion.div key="plan" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Alege planul potrivit</h2>
                  <p className="text-gray-500 mt-1">
                    Poți începe gratuit și face upgrade oricând. <span className="text-blue-600 font-medium">Fără card bancar.</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {plans.map(plan => (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                        selectedPlan === plan.id
                          ? 'border-blue-500 bg-white shadow-md shadow-blue-100/50'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}>
                      {plan.recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <Zap className="h-3 w-3" />Cel mai popular
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{plan.icon}</span>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === plan.id ? 'border-blue-600 bg-blue-600' : 'border-gray-200'}`}>
                          {selectedPlan === plan.id && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                      <div className="flex items-baseline gap-1 mt-1 mb-3">
                        {plan.price !== null ? (
                          <><span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                          <span className="text-xs text-gray-400">{plan.unit}</span></>
                        ) : (
                          <span className="text-lg font-bold text-gray-900">{plan.unit}</span>
                        )}
                      </div>
                      <div className="border-t border-gray-100 pt-3 space-y-2">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="text-xs text-gray-600">{f}</span>
                          </div>
                        ))}
                      </div>
                      {plan.note && (
                        <p className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-50">{plan.note}</p>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ===== STEP 5: COMPLETE ===== */}
            {step === 5 && (
              <motion.div key="complete" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}
                className="text-center">
                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }} className="mb-8">
                  <div className="h-20 w-20 rounded-3xl bg-green-500 flex items-center justify-center mx-auto shadow-lg shadow-green-200/50">
                    <PartyPopper className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Totul e pregătit!</h2>
                  <p className="text-gray-500 text-lg max-w-md mx-auto mb-8">
                    Contul tău HONTRIO este configurat și gata de utilizare.
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-md mx-auto mb-8 text-left">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Rezumat configurare</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Cont creat', done: true, badge: 'Activ' },
                      { label: 'Magazin conectat', done: storeConnected, badge: storeConnected ? 'Conectat' : 'Sari peste' },
                      { label: 'Produse sincronizate', done: productsSynced, badge: productsSynced ? `${syncedCount} produse` : 'Sari peste' },
                      { label: 'Plan selectat', done: true, badge: plans.find(p => p.id === selectedPlan)?.name || 'Free' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.done ? <CheckCircle className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border-2 border-gray-200" />}
                          <span className="text-sm text-gray-700">{item.label}</span>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.done ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  <Button onClick={handleComplete}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 text-base shadow-lg shadow-blue-200/50">
                    Mergi la Dashboard <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== BOTTOM NAV ===== */}
      {step > 0 && step < steps.length - 1 && (
        <div className="h-16 flex items-center justify-between px-5 lg:px-10 border-t border-gray-100/50">
          <button onClick={goBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />Înapoi
          </button>

          <div className="flex items-center gap-3">
            {/* GDPR notice on step 1 */}
            {step === 1 && (
              <span className="hidden sm:inline text-[11px] text-gray-400 mr-2">
                Prin continuare, ești de acord cu{' '}
                <a href="/privacy" target="_blank" className="underline hover:text-gray-600">politica de confidențialitate</a>
              </span>
            )}

            {/* Skip button for steps 2 and 3 */}
            {(step === 2 || step === 3) && !syncing && (
              <button onClick={goNext} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mr-2">
                Sari peste <ChevronRight className="h-3 w-3" />
              </button>
            )}
            {step === 3 && syncing && (
              <button onClick={() => { setSyncing(false); goNext() }}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mr-2">
                Continuă fără să aștepți <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {/* Main CTA */}
            {step === 1 && (
              <Button onClick={handleSaveBusiness} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                Continuă <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 4 && (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs text-gray-400">• Poți schimba planul oricând</span>
                <Button onClick={goNext} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                  {selectedPlan === 'free' ? 'Continuă gratuit' : `Alege ${plans.find(p => p.id === selectedPlan)?.name}`}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}