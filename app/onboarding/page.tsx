'use client'

import { useState, useEffect, useCallback, useId, useSyncExternalStore } from 'react'
import { useT } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/language-switcher'
import { Callout } from '@/components/app/feedback'
import { Button } from '@/components/app/button'
import { inputStyles } from '@/components/app/input'
import { Surface } from '@/components/app/surface'
import { cn } from '@/lib/utils'
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

const labelStyles = 'block text-[12px] font-semibold tracking-[0.02em] text-neutral-500'

// Adresa paginii nu se schimbă de la sine: n-are la ce să se aboneze
const noSubscribe = () => () => {}

/** Un câmp al formularelor de conectare (CLIPPING): etichetă mică, iconiță, inel la focus. */
function InputField({ label, value, onChange, placeholder, type = 'text', mono = false, icon: Icon, name, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; mono?: boolean
  icon?: typeof Globe; name?: string; autoComplete?: string
}) {
  const id = useId()
  return (
    <div>
      {label && <label htmlFor={id} className={cn(labelStyles, 'mb-1.5')}>{label}</label>}
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />}
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} name={name} autoComplete={autoComplete}
          aria-label={label || placeholder} className={cn(inputStyles, 'h-11', Icon && 'pl-10', mono && 'font-mono text-[13px]')} />
      </div>
    </div>
  )
}

/** Iconița de deasupra titlului unui pas. */
function StepIcon({ icon: Icon, dark = false }: { icon: typeof Globe; dark?: boolean }) {
  return (
    <div className={cn('mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl', dark ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-800 ring-1 ring-black/5')}>
      <Icon className="size-6" />
    </div>
  )
}

function ErrorBox({ text }: { text: string }) {
  return <Callout tone="danger">{text}</Callout>
}

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useT()
  /** „3 oferte și 20 de comenzi": numerele cu forma de plural potrivită */
  const counts = (s: StoreInfo) => ({
    offers: t('common.offers_count', { count: s.products_count ?? 0 }),
    orders: t('common.orders_count', { count: s.orders_count ?? 0 }),
  })

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

  // Starea se schimbă doar în callback-urile răspunsului, nu în efectul care pornește încărcarea
  const loadStore = useCallback((): Promise<StoreInfo | null> =>
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => { const s = (d.store ?? null) as StoreInfo | null; setStore(s); return s })
      .catch(() => null), [])

  const loadGoogle = useCallback(() =>
    fetch('/api/integrations/google')
      .then(r => r.json())
      .then(d => {
        const active = (d.stores ?? []).find((s: { id: string }) => s.id === d.active_store_id)
        const account = (d.accounts ?? []).find((a: { customer_id: string }) => a.customer_id === active?.google_ads_customer_id)
        setGoogle({
          connected: d.connection?.status === 'active',
          email: d.connection?.google_email ?? null,
          accounts: (d.accounts ?? []).filter((a: { is_manager: boolean }) => !a.is_manager).length,
          storeAccount: account ? (account.descriptive_name || account.customer_id) : null,
        })
      })
      .catch(() => {}), [])

  // Întoarcerea din Edinio, Shopify sau Google: rezultatul vine în adresă. Se citește
  // în browser (pe server adresa nu se știe) și se aplică o singură dată, la randare.
  const returnQuery = useSyncExternalStore(noSubscribe, () => window.location.search, () => '')
  const [readQuery, setReadQuery] = useState('')
  if (returnQuery && returnQuery !== readQuery) {
    setReadQuery(returnQuery)
    const params = new URLSearchParams(returnQuery)
    const go = (s: number) => { setDir(1); setStep(s) }
    if (params.get('google') === 'connected') {
      const warning = params.get('google_warning')
      if (warning) {
        const testOnly = warning.endsWith('DEVELOPER_TOKEN_NOT_APPROVED') || warning.endsWith('CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION')
        setNotice(testOnly ? { key: 'google_ads.warning_test_token' }
          : warning === 'discovery_failed' ? { key: 'google_ads.warning_discovery_failed' }
          : { key: 'google_ads.warning_generic', params: { code: warning } })
      }
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
  }

  // După ce rezultatul a fost citit, adresa rămâne curată
  useEffect(() => {
    if (readQuery) window.history.replaceState(null, '', window.location.pathname)
  }, [readQuery])

  useEffect(() => {
    loadStore()
    loadGoogle()
  }, [loadStore, loadGoogle])

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
    // Navigare completă: ruta API trimite mai departe la aprobarea din Shopify (OAuth), nu e o pagină
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
    // Reîncărcare completă: sesiunea se schimbă (pașii de pornire sunt gata) și platforma pornește de la zero
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/dashboard'
  }

  const storeLabel = store ? (store.store_name || store.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '')) : ''
  const isMiddle = step > 0 && step < STEPS.length - 1
  const progress = (step / (STEPS.length - 1)) * 100

  const syncLine = store && (
    <p className="text-[12px] text-neutral-500 leading-relaxed">
      {syncing
        ? <><Loader2 className="inline h-3 w-3 mr-1 animate-spin align-[-2px]" />{t('onboarding.sync_running', counts(store))}</>
        : t('onboarding.sync_done', counts(store))}
    </p>
  )

  return (
    <div className="app relative flex min-h-[100dvh] flex-col bg-canvas text-neutral-950">
      {/* ── Bara de sus ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex h-14 items-center justify-between border-b border-line bg-white/70 px-5 backdrop-blur-xl lg:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt="Hontrio" className="h-6 w-auto" />

        {isMiddle && (
          <div className="hidden items-center gap-1 rounded-full bg-neutral-100 p-1 sm:flex">
            {STEPS.slice(1, -1).map((s, i) => {
              const idx = i + 1
              const isActive = step === idx
              // Bifa doar când pasul chiar e făcut: unul sărit rămâne cu numărul lui
              const isDone = idx === 1 ? !!store : google.connected
              return (
                <span key={s} className={cn('relative flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                  isActive ? 'text-black' : isDone ? 'text-neutral-700' : 'text-neutral-400')}>
                  {isActive && <motion.span layoutId="onboarding-step" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                  <span className="relative flex items-center gap-1.5">
                    {isDone ? <Check className="size-3.5" strokeWidth={3} /> : <span className="font-mono text-[11px]">{idx}</span>}
                    {t(`onboarding.steps_${s}`)}
                  </span>
                </span>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {isMiddle && (
            <button onClick={finish} disabled={!!busy} className="text-[13px] font-medium text-neutral-500 transition-colors hover:text-black">{t('onboarding.skip_all')}</button>
          )}
        </div>
      </nav>

      {isMiddle && (
        <div className="relative z-10 h-[2px] bg-line">
          <motion.div className="h-full bg-black" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      {/* ── Conținut ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[520px]">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ BUN VENIT ═══ */}
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <Surface dotted className="px-6 py-10 text-center sm:px-10">
                  <StepIcon icon={Sparkles} dark />
                  <h1 className="text-3xl font-bold tracking-[-0.04em] text-neutral-950 sm:text-[34px]">
                    {userName ? t('onboarding.welcome_title', { name: userName }) : t('onboarding.welcome')}
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-neutral-500">{t('onboarding.welcome_desc')}</p>
                  <p className="mx-auto mt-2 max-w-sm text-[13px] text-neutral-400">{t('onboarding.welcome_steps')}</p>
                  <Button variant="primary" size="lg" onClick={() => goTo(1)} className="mt-8">
                    {t('onboarding.start')}<ArrowRight />
                  </Button>
                  <p className="mt-4 text-[12px] text-neutral-400">{t('onboarding.duration')}</p>
                </Surface>
              </motion.div>
            )}

            {/* ═══ MAGAZIN ═══ */}
            {step === 1 && (
              <motion.div key="store" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <Surface className="px-6 py-8 sm:px-8">
                  <div className="mb-6 text-center">
                    <StepIcon icon={Store} />
                    <h2 className="text-2xl font-bold tracking-[-0.03em] text-neutral-950">{t('onboarding.store_title')}</h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">{t('onboarding.store_desc')}</p>
                  </div>

                  {store ? (
                    <div className="space-y-2 rounded-2xl border border-line bg-neutral-50/70 p-6 text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-black text-white"><Check className="size-5" strokeWidth={3} /></div>
                      <h3 className="pt-1 text-[16px] font-semibold text-neutral-950">{t('onboarding.store_done_title', { store: storeLabel })}</h3>
                      {syncLine}
                      {syncing && <p className="text-[12px] text-neutral-400">{t('onboarding.sync_wait_hint')}</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2.5">
                        {([
                          { id: 'edinio', name: 'Edinio', sub: t('onboarding.edinio_subtitle'), icon: Sparkles },
                          { id: 'woocommerce', name: 'WooCommerce', sub: t('onboarding.woo_subtitle'), icon: Store },
                          { id: 'shopify', name: 'Shopify', sub: t('onboarding.shopify_subtitle'), icon: Zap },
                        ] as { id: Platform; name: string; sub: string; icon: typeof Store }[]).map(p => (
                          <button key={p.id} onClick={() => { setPlatform(p.id); setError(null) }} aria-pressed={platform === p.id}
                            className={cn('flex flex-col items-start rounded-2xl border p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150',
                              platform === p.id ? 'border-black bg-white shadow-sm' : 'border-line bg-neutral-50 hover:border-neutral-300')}>
                            <div className={cn('mb-2.5 flex size-8 items-center justify-center rounded-xl transition-colors',
                              platform === p.id ? 'bg-black text-white' : 'bg-white text-neutral-600 ring-1 ring-black/5')}>
                              <p.icon className="size-4" />
                            </div>
                            <p className="text-[13px] font-semibold text-neutral-950">{p.name}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{p.sub}</p>
                          </button>
                        ))}
                      </div>

                      {platform === 'edinio' && (
                        <div className="space-y-3.5">
                          <p className="rounded-2xl bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600 ring-1 ring-black/5">{t('onboarding.edinio_desc')}</p>
                          {error && <ErrorBox text={say(error)} />}
                          <Button variant="primary" onClick={() => redirectTo('/api/integrations/edinio/connect?from=onboarding')} disabled={!!busy} loading={busy === 'redirect'} className="h-11 w-full text-[14px]">
                            {busy !== 'redirect' && <><ExternalLink />{t('onboarding.edinio_connect')}</>}
                          </Button>
                        </div>
                      )}

                      {platform === 'woocommerce' && (
                        <div className="space-y-3.5">
                          <button onClick={() => setShowTutorial(s => !s)} aria-expanded={showTutorial}
                            className="w-full rounded-2xl border border-line bg-white p-3.5 text-left transition-colors hover:border-neutral-300">
                            <div className="flex items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600"><Info className="size-4" /></span>
                              <div className="flex-1">
                                <p className="text-[13px] font-semibold text-neutral-950">{t('onboarding.woo_tutorial_title')}</p>
                                <p className="text-[12px] text-neutral-500">{t('onboarding.woo_tutorial_hint')}</p>
                              </div>
                              <ChevronRight className={cn('size-4 text-neutral-400 transition-transform', showTutorial && 'rotate-90')} />
                            </div>
                          </button>
                          {showTutorial && (
                            <ol className="space-y-3 rounded-2xl border border-line bg-white p-4">
                              {TUTORIAL.map(n => (
                                <li key={n} className="flex gap-3">
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[11px] font-semibold text-neutral-600">{n}</span>
                                  <span className="text-[13px] leading-relaxed text-neutral-600">
                                    <span className="block font-semibold text-neutral-900">{t(`onboarding.woo_tut_${n}_title`)}</span>
                                    {t(`onboarding.woo_tut_${n}_desc`)}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
                          {/* Nu e un formular de autentificare: managerul de parole nu are ce completa aici */}
                          <InputField label={t('onboarding.store_url')} value={woo.store_url} onChange={v => setWoo(p => ({ ...p, store_url: v }))}
                            placeholder={t('onboarding.store_url_placeholder')} icon={Globe} name="woo_store_url" autoComplete="url" />
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className={labelStyles}>{t('onboarding.api_key')}</span>
                              <button onClick={() => setShowKeys(s => !s)} className="flex items-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-black">
                                {showKeys ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showKeys ? t('onboarding.hide_keys') : t('onboarding.show_keys')}
                              </button>
                            </div>
                            <InputField label="" value={woo.consumer_key} onChange={v => setWoo(p => ({ ...p, consumer_key: v }))} placeholder="ck_..."
                              type={showKeys ? 'text' : 'password'} mono icon={KeyRound} name="woo_consumer_key" autoComplete="new-password" />
                          </div>
                          <InputField label={t('onboarding.api_secret')} value={woo.consumer_secret} onChange={v => setWoo(p => ({ ...p, consumer_secret: v }))} placeholder="cs_..."
                            type={showKeys ? 'text' : 'password'} mono icon={Lock} name="woo_consumer_secret" autoComplete="new-password" />
                          {error && <ErrorBox text={say(error)} />}
                          <Button variant="primary" onClick={connectWoo} disabled={!!busy} loading={busy === 'woo'} className="h-11 w-full text-[14px]">
                            {busy !== 'woo' && t('onboarding.connect_store')}
                          </Button>
                        </div>
                      )}

                      {platform === 'shopify' && (
                        <div className="space-y-3.5">
                          <p className="rounded-2xl bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600 ring-1 ring-black/5">{t('onboarding.shopify_desc')}</p>
                          <InputField label={t('onboarding.shopify_url_label')} value={shopifyUrl} onChange={setShopifyUrl} placeholder={t('onboarding.shopify_url_placeholder')} icon={Globe} name="shopify_domain" autoComplete="url" />
                          {error && <ErrorBox text={say(error)} />}
                          <Button variant="primary" onClick={connectShopify} disabled={!!busy} loading={busy === 'redirect'} className="h-11 w-full text-[14px]">
                            {busy !== 'redirect' && <><Zap />{t('onboarding.shopify_connect')}</>}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Surface>
              </motion.div>
            )}

            {/* ═══ GOOGLE ADS ═══ */}
            {step === 2 && (
              <motion.div key="google" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <Surface className="px-6 py-8 sm:px-8">
                  <div className="mb-6 text-center">
                    <StepIcon icon={Megaphone} />
                    <h2 className="text-2xl font-bold tracking-[-0.03em] text-neutral-950">{t('onboarding.google_title')}</h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">{t('onboarding.google_desc')}</p>
                  </div>
                  {notice && <p className="mb-4 flex items-start gap-2 rounded-2xl bg-neutral-50 p-3.5 text-[13px] text-neutral-700 ring-1 ring-black/5"><CheckCircle className="mt-px size-4 shrink-0" />{say(notice)}</p>}

                  {google.connected ? (
                    <div className="space-y-2 rounded-2xl border border-line bg-neutral-50/70 p-6 text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-black text-white"><Check className="size-5" strokeWidth={3} /></div>
                      <h3 className="pt-1 text-[16px] font-semibold text-neutral-950">{t('onboarding.google_connected', { email: google.email ?? '' })}</h3>
                      <p className="text-[12px] text-neutral-500">
                        {google.storeAccount ? t('onboarding.google_store_account', { account: google.storeAccount, store: storeLabel })
                          : google.accounts ? t('onboarding.google_choose_later', { count: google.accounts }) : t('google_ads.no_accounts')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {error && <ErrorBox text={say(error)} />}
                      {/* Înainte de Google: ce citește și ce face Hontrio în cont, ca în Setări */}
                      <p className="rounded-2xl bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-600 ring-1 ring-black/5">
                        {t('google_ads.connect_desc')}{' '}
                        <a href="/legal/privacy#google" target="_blank" rel="noopener" className="font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-800">{t('site.data_privacy')}</a>
                      </p>
                      <Button variant="primary" onClick={() => redirectTo('/api/integrations/google/connect?from=onboarding')} disabled={!!busy} loading={busy === 'redirect'} className="h-11 w-full text-[14px]">
                        {busy !== 'redirect' && t('google_ads.connect')}
                      </Button>
                      <a href="https://ads.google.com/home/" target="_blank" rel="noopener" className="flex items-center justify-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-black">
                        {t('google_ads.no_account')}<ExternalLink className="size-3" />
                      </a>
                      <p className="text-center text-[12px] text-neutral-400">{t('onboarding.google_later')}</p>
                    </div>
                  )}
                </Surface>
              </motion.div>
            )}

            {/* ═══ GATA ═══ */}
            {step === 3 && (
              <motion.div key="done" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <Surface dotted className="px-6 py-10 text-center sm:px-10">
                  <StepIcon icon={CheckCircle} dark />
                  <h2 className="text-3xl font-bold tracking-[-0.04em] text-neutral-950">{t('onboarding.done_title')}</h2>
                  <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-500">{t('onboarding.done_desc')}</p>
                  {notice && <p className="mx-auto mt-5 flex max-w-sm items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3.5 text-left text-[12px] text-amber-800"><AlertCircle className="mt-px size-4 shrink-0" />{say(notice)}</p>}

                  <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-line bg-neutral-50/70 p-5 text-left">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('onboarding.setup_summary')}</p>
                    <div className="space-y-3">
                      {[
                        { label: t('onboarding.account_created'), done: true, badge: t('onboarding.active_label') },
                        { label: t('onboarding.summary_store'), done: !!store, badge: store ? storeLabel : t('onboarding.skipped_label') },
                        { label: t('onboarding.summary_data'), done: !!store?.last_sync_at, badge: store ? t('onboarding.summary_data_value', counts(store)) : t('onboarding.skipped_label') },
                        { label: 'Google Ads', done: google.connected, badge: google.connected ? t('onboarding.connected_label') : t('onboarding.skipped_label') },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {item.done
                              ? <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-black text-white"><Check className="size-2.5" strokeWidth={3.5} /></span>
                              : <span className="size-4 shrink-0 rounded-full border-2 border-neutral-200" />}
                            <span className={cn('text-[13px]', item.done ? 'text-neutral-800' : 'text-neutral-500')}>{item.label}</span>
                          </div>
                          <span className={cn('max-w-[55%] truncate rounded-full px-2 py-0.5 text-[11px] font-medium',
                            item.done ? 'border border-line bg-white text-neutral-700' : 'text-neutral-400')}>{item.badge}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="primary" size="lg" onClick={finish} loading={busy === 'finish'} className="mt-8">
                    {busy !== 'finish' && <>{t('onboarding.go_overview')}<ArrowRight /></>}
                  </Button>
                </Surface>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bara de jos ─────────────────────────────────────────────────────── */}
      {isMiddle && (
        <div className="relative z-10 flex h-16 items-center justify-between border-t border-line bg-white/70 px-5 backdrop-blur-xl lg:px-10">
          <button onClick={() => goTo(step - 1)} className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 transition-colors hover:text-black">
            <ArrowLeft className="size-4" />{t('onboarding.back')}
          </button>
          {(step === 1 && store) || (step === 2 && google.connected) ? (
            <Button variant="primary" size="sm" onClick={() => goTo(step + 1)}>
              {t('onboarding.next')}<ArrowRight />
            </Button>
          ) : (
            <button onClick={() => goTo(step + 1)} className="flex items-center gap-1 text-[13px] font-medium text-neutral-500 transition-colors hover:text-black">
              {t('onboarding.skip')}<ChevronRight className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
