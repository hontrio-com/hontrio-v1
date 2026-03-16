'use client'

import { useState, useEffect } from 'react'
import { useT, useLocale } from '@/lib/i18n/context'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, ArrowLeft, Store, Package, Loader2,
  CheckCircle, Eye, EyeOff, Zap, Crown,
  RefreshCw, AlertCircle, ChevronRight,
  Play, Info, ExternalLink, Building2, Globe,
  Lock, KeyRound, Sparkles, Check,
} from 'lucide-react'

const STEPS_RO = ['Bun venit', 'Afacerea ta', 'Magazin', 'Produse', 'Plan', 'Gata']
const STEPS_EN = ['Welcome', 'Your Business', 'Store', 'Products', 'Plan', 'Done']

const PLANS = [
  { id: 'free', name: 'Free Trial', price: 0, unit: 'RON', features: ['20 credite gratuite', '1 magazin conectat', 'Toate functiile AI'], recommended: false },
  { id: 'starter', name: 'Starter', price: 49, unit: 'RON/luna', features: ['200 credite/luna', 'Suport prioritar', 'Analiza SEO completa'], recommended: false },
  { id: 'professional', name: 'Professional', price: 99, unit: 'RON/luna', features: ['500 credite/luna', '3 magazine conectate', 'Generare in masa', 'Suport prioritar'], recommended: true },
  { id: 'enterprise', name: 'Enterprise', price: 249, unit: 'RON/luna', features: ['2000+ credite/luna', 'Magazine nelimitate', 'Manager dedicat'], recommended: false },
]

const COUNTRIES = [
  { value: 'RO', label: 'Romania' }, { value: 'MD', label: 'Moldova' },
  { value: 'BG', label: 'Bulgaria' }, { value: 'HU', label: 'Ungaria / Hungary' },
  { value: 'DE', label: 'Germania / Germany' }, { value: 'FR', label: 'Franta / France' },
  { value: 'IT', label: 'Italia / Italy' }, { value: 'ES', label: 'Spania / Spain' },
  { value: 'AT', label: 'Austria' }, { value: 'NL', label: 'Olanda / Netherlands' },
  { value: 'GB', label: 'Marea Britanie / UK' }, { value: 'US', label: 'SUA / USA' },
  { value: 'OTHER', label: 'Alta tara / Other' },
]
const LANGUAGES = [{ value: 'ro', label: 'Romana' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }, { value: 'fr', label: 'Francais' }, { value: 'hu', label: 'Magyar' }]

const TUTORIAL = [
  { step: 1, title: 'Acceseaza panoul WordPress', desc: 'Conecteaza-te la panoul de administrare WordPress. De obicei: magazinul-tau.ro/wp-admin', tip: 'Asigura-te ca ai drepturi de administrator.' },
  { step: 2, title: 'WooCommerce > Settings', desc: 'In meniul din stanga WordPress, click pe WooCommerce, apoi pe Settings.' },
  { step: 3, title: 'Advanced > REST API', desc: 'In pagina Settings, click pe tab-ul Advanced, apoi pe REST API.' },
  { step: 4, title: 'Creeaza o cheie noua', desc: 'Click pe Add Key. Description: "HONTRIO", Permissions: Read/Write.', tip: 'Este important sa selectezi Read/Write.' },
  { step: 5, title: 'Copiaza cheile generate', desc: 'Vei primi Consumer Key (ck_...) si Consumer Secret (cs_...). Copiaza-le mai jos.', tip: 'Secret-ul nu va mai fi afisat dupa ce inchizi pagina.' },
]

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0 }),
}

function LiquidBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div className="absolute rounded-full" style={{ width: '55vw', height: '55vw', maxWidth: 700, maxHeight: 700, left: '-8%', top: '-12%', background: 'radial-gradient(circle, rgba(0,0,0,0.045) 0%, rgba(0,0,0,0.02) 40%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ x: [0, 60, -30, 40, 0], y: [0, -40, 50, -20, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', maxWidth: 650, maxHeight: 650, right: '-10%', bottom: '-8%', background: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.015) 45%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ x: [0, -50, 35, -25, 0], y: [0, 45, -35, 20, 0] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500, left: '30%', top: '40%', background: 'radial-gradient(circle, rgba(0,0,0,0.035) 0%, rgba(0,0,0,0.01) 50%, transparent 70%)', filter: 'blur(90px)' }}
        animate={{ x: [0, 40, -50, 20, 0], y: [0, -35, 30, -15, 0], scale: [1, 1.08, 0.95, 1.03, 1] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text', mono = false, icon: Icon, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; mono?: boolean; icon?: any; autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className={`relative rounded-xl border transition-all duration-200 ${focused ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`}>
        {Icon && <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused ? 'text-neutral-900' : 'text-neutral-300'}`} />}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} autoComplete={autoComplete}
          className={`w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none ${mono ? 'font-mono text-[13px]' : ''}`} />
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-[46px] rounded-xl border border-neutral-200 hover:border-neutral-300 bg-transparent px-4 text-[14px] text-neutral-900 outline-none transition-all focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/5 appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useT()
  const { locale } = useLocale()
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
  const [expandedTut, setExpandedTut] = useState<number | null>(null)

  const [biz, setBiz] = useState({ businessName: '', website: '', niche: '', country: '', language: 'ro' })
  const [store, setStore] = useState({ store_url: '', consumer_key: '', consumer_secret: '' })

  const userName = session?.user?.name?.split(' ')[0] || 'Utilizator'

  useEffect(() => { if ((session?.user as any)?.onboardingCompleted) router.push('/dashboard') }, [session, router])

  const goNext = () => { setDir(1); setStep(s => Math.min(s + 1, STEPS_RO.length - 1)); setError('') }
  const goBack = () => { setDir(-1); setStep(s => Math.max(s - 1, 0)); setError('') }

  const handleSaveBusiness = async () => {
    try {
      await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: biz.businessName, website: biz.website, niche: biz.niche, brand_language: biz.language, preferences: { country: biz.country } }) })
    } catch {}
    goNext()
  }

  const handleConnectStore = async () => {
    if (!store.store_url || !store.consumer_key || !store.consumer_secret) { setError('Completeaza toate campurile'); return }
    setConnecting(true); setError('')
    try {
      const res = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(store) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t('onboarding.error_connect')); return }
      setStoreConnected(true); setTimeout(goNext, 800)
    } catch { setError(t('common.error_connection')) } finally { setConnecting(false) }
  }

  const handleSyncProducts = async () => {
    setSyncing(true); setError(''); setSyncedCount(0); setSyncTotal(0); setSyncEstimate('')
    let done = false
    try {
      const storesRes = await fetch('/api/stores'); const storesData = await storesRes.json()
      if (!storesData.store) { setError(t('onboarding.no_store_connected')); setSyncing(false); return }
      const storeId = storesData.store.id
      fetch(`/api/stores/${storeId}/sync`, { method: 'POST' }).then(async (res) => {
        if (res.ok && !done) { done = true; const data = await res.json(); setSyncedCount(data.synced || 0); setSyncTotal(data.total || 0); setProductsSynced(true); setSyncing(false); setTimeout(goNext, 1200) }
      }).catch(() => {})
      let seenSyncing = false; let phaseStart = Date.now(); let lastPhase = ''
      const poll = setInterval(async () => {
        if (done) { clearInterval(poll); return }
        try {
          const r = await fetch('/api/stores'); const d = await r.json(); const s = d.store; if (!s) return
          const progress = s.sync_progress || 0; const total = s.sync_total || 0
          if (s.sync_status === 'syncing' || s.sync_status === 'saving') seenSyncing = true
          if (s.sync_status !== lastPhase) { phaseStart = Date.now(); lastPhase = s.sync_status }
          if (seenSyncing && (s.sync_status === 'syncing' || s.sync_status === 'saving')) {
            if (total > 0) setSyncTotal(total); if (progress > 0) setSyncedCount(progress)
            if (progress > 0 && total > 0 && progress < total) {
              const elapsed = (Date.now() - phaseStart) / 1000; const rate = progress / elapsed; const remaining = total - progress; const est = Math.ceil(remaining / rate)
              const label = s.sync_status === 'syncing' ? 'Descarcare' : 'Salvare'
              setSyncEstimate(est > 60 ? `${label}: ~${Math.ceil(est / 60)} min` : est > 5 ? `${label}: ~${est}s` : `${label}: se finalizeaza...`)
            }
          }
          if (seenSyncing && s.sync_status === 'active' && !done) {
            done = true; clearInterval(poll); setSyncedCount(s.products_count || total); setSyncTotal(s.products_count || total)
            setSyncEstimate(''); setProductsSynced(true); setSyncing(false); setTimeout(goNext, 1200)
          }
        } catch {}
      }, 3000)
    } catch { setError(t('onboarding.error_sync')); setSyncing(false) }
  }

  const handleComplete = async () => {
    try { await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName: biz.businessName, website: biz.website, niche: biz.niche, language: biz.language, country: biz.country, selectedPlan, gdprConsent: true }) }) } catch {}
    window.location.href = '/dashboard'
  }

  const handleSkip = async () => {
    try { await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedPlan: 'free', gdprConsent: true }) }) } catch {}
    window.location.href = '/dashboard'
  }

  const progress = step / (STEPS_RO.length - 1) * 100
  const isMiddle = step > 0 && step < STEPS_RO.length - 1

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col relative">
      <LiquidBg />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 h-14 flex items-center justify-between px-5 lg:px-10 border-b border-neutral-100">
        <img src="/logo-black.png" alt="Hontrio" style={{ height: 24, width: 'auto' }} />

        {isMiddle && (
          <div className="hidden sm:flex items-center gap-1">
            {(locale === 'en' ? STEPS_EN : STEPS_RO).slice(1, -1).map((s, i) => {
              const idx = i + 1; const isDone = step > idx; const isActive = step === idx
              return (
                <div key={s} className="flex items-center">
                  {i > 0 && <div className={`w-6 h-px mx-1 ${isDone ? 'bg-neutral-900' : 'bg-neutral-200'}`} />}
                  <div className="flex items-center gap-1.5">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold
                      ${isDone ? 'bg-neutral-900 text-white' : isActive ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                      {isDone ? <Check className="h-3 w-3" /> : idx}
                    </div>
                    <span className={`text-[12px] ${isActive ? 'text-neutral-900 font-medium' : isDone ? 'text-neutral-500' : 'text-neutral-300'}`}>{s}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isMiddle ? (
          <button onClick={handleSkip} className="text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors">Omite</button>
        ) : <div className="w-10" />}
      </nav>

      {/* Progress */}
      {isMiddle && (
        <div className="relative z-10 h-[2px] bg-neutral-100">
          <motion.div className="h-full bg-neutral-900" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative z-10 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[520px]">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ WELCOME ═══ */}
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="text-center">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8">
                  <div className="h-20 w-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto">
                    <Sparkles className="h-9 w-9 text-neutral-700" />
                  </div>
                </motion.div>
                <h1 className="text-[32px] font-semibold text-neutral-900 tracking-tight leading-tight">
                  Bine ai venit, {userName}.
                </h1>
                <p className="text-neutral-400 text-[15px] mt-3 mb-2 font-light">{t('onboarding.setup_minutes')}</p>
                <p className="text-neutral-300 text-[13px] max-w-sm mx-auto mb-10">
                  4 pasi simpli: brandul tau, conectarea magazinului, sincronizarea produselor si alegerea planului.
                </p>
                <motion.div whileTap={{ scale: 0.985 }}>
                  <button onClick={goNext} className="h-[48px] px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
                    Hai sa incepem <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
                <p className="text-[12px] text-neutral-300 mt-4">Dureaza aproximativ 3 minute</p>
              </motion.div>
            )}

            {/* ═══ BUSINESS ═══ */}
            {step === 1 && (
              <motion.div key="business" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-6 w-6 text-neutral-700" />
                  </div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">Spune-ne despre afacerea ta</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 font-light">AI-ul va genera continut adaptat magazinului tau</p>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <InputField label="Numele magazinului" value={biz.businessName} onChange={v => setBiz(p => ({ ...p, businessName: v }))} placeholder="Ex: Magazinul Meu" icon={Store} />
                    <InputField label="Website" value={biz.website} onChange={v => setBiz(p => ({ ...p, website: v }))} placeholder="https://magazinul-meu.ro" icon={Globe} />
                  </div>
                  <InputField label="Nisa / Industrie" value={biz.niche} onChange={v => setBiz(p => ({ ...p, niche: v }))} placeholder="Ex: Fashion, Electronice, Beauty, Food..." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <SelectField label="Tara" value={biz.country} onChange={v => setBiz(p => ({ ...p, country: v }))} options={COUNTRIES} placeholder={t('onboarding.select_country')} />
                    <SelectField label={t('onboarding.main_language')} value={biz.language} onChange={v => setBiz(p => ({ ...p, language: v }))} options={LANGUAGES} placeholder={t('onboarding.select_language')} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ CONNECT STORE ═══ */}
            {step === 2 && (
              <motion.div key="connect" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <ExternalLink className="h-6 w-6 text-neutral-700" />
                  </div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">{t('onboarding.connect_store')}</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 font-light">Vom importa produsele automat din WooCommerce</p>
                </div>

                {storeConnected ? (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="border border-neutral-200 rounded-2xl p-8 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-7 w-7 text-neutral-700" />
                    </div>
                    <h3 className="text-[16px] font-semibold text-neutral-900 mb-1">{t('onboarding.store_connected_label')}</h3>
                    <p className="text-neutral-400 text-[13px]">Trecem la sincronizarea produselor...</p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Tutorial toggle */}
                    <button onClick={() => setShowTutorial(!showTutorial)}
                      className="w-full border border-neutral-200 rounded-xl p-4 text-left transition-all hover:border-neutral-300">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                          <Play className="h-4 w-4 text-neutral-600 ml-0.5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-neutral-900">Nu stii cum sa obtii cheile API?</p>
                          <p className="text-[12px] text-neutral-400">Tutorial pas cu pas</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-neutral-300 transition-transform ${showTutorial ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {showTutorial && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="border border-neutral-200 rounded-xl p-4 space-y-1.5">
                            {TUTORIAL.map(item => (
                              <button key={item.step} onClick={() => setExpandedTut(expandedTut === item.step ? null : item.step)} className="w-full text-left">
                                <div className={`p-3 rounded-lg border transition-all ${expandedTut === item.step ? 'border-neutral-300 bg-neutral-50' : 'border-transparent hover:bg-neutral-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0 ${expandedTut === item.step ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{item.step}</div>
                                    <span className="text-[13px] font-medium text-neutral-700">{item.title}</span>
                                  </div>
                                  <AnimatePresence>
                                    {expandedTut === item.step && (
                                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                        <p className="text-[13px] text-neutral-500 mt-2 ml-9 leading-relaxed">{item.desc}</p>
                                        {item.tip && (
                                          <div className="mt-2 ml-9 flex items-start gap-2 p-2.5 bg-neutral-100 rounded-lg">
                                            <Info className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                                            <span className="text-[12px] text-neutral-500">{item.tip}</span>
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

                    {/* Form */}
                    <div className="space-y-3.5">
                      <InputField label="URL Magazin" value={store.store_url} onChange={v => setStore(p => ({ ...p, store_url: v }))} placeholder="https://magazinul-tau.ro" icon={Globe} />
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-wide">Consumer Key</label>
                          <button onClick={() => setShowKeys(!showKeys)} className="text-[11px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors">
                            {showKeys ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{showKeys ? 'Ascunde' : 'Arata'}
                          </button>
                        </div>
                        <InputField label="" value={store.consumer_key} onChange={v => setStore(p => ({ ...p, consumer_key: v }))} placeholder="ck_xxxxxxxxxxxxxxxx" type={showKeys ? 'text' : 'password'} mono icon={KeyRound} />
                      </div>
                      <InputField label="Consumer Secret" value={store.consumer_secret} onChange={v => setStore(p => ({ ...p, consumer_secret: v }))} placeholder="cs_xxxxxxxxxxxxxxxx" type={showKeys ? 'text' : 'password'} mono icon={Lock} />

                      {error && (
                        <div className="flex items-center gap-2 p-3 border border-red-200 rounded-xl bg-red-50/50">
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" /><span className="text-[13px] text-red-500">{error}</span>
                        </div>
                      )}

                      <motion.div whileTap={{ scale: 0.985 }}>
                        <button onClick={handleConnectStore} disabled={connecting}
                          className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
                          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" />{t('onboarding.connect_store')}</>}
                        </button>
                      </motion.div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ SYNC ═══ */}
            {step === 3 && (
              <motion.div key="sync" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-6 w-6 text-neutral-700" />
                  </div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">{t('onboarding.sync_products')}</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 font-light">Importam produsele din magazinul tau WooCommerce</p>
                </div>

                {productsSynced ? (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="border border-neutral-200 rounded-2xl p-8 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-7 w-7 text-neutral-700" />
                    </div>
                    <h3 className="text-[16px] font-semibold text-neutral-900 mb-1">{syncedCount} produse sincronizate</h3>
                    <p className="text-neutral-400 text-[13px]">Mai avem un singur pas...</p>
                  </motion.div>
                ) : (
                  <div className="border border-neutral-200 rounded-2xl p-8 text-center">
                    {syncing ? (
                      <div>
                        <div className="relative mx-auto mb-6 w-16 h-16">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0">
                            <RefreshCw className="h-16 w-16 text-neutral-200" />
                          </motion.div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-7 w-7 text-neutral-700" />
                          </div>
                        </div>
                        <h3 className="text-[16px] font-semibold text-neutral-900 mb-1">{t('onboarding.syncing')}</h3>
                        <p className="text-neutral-400 text-[13px] mb-4">{syncTotal > 0 ? `${syncedCount} din ${syncTotal} produse` : 'Se conecteaza la magazin...'}</p>
                        {syncTotal > 0 && (
                          <div className="max-w-xs mx-auto mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[12px] font-medium text-neutral-600">{Math.round((syncedCount / syncTotal) * 100)}%</span>
                              <span className="text-[12px] text-neutral-400">{syncEstimate}</span>
                            </div>
                            <div className="h-[6px] bg-neutral-100 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-neutral-900 rounded-full" initial={{ width: '0%' }} animate={{ width: `${Math.min((syncedCount / syncTotal) * 100, 100)}%` }} transition={{ duration: 0.5 }} />
                            </div>
                          </div>
                        )}
                        {syncTotal === 0 && (
                          <div className="flex items-center justify-center gap-1.5 mt-4">
                            {[0, 1, 2].map(i => (<motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} className="h-1.5 w-1.5 rounded-full bg-neutral-400" />))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="h-14 w-14 rounded-2xl bg-neutral-50 flex items-center justify-center mx-auto mb-4">
                          <RefreshCw className="h-6 w-6 text-neutral-500" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-neutral-900 mb-1">Gata de sincronizare</h3>
                        <p className="text-neutral-400 text-[13px] mb-6 max-w-sm mx-auto">Vom importa toate produsele din magazinul tau WooCommerce.</p>
                        {error && (
                          <div className="flex items-center justify-center gap-2 p-3 border border-red-200 rounded-xl bg-red-50/50 mb-4 text-left">
                            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" /><span className="text-[13px] text-red-500">{error}</span>
                          </div>
                        )}
                        <motion.div whileTap={{ scale: 0.985 }}>
                          <button onClick={handleSyncProducts} className="h-[46px] px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
                            <RefreshCw className="h-4 w-4" />Sincronizeaza acum
                          </button>
                        </motion.div>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ PLAN ═══ */}
            {step === 4 && (
              <motion.div key="plan" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">Alege planul potrivit</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 font-light">Incepe gratuit, fara card bancar</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PLANS.map(plan => (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 rounded-xl border-2 text-left transition-all ${selectedPlan === plan.id ? 'border-neutral-900 bg-white' : 'border-neutral-100 bg-white hover:border-neutral-200'}`}>
                      {plan.recommended && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="bg-neutral-900 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">Recomandat</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] font-semibold text-neutral-900">{plan.name}</p>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200'}`}>
                          {selectedPlan === plan.id && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-[22px] font-bold text-neutral-900">{plan.price}</span>
                        <span className="text-[12px] text-neutral-400">{plan.unit}</span>
                      </div>
                      <div className="border-t border-neutral-100 pt-3 space-y-2">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                            <span className="text-[12px] text-neutral-500">{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ COMPLETE ═══ */}
            {step === 5 && (
              <motion.div key="complete" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="text-center">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }} className="mb-8">
                  <div className="h-20 w-20 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h2 className="text-[28px] font-semibold text-neutral-900 tracking-tight mb-2">Totul e pregatit</h2>
                  <p className="text-neutral-400 text-[15px] max-w-sm mx-auto mb-8 font-light">Contul tau Hontrio este configurat si gata de utilizare.</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="border border-neutral-200 rounded-xl p-5 max-w-sm mx-auto mb-8 text-left">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('onboarding.setup_summary')}</p>
                  <div className="space-y-3">
                    {[
                      { label: t('onboarding.account_created'), done: true, badge: 'Activ' },
                      { label: t('onboarding.store_connected_label'), done: storeConnected, badge: storeConnected ? 'Conectat' : 'Omis' },
                      { label: 'Produse sincronizate', done: productsSynced, badge: productsSynced ? `${syncedCount} produse` : 'Omis' },
                      { label: 'Plan selectat', done: true, badge: PLANS.find(p => p.id === selectedPlan)?.name || 'Free' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.done ? <CheckCircle className="h-4 w-4 text-neutral-700" /> : <div className="h-4 w-4 rounded-full border-2 border-neutral-200" />}
                          <span className="text-[13px] text-neutral-600">{item.label}</span>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${item.done ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-50 text-neutral-400'}`}>{item.badge}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} whileTap={{ scale: 0.985 }}>
                  <button onClick={handleComplete}
                    className="h-[48px] px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
                    Mergi la Dashboard <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────────── */}
      {isMiddle && (
        <div className="relative z-10 h-16 flex items-center justify-between px-5 lg:px-10 border-t border-neutral-100">
          <button onClick={goBack} className="flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />Inapoi
          </button>

          <div className="flex items-center gap-3">
            {(step === 2 || step === 3) && !syncing && (
              <button onClick={goNext} className="text-[13px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors">
                Sari peste <ChevronRight className="h-3 w-3" />
              </button>
            )}
            {step === 3 && syncing && (
              <button onClick={() => { setSyncing(false); goNext() }} className="text-[13px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors">
                Continua fara sa astepti <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {step === 1 && (
              <motion.div whileTap={{ scale: 0.985 }}>
                <button onClick={handleSaveBusiness} className="h-[40px] px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
                  Continua <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
            {step === 4 && (
              <motion.div whileTap={{ scale: 0.985 }}>
                <button onClick={goNext} className="h-[40px] px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-all cursor-pointer">
                  {selectedPlan === 'free' ? 'Continua gratuit' : `Alege ${PLANS.find(p => p.id === selectedPlan)?.name}`} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}