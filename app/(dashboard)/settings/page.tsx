'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Plug, Shield, SlidersHorizontal, Store,
  Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2,
  ExternalLink, Eye, EyeOff, Save, Globe, Lock, Key,
  Mail, Camera, Unplug, Package, Sparkles, CreditCard,
  TrendingDown, TrendingUp, Zap, ArrowRight,
  CheckCircle2, XCircle, Wifi, Download, Bot, RefreshCcw,
  Bell, ChevronRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreData = {
  id: string; store_url: string; store_name: string
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

// ─── Config ───────────────────────────────────────────────────────────────────

const CREDIT_PACKS = [
  { id: 'pack_50',   credits: 50,   price: 39,  popular: false },
  { id: 'pack_100',  credits: 100,  price: 69,  popular: false },
  { id: 'pack_300',  credits: 300,  price: 159, popular: true  },
  { id: 'pack_500',  credits: 500,  price: 249, popular: false },
  { id: 'pack_1000', credits: 1000, price: 399, popular: false },
]

const PLANS = [
  { id: 'starter',      name: 'Starter',      price: 99,  credits: 250  },
  { id: 'professional', name: 'Professional', price: 249, credits: 750  },
  { id: 'enterprise',   name: 'Enterprise',   price: 499, credits: 2000 },
]

const getTabs = (t: (k: string) => string) => [
  { value: 'general',      label: 'General',    icon: User },
  { value: 'brand',        label: t('settings.brand_ai'), icon: Sparkles },
  { value: 'integrations', label: t('settings.tab_integrations'),  icon: Plug },
  { value: 'credits',      label: t('common.credits_label'),    icon: CreditCard },
  { value: 'security',     label: t('settings.security'), icon: Shield },
  { value: 'preferences',  label: t('settings.tab_preferences'), icon: SlidersHorizontal },
  { value: 'plugin',       label: 'Plugin WP',  icon: Download },
]

const getPwStrength = (t: (k: string) => string) => (p: string) => {
  if (!p) return { score: 0, label: '', color: '' }
  let s = 0
  if (p.length >= 8)           s++
  if (p.length >= 12)          s++
  if (/[A-Z]/.test(p))         s++
  if (/[0-9]/.test(p))         s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  if (s <= 1) return { score: s, label: t('settings.pw_weak'),    color: 'bg-red-400' }
  if (s <= 2) return { score: s, label: t('settings.pw_fair'),    color: 'bg-amber-400' }
  if (s <= 3) return { score: s, label: t('settings.pw_good'),     color: 'bg-neutral-400' }
  return              { score: s, label: t('settings.pw_strong'), color: 'bg-emerald-500' }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${value ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, placeholder, disabled, type = 'text', className = '' }: {
  value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; disabled?: boolean; type?: string; className?: string
}) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} type={type}
      className={`w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-300
        focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400 transition-all ${className}`} />
  )
}

function Btn({ onClick, disabled, children, variant = 'primary', type = 'button', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'danger'; type?: 'button' | 'submit'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50'
  const variants = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    danger:  'border border-red-200 text-red-600 hover:bg-red-50',
  }
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Toast({ type, text, onClose }: { type: string; text: string; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] ${type === 'success' ? 'bg-neutral-900 text-white' : 'bg-red-50 border border-red-100 text-red-700'}`}>
      {type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span>{text}</span>
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 text-[12px]">✕</button>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useT()
  const TABS = getTabs(t)
  const pwStrength = getPwStrength(t)
  const { data: session } = useSession()
  const [tab, setTab]             = useState('general')
  const [store, setStore]         = useState<StoreData | null>(null)
  const [profile, setProfile]     = useState<UserProfile | null>(null)
  const [loading, setLoading]     = useState(true)
  const [msg, setMsg]             = useState({ type: '', text: '' })
  const avatarRef                 = useRef<HTMLInputElement>(null)

  const [connecting, setConnecting]       = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [savingBrand, setSavingBrand]     = useState(false)
  const [savingPw, setSavingPw]           = useState(false)
  const [savingPrefs, setSavingPrefs]     = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [testingConn, setTestingConn]     = useState(false)
  const [connTest, setConnTest]           = useState<{ ok: boolean; msg: string } | null>(null)
  const [buyingPack, setBuyingPack]       = useState<string | null>(null)
  const [showKeys, setShowKeys]           = useState(false)
  const [downloadingPlugin, setDownloadingPlugin] = useState(false)

  const [credits, setCredits]           = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [storeForm, setStoreForm]     = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [brandForm, setBrandForm]     = useState({ businessName: '', website: '', tone: 'professional', language: 'ro', niche: '' })
  const [pwForm, setPwForm]           = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw]           = useState({ current: false, new: false, confirm: false })
  const [prefs, setPrefs]             = useState({ emailNotifications: true, weeklyReport: true, autoOptimize: false })

  useEffect(() => { fetchProfile(); fetchStore(); fetchCredits() }, [])

  const toast = (type: string, text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 5000)
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
    try { const r = await fetch('/api/stores'); const d = await r.json(); if (d.store) setStore(d.store) } catch {}
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
      if (!r.ok) { toast('error', d.error || 'Eroare la încărcare'); return }
      setProfile(p => p ? { ...p, avatar_url: d.avatar_url } : p); toast('success', 'Avatar actualizat!')
    } catch { toast('error', 'Eroare la încărcarea avatarului') }
    finally { setUploadingAvatar(false); if (avatarRef.current) avatarRef.current.value = '' }
  }

  async function handleSaveProfile() {
    if (!profileForm.name.trim()) { toast('error', 'Numele nu poate fi gol'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileForm.name.trim() }) })
      const d = await r.json()
      if (!r.ok) { toast('error', d.error || 'Eroare la salvare'); return }
      setProfile(p => p ? { ...p, name: d.user.name } : p); toast('success', 'Profil salvat!')
    } catch { toast('error', 'Eroare la salvare') } finally { setSaving(false) }
  }

  async function handleSaveBrand() {
    setSavingBrand(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_name: brandForm.businessName.trim(), website: brandForm.website.trim(), brand_tone: brandForm.tone, brand_language: brandForm.language, niche: brandForm.niche.trim() }) })
      const d = await r.json()
      if (!r.ok) { toast('error', d.error || 'Eroare la salvare'); return }
      toast('success', 'Setări brand salvate!')
    } catch { toast('error', 'Eroare la salvare') } finally { setSavingBrand(false) }
  }

  async function handleChangePw() {
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) { toast('error', 'Completează toate câmpurile'); return }
    if (pwForm.new.length < 6) { toast('error', 'Parola trebuie să aibă minim 6 caractere'); return }
    if (pwForm.new !== pwForm.confirm) { toast('error', 'Parolele nu se potrivesc'); return }
    setSavingPw(true)
    try {
      const r = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }) })
      const d = await r.json()
      if (!r.ok) { toast('error', d.error || 'Eroare'); return }
      toast('success', 'Parola schimbată!'); setPwForm({ current: '', new: '', confirm: '' })
    } catch { toast('error', 'Eroare de rețea') } finally { setSavingPw(false) }
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    try {
      const r = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: prefs }) })
      const d = await r.json()
      if (!r.ok) { toast('error', d.error); return }
      toast('success', 'Preferințe salvate!')
    } catch { toast('error', 'Eroare la salvare') } finally { setSavingPrefs(false) }
  }

  async function handleTestConn() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) { setConnTest({ ok: false, msg: 'Completează toate câmpurile' }); return }
    setTestingConn(true); setConnTest(null)
    try {
      const url = storeForm.store_url.replace(/\/$/, '')
      const r = await fetch(`${url}/wp-json/wc/v3/products?per_page=1&consumer_key=${storeForm.consumer_key}&consumer_secret=${storeForm.consumer_secret}`)
      setConnTest(r.ok ? { ok: true, msg: 'Conexiune reușită! Magazinul este accesibil.' } : { ok: false, msg: `Eroare ${r.status} — verifică URL-ul și cheile API` })
    } catch { setConnTest({ ok: false, msg: 'Nu se poate conecta — verifică URL-ul și dacă site-ul e online' }) }
    finally { setTestingConn(false) }
  }

  async function handleConnect() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) { toast('error', 'Completează toate câmpurile'); return }
    setConnecting(true)
    try {
      const r = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeForm) })
      const d = await r.json()
      if (!r.ok) { toast('error', d.error); return }
      toast('success', 'Magazin conectat!'); setStore(d.store); setStoreForm({ store_url: '', consumer_key: '', consumer_secret: '' }); setConnTest(null)
    } catch { toast('error', 'Eroare la conectare') } finally { setConnecting(false) }
  }

  async function handleSync() {
    if (!store) return; setSyncing(true)
    try {
      const r = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' }); const d = await r.json()
      if (!r.ok) { toast('error', d.error); return }
      toast('success', `Sincronizare completă! ${d.synced} produse.`); fetchStore()
    } catch { toast('error', 'Eroare la sincronizare') } finally { setSyncing(false) }
  }

  async function handleDisconnect() {
    if (!store || !confirm(t('settings.disconnect_confirm'))) return
    setDisconnecting(true)
    try { await fetch(`/api/stores/${store.id}`, { method: 'DELETE' }); setStore(null); toast('success', 'Magazin deconectat.') }
    catch { toast('error', 'Eroare la deconectare') } finally { setDisconnecting(false) }
  }

  async function handleBuyPack(packId: string) {
    setBuyingPack(packId)
    try {
      const r = await fetch('/api/stripe/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: packId }) })
      const d = await r.json()
      if (r.ok && d.url) window.location.href = d.url
      else toast('error', d.error || 'Eroare la procesare')
    } catch { toast('error', 'Eroare de rețea') } finally { setBuyingPack(null) }
  }

  async function handleManageSub() {
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' }); const d = await r.json()
      if (r.ok && d.url) window.location.href = d.url
      else toast('error', d.error || 'Eroare la accesarea portalului')
    } catch { toast('error', 'Eroare de rețea') }
  }

  async function handleDownloadPlugin() {
    setDownloadingPlugin(true)
    try {
      const r = await fetch('/api/plugin/download', { credentials: 'include' })
      if (!r.ok) { toast('error', 'Eroare la generarea pluginului'); return }
      const blob = await r.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'hontrio.zip'; a.click(); URL.revokeObjectURL(url)
    } catch { toast('error', 'Eroare la descărcare') } finally { setDownloadingPlugin(false) }
  }

  const userName   = profile?.name || session?.user?.name || 'Utilizator'
  const userEmail  = profile?.email || session?.user?.email || ''
  const userPlan   = profile?.plan || (session?.user as any)?.plan || 'free'
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' }) : ''
  const pw         = pwStrength(pwForm.new)

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-neutral-100 rounded-xl animate-pulse" />
      <div className="h-64 bg-neutral-50 rounded-xl animate-pulse" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('settings.title')}</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">Administrează contul, brandul și integrările</p>
      </div>

      <AnimatePresence>
        {msg.text && <Toast type={msg.type} text={msg.text} onClose={() => setMsg({ type: '', text: '' })} />}
      </AnimatePresence>

      {/* Tab nav */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap shrink-0
                ${tab === t.value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />{t.label}
            </button>
          )
        })}
      </div>

      {/* ═══════ GENERAL ═══════ */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-4">Informații profil</p>
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative group">
                  <div className="h-14 w-14 rounded-xl bg-neutral-200 overflow-hidden">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center text-xl font-semibold text-neutral-500">{userName[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
                  </button>
                  <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-neutral-900">{userName}</p>
                  <p className="text-[12px] text-neutral-400">{userEmail}</p>
                  <button onClick={() => avatarRef.current?.click()} className="text-[11px] text-neutral-500 hover:text-neutral-800 mt-1 underline underline-offset-2">
                    {t('settings.change_avatar')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Field label={t('settings.full_name')}>
                  <Inp value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} />
                </Field>
                <Field label={t('settings.email')}>
                  <Inp value={userEmail} disabled />
                </Field>
              </div>

              <Btn onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? t('common.saving') : t('common.save')}
              </Btn>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">Detalii cont</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-500">{t('common.plan')}</span>
                  <span className="text-[12px] font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md capitalize">{userPlan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-500">{t('settings.credits_billing')}</span>
                  <span className="text-[13px] font-semibold text-neutral-900">{credits}</span>
                </div>
                {memberSince && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-neutral-500">Membru din</span>
                    <span className="text-[13px] text-neutral-700">{memberSince}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[11px] font-medium text-red-500 uppercase tracking-wide mb-2">Zonă periculoasă</p>
              <p className="text-[12px] text-neutral-400 mb-3">Acțiunile de mai jos sunt permanente și nu pot fi anulate.</p>
              <Btn variant="danger" className="w-full justify-center">
                <Trash2 className="h-3.5 w-3.5" />Șterge contul
              </Btn>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ BRAND & AI ═══════ */}
      {tab === 'brand' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-neutral-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">Identitate brand</p>
                  <p className="text-[11px] text-neutral-400">AI-ul va folosi aceste setări la generarea oricărui conținut</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('settings.business_name')}>
                    <Inp value={brandForm.businessName} onChange={e => setBrandForm(p => ({ ...p, businessName: e.target.value }))} placeholder={t('settings.store_name_placeholder')} />
                  </Field>
                  <Field label="Website">
                    <Inp value={brandForm.website} onChange={e => setBrandForm(p => ({ ...p, website: e.target.value }))} placeholder="https://magazin.ro" />
                  </Field>
                </div>

                <Field label={t('settings.niche_label')}>
                  <Inp value={brandForm.niche} onChange={e => setBrandForm(p => ({ ...p, niche: e.target.value }))} placeholder="ex: Fashion feminin, Electronice, Cosmetice..." />
                  <p className="text-[11px] text-neutral-400 mt-1">Ajută AI-ul să folosească terminologia corectă</p>
                </Field>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">Ton comunicare</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: 'professional', label: 'Profesional', emoji: '👔' },
                      { value: 'friendly',     label: t('settings.tone_friendly_label'),   emoji: '😊' },
                      { value: 'luxury',       label: t('settings.tone_premium_label'),     emoji: '💎' },
                      { value: 'casual',       label: 'Casual',      emoji: '✌️' },
                    ].map(t => (
                      <button key={t.value} onClick={() => setBrandForm(p => ({ ...p, tone: t.value }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all
                          ${brandForm.tone === t.value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-200'}`}>
                        <div className="text-base mb-1">{t.emoji}</div>
                        <p className="text-[12px] font-medium text-neutral-900">{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">Limbă conținut</label>
                  <div className="flex gap-2">
                    {[{ value: 'ro', label: t('settings.lang_ro') }, { value: 'en', label: t('settings.lang_en') }].map(l => (
                      <button key={l.value} onClick={() => setBrandForm(p => ({ ...p, language: l.value }))}
                        className={`h-9 px-4 rounded-xl border-2 text-[13px] font-medium transition-all
                          ${brandForm.language === l.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Btn onClick={handleSaveBrand} disabled={savingBrand}>
                  {savingBrand ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {savingBrand ? t('common.saving') : t('common.save_brand')}
                </Btn>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">Preview ton selectat</p>
              <p className="text-[13px] text-neutral-600 leading-relaxed italic">
                {brandForm.tone === 'professional' && t('settings.tone_pro_example')}
                {brandForm.tone === 'friendly'     && '"Exact ce ai nevoie! Super simplu de folosit — vei adora rezultatele."'}
                {brandForm.tone === 'luxury'       && t('settings.tone_luxury_example')}
                {brandForm.tone === 'casual'       && t('settings.tone_casual_example')}
              </p>
            </Card>

            <Card className="p-5 bg-neutral-50">
              <p className="text-[12px] font-semibold text-neutral-700 mb-2">Cum influențează AI-ul</p>
              <div className="space-y-2 text-[12px] text-neutral-500">
                {['Titlurile și descrierile reflectă tonul ales', 'Terminologie și keywords din nișa ta', 'Tot conținutul generat în limba aleasă', 'AI-ul poate referenția brandul natural'].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ INTEGRĂRI ═══════ */}
      {tab === 'integrations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {store ? (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <Store className="h-4 w-4 text-neutral-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-neutral-900">{t('settings.store_connected')}</p>
                    <p className="text-[11px] text-neutral-400">WooCommerce activ</p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Conectat
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {[
                    { icon: Globe,     label: t('settings.store_url_label'),          value: <a href={store.store_url} target="_blank" rel="noopener" className="text-[13px] text-neutral-600 flex items-center gap-1 hover:text-neutral-900">{store.store_url.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3" /></a> },
                    { icon: Package,   label: t('settings.products_synced'), value: <span className="text-[13px] font-semibold text-neutral-900">{store.products_count}</span> },
                    { icon: RefreshCw, label: t('settings.last_sync'),  value: <span className="text-[13px] text-neutral-600">{store.last_sync_at ? new Date(store.last_sync_at).toLocaleString('ro-RO') : 'Niciodată'}</span> },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <row.icon className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="text-[13px] text-neutral-500">{row.label}</span>
                      </div>
                      {row.value}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Btn onClick={handleSync} disabled={syncing}>
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {syncing ? t('common.syncing') : t('products.sync')}
                  </Btn>
                  <Btn variant="danger" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                    {t('settings.disconnect_store')}
                  </Btn>
                </div>
              </Card>
            ) : (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center">
                    <Plug className="h-4 w-4 text-neutral-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-neutral-900">{t('settings.connect_store_label')}</p>
                    <p className="text-[11px] text-neutral-400">Introdu datele WooCommerce</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Field label={t('settings.store_url_label')}>
                    <Inp value={storeForm.store_url} onChange={e => { setStoreForm(p => ({ ...p, store_url: e.target.value })); setConnTest(null) }} placeholder="https://magazin.ro" />
                  </Field>

                  <Field label="Consumer Key">
                    <div className="relative">
                      <Inp type={showKeys ? 'text' : 'password'} value={storeForm.consumer_key}
                        onChange={e => { setStoreForm(p => ({ ...p, consumer_key: e.target.value })); setConnTest(null) }}
                        placeholder="ck_..." className="pr-10" />
                      <button onClick={() => setShowKeys(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                        {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Consumer Secret">
                    <Inp type={showKeys ? 'text' : 'password'} value={storeForm.consumer_secret}
                      onChange={e => { setStoreForm(p => ({ ...p, consumer_secret: e.target.value })); setConnTest(null) }}
                      placeholder="cs_..." />
                  </Field>

                  <AnimatePresence>
                    {connTest && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] ${connTest.ok ? 'bg-neutral-900 text-white' : 'bg-red-50 border border-red-100 text-red-600'}`}>
                        {connTest.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                        {connTest.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2">
                    <Btn variant="outline" onClick={handleTestConn} disabled={testingConn}>
                      {testingConn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                      {t('settings.test_btn')}
                    </Btn>
                    <Btn onClick={handleConnect} disabled={connecting} className="flex-1 justify-center">
                      {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                      {connecting ? t('common.connecting') : t('onboarding.connect_store')}
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <div>
            <Card className="p-5 bg-neutral-50">
              <div className="flex items-center gap-2 mb-3">
                <Key className="h-3.5 w-3.5 text-neutral-500" />
                <p className="text-[12px] font-semibold text-neutral-700">Cum obțin cheile API?</p>
              </div>
              <div className="space-y-1.5 text-[12px] text-neutral-500 leading-relaxed">
                {t('settings.tutorial_wp_steps').split(',').map((s: string, i: number) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ CREDITE ═══════ */}
      {tab === 'credits' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">

            {/* Balance */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">Credite disponibile</p>
                  <p className="text-4xl font-bold text-neutral-900 tabular-nums">{credits}</p>
                  <p className="text-[12px] text-neutral-400 mt-1">Plan: <span className="text-neutral-700 font-medium capitalize">{userPlan}</span></p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-neutral-100 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-neutral-400" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <Btn variant="outline" onClick={handleManageSub}>
                  <CreditCard className="h-3.5 w-3.5" />Gestionează abonament
                </Btn>
              </div>
            </Card>

            {/* Packs */}
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-neutral-900 mb-0.5">Cumpără credite extra</p>
              <p className="text-[12px] text-neutral-400 mb-4">Creditele nu expiră și se adaugă la balanța curentă</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CREDIT_PACKS.map(pack => (
                  <button key={pack.id} onClick={() => handleBuyPack(pack.id)} disabled={!!buyingPack}
                    className={`relative p-3.5 rounded-xl border-2 text-left transition-all hover:border-neutral-400 hover:shadow-sm disabled:opacity-50
                      ${pack.popular ? 'border-neutral-900' : 'border-neutral-200'}`}>
                    {pack.popular && (
                      <span className="absolute -top-2.5 left-3 text-[9px] font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-full">Popular</span>
                    )}
                    <p className="text-[16px] font-bold text-neutral-900">{pack.credits} <span className="text-[13px] font-normal text-neutral-400">cr.</span></p>
                    <p className="text-[13px] font-semibold text-neutral-700 mt-0.5">{pack.price} RON</p>
                    <p className="text-[10px] text-neutral-400 mt-1">{(pack.price / pack.credits * 100).toFixed(0)} bani/credit</p>
                    {buyingPack === pack.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                        <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            {/* Transactions */}
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-neutral-900 mb-4">Istoric tranzacții</p>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
                  <p className="text-[13px] text-neutral-400">Nicio tranzacție încă</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {transactions.slice(0, 15).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-emerald-50' : 'bg-neutral-100'}`}>
                        {tx.amount > 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-neutral-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-neutral-700 truncate">{tx.description}</p>
                        <p className="text-[11px] text-neutral-400">{new Date(tx.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[13px] font-semibold tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-neutral-700'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </p>
                        <p className="text-[10px] text-neutral-400">sold: {tx.balance_after}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">Cost acțiuni AI</p>
              <div className="space-y-2">
                {[
                  { label: 'Generare text complet', cost: '5', icon: '📝' },
                  { label: 'SEO complet produs',    cost: '5', icon: '🔍' },
                  { label: 'Regenerare secțiune',   cost: '1–2', icon: '✏️' },
                  { label: 'Generare imagine AI',   cost: '2–4', icon: '🖼️' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-[13px] text-neutral-600 flex items-center gap-2"><span>{item.icon}</span>{item.label}</span>
                    <span className="text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md tabular-nums">{item.cost} cr.</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-neutral-50">
              <p className="text-[12px] font-semibold text-neutral-700 mb-2">Planuri disponibile</p>
              <div className="space-y-1.5">
                {PLANS.map(plan => (
                  <div key={plan.id} className={`flex items-center justify-between text-[12px] px-2 py-1.5 rounded-lg
                    ${userPlan === plan.id ? 'bg-neutral-900 text-white' : 'text-neutral-500'}`}>
                    <span className="font-medium">{plan.name}</span>
                    <span className="tabular-nums">{plan.credits} cr. / {plan.price} RON</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ SECURITATE ═══════ */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-neutral-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">{t('settings.change_password')}</p>
                  <p className="text-[11px] text-neutral-400">Actualizează parola contului tău</p>
                </div>
              </div>

              <div className="space-y-4">
                <Field label="Parola curentă">
                  <div className="relative">
                    <Inp type={showPw.current ? 'text' : 'password'} value={pwForm.current}
                      onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" className="pr-10" />
                    <button onClick={() => setShowPw(p => ({ ...p, current: !p.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                      {showPw.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Parola nouă">
                    <div className="relative">
                      <Inp type={showPw.new ? 'text' : 'password'} value={pwForm.new}
                        onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))} placeholder="Minim 6 caractere" className="pr-10" />
                      <button onClick={() => setShowPw(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                        {showPw.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwForm.new && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex gap-1">
                          {[1,2,3,4].map(i => <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= pw.score ? pw.color : 'bg-neutral-100'}`} />)}
                        </div>
                        <p className={`text-[10px] font-medium ${pw.score <= 1 ? 'text-red-500' : pw.score <= 2 ? 'text-amber-500' : pw.score <= 3 ? 'text-neutral-500' : 'text-emerald-600'}`}>{pw.label}</p>
                      </div>
                    )}
                  </Field>

                  <Field label="Confirmă parola">
                    <div className="relative">
                      <Inp type={showPw.confirm ? 'text' : 'password'} value={pwForm.confirm}
                        onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Repetă parola" className="pr-10" />
                      <button onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                        {showPw.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwForm.confirm && pwForm.new && (
                      <p className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${pwForm.new === pwForm.confirm ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pwForm.new === pwForm.confirm
                          ? <><CheckCircle2 className="h-3 w-3" />Se potrivesc</>
                          : <><XCircle className="h-3 w-3" />Nu se potrivesc</>}
                      </p>
                    )}
                  </Field>
                </div>

                <Btn onClick={handleChangePw} disabled={savingPw}>
                  {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  {savingPw ? 'Se actualizează...' : 'Actualizează parola'}
                </Btn>
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">Sesiuni active</p>
              <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-[13px] font-medium text-neutral-900">Sesiunea curentă</p>
                    <p className="text-[11px] text-neutral-400">Activ acum — browser web</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Activ</span>
              </div>
            </Card>
          </div>

          <div>
            <Card className="p-5 bg-neutral-50">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-3.5 w-3.5 text-neutral-500" />
                <p className="text-[12px] font-semibold text-neutral-700">Securitate cont</p>
              </div>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                Contul tău este protejat cu criptare. Cheile API ale magazinului sunt stocate securizat. Recomandăm o parolă puternică cu litere mari, cifre și simboluri.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ PREFERINȚE ═══════ */}
      {tab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-4">Notificări & Automatizări</p>
              <div className="space-y-3">
                {[
                  { key: 'emailNotifications', icon: Mail,     title: t('settings.pref_email_notifs'), desc: t('settings.pref_email_desc') },
                  { key: 'weeklyReport',        icon: Bell,     title: t('settings.pref_weekly_report'), desc: t('settings.pref_weekly_desc') },
                  { key: 'autoOptimize',        icon: Sparkles, title: t('settings.pref_auto_optimize'), desc: t('settings.pref_auto_desc') },
                ].map(pref => (
                  <div key={pref.key} className="flex items-center justify-between px-4 py-3.5 bg-neutral-50 rounded-xl gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                        <pref.icon className="h-4 w-4 text-neutral-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-neutral-900">{pref.title}</p>
                        <p className="text-[11px] text-neutral-400 leading-relaxed">{pref.desc}</p>
                      </div>
                    </div>
                    <Toggle value={prefs[pref.key as keyof typeof prefs]} onChange={() => setPrefs(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof p] }))} />
                  </div>
                ))}
              </div>
            </Card>

            <Btn onClick={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {savingPrefs ? t('settings.saving_prefs') : t('settings.save_prefs_btn')}
            </Btn>
          </div>

          <div>
            <Card className="p-5 bg-neutral-50">
              <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500" />
                <p className="text-[12px] font-semibold text-neutral-700">Despre preferințe</p>
              </div>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                Optimizarea automată va folosi credite la fiecare sincronizare. Asigură-te că ai credite suficiente dacă activezi această opțiune.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ PLUGIN WP ═══════ */}
      {tab === 'plugin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-neutral-900 flex items-center justify-center">
                  <Download className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-neutral-900">Plugin Hontrio pentru WordPress</p>
                  <p className="text-[12px] text-neutral-400">Un singur plugin — AI Agent + Risk Shield</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {[
                  { icon: Bot,        title: 'AI Agent',        desc: 'Widget conversațional injectat automat în frontend' },
                  { icon: Shield,     title: 'Risk Shield',     desc: 'Webhooks order.created + order.updated înregistrate automat' },
                  { icon: RefreshCcw, title: 'Auto-update',     desc: 'Butonul „Actualizează" apare direct în WordPress → Plugins' },
                  { icon: Zap,        title: 'Instalare 1-click', desc: 'Upload ZIP, activează, gata — fără configurare manuală' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                    <div className="h-8 w-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-neutral-900">{item.title}</p>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Btn onClick={handleDownloadPlugin} disabled={downloadingPlugin || !store} className="h-10 px-6">
                {downloadingPlugin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloadingPlugin ? 'Se generează...' : 'Descarcă hontrio.zip'}
              </Btn>
              {!store && (
                <p className="text-[12px] text-amber-600 mt-2">⚠️ Conectează mai întâi un magazin din tab-ul Integrări</p>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-[13px] font-semibold text-neutral-900 mb-4">Cum instalezi pluginul</p>
              <div className="space-y-3">
                {[
                  'Descarcă fișierul hontrio.zip de mai sus',
                  'WordPress Admin → Plugins → Adaugă nou → Încarcă plugin',
                  'Selectează hontrio.zip și apasă „Instalează acum"',
                  'Activează pluginul — webhooks și widget-ul se configurează automat',
                  'Viitoarele actualizări apar direct în WordPress → Plugins',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="h-5 w-5 rounded-full bg-neutral-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-[13px] text-neutral-600">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5 bg-neutral-50">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCcw className="h-3.5 w-3.5 text-neutral-500" />
                <p className="text-[12px] font-semibold text-neutral-700">Cum funcționează auto-update</p>
              </div>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                WordPress verifică zilnic dacă există o versiune nouă. Când lansăm o actualizare, apare butonul <strong className="text-neutral-700">„Actualizează"</strong> în Plugins — exact ca orice alt plugin. Nu trebuie să descarci manual niciodată din nou.
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-[12px] font-semibold text-neutral-700 mb-3">Ce se configurează automat</p>
              <div className="space-y-2">
                {['User ID și Store ID embedduite', 'Webhook secret unic per magazin', 'Webhook URL setat la hontrio.com', 'Culoare și poziție widget AI Agent', 'Pagină admin Hontrio în WordPress'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-neutral-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />{item}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}