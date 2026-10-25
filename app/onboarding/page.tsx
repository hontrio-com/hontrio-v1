'use client'

import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/language-switcher'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Store, Loader2, CheckCircle, Eye, EyeOff, Zap,
  AlertCircle, ChevronRight, Info, ExternalLink, Globe, Lock, KeyRound, Sparkles, Check, Megaphone,
} from 'lucide-react'

// =============================================
// Onboarding — magazinul și contul Google Ads, apoi Prezentarea generală
// arată ce mai trebuie pregătit pentru prima campanie. Conectările pornite de
// aici (Edinio, Shopify, Google) se întorc aici, cu rezultatul în adresă.
// =============================================

type Platform = 'edinio' | 'woocommerce' | 'shopify'
type StoreInfo = {
  id: string; platform: string; store_name: string | null; store_url: string
  sync_status: string | null; last_sync_at: string | null; products_count: number | null; orders_count: number | null
}
type GoogleState = { connected: boolean; email: string | null; accounts: number; storeAccount: string | null }
/** Mesajele se traduc la afișare (la încărcare, textele limbii pot să nu fie gata); al serverului vine gata. */
type Msg = { key: string; params?: Record<string, string> } | { text: string } | null

const STEPS = ['welcome', 'store', 'google', 'done'] as const
const EDINIO_ERRORS = ['access_denied', 'state', 'expired', 'store_read', 'save', 'rate_limited', 'not_configured']
const GOOGLE_ERRORS = ['access_denied', 'missing_scope', 'no_refresh_token', 'state', 'rate_limited', 'not_configured']
const TUTORIAL = [1, 2, 3, 4]

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
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text', mono = false, icon: Icon, name, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; mono?: boolean
  icon?: typeof Globe; name?: string; autoComplete?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      {label && <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{label}</label>}
      <div className={`relative rounded-xl border transition-all duration-200 ${focused ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`}>
        {Icon && <Icon className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused ? 'text-neutral-900' : 'text-neutral-300'}`} />}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} name={name} autoComplete={autoComplete} aria-label={label || placeholder}
          className={`w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none ${mono ? 'font-mono text-[13px]' : ''}`} />
      </div>
    </div>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 p-3 border border-red-200 rounded-xl bg-red-50/50">
      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-px" /><span className="text-[13px] text-red-500">{text}</span>
    </div>
  )
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { t, locale } = useT()
  const numberLocale = locale === 'en' ? 'en-GB' : 'ro-RO'
  const fmt = (n: number | null | undefined) => new Intl.NumberFormat(numberLocale).format(n ?? 0)

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(0)
  const [error, setError] = useState<Msg>(null)
  const [notice, setNotice] = useState<Msg>(null)
  const [platform, setPlatform] = useState<Platform>('edinio')
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [google, setGoogle] = useState<GoogleState>({ connected: false, email: null, accounts: 0, storeAccount: null })
  const [woo, setWoo] = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [showKeys, setShowKeys] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [shopifyUrl, setShopifyUrl] = useState('')
  const [busy, setBusy] = useState<'' | 'woo' | 'redirect' | 'finish'>('')

  const userName = session?.user?.name?.split(' ')[0] || ''
  const say = (m: Msg) => (!m ? '' : 'text' in m ? m.text : t(m.key, m.params))

  useEffect(() => { if ((session?.user as { onboardingCompleted?: boolean } | undefined)?.onboardingCompleted) router.push('/dashboard') }, [session, router])

  const loadStore = useCallback(async () => {
    try {
      const d = await (await fetch('/api/stores')).json()
      setStore(d.store ?? null)
      return (d.store ?? null) as StoreInfo | null
    } catch { return null }
  }, [])

  const loadGoogle = useCallback(async () => {
    try {
      const d = await (await fetch('/api/integrations/google')).json()
      const active = (d.stores ?? []).find((s: { id: string }) => s.id === d.active_store_id)
      const account = (d.accounts ?? []).find((a: { customer_id: string }) => a.customer_id === active?.google_ads_customer_id)
      setGoogle({
        connected: d.connection?.status === 'active',
        email: d.connection?.google_email ?? null,
        accounts: (d.accounts ?? []).filter((a: { is_manager: boolean }) => !a.is_manager).length,
        storeAccount: account ? (account.descriptive_name || account.customer_id) : null,
      })
    } catch {}
  }, [])

  // Întoarcerea din Edinio, Shopify sau Google: rezultatul vine în adresă
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const go = (s: number) => { setDir(1); setStep(s) }
    if (params.get('google') === 'connected') {
      const warning = params.get('google_warning')
      if (warning) setNotice(warning === 'discovery_failed' ? { key: 'google_ads.warning_discovery_failed' } : { key: 'google_ads.warning_generic', params: { code: warning } })
      go(3)
    } else if (params.get('google_error')) {
      const code = params.get('google_error')!
      setError({ key: `google_ads.error_${GOOGLE_ERRORS.includes(code) ? code : 'generic'}` })
      go(2)
    } else if (params.get('edinio') === 'connected' || params.get('shopify') === 'connected') {
      setNotice({ key: 'onboarding.store_linked' })
      go(2)
    } else if (params.get('edinio_error')) {
      const code = params.get('edinio_error')!
      setPlatform('edinio')
      setError({ key: `edinio.error_${EDINIO_ERRORS.includes(code) ? code : 'generic'}` })
      go(1)
    }
    if ([...params.keys()].length) window.history.replaceState(null, '', window.location.pathname)
    loadStore()
    loadGoogle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prima sincronizare rulează în fundal: arătăm cum avansează
  const syncing = !!store && (store.sync_status === 'syncing' || !store.last_sync_at)
  useEffect(() => {
    if (!syncing) return
    const id = setInterval(loadStore, 4000)
    return () => clearInterval(id)
  }, [syncing, loadStore])

  const goTo = (s: number) => { setDir(s > step ? 1 : -1); setStep(s); setError(null); setNotice(null) }

  async function connectWoo() {
    if (!woo.store_url || !woo.consumer_key || !woo.consumer_secret) { setError({ key: 'onboarding.fill_all' }); return }
    setBusy('woo'); setError(null)
    try {
      const res = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(woo) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ? { text: data.error } : { key: 'onboarding.error_connect' }); return }
      setWoo({ store_url: '', consumer_key: '', consumer_secret: '' })
      await loadStore()
    } catch { setError({ key: 'common.error_connection' }) } finally { setBusy('') }
  }

  function connectShopify() {
    const shop = shopifyUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) { setError({ key: 'onboarding.shopify_url_invalid' }); return }
    setBusy('redirect'); setError(null)
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}&redirect_onboarding=true`
  }

  function redirectTo(url: string) {
    setBusy('redirect')
    window.location.href = url
  }

  async function finish() {
    setBusy('finish')
    try {
      await fetch('/api/onboarding/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gdprConsent: true }) })
    } catch {}
    window.location.href = '/dashboard'
  }

  const storeLabel = store ? (store.store_name || store.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '')) : ''
  const isMiddle = step > 0 && step < STEPS.length - 1
  const progress = (step / (STEPS.length - 1)) * 100

  const syncLine = store && (
    <p className="text-[12px] text-neutral-500 leading-relaxed">
      {syncing
        ? <><Loader2 className="inline h-3 w-3 mr-1 animate-spin align-[-2px]" />{t('onboarding.sync_running', { offers: fmt(store.products_count), orders: fmt(store.orders_count) })}</>
        : t('onboarding.sync_done', { offers: fmt(store.products_count), orders: fmt(store.orders_count) })}
    </p>
  )

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col relative">
      <LiquidBg />

      {/* ── Bara de sus ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 h-14 flex items-center justify-between px-5 lg:px-10 border-b border-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt="Hontrio" style={{ height: 24, width: 'auto' }} />

        {isMiddle && (
          <div className="hidden sm:flex items-center gap-1">
            {STEPS.slice(1, -1).map((s, i) => {
              const idx = i + 1; const isDone = step > idx; const isActive = step === idx
              return (
                <div key={s} className="flex items-center">
                  {i > 0 && <div className={`w-6 h-px mx-1 ${isDone ? 'bg-neutral-900' : 'bg-neutral-200'}`} />}
                  <div className="flex items-center gap-1.5">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${isDone || isActive ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                      {isDone ? <Check className="h-3 w-3" /> : idx}
                    </div>
                    <span className={`text-[12px] ${isActive ? 'text-neutral-900 font-medium' : isDone ? 'text-neutral-500' : 'text-neutral-300'}`}>{t(`onboarding.steps_${s}`)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {isMiddle && (
            <button onClick={finish} disabled={!!busy} className="text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors">{t('onboarding.skip_all')}</button>
          )}
        </div>
      </nav>

      {isMiddle && (
        <div className="relative z-10 h-[2px] bg-neutral-100">
          <motion.div className="h-full bg-neutral-900" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      {/* ── Conținut ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative z-10 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[520px]">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ BUN VENIT ═══ */}
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-8">
                  <Sparkles className="h-9 w-9 text-neutral-700" />
                </div>
                <h1 className="text-[32px] font-semibold text-neutral-900 tracking-tight leading-tight">
                  {userName ? t('onboarding.welcome_title', { name: userName }) : t('onboarding.welcome')}
                </h1>
                <p className="text-neutral-500 text-[15px] mt-3 mb-2 max-w-md mx-auto leading-relaxed">{t('onboarding.welcome_desc')}</p>
                <p className="text-neutral-400 text-[13px] max-w-sm mx-auto mb-10">{t('onboarding.welcome_steps')}</p>
                <button onClick={() => goTo(1)} className="h-[48px] px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium inline-flex items-center gap-2 transition-all">
                  {t('onboarding.start')} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="text-[12px] text-neutral-300 mt-4">{t('onboarding.duration')}</p>
              </motion.div>
            )}

            {/* ═══ MAGAZIN ═══ */}
            {step === 1 && (
              <motion.div key="store" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4"><Store className="h-6 w-6 text-neutral-700" /></div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">{t('onboarding.store_title')}</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 leading-relaxed">{t('onboarding.store_desc')}</p>
                </div>

                {store ? (
                  <div className="border border-neutral-200 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle className="h-7 w-7 text-neutral-700 mx-auto" />
                    <h3 className="text-[16px] font-semibold text-neutral-900">{t('onboarding.store_done_title', { store: storeLabel })}</h3>
                    {syncLine}
                    {syncing && <p className="text-[12px] text-neutral-400">{t('onboarding.sync_wait_hint')}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      {([
                        { id: 'edinio', name: 'Edinio', sub: t('onboarding.edinio_subtitle'), color: '#111827' },
                        { id: 'woocommerce', name: 'WooCommerce', sub: t('onboarding.woo_subtitle'), color: '#7F54B3' },
                        { id: 'shopify', name: 'Shopify', sub: t('onboarding.shopify_subtitle'), color: '#5E8E3E' },
                      ] as { id: Platform; name: string; sub: string; color: string }[]).map(p => (
                        <button key={p.id} onClick={() => { setPlatform(p.id); setError(null) }}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all ${platform === p.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${p.color}14` }}>
                            <Store className="h-3.5 w-3.5" style={{ color: p.color }} />
                          </div>
                          <p className="text-[13px] font-semibold text-neutral-900">{p.name}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{p.sub}</p>
                        </button>
                      ))}
                    </div>

                    {platform === 'edinio' && (
                      <div className="space-y-3.5">
                        <p className="text-[13px] text-neutral-500 leading-relaxed p-4 bg-neutral-50 rounded-xl">{t('onboarding.edinio_desc')}</p>
                        {error && <ErrorBox text={say(error)} />}
                        <button onClick={() => redirectTo('/api/integrations/edinio/connect?from=onboarding')} disabled={!!busy}
                          className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                          {busy === 'redirect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ExternalLink className="h-4 w-4" />{t('onboarding.edinio_connect')}</>}
                        </button>
                      </div>
                    )}

                    {platform === 'woocommerce' && (
                      <div className="space-y-3.5">
                        <button onClick={() => setShowTutorial(s => !s)} className="w-full border border-neutral-200 rounded-xl p-3.5 text-left transition-all hover:border-neutral-300">
                          <div className="flex items-center gap-3">
                            <Info className="h-4 w-4 text-neutral-500 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[13px] font-medium text-neutral-900">{t('onboarding.woo_tutorial_title')}</p>
                              <p className="text-[12px] text-neutral-400">{t('onboarding.woo_tutorial_hint')}</p>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-neutral-300 transition-transform ${showTutorial ? 'rotate-90' : ''}`} />
                          </div>
                        </button>
                        {showTutorial && (
                          <ol className="border border-neutral-200 rounded-xl p-4 space-y-3">
                            {TUTORIAL.map(n => (
                              <li key={n} className="flex gap-3">
                                <span className="h-6 w-6 rounded-md bg-neutral-100 text-neutral-500 text-[11px] font-semibold flex items-center justify-center shrink-0">{n}</span>
                                <span className="text-[13px] text-neutral-600 leading-relaxed">
                                  <span className="block font-medium text-neutral-800">{t(`onboarding.woo_tut_${n}_title`)}</span>
                                  {t(`onboarding.woo_tut_${n}_desc`)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {/* Nu e un formular de autentificare: managerul de parole nu are ce completa aici */}
                        <InputField label={t('onboarding.store_url')} value={woo.store_url} onChange={v => setWoo(p => ({ ...p, store_url: v }))}
                          placeholder="https://magazinul-tau.ro" icon={Globe} name="woo_store_url" autoComplete="url" />
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-wide">{t('onboarding.api_key')}</label>
                            <button onClick={() => setShowKeys(s => !s)} className="text-[11px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1">
                              {showKeys ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{showKeys ? t('onboarding.hide_keys') : t('onboarding.show_keys')}
                            </button>
                          </div>
                          <InputField label="" value={woo.consumer_key} onChange={v => setWoo(p => ({ ...p, consumer_key: v }))} placeholder="ck_..."
                            type={showKeys ? 'text' : 'password'} mono icon={KeyRound} name="woo_consumer_key" autoComplete="new-password" />
                        </div>
                        <InputField label={t('onboarding.api_secret')} value={woo.consumer_secret} onChange={v => setWoo(p => ({ ...p, consumer_secret: v }))} placeholder="cs_..."
                          type={showKeys ? 'text' : 'password'} mono icon={Lock} name="woo_consumer_secret" autoComplete="new-password" />
                        {error && <ErrorBox text={say(error)} />}
                        <button onClick={connectWoo} disabled={!!busy}
                          className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                          {busy === 'woo' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('onboarding.connect_store')}
                        </button>
                      </div>
                    )}

                    {platform === 'shopify' && (
                      <div className="space-y-3.5">
                        <p className="text-[13px] text-neutral-500 leading-relaxed p-4 bg-neutral-50 rounded-xl">{t('onboarding.shopify_desc')}</p>
                        <InputField label={t('onboarding.shopify_url_label')} value={shopifyUrl} onChange={setShopifyUrl} placeholder="magazin.myshopify.com" icon={Globe} name="shopify_domain" autoComplete="url" />
                        {error && <ErrorBox text={say(error)} />}
                        <button onClick={connectShopify} disabled={!!busy}
                          className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                          {busy === 'redirect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" />{t('onboarding.shopify_connect')}</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ GOOGLE ADS ═══ */}
            {step === 2 && (
              <motion.div key="google" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className="text-center mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4"><Megaphone className="h-6 w-6 text-neutral-700" /></div>
                  <h2 className="text-[24px] font-semibold text-neutral-900 tracking-tight">{t('onboarding.google_title')}</h2>
                  <p className="text-neutral-400 text-[14px] mt-1 leading-relaxed">{t('onboarding.google_desc')}</p>
                </div>
                {notice && <p className="mb-4 flex items-start gap-2 text-[13px] text-neutral-700 p-3 bg-neutral-50 rounded-xl"><CheckCircle className="h-4 w-4 shrink-0 mt-px" />{say(notice)}</p>}

                {google.connected ? (
                  <div className="border border-neutral-200 rounded-2xl p-6 text-center space-y-2">
                    <CheckCircle className="h-7 w-7 text-neutral-700 mx-auto" />
                    <h3 className="text-[16px] font-semibold text-neutral-900">{t('onboarding.google_connected', { email: google.email ?? '' })}</h3>
                    <p className="text-[12px] text-neutral-500">
                      {google.storeAccount ? t('onboarding.google_store_account', { account: google.storeAccount, store: storeLabel })
                        : google.accounts ? t('onboarding.google_choose_later', { count: fmt(google.accounts) }) : t('google_ads.no_accounts')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {error && <ErrorBox text={say(error)} />}
                    <button onClick={() => redirectTo('/api/integrations/google/connect?from=onboarding')} disabled={!!busy}
                      className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                      {busy === 'redirect' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('google_ads.connect')}
                    </button>
                    <a href="https://ads.google.com/home/" target="_blank" rel="noopener" className="flex items-center justify-center gap-1 text-[12px] text-neutral-400 hover:text-neutral-600">
                      {t('google_ads.no_account')}<ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-center text-[12px] text-neutral-400">{t('onboarding.google_later')}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ GATA ═══ */}
            {step === 3 && (
              <motion.div key="done" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }} className="text-center">
                <div className="h-20 w-20 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-8"><CheckCircle className="h-10 w-10 text-white" /></div>
                <h2 className="text-[28px] font-semibold text-neutral-900 tracking-tight mb-2">{t('onboarding.done_title')}</h2>
                <p className="text-neutral-500 text-[14px] max-w-sm mx-auto mb-6 leading-relaxed">{t('onboarding.done_desc')}</p>
                {notice && <p className="mb-4 max-w-sm mx-auto text-left flex items-start gap-2 text-[12px] text-amber-800 p-3 bg-amber-50 border border-amber-100 rounded-xl"><AlertCircle className="h-4 w-4 shrink-0 mt-px" />{say(notice)}</p>}

                <div className="border border-neutral-200 rounded-xl p-5 max-w-sm mx-auto mb-8 text-left">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('onboarding.setup_summary')}</p>
                  <div className="space-y-3">
                    {[
                      { label: t('onboarding.account_created'), done: true, badge: t('onboarding.active_label') },
                      { label: t('onboarding.summary_store'), done: !!store, badge: store ? storeLabel : t('onboarding.skipped_label') },
                      { label: t('onboarding.summary_data'), done: !!store?.last_sync_at, badge: store ? t('onboarding.summary_data_value', { offers: fmt(store.products_count), orders: fmt(store.orders_count) }) : t('onboarding.skipped_label') },
                      { label: 'Google Ads', done: google.connected, badge: google.connected ? t('onboarding.connected_label') : t('onboarding.skipped_label') },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.done ? <CheckCircle className="h-4 w-4 text-neutral-700 shrink-0" /> : <div className="h-4 w-4 rounded-full border-2 border-neutral-200 shrink-0" />}
                          <span className="text-[13px] text-neutral-600">{item.label}</span>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full truncate max-w-[55%] ${item.done ? 'bg-neutral-100 text-neutral-600' : 'bg-neutral-50 text-neutral-400'}`}>{item.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={finish} disabled={busy === 'finish'}
                  className="h-[48px] px-8 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium inline-flex items-center gap-2 transition-all disabled:opacity-60">
                  {busy === 'finish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{t('onboarding.go_overview')} <ArrowRight className="h-4 w-4" /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bara de jos ─────────────────────────────────────────────────────── */}
      {isMiddle && (
        <div className="relative z-10 h-16 flex items-center justify-between px-5 lg:px-10 border-t border-neutral-100">
          <button onClick={() => goTo(step - 1)} className="flex items-center gap-2 text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />{t('onboarding.back')}
          </button>
          {(step === 1 && store) || (step === 2 && google.connected) ? (
            <button onClick={() => goTo(step + 1)} className="h-[40px] px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium inline-flex items-center gap-2 transition-all">
              {t('onboarding.next')} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={() => goTo(step + 1)} className="text-[13px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors">
              {t('onboarding.skip')} <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
