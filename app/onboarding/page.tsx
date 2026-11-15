'use client'

import { useCallback, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Globe, KeyRound, Loader2, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { inputStyles } from '@/components/app/input'
import { GoogleMark } from '@/components/integrations/google-mark'
import { KeyStoreForm, type KeyStorePlatform } from '@/components/integrations/key-store-form'
import { Tutorial } from '@/components/integrations/tutorial'
import { PlatformLogo } from '@/components/integrations/platform-logo'
import { MotionPanel } from '@/components/onboarding/motion-panel'
import { PLATFORM_NAMES, type CommercePlatform } from '@/lib/commerce/platforms'
import { cn } from '@/lib/utils'

// =============================================
// Onboarding: în stânga pașii (bun venit → magazinul → Google Ads → gata), în
// dreapta clipul motion design cu fraza fiecărui pas. Conectările pornite de
// aici (Edinio, Shopify, Google) se întorc aici, cu rezultatul în adresă;
// Gomag, MerchantPro și OpenCart se leagă cu chei, în pagină (KeyStoreForm).
// După onboarding, Prezentarea arată ce mai trebuie pentru prima campanie.
// =============================================

type Method = 'oauth' | 'key' | 'extension'
type StoreInfo = {
  id: string; platform: string; store_name: string | null; store_url: string
  sync_status: string | null; last_sync_at: string | null; products_count: number | null; orders_count: number | null
}
type GoogleState = { connected: boolean; email: string | null; accounts: number; storeAccount: string | null }
/** Mesajele se traduc la afișare (la încărcare, textele limbii pot să nu fie gata); al serverului vine gata. */
type Msg = { key: string; params?: Record<string, string> } | { text: string } | null

const PLATFORMS: { id: CommercePlatform; method: Method; sub: string; desc: string }[] = [
  { id: 'edinio', method: 'oauth', sub: 'onboarding.edinio_subtitle', desc: 'onboarding.edinio_desc' },
  { id: 'woocommerce', method: 'key', sub: 'onboarding.woo_subtitle', desc: 'onboarding.woo_form_desc' },
  { id: 'shopify', method: 'oauth', sub: 'onboarding.shopify_subtitle', desc: 'onboarding.shopify_desc' },
  { id: 'gomag', method: 'key', sub: 'integrations.gomag_subtitle', desc: 'integrations.gomag_desc' },
  { id: 'merchantpro', method: 'key', sub: 'integrations.merchantpro_subtitle', desc: 'integrations.merchantpro_desc' },
  { id: 'opencart', method: 'extension', sub: 'integrations.opencart_subtitle', desc: 'integrations.opencart_desc' },
]
const KEY_FORMS: readonly string[] = ['gomag', 'merchantpro', 'opencart'] satisfies KeyStorePlatform[]
const EDINIO_ERRORS = ['access_denied', 'state', 'expired', 'store_read', 'save', 'rate_limited', 'not_configured']
const GOOGLE_ERRORS = ['access_denied', 'missing_scope', 'no_refresh_token', 'state', 'rate_limited', 'not_configured']
const WOO_TUTORIAL = [1, 2, 3, 4]
const LAST = 3

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 28 : -28, opacity: 0 }),
}

const labelStyles = 'block text-[12px] font-semibold tracking-[0.02em] text-neutral-500'

// Adresa paginii nu se schimbă de la sine: n-are la ce să se aboneze
const noSubscribe = () => () => {}

/** Un câmp al formularelor de conectare: etichetă mică, iconiță, inel la focus. */
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
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} name={name} autoComplete={autoComplete} spellCheck={false}
          aria-label={label || placeholder} className={cn(inputStyles, 'h-11', Icon && 'pl-10', mono && 'font-mono text-[13px] placeholder:font-sans placeholder:text-[14px]')} />
      </div>
    </div>
  )
}

/** Titlul unui pas: titlul mare și descrierea. */
function Title({ title, desc }: { title: string; desc?: ReactNode }) {
  return (
    <div>
      <h1 className="text-balance text-[32px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[38px]">{title}</h1>
      {desc && <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{desc}</p>}
    </div>
  )
}

/** Bifa neagră de deasupra unui pas încheiat. */
function DoneMark() {
  return (
    <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className="mb-5 grid size-11 place-items-center rounded-full bg-black text-white">
      <Check className="size-5" strokeWidth={3} />
    </motion.span>
  )
}

/** „Pasul 2 din 3", cu liniuțele lui (pe telefon, doar liniuțele). */
function Progress({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3" role="img" aria-label={label}>
      <span className="hidden whitespace-nowrap text-[12px] font-medium text-neutral-500 sm:inline">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <span key={i} className="h-1 w-5 overflow-hidden rounded-full bg-neutral-200 sm:w-7">
            <motion.span className="block h-full bg-black" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
          </span>
        ))}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const { t } = useT()
  /** „3 oferte și 20 de comenzi": numerele cu forma de plural potrivită */
  const counts = (s: StoreInfo) => ({
    offers: t('common.offers_count', { count: s.products_count ?? 0 }),
    orders: t('common.orders_count', { count: s.orders_count ?? 0 }),
  })

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [error, setError] = useState<Msg>(null)
  const [notice, setNotice] = useState<Msg>(null)
  const [platform, setPlatform] = useState<CommercePlatform | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [storeLoaded, setStoreLoaded] = useState(false)
  const [google, setGoogle] = useState<GoogleState>({ connected: false, email: null, accounts: 0, storeAccount: null })
  const [woo, setWoo] = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [showKeys, setShowKeys] = useState(false)
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
      .catch(() => null)
      .finally(() => setStoreLoaded(true)), [])

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
      go(2)
    } else if (params.get('google_error')) {
      const code = params.get('google_error')!
      setError({ key: `google_ads.error_${GOOGLE_ERRORS.includes(code) ? code : 'generic'}` })
      go(2)
    } else if (params.get('edinio') === 'connected' || params.get('shopify') === 'connected') {
      go(1)
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
  const choose = (p: CommercePlatform | null) => { setDir(p ? 1 : -1); setPlatform(p); setError(null) }

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
      // Sesiunea află acum că onboarding-ul s-a încheiat, nu abia la următoarea reîmprospătare
      await update()
    } catch {}
    // Reîncărcare completă: sesiunea se schimbă (pașii de pornire sunt gata) și platforma pornește de la zero
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/dashboard'
  }

  const storeLabel = store ? (store.store_name || store.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '')) : ''
  const isMiddle = step > 0 && step < LAST
  const stepDone = (step === 1 && !!store) || (step === 2 && google.connected)
  const chosen = PLATFORMS.find(p => p.id === platform) ?? null

  // Fiecare ecran are cheia lui, ca trecerea dintre ele să fie animată și în cadrul unui pas
  const screen = step === 0 ? 'welcome'
    : step === 1 ? (!storeLoaded ? 'store-loading' : store ? 'store-connected' : chosen ? `store-${chosen.id}` : 'store-choose')
    : step === 2 ? (google.connected ? 'google-connected' : 'google')
    : 'done'

  const errorBox = error && <Callout tone="danger">{say(error)}</Callout>

  return (
    <div className="app grid min-h-dvh bg-white text-neutral-950 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <section className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:px-14">
        {/* ── Sus: logo și pasul (limba vine din țară; se schimbă din Setări) ── */}
        <header className="flex h-9 items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-black.png" alt="Hontrio" className="h-5 w-auto sm:h-6" />
          {step > 0 && <Progress step={step} label={t('onboarding.progress', { step: String(step), total: '3' })} />}
        </header>

        {/* ── Pasul ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[460px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={screen} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>

                {/* ═══ BUN VENIT ═══ */}
                {screen === 'welcome' && (
                  <div>
                    <Title title={userName ? t('onboarding.welcome_title', { name: userName }) : t('onboarding.welcome')} desc={t('onboarding.welcome_desc')} />
                    <ol className="mt-8 space-y-4">
                      {(['store', 'google'] as const).map((k, i) => (
                        <li key={k} className="flex gap-3.5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line font-mono text-[12px] font-semibold">{i + 1}</span>
                          <span>
                            <span className="block text-[15px] font-semibold">{t(`onboarding.intro_${k}_title`)}</span>
                            <span className="block text-[13px] leading-relaxed text-neutral-500">{t(`onboarding.intro_${k}_desc`)}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <Button variant="primary" size="lg" onClick={() => goTo(1)} className="mt-9">{t('onboarding.start')}<ArrowRight /></Button>
                    <p className="mt-3 text-[12px] text-neutral-400">{t('onboarding.duration')}</p>
                  </div>
                )}

                {/* ═══ MAGAZIN ═══ */}
                {screen === 'store-loading' && <Loader2 className="mx-auto size-5 animate-spin text-neutral-400" />}

                {screen === 'store-choose' && (
                  <div>
                    <Title title={t('onboarding.store_choose_title')} desc={t('onboarding.store_desc')} />
                    <div className="mt-7 grid grid-cols-2 gap-2.5">
                      {PLATFORMS.map(p => (
                        <button key={p.id} onClick={() => choose(p.id)}
                          className="group flex h-[104px] flex-col justify-between rounded-2xl border border-line bg-white p-3.5 text-left transition-[border-color,box-shadow] hover:border-neutral-300 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-black/15">
                          {/* Pe ecranele cu mouse, logo-urile stau gri până treci peste ele */}
                          <span className="flex h-8 items-center transition [@media(hover:hover)]:grayscale group-hover:grayscale-0 group-focus-visible:grayscale-0">
                            <PlatformLogo platform={p.id} named nameClassName="text-[13px] text-neutral-950 sm:text-[14px]" />
                          </span>
                          <span className="text-[12px] leading-snug text-neutral-500">{t(p.sub)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chosen && screen === `store-${chosen.id}` && (
                  <div>
                    <button onClick={() => choose(null)} className="mb-5 flex items-center gap-1 text-[13px] font-medium text-neutral-500 transition-colors hover:text-black">
                      <ChevronLeft className="size-4" />{t('onboarding.other_platform')}
                    </button>
                    <div className="flex h-9 items-center"><PlatformLogo platform={chosen.id} named scale={1.2} nameClassName="text-[18px]" /></div>
                    <h1 className="mt-4 text-balance text-[28px] font-bold leading-[1.1] tracking-[-0.035em]">
                      {chosen.method === 'extension' ? t('onboarding.form_title_extension') : t(`onboarding.form_title_${chosen.method}`, { platform: PLATFORM_NAMES[chosen.id] })}
                    </h1>
                    <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{t(chosen.desc)}</p>

                    <div className="mt-6">
                      {chosen.id === 'edinio' && (
                        <div className="space-y-4">
                          {errorBox}
                          <Button variant="primary" onClick={() => redirectTo('/api/integrations/edinio/connect?from=onboarding')} disabled={!!busy} loading={busy === 'redirect'} className="h-11 w-full text-[14px]">
                            {busy !== 'redirect' && <>{t('onboarding.continue_in', { platform: 'Edinio' })}<ExternalLink /></>}
                          </Button>
                        </div>
                      )}

                      {chosen.id === 'shopify' && (
                        <div className="space-y-4">
                          <InputField label={t('onboarding.shopify_url_label')} value={shopifyUrl} onChange={setShopifyUrl} placeholder={t('onboarding.shopify_url_placeholder')} icon={Globe} name="shopify_domain" autoComplete="url" />
                          {errorBox}
                          <Button variant="primary" onClick={connectShopify} disabled={!!busy} loading={busy === 'redirect'} className="h-11 w-full text-[14px]">
                            {busy !== 'redirect' && <>{t('onboarding.continue_in', { platform: 'Shopify' })}<ExternalLink /></>}
                          </Button>
                        </div>
                      )}

                      {chosen.id === 'woocommerce' && (
                        <div className="space-y-4">
                          <Tutorial title={t('integrations.tutorial_title')} platform="woocommerce"
                            steps={WOO_TUTORIAL.map(n => ({ title: t(`onboarding.woo_tut_${n}_title`), desc: t(`onboarding.woo_tut_${n}_desc`) }))} />
                          {/* Nu e un formular de autentificare: managerul de parole nu are ce completa aici */}
                          <InputField label={t('onboarding.store_url')} value={woo.store_url} onChange={v => setWoo(p => ({ ...p, store_url: v }))}
                            placeholder={t('onboarding.store_url_placeholder')} icon={Globe} name="woo_store_url" autoComplete="url" />
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className={labelStyles}>{t('onboarding.api_key')}</span>
                              <button type="button" onClick={() => setShowKeys(s => !s)} className="flex items-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-black">
                                {showKeys ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showKeys ? t('onboarding.hide_keys') : t('onboarding.show_keys')}
                              </button>
                            </div>
                            <InputField label="" value={woo.consumer_key} onChange={v => setWoo(p => ({ ...p, consumer_key: v }))} placeholder="ck_…"
                              type={showKeys ? 'text' : 'password'} mono icon={KeyRound} name="woo_consumer_key" autoComplete="new-password" />
                          </div>
                          <InputField label={t('onboarding.api_secret')} value={woo.consumer_secret} onChange={v => setWoo(p => ({ ...p, consumer_secret: v }))} placeholder="cs_…"
                            type={showKeys ? 'text' : 'password'} mono icon={Lock} name="woo_consumer_secret" autoComplete="new-password" />
                          {errorBox}
                          <Button variant="primary" onClick={connectWoo} disabled={!!busy} loading={busy === 'woo'} className="h-11 w-full text-[14px]">
                            {busy !== 'woo' && t('onboarding.connect_store')}
                          </Button>
                        </div>
                      )}

                      {KEY_FORMS.includes(chosen.id) && (
                        <KeyStoreForm key={chosen.id} platform={chosen.id as KeyStorePlatform} variant="onboarding" onConnected={() => { loadStore() }} />
                      )}
                    </div>
                  </div>
                )}

                {screen === 'store-connected' && store && (
                  <div>
                    <DoneMark />
                    <Title title={t('onboarding.store_done_title', { store: storeLabel })} desc={syncing ? t('onboarding.store_syncing_desc') : t('onboarding.store_synced_desc')} />
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      {/* Chei diferite: bara plină pornește de la zero, fără deplasarea celei care alerga */}
                      {syncing
                        ? <motion.div key="running" className="h-full w-1/3 rounded-full bg-black" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
                        : <motion.div key="done" className="h-full bg-black" initial={{ width: '35%' }} animate={{ width: '100%' }} transition={{ duration: 0.6, ease: 'easeOut' }} />}
                    </div>
                    <p className="mt-2 font-mono text-[12px] text-neutral-500">{t('onboarding.summary_data_value', counts(store))}</p>
                    <Button variant="primary" size="lg" onClick={() => goTo(2)} className="mt-8">{t('onboarding.next')}<ArrowRight /></Button>
                  </div>
                )}

                {/* ═══ GOOGLE ADS ═══ */}
                {screen === 'google' && (
                  <div>
                    <Title title={t('onboarding.google_title')} desc={t('onboarding.google_desc')} />
                    {error && <div className="mt-5">{errorBox}</div>}
                    <Button onClick={() => redirectTo('/api/integrations/google/connect?from=onboarding')} disabled={!!busy} loading={busy === 'redirect'} className="mt-7 h-12 w-full text-[15px]">
                      {busy !== 'redirect' && <GoogleMark />}{t('google_ads.connect')}
                    </Button>
                    <a href="https://ads.google.com/home/" target="_blank" rel="noopener" className="mt-4 flex items-center justify-center gap-1 text-[13px] font-medium text-neutral-500 transition-colors hover:text-black">
                      {t('google_ads.no_account')}<ExternalLink className="size-3" />
                    </a>
                    {/* Înainte de Google: ce citește și ce face Hontrio în cont, ca în Setări */}
                    <p className="mt-6 text-[12px] leading-relaxed text-neutral-400">
                      {t('google_ads.connect_desc')}{' '}
                      <a href="/legal/privacy#google" target="_blank" rel="noopener" className="font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600">{t('site.data_privacy')}</a>
                    </p>
                  </div>
                )}

                {screen === 'google-connected' && (
                  <div>
                    <DoneMark />
                    <Title title={t('onboarding.google_connected_title')}
                      desc={google.storeAccount ? t('onboarding.google_store_account', { account: google.storeAccount, store: storeLabel })
                        : google.accounts ? t('onboarding.google_choose_later', { count: google.accounts }) : t('google_ads.no_accounts')} />
                    {notice && <Callout tone="warning" className="mt-5">{say(notice)}</Callout>}
                    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
                      <GoogleMark />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{google.email}</span>
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-black text-white"><Check className="size-3" strokeWidth={3} /></span>
                    </div>
                    <Button variant="primary" size="lg" onClick={() => goTo(3)} className="mt-8">{t('onboarding.next')}<ArrowRight /></Button>
                  </div>
                )}

                {/* ═══ GATA ═══ */}
                {screen === 'done' && (
                  <div>
                    {/* „Configurat" doar dacă magazinul și Google Ads chiar sunt conectate; altfel, contul e doar creat */}
                    <Title title={t(store && google.connected ? 'onboarding.done_title' : 'onboarding.done_title_partial')}
                      desc={t(store && google.connected ? 'onboarding.done_desc' : 'onboarding.done_desc_partial')} />
                    <ul className="mt-7 divide-y divide-line rounded-2xl border border-line">
                      {[
                        { label: t('onboarding.account_created'), done: true, value: session?.user?.email ?? '' },
                        { label: t('onboarding.summary_store'), done: !!store, value: store ? storeLabel : t('onboarding.skipped_label') },
                        { label: t('onboarding.summary_data'), done: !!store?.last_sync_at, value: store ? t('onboarding.summary_data_value', counts(store)) : t('onboarding.skipped_label') },
                        { label: 'Google Ads', done: google.connected, value: google.connected ? (google.storeAccount ?? t('onboarding.connected_label')) : t('onboarding.skipped_label') },
                      ].map(row => (
                        <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="flex min-w-0 items-center gap-2.5 text-[14px] font-medium">
                            {row.done
                              ? <span className="grid size-5 shrink-0 place-items-center rounded-full bg-black text-white"><Check className="size-3" strokeWidth={3} /></span>
                              : <span className="size-5 shrink-0 rounded-full border border-neutral-300" />}
                            <span className="truncate">{row.label}</span>
                          </span>
                          <span className={cn('max-w-[55%] truncate text-[13px]', row.done ? 'text-neutral-600' : 'text-neutral-400')}>{row.value}</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="primary" size="lg" onClick={finish} loading={busy === 'finish'} className="mt-8">
                      {busy !== 'finish' && <>{t('onboarding.go_overview')}<ArrowRight /></>}
                    </Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Jos: înapoi și „sari peste" (cât timp pasul nu e făcut) ─────── */}
        {isMiddle && (
          <footer className="flex h-9 items-center justify-between text-[13px] font-medium text-neutral-500">
            <button onClick={() => goTo(step - 1)} className="flex items-center gap-1.5 transition-colors hover:text-black"><ArrowLeft className="size-4" />{t('onboarding.back')}</button>
            {!stepDone && (
              <button onClick={() => goTo(step + 1)} className="flex items-center gap-1 transition-colors hover:text-black">{t('onboarding.skip')}<ChevronRight className="size-3.5" /></button>
            )}
          </footer>
        )}
      </section>

      {/* ── Dreapta: clipul, doar pe ecranele late ────────────────────────── */}
      <aside className="hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100dvh-1.5rem)]">
          <MotionPanel step={step} />
        </div>
      </aside>
    </div>
  )
}
