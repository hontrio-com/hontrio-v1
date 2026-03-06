'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Palette, Plug, Shield, SlidersHorizontal, Store,
  Loader2, CheckCircle, AlertCircle, RefreshCw, Trash2,
  ExternalLink, Eye, EyeOff, Save, Globe, Bell, Lock, Key,
  Mail, Camera, Unplug, Package, Sparkles, CreditCard,
  TrendingDown, TrendingUp, Zap, ArrowRight, ShoppingBag,
  CheckCircle2, XCircle, Wifi, WifiOff, Download, Bot, RefreshCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
  { id: 'pack_50',   credits: 50,   price: 15,  popular: false },
  { id: 'pack_100',  credits: 100,  price: 25,  popular: true  },
  { id: 'pack_250',  credits: 250,  price: 50,  popular: false },
  { id: 'pack_500',  credits: 500,  price: 85,  popular: false },
  { id: 'pack_1000', credits: 1000, price: 150, popular: false },
]

const PLANS = [
  { id: 'starter',      name: 'Starter',      price: 49,  credits: 200  },
  { id: 'professional', name: 'Professional', price: 99,  credits: 500  },
  { id: 'enterprise',   name: 'Enterprise',   price: 249, credits: 2000 },
]

const PASSWORD_STRENGTH = (p: string) => {
  if (!p) return { score: 0, label: '', color: '' }
  let score = 0
  if (p.length >= 8)  score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score <= 1) return { score, label: 'Slabă',    color: 'bg-red-400'    }
  if (score <= 2) return { score, label: 'Medie',    color: 'bg-amber-400'  }
  if (score <= 3) return { score, label: 'Bună',     color: 'bg-blue-400'   }
  return              { score, label: 'Puternică', color: 'bg-emerald-500' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function MessageBanner({ message, onClose }: { message: { type: string; text: string }; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-3 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
      {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <span className="text-sm">{message.text}</span>
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100">✕</button>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab]   = useState('general')
  const [store, setStore]           = useState<StoreData | null>(null)
  const [profile, setProfile]       = useState<UserProfile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [message, setMessage]       = useState({ type: '', text: '' })
  const avatarInputRef              = useRef<HTMLInputElement>(null)

  // Loading states
  const [connecting, setConnecting]           = useState(false)
  const [syncing, setSyncing]                 = useState(false)
  const [disconnecting, setDisconnecting]     = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [savingBrand, setSavingBrand]         = useState(false)
  const [savingPassword, setSavingPassword]   = useState(false)
  const [savingPrefs, setSavingPrefs]         = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [testingConn, setTestingConn]         = useState(false)
  const [connTestResult, setConnTestResult]   = useState<null | { ok: boolean; msg: string }>(null)
  const [buyingPack, setBuyingPack]           = useState<string | null>(null)
  const [showKeys, setShowKeys]               = useState(false)

  // Credits
  const [credits, setCredits]           = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Forms
  const [storeForm, setStoreForm]     = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [brandForm, setBrandForm]     = useState({ businessName: '', website: '', tone: 'professional', language: 'ro', niche: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [preferences, setPreferences]   = useState({ emailNotifications: true, weeklyReport: true, autoOptimize: false })

  useEffect(() => { fetchProfile(); fetchStore(); fetchCredits() }, [])

  const showMsg = (type: string, text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  async function fetchProfile() {
    try {
      const res = await fetch('/api/user/profile')
      const data = await res.json()
      if (data.user) {
        setProfile(data.user)
        setCredits(data.user.credits || 0)
        setProfileForm({ name: data.user.name || '' })
        setBrandForm({
          businessName: data.user.business_name || '',
          website: data.user.website || '',
          tone: data.user.brand_tone || 'professional',
          language: data.user.brand_language || 'ro',
          niche: data.user.niche || '',
        })
        if (data.user.preferences) {
          const p = data.user.preferences
          setPreferences({
            emailNotifications: p.emailNotifications ?? true,
            weeklyReport: p.weeklyReport ?? true,
            autoOptimize: p.autoOptimize ?? false,
          })
        }
      }
    } catch {} finally { setLoading(false) }
  }

  async function fetchStore() {
    try {
      const res = await fetch('/api/stores')
      const data = await res.json()
      if (data.store) setStore(data.store)
    } catch {}
  }

  async function fetchCredits() {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setCredits(data.balance || 0)
      setTransactions(data.transactions || [])
    } catch {}
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare la încărcare'); return }
      setProfile(p => p ? { ...p, avatar_url: data.avatar_url } : p)
      showMsg('success', 'Avatar actualizat cu succes!')
    } catch { showMsg('error', 'Eroare la încărcarea avatarului') }
    finally { setUploadingAvatar(false); if (avatarInputRef.current) avatarInputRef.current.value = '' }
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!profileForm.name.trim()) { showMsg('error', 'Numele nu poate fi gol'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileForm.name.trim() }) })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare la salvare'); return }
      setProfile(p => p ? { ...p, name: data.user.name } : p)
      showMsg('success', 'Profil salvat cu succes!')
    } catch { showMsg('error', 'Eroare la salvare') }
    finally { setSaving(false) }
  }

  // ── Brand ──────────────────────────────────────────────────────────────────
  async function handleSaveBrand() {
    setSavingBrand(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: brandForm.businessName.trim(), website: brandForm.website.trim(), brand_tone: brandForm.tone, brand_language: brandForm.language, niche: brandForm.niche.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare la salvare'); return }
      showMsg('success', 'Setări brand salvate! AI-ul va folosi aceste setări la generare.')
    } catch { showMsg('error', 'Eroare la salvare') }
    finally { setSavingBrand(false) }
  }

  // ── Password ───────────────────────────────────────────────────────────────
  async function handleChangePassword() {
    const { currentPassword, newPassword, confirmPassword } = passwordForm
    if (!currentPassword || !newPassword || !confirmPassword) { showMsg('error', 'Completează toate câmpurile'); return }
    if (newPassword.length < 6) { showMsg('error', 'Parola nouă trebuie să aibă minim 6 caractere'); return }
    if (newPassword !== confirmPassword) { showMsg('error', 'Parolele noi nu se potrivesc'); return }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/user/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare la schimbarea parolei'); return }
      showMsg('success', 'Parola a fost schimbată cu succes!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch { showMsg('error', 'Eroare la schimbarea parolei') }
    finally { setSavingPassword(false) }
  }

  // ── Preferences ────────────────────────────────────────────────────────────
  async function handleSavePreferences() {
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/user/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences }) })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error); return }
      showMsg('success', 'Preferințe salvate cu succes!')
    } catch { showMsg('error', 'Eroare la salvare') }
    finally { setSavingPrefs(false) }
  }

  // ── Store ──────────────────────────────────────────────────────────────────
  async function handleTestConnection() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) {
      setConnTestResult({ ok: false, msg: 'Completează toate câmpurile înainte de test' }); return
    }
    setTestingConn(true); setConnTestResult(null)
    try {
      const url = storeForm.store_url.replace(/\/$/, '')
      const res = await fetch(`${url}/wp-json/wc/v3/products?per_page=1&consumer_key=${storeForm.consumer_key}&consumer_secret=${storeForm.consumer_secret}`)
      if (res.ok) {
        setConnTestResult({ ok: true, msg: 'Conexiune reușită! Magazinul este accesibil.' })
      } else {
        setConnTestResult({ ok: false, msg: `Eroare ${res.status} — verifică URL-ul și cheile API` })
      }
    } catch {
      setConnTestResult({ ok: false, msg: 'Nu se poate conecta — verifică URL-ul și dacă site-ul e online' })
    } finally { setTestingConn(false) }
  }

  async function handleConnect() {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) { showMsg('error', 'Completează toate câmpurile'); return }
    setConnecting(true)
    try {
      const res = await fetch('/api/stores/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeForm) })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error); return }
      showMsg('success', 'Magazin conectat cu succes!')
      setStore(data.store); setStoreForm({ store_url: '', consumer_key: '', consumer_secret: '' })
      setConnTestResult(null)
    } catch { showMsg('error', 'Eroare la conectare') }
    finally { setConnecting(false) }
  }

  async function handleSync() {
    if (!store) return; setSyncing(true)
    try {
      const res = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error); return }
      showMsg('success', `Sincronizare completă! ${data.synced} produse sincronizate.`)
      fetchStore()
    } catch { showMsg('error', 'Eroare la sincronizare') }
    finally { setSyncing(false) }
  }

  async function handleDisconnect() {
    if (!store || !confirm('Ești sigur că vrei să deconectezi magazinul? Produsele sincronizate vor rămâne în platformă.')) return
    setDisconnecting(true)
    try {
      await fetch(`/api/stores/${store.id}`, { method: 'DELETE' })
      setStore(null); showMsg('success', 'Magazin deconectat.')
    } catch { showMsg('error', 'Eroare la deconectare') }
    finally { setDisconnecting(false) }
  }

  // ── Credits ────────────────────────────────────────────────────────────────
  async function handleBuyPack(packId: string) {
    setBuyingPack(packId)
    try {
      const res = await fetch('/api/stripe/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: packId }) })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url }
      else { showMsg('error', data.error || 'Eroare la procesare') }
    } catch { showMsg('error', 'Eroare de rețea') }
    finally { setBuyingPack(null) }
  }

  async function handleManageSubscription() {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url }
      else { showMsg('error', data.error || 'Eroare la accesarea portalului') }
    } catch { showMsg('error', 'Eroare de rețea') }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const userName    = profile?.name || session?.user?.name || 'Utilizator'
  const userEmail   = profile?.email || session?.user?.email || ''
  const userPlan    = profile?.plan || (session?.user as any)?.plan || 'free'
  const userAvatar  = profile?.avatar_url || null
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' }) : ''
  const pwStrength  = PASSWORD_STRENGTH(passwordForm.newPassword)

  const [downloadingPlugin, setDownloadingPlugin] = useState(false)

  async function handleDownloadPlugin() {
    setDownloadingPlugin(true)
    try {
      const res = await fetch('/api/plugin/download', { credentials: 'include' })
      if (!res.ok) { showMsg('error', 'Eroare la generarea pluginului'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'hontrio.zip'; a.click()
      URL.revokeObjectURL(url)
    } catch { showMsg('error', 'Eroare la descărcare') }
    finally { setDownloadingPlugin(false) }
  }

  const tabItems = [
    { value: 'general',      label: 'General',    icon: User },
    { value: 'brand',        label: 'Brand & AI', icon: Sparkles },
    { value: 'integrations', label: 'Integrări',  icon: Plug },
    { value: 'credits',      label: 'Credite',    icon: CreditCard },
    { value: 'security',     label: 'Securitate', icon: Shield },
    { value: 'preferences',  label: 'Preferințe', icon: SlidersHorizontal },
    { value: 'plugin',       label: 'Plugin WP',  icon: Download },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900">Setări</h1>
        <p className="text-gray-500 text-sm mt-0.5">Administrează contul, brandul și integrările</p>
      </motion.div>

      <AnimatePresence>
        {message.text && <MessageBanner message={message} onClose={() => setMessage({ type: '', text: '' })} />}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto flex-wrap gap-0.5">
          {tabItems.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <tab.icon className="h-4 w-4 mr-2" />{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══════════ GENERAL ═══════════ */}
        <TabsContent value="general" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-5">Informații profil</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative group">
                      <Avatar className="h-16 w-16">
                        {userAvatar && <img src={userAvatar} alt={userName} className="h-full w-full object-cover rounded-full" />}
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xl font-medium">
                          {userName[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                        className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-400">{userEmail}</p>
                      <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
                        {uploadingAvatar ? <><Loader2 className="h-3 w-3 animate-spin" />Se încarcă...</> : <><Camera className="h-3 w-3" />Schimbă avatar</>}
                      </button>
                      <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WebP, GIF · max 5MB</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Nume complet</Label>
                        <Input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl border-gray-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Email</Label>
                        <Input value={userEmail} disabled className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                      </div>
                    </div>
                    <Button onClick={handleSaveProfile} disabled={saving} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</> : <><Save className="h-4 w-4 mr-2" />Salvează</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalii cont</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Plan</span>
                      <Badge className="bg-blue-100 text-blue-700 border-0 capitalize">{userPlan}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Credite</span>
                      <span className="text-sm font-semibold text-gray-900">{credits}</span>
                    </div>
                    {memberSince && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Membru din</span>
                        <span className="text-sm text-gray-700">{memberSince}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-red-600 mb-2">Zonă periculoasă</h3>
                  <p className="text-xs text-gray-500 mb-3">Aceste acțiuni sunt permanente și nu pot fi anulate.</p>
                  <Button variant="outline" size="sm" className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs h-9">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Șterge contul
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ BRAND & AI ═══════════ */}
        <TabsContent value="brand" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Identitate brand</h3>
                      <p className="text-xs text-gray-400">AI-ul va folosi aceste setări la generarea oricărui conținut</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Nume business</Label>
                        <Input value={brandForm.businessName} onChange={e => setBrandForm(p => ({ ...p, businessName: e.target.value }))} placeholder="Numele magazinului tău" className="h-10 rounded-xl border-gray-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Website</Label>
                        <Input value={brandForm.website} onChange={e => setBrandForm(p => ({ ...p, website: e.target.value }))} placeholder="https://magazinul-tau.ro" className="h-10 rounded-xl border-gray-200" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Nișa / Industria</Label>
                      <Input value={brandForm.niche} onChange={e => setBrandForm(p => ({ ...p, niche: e.target.value }))} placeholder="ex: Fashion feminin, Electronice, Cosmetice naturale..." className="h-10 rounded-xl border-gray-200" />
                      <p className="text-xs text-gray-400">Ajută AI-ul să folosească terminologia corectă pentru industria ta</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Tonul comunicării</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { value: 'professional', label: 'Profesional', desc: 'Serios, de încredere', emoji: '👔' },
                          { value: 'friendly',     label: 'Prietenos',   desc: 'Cald, accesibil',    emoji: '😊' },
                          { value: 'luxury',       label: 'Premium',     desc: 'Elegant, sofisticat', emoji: '💎' },
                          { value: 'casual',       label: 'Casual',      desc: 'Relaxat, informal',   emoji: '✌️' },
                        ].map(tone => (
                          <button key={tone.value} onClick={() => setBrandForm(p => ({ ...p, tone: tone.value }))}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${brandForm.tone === tone.value ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className="text-lg mb-1">{tone.emoji}</div>
                            <p className="text-sm font-medium text-gray-900">{tone.label}</p>
                            <p className="text-[11px] text-gray-400">{tone.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Limba conținutului generat</Label>
                      <div className="flex gap-2">
                        {[{ value: 'ro', label: '🇷🇴 Română' }, { value: 'en', label: '🇬🇧 Engleză' }].map(lang => (
                          <button key={lang.value} onClick={() => setBrandForm(p => ({ ...p, language: lang.value }))}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${brandForm.language === lang.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button onClick={handleSaveBrand} disabled={savingBrand} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                      {savingBrand ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</> : <><Save className="h-4 w-4 mr-2" />Salvează setări brand</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-blue-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-900">Cum influențează AI-ul</span>
                  </div>
                  <div className="space-y-2 text-xs text-purple-700 leading-relaxed">
                    <div className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" /><span><strong>Ton:</strong> Titlurile și descrierile vor reflecta stilul ales</span></div>
                    <div className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" /><span><strong>Nișa:</strong> Terminologie și cuvinte cheie specifice industriei</span></div>
                    <div className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" /><span><strong>Limba:</strong> Tot conținutul generat în limba aleasă</span></div>
                    <div className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" /><span><strong>Brandul:</strong> AI-ul poate referenția magazinul tău natural</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview tone */}
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview ton selectat</p>
                  <p className="text-xs text-gray-600 leading-relaxed italic">
                    {brandForm.tone === 'professional' && '"Produs de înaltă calitate, conceput pentru performanță și durabilitate. Ideal pentru profesioniști care nu fac compromisuri."'}
                    {brandForm.tone === 'friendly'     && '"Exact ce ai nevoie pentru a face lucrurile mai ușoare! Simplu de folosit și super eficient — vei adora rezultatele."'}
                    {brandForm.tone === 'luxury'       && '"O experiență rafinată, creată pentru cei care apreciază excelența. Fiecare detaliu a fost gândit cu măiestrie."'}
                    {brandForm.tone === 'casual'       && '"Hai să fim sinceri — e bun, e simplu, funcționează. Fără complicații, exact cum îți place."'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ INTEGRĂRI ═══════════ */}
        <TabsContent value="integrations" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {store ? (
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center"><Store className="h-4 w-4 text-green-600" /></div>
                      <div><h3 className="text-sm font-semibold text-gray-900">Magazin conectat</h3><p className="text-xs text-gray-400">WooCommerce este activ</p></div>
                      <Badge className="ml-auto bg-green-100 text-green-700 border-0 text-[10px]">Conectat</Badge>
                    </div>
                    <div className="space-y-2 mb-5">
                      {[
                        { icon: Globe,    label: 'URL Magazin',           value: <a href={store.store_url} target="_blank" rel="noopener" className="text-sm text-blue-600 flex items-center gap-1">{store.store_url.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3" /></a> },
                        { icon: Package, label: 'Produse sincronizate',   value: <span className="text-sm font-semibold">{store.products_count}</span> },
                        { icon: RefreshCw, label: 'Ultima sincronizare', value: <span className="text-sm text-gray-700">{store.last_sync_at ? new Date(store.last_sync_at).toLocaleString('ro-RO') : 'Niciodată'}</span> },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2"><row.icon className="h-4 w-4 text-gray-400" /><span className="text-sm text-gray-600">{row.label}</span></div>
                          {row.value}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                        {syncing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sincronizare...</> : <><RefreshCw className="h-4 w-4 mr-2" />Sincronizează</>}
                      </Button>
                      <Button onClick={handleDisconnect} disabled={disconnecting} variant="outline" className="rounded-xl h-10 px-5 border-red-200 text-red-600 hover:bg-red-50">
                        {disconnecting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se deconectează...</> : <><Unplug className="h-4 w-4 mr-2" />Deconectează</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center"><Plug className="h-4 w-4 text-blue-600" /></div>
                      <div><h3 className="text-sm font-semibold text-gray-900">Conectează magazinul</h3><p className="text-xs text-gray-400">Introdu datele WooCommerce</p></div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">URL Magazin</Label>
                        <Input value={storeForm.store_url} onChange={e => { setStoreForm(p => ({ ...p, store_url: e.target.value })); setConnTestResult(null) }} placeholder="https://magazinul-tau.ro" className="h-10 rounded-xl border-gray-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Consumer Key</Label>
                        <div className="relative">
                          <Input type={showKeys ? 'text' : 'password'} value={storeForm.consumer_key} onChange={e => { setStoreForm(p => ({ ...p, consumer_key: e.target.value })); setConnTestResult(null) }} placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx" className="h-10 rounded-xl border-gray-200 pr-10" />
                          <button onClick={() => setShowKeys(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Consumer Secret</Label>
                        <Input type={showKeys ? 'text' : 'password'} value={storeForm.consumer_secret} onChange={e => { setStoreForm(p => ({ ...p, consumer_secret: e.target.value })); setConnTestResult(null) }} placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx" className="h-10 rounded-xl border-gray-200" />
                      </div>

                      {/* Test result */}
                      <AnimatePresence>
                        {connTestResult && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`flex items-center gap-2 p-3 rounded-xl text-sm ${connTestResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {connTestResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                            {connTestResult.msg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-2">
                        <Button onClick={handleTestConnection} disabled={testingConn} variant="outline" className="rounded-xl h-10 px-4 border-gray-200 text-gray-600 hover:bg-gray-50">
                          {testingConn ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se testează...</> : <><Wifi className="h-4 w-4 mr-2" />Testează conexiunea</>}
                        </Button>
                        <Button onClick={handleConnect} disabled={connecting} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5 flex-1">
                          {connecting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</> : <><Plug className="h-4 w-4 mr-2" />Conectează</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3"><Key className="h-4 w-4 text-blue-600" /><span className="text-sm font-semibold text-blue-900">Cum obțin cheile API?</span></div>
                  <div className="text-xs text-blue-700 leading-relaxed space-y-1.5">
                    <p>1. Intră în WordPress Admin</p>
                    <p>2. WooCommerce → Setări → Avansat</p>
                    <p>3. Click pe tab-ul REST API</p>
                    <p>4. Add Key → Permissions: <strong>Read/Write</strong></p>
                    <p>5. Copiază Consumer Key și Consumer Secret</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ CREDITE ═══════════ */}
        <TabsContent value="credits" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">

              {/* Balance */}
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-xs font-medium mb-1">Credite disponibile</p>
                      <p className="text-4xl font-bold">{credits}</p>
                      <p className="text-blue-200 text-xs mt-1">Plan curent: <span className="text-white font-semibold capitalize">{userPlan}</span></p>
                    </div>
                    <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
                      <Zap className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-3">
                    <Button onClick={handleManageSubscription} variant="outline" size="sm" className="rounded-xl border-white/30 text-white hover:bg-white/10 bg-transparent text-xs h-8">
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />Gestionează abonament
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Credit packs */}
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Cumpără credite extra</h3>
                  <p className="text-xs text-gray-400 mb-4">Creditele nu expiră și se adaugă la balanța curentă</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CREDIT_PACKS.map(pack => (
                      <button key={pack.id} onClick={() => handleBuyPack(pack.id)} disabled={buyingPack === pack.id}
                        className={`relative p-3.5 rounded-xl border-2 text-left transition-all hover:border-blue-300 hover:shadow-sm disabled:opacity-60 ${pack.popular ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}>
                        {pack.popular && <span className="absolute -top-2 left-3 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">Popular</span>}
                        <p className="text-lg font-bold text-gray-900">{pack.credits} <span className="text-sm font-normal text-gray-500">credite</span></p>
                        <p className="text-sm font-semibold text-blue-600 mt-0.5">{pack.price} RON</p>
                        <p className="text-[10px] text-gray-400 mt-1">{(pack.price / pack.credits * 100).toFixed(0)} bani/credit</p>
                        {buyingPack === pack.id && <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Transaction history */}
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Istoric tranzacții</h3>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">Nicio tranzacție încă</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.slice(0, 15).map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                            {tx.amount > 0
                              ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                              : <TrendingDown className="h-4 w-4 text-gray-500" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">{tx.description}</p>
                            <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-emerald-600' : 'text-gray-700'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </p>
                            <p className="text-[10px] text-gray-400">sold: {tx.balance_after}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - cost reference */}
            <div className="space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost acțiuni AI</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Generare text complet', cost: 5, icon: '📝' },
                      { label: 'SEO complet (toate secț.)', cost: 5, icon: '🔍' },
                      { label: 'Regenerare secțiune SEO', cost: '1-2', icon: '✏️' },
                      { label: 'Generare imagine AI', cost: '2-4', icon: '🖼️' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600 flex items-center gap-2"><span>{item.icon}</span>{item.label}</span>
                        <span className="text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full">{item.cost} cr.</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-indigo-800 mb-2">Vrei mai multe credite lunar?</p>
                  <p className="text-xs text-indigo-600 leading-relaxed mb-3">Upgrade la un plan superior pentru credite mai multe la un preț mai bun pe credit.</p>
                  <div className="space-y-1.5">
                    {PLANS.map(plan => (
                      <div key={plan.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${userPlan === plan.id ? 'bg-indigo-100 text-indigo-800 font-semibold' : 'text-indigo-700'}`}>
                        <span>{plan.name}</span>
                        <span>{plan.credits} cr. / {plan.price} RON</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ SECURITATE ═══════════ */}
        <TabsContent value="security" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center"><Lock className="h-4 w-4 text-green-600" /></div>
                    <div><h3 className="text-sm font-semibold text-gray-900">Schimbă parola</h3><p className="text-xs text-gray-400">Actualizează parola contului tău</p></div>
                  </div>
                  <div className="space-y-4">
                    {/* Current password */}
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Parola curentă</Label>
                      <div className="relative">
                        <Input type={showPasswords.current ? 'text' : 'password'} value={passwordForm.currentPassword}
                          onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                          placeholder="••••••••" className="h-10 rounded-xl border-gray-200 pr-10" />
                        <button onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* New password */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Parola nouă</Label>
                        <div className="relative">
                          <Input type={showPasswords.new ? 'text' : 'password'} value={passwordForm.newPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                            placeholder="Minim 6 caractere" className="h-10 rounded-xl border-gray-200 pr-10" />
                          <button onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {/* Strength indicator */}
                        {passwordForm.newPassword && (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              {[1,2,3,4].map(i => (
                                <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= pwStrength.score ? pwStrength.color : 'bg-gray-100'}`} />
                              ))}
                            </div>
                            <p className={`text-[10px] font-medium ${
                              pwStrength.score <= 1 ? 'text-red-500' :
                              pwStrength.score <= 2 ? 'text-amber-500' :
                              pwStrength.score <= 3 ? 'text-blue-500' : 'text-emerald-600'
                            }`}>{pwStrength.label}</p>
                          </div>
                        )}
                      </div>

                      {/* Confirm */}
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Confirmă parola</Label>
                        <div className="relative">
                          <Input type={showPasswords.confirm ? 'text' : 'password'} value={passwordForm.confirmPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            placeholder="Repetă parola" className="h-10 rounded-xl border-gray-200 pr-10" />
                          <button onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordForm.confirmPassword && passwordForm.newPassword && (
                          <p className={`text-[10px] font-medium flex items-center gap-1 ${passwordForm.newPassword === passwordForm.confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                            {passwordForm.newPassword === passwordForm.confirmPassword
                              ? <><CheckCircle2 className="h-3 w-3" />Parolele se potrivesc</>
                              : <><XCircle className="h-3 w-3" />Parolele nu se potrivesc</>
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <Button onClick={handleChangePassword} disabled={savingPassword} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                      {savingPassword ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se actualizează...</> : <><Lock className="h-4 w-4 mr-2" />Actualizează parola</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center"><Shield className="h-4 w-4 text-blue-600" /></div>
                    <div><h3 className="text-sm font-semibold text-gray-900">Sesiuni active</h3><p className="text-xs text-gray-400">Dispozitive conectate</p></div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                      <div><p className="text-sm font-medium text-gray-900">Sesiunea curentă</p><p className="text-xs text-gray-400">Activ acum — browser web</p></div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Activ</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-green-600" /><span className="text-sm font-semibold text-green-900">Securitate</span></div>
                  <p className="text-xs text-green-700 leading-relaxed">Contul tău este protejat cu criptare. Cheile API ale magazinului sunt stocate securizat. Recomandăm o parolă puternică cu litere mari, cifre și simboluri.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ PREFERINȚE ═══════════ */}
        <TabsContent value="preferences" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-5">Notificări & Automatizări</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'emailNotifications', icon: Mail,     title: 'Notificări email', desc: 'Primești emailuri la răspunsuri tichete, sincronizări eșuate și activitate cont' },
                      { key: 'weeklyReport',        icon: Bell,     title: 'Raport săptămânal', desc: 'Sumar cu produse optimizate, credite consumate și produse publicate — trimis luni' },
                      { key: 'autoOptimize',        icon: Sparkles, title: 'Optimizare automată la sync', desc: 'Produsele noi cu scor SEO 0 sunt optimizate automat. Consumă 5 credite per produs.' },
                    ].map(pref => (
                      <div key={pref.key} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                            <pref.icon className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{pref.title}</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{pref.desc}</p>
                          </div>
                        </div>
                        <Toggle value={preferences[pref.key as keyof typeof preferences]} onChange={() => setPreferences(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof p] }))} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSavePreferences} disabled={savingPrefs} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                {savingPrefs ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</> : <><Save className="h-4 w-4 mr-2" />Salvează preferințele</>}
              </Button>
            </div>

            <div>
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2"><SlidersHorizontal className="h-4 w-4 text-blue-600" /><span className="text-sm font-semibold text-blue-900">Despre preferințe</span></div>
                  <p className="text-xs text-blue-700 leading-relaxed">Optimizarea automată va folosi credite din contul tău la fiecare sincronizare. Asigură-te că ai credite suficiente dacă activezi această opțiune.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════ PLUGIN WORDPRESS ═══════════ */}
        <TabsContent value="plugin" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">

              {/* Card principal descărcare */}
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Plugin Hontrio pentru WordPress</h3>
                      <p className="text-xs text-gray-400">Un singur plugin — AI Agent + Risk Shield</p>
                    </div>
                  </div>

                  {/* Ce include */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {[
                      { icon: Bot,    color: 'bg-purple-50 text-purple-600', title: 'AI Agent', desc: 'Widget conversațional injectat automat în frontend' },
                      { icon: Shield, color: 'bg-blue-50 text-blue-600',   title: 'Risk Shield', desc: 'Webhooks order.created + order.updated înregistrate automat' },
                      { icon: RefreshCcw, color: 'bg-green-50 text-green-600', title: 'Auto-update', desc: 'Butonul „Actualizează" apare direct în WordPress → Plugins' },
                      { icon: Zap,    color: 'bg-amber-50 text-amber-600',  title: 'Instalare 1 click', desc: 'Upload ZIP, activează, gata — fără configurare manuală' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleDownloadPlugin}
                    disabled={downloadingPlugin || !store}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-8 text-sm font-medium"
                  >
                    {downloadingPlugin
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se generează...</>
                      : <><Download className="h-4 w-4 mr-2" />Descarcă hontrio.zip</>
                    }
                  </Button>
                  {!store && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      ⚠️ Conectează mai întâi un magazin din tab-ul <strong>Integrări</strong>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Pași instalare */}
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Cum instalezi pluginul</h3>
                  <div className="space-y-3">
                    {[
                      { step: '1', text: 'Descarcă fișierul hontrio.zip de mai sus' },
                      { step: '2', text: 'În WordPress Admin → Plugins → Adaugă nou → Încarcă plugin' },
                      { step: '3', text: 'Selectează hontrio.zip și apasă „Instalează acum"' },
                      { step: '4', text: 'Activează pluginul — webhooks și widget-ul se configurează automat' },
                      { step: '5', text: 'Viitoarele actualizări apar direct în WordPress → Plugins → Actualizează' },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</span>
                        <p className="text-sm text-gray-600">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCcw className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900">Cum funcționează auto-update</span>
                  </div>
                  <p className="text-xs text-green-700 leading-relaxed">
                    WordPress verifică zilnic automat dacă există o versiune nouă. Când lansăm o actualizare, apare butonul <strong>„Actualizează"</strong> în secțiunea Plugins — exact ca orice alt plugin din WordPress.org. Nu trebuie să descarci manual niciodată din nou.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Ce se configurează automat</h3>
                  <div className="space-y-2">
                    {[
                      '✓ User ID și Store ID embedduite în plugin',
                      '✓ Webhook secret unic per magazin',
                      '✓ Webhook URL setat la hontrio.com',
                      '✓ Culoare și poziție widget AI Agent',
                      '✓ Pagină admin Hontrio în WordPress',
                    ].map((item, i) => (
                      <p key={i} className="text-xs text-gray-600">{item}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}