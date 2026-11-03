'use client'

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Bell, Briefcase, Camera, Check, CircleCheck, Coffee, CreditCard, ExternalLink, Eye, EyeOff, Gem, Globe, KeyRound,
  Loader2, Lock, Mail, Package, Plug, RefreshCw, Shield, SlidersHorizontal, Smile, Sparkles, Store, Trash2,
  TrendingDown, TrendingUp, Unplug, User, Wifi, X, Zap,
} from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n/context'
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config'
import { translateStored } from '@/lib/i18n/stored'
import { PACKS, PACK_IDS, PAID_PLANS, PLAN_IDS, perCreditUsd, type PackId } from '@/lib/billing/catalog'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { PageTabs, Segmented } from '@/components/app/tabs'
import { Card, CardFooter, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { ChoiceCard, Input, Select, Switch } from '@/components/app/input'
import { Callout, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import GoogleAdsCard from '@/components/integrations/google-ads-card'
import MerchantCard from '@/components/integrations/merchant-card'
import { EdinioConnectCard, EdinioStoreCard, type EdinioStore } from '@/components/integrations/edinio-card'

// =============================================
// Setări — contul, brandul pentru AI, integrările (magazinele, Google Ads,
// Merchant Center), creditele, securitatea și preferințele. Fiecare filă e
// o listă de secțiuni: în stânga ce e și de ce contează, în dreapta setarea.
// Fila aleasă stă în adresă (?tab=), ca linkurile să ducă direct la ea.
// =============================================

type StoreData = EdinioStore & {
  id: string; store_url: string; store_name: string; platform: string
  products_count: number; last_sync_at: string | null; status: string
}
type UserProfile = {
  id: string; name: string | null; email: string; avatar_url: string | null
  credits: number; plan: string; role: string; business_name: string | null
  website: string | null; brand_tone: string | null; brand_language: string | null
  niche: string | null; preferences: Record<string, boolean> | null; created_at: string
}
type Transaction = {
  id: string; type: string; amount: number; balance_after: number
  description: string; created_at: string; reference_type: string
}
type Tab = 'general' | 'brand' | 'integrations' | 'credits' | 'security' | 'preferences'

// Rezultatul conectării Edinio (redirect înapoi din /api/integrations/edinio/callback)
const EDINIO_ERRORS = ['access_denied', 'state', 'expired', 'store_exists', 'store_read', 'save', 'rate_limited', 'not_configured']
const TABS: Tab[] = ['general', 'brand', 'integrations', 'credits', 'security', 'preferences']

// Prețurile pachetelor și ale planurilor vin din lib/billing/catalog.ts (ca pe pagina Abonament)
const POPULAR_PACK: PackId = 'pack_300'

const TONES = [
  { value: 'professional', icon: Briefcase, label: 'settings.tone_professional_label', example: 'settings.tone_pro_example' },
  { value: 'friendly', icon: Smile, label: 'settings.tone_friendly_label', example: 'settings.tone_friendly_example' },
  { value: 'luxury', icon: Gem, label: 'settings.tone_premium_label', example: 'settings.tone_luxury_example' },
  { value: 'casual', icon: Coffee, label: 'settings.tone_casual_label', example: 'settings.tone_casual_example' },
]

/** Cât de bună e o parolă nouă: 0–5, cu eticheta și culoarea barei. */
function passwordStrength(p: string, t: (k: string) => string) {
  if (!p) return { score: 0, label: '', color: '' }
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  if (s <= 1) return { score: s, label: t('settings.pw_weak'), color: 'bg-red-500' }
  if (s <= 2) return { score: s, label: t('settings.pw_fair'), color: 'bg-amber-500' }
  if (s <= 3) return { score: s, label: t('settings.pw_good'), color: 'bg-neutral-500' }
  return { score: s, label: t('settings.pw_strong'), color: 'bg-emerald-500' }
}

/** O secțiune a setărilor: în stânga ce e, în dreapta setarea. */
function Section({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b border-neutral-200/70 py-8 first:pt-2 last:border-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</h2>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</div>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

/** Eticheta unui câmp, cu câmpul sub ea. */
function Label({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-neutral-700">{text}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-[12px] text-neutral-500">{hint}</span>}
    </label>
  )
}

/** Un câmp de parolă, cu buton de arătat / ascuns. */
function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete: string }) {
  const { t } = useT()
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input type={shown ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-10 pr-10" />
      <button type="button" onClick={() => setShown(s => !s)} aria-label={t(shown ? 'settings.hide_password' : 'settings.show_password')}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-700">
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function SettingsView() {
  const { t, intlLocale } = useT()
  const { locale, setLocale } = useLocale()
  const { data: session } = useSession()
  const params = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'general'

  // Un cont poate avea mai multe magazine; paginile lucrează pe cel activ
  const [stores, setStores] = useState<StoreData[]>([])
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const avatarRef = useRef<HTMLInputElement>(null)

  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [testingConn, setTestingConn] = useState(false)
  const [connTest, setConnTest] = useState<{ ok: boolean; msg: string } | null>(null)
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)

  const [credits, setCredits] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [storeForm, setStoreForm] = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [shopifyUrl, setShopifyUrl] = useState('')
  const [connectingShopify, setConnectingShopify] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [brandForm, setBrandForm] = useState({ businessName: '', website: '', tone: 'professional', language: 'ro', niche: '' })
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [prefs, setPrefs] = useState({ emailNotifications: true, weeklyReport: true, autoOptimize: false })

  useEffect(() => {
    fetchProfile(); fetchStore(); fetchCredits()
    // Rezultatul conectării Edinio: un mesaj, apoi adresa curată
    const q = new URLSearchParams(window.location.search)
    const edinioError = q.get('edinio_error')
    if (edinioError) toast.error(t(`edinio.error_${EDINIO_ERRORS.includes(edinioError) ? edinioError : 'generic'}`))
    else if (q.get('edinio') === 'connected') toast.success(t('edinio.connected_success'))
    if (edinioError || q.get('edinio')) {
      q.delete('edinio'); q.delete('edinio_error')
      const qs = q.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTab = (next: Tab) => {
    const q = new URLSearchParams(window.location.search)
    if (next === 'general') q.delete('tab'); else q.set('tab', next)
    window.history.pushState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}`)
  }

  async function fetchProfile() {
    try {
      const r = await fetch('/api/user/profile'); const d = await r.json()
      if (d.user) {
        setProfile(d.user); setCredits(d.user.credits || 0)
        setProfileForm({ name: d.user.name || '' })
        setBrandForm({ businessName: d.user.business_name || '', website: d.user.website || '', tone: d.user.brand_tone || 'professional', language: d.user.brand_language || 'ro', niche: d.user.niche || '' })
        if (d.user.preferences) { const p = d.user.preferences; setPrefs({ emailNotifications: p.emailNotifications ?? true, weeklyReport: p.weeklyReport ?? true, autoOptimize: p.autoOptimize ?? false }) }
      }
    } catch {} finally { setLoading(false) }
  }
  async function fetchStore() {
    try {
      const r = await fetch('/api/stores'); const d = await r.json()
      if (!r.ok) return
      setStores(d.stores ?? (d.store ? [d.store] : []))
      setActiveStoreId(d.active_store_id ?? d.store?.id ?? null)
    } catch {}
  }
  async function fetchCredits() {
    try { const r = await fetch('/api/credits'); const d = await r.json(); setCredits(d.balance || 0); setTransactions(d.transactions || []) } catch {}
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const r = await fetch('/api/user/avatar', { method: 'POST', body: fd }); const d = await r.json()
      if (!r.ok) { toast.error(d.error || t('settings.error_upload_avatar')); return }
      setProfile(p => p ? { ...p, avatar_url: d.avatar_url } : p); toast.success(t('settings.avatar_updated'))
    } catch { toast.error(t('settings.error_avatar')) }
    finally { setUploadingAvatar(false); if (avatarRef.current) avatarRef.current.value = '' }
  }

  async function handleSaveProfile() {
    if (!profileForm.name.trim()) { toast.error(t('settings.name_required')); return }
    setSaving(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileForm.name.trim() }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || t('settings.error_save')); return }
      setProfile(p => p ? { ...p, name: d.user.name } : p); toast.success(t('settings.profile_saved'))
    } catch { toast.error(t('settings.error_save')) } finally { setSaving(false) }
  }

  async function handleSaveBrand() {
    setSavingBrand(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_name: brandForm.businessName.trim(), website: brandForm.website.trim(), brand_tone: brandForm.tone, brand_language: brandForm.language, niche: brandForm.niche.trim() }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || t('settings.error_save')); return }
      toast.success(t('settings.brand_saved'))
    } catch { toast.error(t('settings.error_save')) } finally { setSavingBrand(false) }
  }

  async function handleChangePw() {
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) { toast.error(t('settings.pw_fill_all')); return }
    if (pwForm.new.length < 6) { toast.error(t('settings.pw_min_6')); return }
    if (pwForm.new !== pwForm.confirm) { toast.error(t('settings.pw_mismatch')); return }
    setSavingPw(true)
    try {
      const r = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || t('common.error')); return }
      toast.success(t('settings.pw_changed')); setPwForm({ current: '', new: '', confirm: '' })
    } catch { toast.error(t('settings.error_network')) } finally { setSavingPw(false) }
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: prefs }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      toast.success(t('settings.prefs_saved'))
    } catch { toast.error(t('settings.error_save')) } finally { setSavingPrefs(false) }
  }

  async function handleTestConn() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) { setConnTest({ ok: false, msg: t('settings.pw_fill_all') }); return }
    setTestingConn(true); setConnTest(null)
    try {
      // Verificarea se face pe server: cheia nu ajunge în adresă, iar CORS-ul magazinului nu contează
      const r = await fetch('/api/stores/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeForm) })
      const d = await r.json().catch(() => ({}))
      setConnTest(d.ok ? { ok: true, msg: t('settings.conn_ok_full') } : { ok: false, msg: d.error || t('settings.conn_cant_connect') })
    } catch { setConnTest({ ok: false, msg: t('settings.conn_cant_connect') }) }
    finally { setTestingConn(false) }
  }

  async function handleConnect() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) { toast.error(t('settings.pw_fill_all')); return }
    setConnecting(true)
    try {
      const r = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeForm) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      // Magazinul nou devine cel activ (serverul l-a ales); îl vedem în listă
      toast.success(t('settings.store_connected_msg')); setStoreForm({ store_url: '', consumer_key: '', consumer_secret: '' }); setConnTest(null)
      await fetchStore()
    } catch { toast.error(t('settings.error_connect')) } finally { setConnecting(false) }
  }

  async function handleSync(s: StoreData) {
    setSyncingId(s.id)
    try {
      const r = await fetch(`/api/stores/${s.id}/sync`, { method: 'POST' }); const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      // Un magazin mare nu încape într-o rulare: restul vine la sincronizările următoare
      toast.success(d.complete === false
        ? t('catalog.sync_partial', { offers: t('common.offers_count', { count: Number(d.synced ?? 0) }), orders: t('common.orders_count', { count: Number(d.orders ?? 0) }) })
        : t('settings.sync_complete', { count: Number(d.synced ?? 0) })); fetchStore()
    } catch { toast.error(t('settings.error_sync')) } finally { setSyncingId(null) }
  }

  /** Paginile (Prezentare, Produse, Campanii...) lucrează pe magazinul activ: se reîncarcă tot. */
  async function handleUseStore(s: StoreData) {
    setSwitchingId(s.id)
    try {
      const r = await fetch('/api/stores/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: s.id }) })
      if (!r.ok) { toast.error(t('settings.error_switch_store')); setSwitchingId(null); return }
      window.location.reload()
    } catch { toast.error(t('settings.error_switch_store')); setSwitchingId(null) }
  }

  function handleConnectShopify() {
    const raw = shopifyUrl.trim().toLowerCase()
    if (!raw) { toast.error(t('settings.shopify_url_required')); return }
    const shop = raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!shop.includes('.myshopify.com')) { toast.error(t('onboarding.shopify_url_invalid')); return }
    setConnectingShopify(true)
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`
  }

  async function handleDisconnect(s: StoreData) {
    if (!confirm(t('settings.disconnect_confirm'))) return
    setDisconnectingId(s.id)
    try { await fetch(`/api/stores/${s.id}`, { method: 'DELETE' }); await fetchStore(); toast.success(t('settings.store_disconnected')) }
    catch { toast.error(t('settings.error_disconnect')) } finally { setDisconnectingId(null) }
  }

  async function handleBuyPack(packId: string) {
    setBuyingPack(packId)
    try {
      const r = await fetch('/api/stripe/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: packId }) })
      const d = await r.json()
      if (r.ok && d.url) window.location.href = d.url
      else toast.error(d.error || t('settings.error_processing'))
    } catch { toast.error(t('settings.error_network')) } finally { setBuyingPack(null) }
  }

  async function handleManageSub() {
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' }); const d = await r.json()
      if (r.ok && d.url) window.location.href = d.url
      else toast.error(d.error || t('settings.error_portal'))
    } catch { toast.error(t('settings.error_network')) }
  }

  const userName = profile?.name || session?.user?.name || t('settings.default_user')
  const userEmail = profile?.email || session?.user?.email || ''
  const userPlan = profile?.plan || (session?.user as { plan?: string } | undefined)?.plan || 'free'
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' }) : ''
  const planName = t.has(`credits.plan_${userPlan}`) ? t(`credits.plan_${userPlan}`) : userPlan
  const pw = passwordStrength(pwForm.new, t)
  const fmtInt = new Intl.NumberFormat(intlLocale)

  const header = (
    <PageHeader title={t('settings.title')} description={t('settings.admin_settings_desc')}>
      <PageTabs id="settings" value={tab} onChange={goTab} items={[
        { value: 'general', label: t('settings.tab_general'), icon: <User /> },
        { value: 'brand', label: t('settings.brand_ai'), icon: <Sparkles /> },
        { value: 'integrations', label: t('settings.tab_integrations'), icon: <Plug /> },
        { value: 'credits', label: t('common.credits_label'), icon: <CreditCard /> },
        { value: 'security', label: t('settings.security'), icon: <Shield /> },
        { value: 'preferences', label: t('settings.tab_preferences'), icon: <SlidersHorizontal /> },
      ]} />
    </PageHeader>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="flex gap-6 border-b border-neutral-200 pb-3">{['w-[72px]', 'w-[96px]', 'w-[84px]', 'w-[64px]'].map(w => <Skeleton key={w} className={`h-5 ${w}`} />)}</div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <FadeIn key={tab}>
        {/* ═══════ GENERAL ═══════ */}
        {tab === 'general' && (
          <div>
            <Section title={t('settings.profile_info')} description={t('settings.profile_info_desc')}>
              <Card>
                <div className="space-y-5 p-5">
                  <div className="flex items-center gap-4">
                    <div className="group relative">
                      <div className="size-16 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                        {profile?.avatar_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={profile.avatar_url} alt="" className="size-full object-cover" />
                          : <div className="flex size-full items-center justify-center text-[20px] font-semibold text-neutral-500">{userName[0]?.toUpperCase()}</div>}
                      </div>
                      <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar} aria-label={t('settings.change_avatar')}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                        {uploadingAvatar ? <Loader2 className="size-4 animate-spin text-white" /> : <Camera className="size-4 text-white" />}
                      </button>
                      <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">{userName}</p>
                      <p className="truncate text-[13px] text-neutral-500">{userEmail}</p>
                      <button onClick={() => avatarRef.current?.click()} className={cn(linkStyles, 'mt-1 text-[12px]')}>{t('settings.change_avatar')}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Label text={t('settings.full_name')}>
                      <Input value={profileForm.name} onChange={e => setProfileForm({ name: e.target.value })} autoComplete="name" className="h-10" />
                    </Label>
                    <Label text={t('settings.email')}>
                      <Input value={userEmail} disabled className="h-10" />
                    </Label>
                    {/* Limba se salvează imediat (în cont și în browser) */}
                    <Label text={t('common.language')} hint={t('settings.language_hint')}>
                      <Select value={locale} onChange={e => setLocale(e.target.value as Locale)} className="h-10">
                        {LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
                      </Select>
                    </Label>
                  </div>
                </div>
                <CardFooter>
                  <p className="text-[12px] text-neutral-500">{t('settings.profile_footer')}</p>
                  <Button variant="primary" loading={saving} onClick={handleSaveProfile}>{!saving && <Check />}{saving ? t('common.saving') : t('common.save')}</Button>
                </CardFooter>
              </Card>
            </Section>

            <Section title={t('settings.account_details')} description={t('settings.account_details_desc')}>
              <Card>
                <dl className="divide-y divide-neutral-100">
                  {[
                    { label: t('common.plan'), value: <Badge tone="brand">{planName}</Badge> },
                    { label: t('settings.credits_available'), value: <span className="font-semibold tabular-nums text-neutral-900">{fmtInt.format(credits)}</span> },
                    ...(memberSince ? [{ label: t('settings.member_since'), value: <span className="text-neutral-800">{memberSince}</span> }] : []),
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between gap-3 px-5 py-3.5 text-[13px]">
                      <dt className="text-neutral-500">{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Section>

            <Section title={<span className="text-red-600">{t('settings.danger_zone')}</span>} description={t('settings.danger_zone_desc')}>
              <Card className="border-red-200/80">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-neutral-900">{t('settings.delete_account')}</p>
                    <p className="mt-0.5 text-[13px] text-neutral-500">{t('settings.delete_account_desc')}</p>
                  </div>
                  <Button variant="danger" className="shrink-0"><Trash2 />{t('settings.delete_account')}</Button>
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ═══════ BRAND & AI ═══════ */}
        {tab === 'brand' && (
          <div>
            <Section title={t('settings.brand_identity')} description={t('settings.brand_identity_desc')}>
              <Card>
                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Label text={t('settings.business_name')}>
                      <Input value={brandForm.businessName} onChange={e => setBrandForm(p => ({ ...p, businessName: e.target.value }))} placeholder={t('settings.store_name_placeholder')} className="h-10" />
                    </Label>
                    <Label text={t('settings.website')}>
                      <Input value={brandForm.website} onChange={e => setBrandForm(p => ({ ...p, website: e.target.value }))} placeholder={t('onboarding.store_url_placeholder')} icon={<Globe />} className="h-10" />
                    </Label>
                  </div>
                  <Label text={t('settings.niche_label')} hint={t('settings.niche_help')}>
                    <Input value={brandForm.niche} onChange={e => setBrandForm(p => ({ ...p, niche: e.target.value }))} placeholder={t('settings.niche_placeholder')} className="h-10" />
                  </Label>
                  <div>
                    <p className="text-[13px] font-medium text-neutral-700">{t('settings.tone_label')}</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TONES.map(tone => (
                        <ChoiceCard key={tone.value} active={brandForm.tone === tone.value} onClick={() => setBrandForm(p => ({ ...p, tone: tone.value }))}
                          title={<span className="flex items-center gap-2"><tone.icon className="size-4 text-neutral-500" />{t(tone.label)}</span>} />
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 ring-1 ring-inset ring-neutral-200/60">
                      <p className="text-[12px] font-medium text-neutral-500">{t('settings.tone_preview_label')}</p>
                      <p className="mt-1 text-[13px] italic leading-relaxed text-neutral-700">{t(TONES.find(x => x.value === brandForm.tone)?.example ?? 'settings.tone_pro_example')}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-neutral-700">{t('settings.language_label')}</p>
                    <div className="mt-1.5">
                      <Segmented id="brand-language" value={brandForm.language} onChange={v => setBrandForm(p => ({ ...p, language: v }))}
                        items={[{ value: 'ro', label: t('settings.lang_ro') }, { value: 'en', label: t('settings.lang_en') }]} />
                    </div>
                  </div>
                </div>
                <CardFooter>
                  <span />
                  <Button variant="primary" loading={savingBrand} onClick={handleSaveBrand}>{!savingBrand && <Check />}{savingBrand ? t('common.saving') : t('common.save_brand')}</Button>
                </CardFooter>
              </Card>
            </Section>

            <Section title={t('settings.how_ai_influences')}>
              <Card>
                <ul className="space-y-3 p-5">
                  {t('settings.brand_affects_list').split(',').map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-700">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-neutral-400" />{item}
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          </div>
        )}

        {/* ═══════ INTEGRĂRI ═══════ */}
        {tab === 'integrations' && (
          <div>
            {stores.length > 0 && (
              <Section title={t('settings.section_stores')} description={t('settings.add_store_hint')}>
                {stores.map(s => {
                  const active = s.id === activeStoreId
                  const switcher = stores.length > 1 && (active
                    ? <Badge tone="brand"><Check className="size-3" />{t('settings.store_active')}</Badge>
                    : <Button size="xs" loading={switchingId === s.id} disabled={!!switchingId} onClick={() => handleUseStore(s)}>{t('settings.store_use')}</Button>)
                  return s.platform === 'edinio' ? (
                    <EdinioStoreCard key={s.id} store={s} header={switcher} onChanged={fetchStore}
                      onDisconnected={() => { fetchStore(); toast.success(t('settings.store_disconnected')) }} />
                  ) : (
                    <Card key={s.id}>
                      <CardHeader icon={s.platform === 'shopify' ? <Zap /> : <Store />} title={s.store_name || s.store_url.replace(/^https?:\/\//, '')}
                        description={s.platform === 'shopify' ? t('settings.shopify_active') : t('settings.woo_active')}
                        action={<>
                          {switcher}
                          {s.connection_status === 'revoked' || s.connection_status === 'error'
                            ? <Badge tone={s.connection_status === 'revoked' ? 'red' : 'amber'} dot>{s.connection_status === 'revoked' ? t('edinio.revoked') : t('catalog.store_unreachable')}</Badge>
                            : <Badge tone="green" dot>{t('settings.connected')}</Badge>}
                        </>} />
                      <div className="space-y-4 px-5 pb-5 pt-4">
                        {/* Ce a răspuns magazinul la ultima sincronizare, ca omul să știe ce să repare */}
                        {(s.connection_status === 'revoked' || s.connection_status === 'error') && s.last_error && <Callout tone="warning">{translateStored(t, s.last_error)}</Callout>}
                        <dl className="divide-y divide-neutral-100 rounded-xl ring-1 ring-inset ring-neutral-200/70">
                          {[
                            { icon: Globe, label: t('settings.store_url_label'), value: <a href={s.platform === 'shopify' ? `https://${s.store_url}` : s.store_url} target="_blank" rel="noopener" className="flex items-center gap-1 truncate text-neutral-700 hover:text-neutral-950">{s.store_url.replace(/^https?:\/\//, '')}<ExternalLink className="size-3 shrink-0" /></a> },
                            { icon: Package, label: t('settings.products_synced'), value: <span className="font-semibold tabular-nums text-neutral-900">{fmtInt.format(s.products_count)}</span> },
                            { icon: RefreshCw, label: t('settings.last_sync'), value: <span className="text-neutral-700">{s.last_sync_at ? new Date(s.last_sync_at).toLocaleString(intlLocale) : t('settings.never_synced')}</span> },
                            // Shopify: accesul e prin OAuth, nu prin chei API
                            ...(s.platform === 'shopify' ? [{ icon: KeyRound, label: t('settings.access_token'), value: <Badge tone="green">OAuth 2.0</Badge> }] : []),
                          ].map(row => (
                            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                              <dt className="flex shrink-0 items-center gap-2 text-neutral-500"><row.icon className="size-3.5 text-neutral-400" />{row.label}</dt>
                              <dd className="min-w-0 text-right">{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex flex-wrap gap-2">
                          <Button loading={syncingId === s.id} onClick={() => handleSync(s)}>{syncingId !== s.id && <RefreshCw />}{syncingId === s.id ? t('common.syncing') : t('products.sync')}</Button>
                          <Button variant="danger" loading={disconnectingId === s.id} onClick={() => handleDisconnect(s)}>{disconnectingId !== s.id && <Unplug />}{t('settings.disconnect_store')}</Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </Section>
            )}

            <Section title={stores.length ? t('settings.add_store_title') : t('settings.section_connect_store')} description={t('settings.section_add_store_desc')}>
              <EdinioConnectCard />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {/* WooCommerce: cheile REST, cu permisiunea de citire */}
                <Card className="flex flex-col">
                  <CardHeader icon={<Store />} title="WooCommerce" description={t('settings.woo_subtitle')} />
                  <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
                    {/* Nu e un formular de autentificare: managerul de parole nu are ce completa aici */}
                    <Label text={t('settings.store_url_label')}>
                      <Input value={storeForm.store_url} onChange={e => { setStoreForm(p => ({ ...p, store_url: e.target.value })); setConnTest(null) }}
                        placeholder={t('onboarding.store_url_placeholder')} name="woo_store_url" autoComplete="url" />
                    </Label>
                    <Label text={t('settings.consumer_key')}>
                      <div className="relative">
                        <Input type={showKeys ? 'text' : 'password'} value={storeForm.consumer_key} placeholder="ck_..." className="pr-10" name="woo_consumer_key" autoComplete="new-password"
                          onChange={e => { setStoreForm(p => ({ ...p, consumer_key: e.target.value })); setConnTest(null) }} />
                        <button type="button" onClick={() => setShowKeys(s => !s)} aria-label={t(showKeys ? 'settings.hide_password' : 'settings.show_password')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-700">
                          {showKeys ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </Label>
                    <Label text={t('settings.consumer_secret')}>
                      <Input type={showKeys ? 'text' : 'password'} value={storeForm.consumer_secret} placeholder="cs_..." name="woo_consumer_secret" autoComplete="new-password"
                        onChange={e => { setStoreForm(p => ({ ...p, consumer_secret: e.target.value })); setConnTest(null) }} />
                    </Label>
                    {connTest && <Callout tone={connTest.ok ? 'success' : 'danger'}>{connTest.msg}</Callout>}
                    <details className="group rounded-lg bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600 ring-1 ring-inset ring-neutral-200/60">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-neutral-700"><KeyRound className="size-3.5 text-neutral-400" />{t('settings.how_get_api_keys')}</summary>
                      <ol className="mt-2 space-y-1 leading-relaxed">
                        {t('settings.tutorial_wp_steps').split(',').map(step => <li key={step}>{step}</li>)}
                      </ol>
                    </details>
                    <div className="mt-auto flex gap-2 pt-1">
                      <Button loading={testingConn} onClick={handleTestConn}>{!testingConn && <Wifi />}{t('settings.test_btn')}</Button>
                      <Button variant="primary" loading={connecting} onClick={handleConnect} className="flex-1">{!connecting && <Plug />}{connecting ? t('common.connecting') : t('onboarding.connect_store')}</Button>
                    </div>
                  </div>
                </Card>

                {/* Shopify: aprobarea se face în Shopify (OAuth) */}
                <Card className="flex flex-col">
                  <CardHeader icon={<Zap />} title="Shopify" description={t('onboarding.shopify_subtitle')} />
                  <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
                    <p className="text-[13px] leading-relaxed text-neutral-500">{t('onboarding.shopify_desc')}</p>
                    <Label text={t('onboarding.shopify_url_label')}>
                      <Input value={shopifyUrl} onChange={e => setShopifyUrl(e.target.value)} placeholder={t('onboarding.shopify_url_placeholder')} />
                    </Label>
                    <Button variant="primary" loading={connectingShopify} onClick={handleConnectShopify} className="mt-auto w-full">
                      {!connectingShopify && <Zap />}{connectingShopify ? t('common.redirecting') : t('onboarding.shopify_connect')}
                    </Button>
                  </div>
                </Card>
              </div>
            </Section>

            <Section title={t('settings.section_google')} description={t('settings.section_google_desc')}>
              <GoogleAdsCard />
              <MerchantCard />
            </Section>
          </div>
        )}

        {/* ═══════ CREDITE ═══════ */}
        {tab === 'credits' && (
          <div>
            <Section title={t('settings.credits_available')} description={t('settings.section_balance_desc')}>
              <Card>
                <div className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-[36px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-neutral-950">{fmtInt.format(credits)}</p>
                    <p className="mt-2 text-[13px] text-neutral-500">{t('settings.plan_label')} <span className="font-medium text-neutral-900">{planName}</span></p>
                  </div>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-neutral-900 text-white"><Zap className="size-5" /></span>
                </div>
                <CardFooter>
                  <p className="text-[12px] text-neutral-500">{t('settings.credits_no_expire')}</p>
                  <Button onClick={handleManageSub}><CreditCard />{t('settings.manage_subscription')}</Button>
                </CardFooter>
              </Card>
            </Section>

            <Section title={t('settings.buy_extra_credits')} description={t('settings.credits_no_expire')}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PACK_IDS.map(id => (
                  <button key={id} onClick={() => handleBuyPack(id)} disabled={!!buyingPack}
                    className={cn('group relative rounded-xl border bg-white p-4 text-left shadow-card transition-all hover:border-neutral-400 hover:shadow-raised disabled:opacity-50',
                      id === POPULAR_PACK ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200/80')}>
                    {id === POPULAR_PACK && <Badge tone="brand" className="absolute -top-2.5 left-3 h-5 text-[10px]">{t('settings.popular')}</Badge>}
                    <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">{fmtInt.format(PACKS[id].credits)} <span className="text-[13px] font-normal text-neutral-500">{t('common.credits_short')}</span></p>
                    <p className="mt-1 text-[14px] font-medium tabular-nums text-neutral-800">${PACKS[id].priceUsd}</p>
                    <p className="mt-1 text-[12px] tabular-nums text-neutral-400">${perCreditUsd(id).toFixed(2)} / {t('credits.per_credit')}</p>
                    {buyingPack === id && <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70"><Loader2 className="size-5 animate-spin text-neutral-500" /></span>}
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('settings.transaction_history')} description={t('settings.section_history_desc')}>
              <Card>
                {transactions.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[13px] text-neutral-400">{t('settings.no_transactions')}</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {transactions.slice(0, 15).map(tx => (
                      <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500')}>
                          {tx.amount > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-neutral-800">{translateStored(t, tx.description)}</p>
                          <p className="text-[12px] text-neutral-400">{new Date(tx.created_at).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('text-[13px] font-semibold tabular-nums', tx.amount > 0 ? 'text-emerald-600' : 'text-neutral-800')}>{tx.amount > 0 ? '+' : ''}{tx.amount}</p>
                          <p className="text-[11px] text-neutral-400">{t('settings.balance_label')} {tx.balance_after}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Section>

            <Section title={t('settings.available_plans')} description={t('settings.ai_action_costs_desc', { cost: '2–4' })}>
              <Card>
                <ul className="divide-y divide-neutral-100">
                  {PLAN_IDS.map(id => (
                    <li key={id} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
                      <span className="flex items-center gap-2 font-medium text-neutral-900">{t(`credits.plan_${id}`)}{userPlan === id && <Badge tone="brand">{t('settings.store_active')}</Badge>}</span>
                      <span className="tabular-nums text-neutral-500">{fmtInt.format(PAID_PLANS[id].credits)} {t('common.credits_short')} · ${PAID_PLANS[id].priceUsd}{t('credits.per_month_label')}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          </div>
        )}

        {/* ═══════ SECURITATE ═══════ */}
        {tab === 'security' && (
          <div>
            <Section title={t('settings.change_password')} description={t('settings.update_pw_desc')}>
              <Card>
                <div className="space-y-4 p-5">
                  <Label text={t('settings.current_pw_label')}>
                    <PasswordInput value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} placeholder="••••••••" autoComplete="current-password" />
                  </Label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label text={t('settings.new_pw_label')}>
                        <PasswordInput value={pwForm.new} onChange={v => setPwForm(p => ({ ...p, new: v }))} placeholder={t('settings.pw_min_placeholder')} autoComplete="new-password" />
                      </Label>
                      {pwForm.new && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">{[1, 2, 3, 4].map(i => <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= pw.score ? pw.color : 'bg-neutral-100')} />)}</div>
                          <p className="text-[12px] font-medium text-neutral-500">{pw.label}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label text={t('settings.confirm_pw_label')}>
                        <PasswordInput value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} placeholder={t('settings.pw_repeat_placeholder')} autoComplete="new-password" />
                      </Label>
                      {pwForm.confirm && pwForm.new && (
                        <p className={cn('mt-2 flex items-center gap-1 text-[12px] font-medium', pwForm.new === pwForm.confirm ? 'text-emerald-600' : 'text-red-600')}>
                          {pwForm.new === pwForm.confirm ? <><Check className="size-3.5" />{t('settings.pw_match')}</> : <><X className="size-3.5" />{t('settings.pw_no_match')}</>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <CardFooter>
                  <p className="text-[12px] text-neutral-500">{t('settings.pw_footer')}</p>
                  <Button variant="primary" loading={savingPw} onClick={handleChangePw}>{!savingPw && <Lock />}{savingPw ? t('settings.updating_pw') : t('settings.update_pw_btn')}</Button>
                </CardFooter>
              </Card>
            </Section>

            <Section title={t('settings.active_sessions')} description={t('settings.security_desc')}>
              <Card>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" /></span>
                    <div>
                      <p className="text-[13px] font-medium text-neutral-900">{t('settings.current_session')}</p>
                      <p className="text-[12px] text-neutral-500">{t('settings.active_now_browser')}</p>
                    </div>
                  </div>
                  <Badge tone="green">{t('settings.active_badge')}</Badge>
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ═══════ PREFERINȚE ═══════ */}
        {tab === 'preferences' && (
          <div>
            <Section title={t('settings.notif_automations')} description={t('settings.auto_optimize_warning')}>
              <Card>
                <ul className="divide-y divide-neutral-100">
                  {[
                    { key: 'emailNotifications' as const, icon: Mail, title: t('settings.pref_email_notifs'), desc: t('settings.pref_email_desc') },
                    { key: 'weeklyReport' as const, icon: Bell, title: t('settings.pref_weekly_report'), desc: t('settings.pref_weekly_desc') },
                    { key: 'autoOptimize' as const, icon: Sparkles, title: t('settings.pref_auto_optimize'), desc: t('settings.pref_auto_desc') },
                  ].map(pref => (
                    <li key={pref.key} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500 ring-1 ring-inset ring-neutral-200/70"><pref.icon className="size-4" /></span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-neutral-900">{pref.title}</p>
                          <p className="text-[12px] leading-relaxed text-neutral-500">{pref.desc}</p>
                        </div>
                      </div>
                      <Switch checked={prefs[pref.key]} label={pref.title} onChange={v => setPrefs(p => ({ ...p, [pref.key]: v }))} />
                    </li>
                  ))}
                </ul>
                <CardFooter>
                  <span />
                  <Button variant="primary" loading={savingPrefs} onClick={handleSavePrefs}>{!savingPrefs && <Check />}{savingPrefs ? t('settings.saving_prefs') : t('settings.save_prefs_btn')}</Button>
                </CardFooter>
              </Card>
            </Section>
          </div>
        )}
      </FadeIn>
    </div>
  )
}

// useSearchParams cere o graniță Suspense la randarea statică
export default function SettingsPage() {
  return <Suspense fallback={null}><SettingsView /></Suspense>
}
