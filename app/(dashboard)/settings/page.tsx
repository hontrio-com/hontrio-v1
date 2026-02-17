'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  User,
  Palette,
  Plug,
  Shield,
  SlidersHorizontal,
  Store,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Globe,
  Bell,
  Moon,
  Lock,
  Key,
  Mail,
  Camera,
  ArrowRight,
  Unplug,
  ShoppingBag,
  Package,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type StoreData = {
  id: string
  store_url: string
  store_name: string
  products_count: number
  last_sync_at: string | null
  status: string
}

type UserProfile = {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  credits: number
  plan: string
  role: string
  business_name: string | null
  website: string | null
  brand_tone: string | null
  brand_language: string | null
  niche: string | null
  preferences: {
    emailNotifications: boolean
    weeklyReport: boolean
    autoOptimize: boolean
    darkMode: boolean
  } | null
  created_at: string
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('general')
  const [store, setStore] = useState<StoreData | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showKeys, setShowKeys] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [storeForm, setStoreForm] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
  })

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  })

  const [brandForm, setBrandForm] = useState({
    businessName: '',
    website: '',
    tone: 'professional',
    language: 'ro',
    niche: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    weeklyReport: true,
    autoOptimize: false,
    darkMode: false,
  })

  // ========== FETCH DATA ==========
  useEffect(() => {
    fetchProfile()
    fetchStore()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile')
      const data = await res.json()
      if (data.user) {
        setProfile(data.user)
        setProfileForm({
          name: data.user.name || '',
          email: data.user.email || '',
        })
        setBrandForm({
          businessName: data.user.business_name || '',
          website: data.user.website || '',
          tone: data.user.brand_tone || 'professional',
          language: data.user.brand_language || 'ro',
          niche: data.user.niche || '',
        })
        if (data.user.preferences) {
          setPreferences(data.user.preferences)
        }
      }
    } catch {
      console.error('Error loading profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchStore = async () => {
    try {
      const res = await fetch('/api/stores')
      const data = await res.json()
      if (data.store) setStore(data.store)
    } catch {
      console.error('Error loading store')
    }
  }

  // ========== SHOW MESSAGE HELPER ==========
  const showMessage = (type: string, text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  // ========== AVATAR UPLOAD ==========
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        showMessage('error', data.error || 'Eroare la încărcare')
        return
      }

      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : prev)
      showMessage('success', 'Avatar actualizat cu succes!')
    } catch {
      showMessage('error', 'Eroare la încărcarea avatarului')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // ========== SAVE PROFILE ==========
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      showMessage('error', 'Numele nu poate fi gol')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        showMessage('error', data.error || 'Eroare la salvare')
        return
      }

      setProfile(prev => prev ? { ...prev, name: data.user.name } : prev)
      showMessage('success', 'Profil salvat cu succes!')
    } catch {
      showMessage('error', 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  // ========== SAVE BRAND ==========
  const handleSaveBrand = async () => {
    setSavingBrand(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: brandForm.businessName.trim(),
          website: brandForm.website.trim(),
          brand_tone: brandForm.tone,
          brand_language: brandForm.language,
          niche: brandForm.niche.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        showMessage('error', data.error || 'Eroare la salvare')
        return
      }

      setProfile(prev => prev ? {
        ...prev,
        business_name: data.user.business_name,
        website: data.user.website,
        brand_tone: data.user.brand_tone,
        brand_language: data.user.brand_language,
        niche: data.user.niche,
      } : prev)
      showMessage('success', 'Setări brand salvate cu succes!')
    } catch {
      showMessage('error', 'Eroare la salvare')
    } finally {
      setSavingBrand(false)
    }
  }

  // ========== CHANGE PASSWORD ==========
  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showMessage('error', 'Completează toate câmpurile')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      showMessage('error', 'Parola nouă trebuie să aibă minim 6 caractere')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Parolele noi nu se potrivesc')
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        showMessage('error', data.error || 'Eroare la schimbarea parolei')
        return
      }

      showMessage('success', 'Parola a fost schimbată cu succes!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch {
      showMessage('error', 'Eroare la schimbarea parolei')
    } finally {
      setSavingPassword(false)
    }
  }

  // ========== SAVE PREFERENCES ==========
  const handleSavePreferences = async () => {
    setSavingPreferences(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      const data = await res.json()

      if (!res.ok) {
        showMessage('error', data.error || 'Eroare la salvare')
        return
      }

      showMessage('success', 'Preferințe salvate cu succes!')
    } catch {
      showMessage('error', 'Eroare la salvare')
    } finally {
      setSavingPreferences(false)
    }
  }

  // ========== STORE ACTIONS ==========
  const handleConnect = async () => {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) {
      showMessage('error', 'Completează toate câmpurile')
      return
    }
    setConnecting(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/stores/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeForm),
      })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error)
        return
      }
      showMessage('success', 'Magazin conectat cu succes!')
      setStore(data.store)
      setStoreForm({ store_url: '', consumer_key: '', consumer_secret: '' })
    } catch {
      showMessage('error', 'Eroare la conectare')
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    if (!store) return
    setSyncing(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showMessage('error', data.error)
        return
      }
      showMessage('success', `Sincronizare completă! ${data.synced} produse sincronizate.`)
      fetchStore()
    } catch {
      showMessage('error', 'Eroare la sincronizare')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!store || !confirm('Ești sigur că vrei să deconectezi magazinul? Produsele sincronizate vor rămâne în platformă.')) return
    setDisconnecting(true)
    try {
      await fetch(`/api/stores/${store.id}`, { method: 'DELETE' })
      setStore(null)
      showMessage('success', 'Magazin deconectat.')
    } catch {
      showMessage('error', 'Eroare la deconectare')
    } finally {
      setDisconnecting(false)
    }
  }

  // ========== DERIVED DATA ==========
  const userName = profile?.name || session?.user?.name || 'Utilizator'
  const userEmail = profile?.email || session?.user?.email || ''
  const userPlan = profile?.plan || (session?.user as any)?.plan || 'free'
  const userCredits = profile?.credits ?? (session?.user as any)?.credits ?? 0
  const userRole = profile?.role || (session?.user as any)?.role || 'user'
  const userAvatar = profile?.avatar_url || null
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' })
    : ''

  const tabItems = [
    { value: 'general', label: 'General', icon: User },
    { value: 'brand', label: 'Brand', icon: Palette },
    { value: 'integrations', label: 'Integrări', icon: Plug },
    { value: 'security', label: 'Securitate', icon: Shield },
    { value: 'preferences', label: 'Preferințe', icon: SlidersHorizontal },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Setări</h1>
        <p className="text-gray-500 text-sm mt-0.5">Administrează contul, brandul și integrările</p>
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
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto flex-wrap">
            {tabItems.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ===== GENERAL TAB ===== */}
          <TabsContent value="general" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-5">Informații profil</h3>

                    {/* Avatar section */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative group">
                        <Avatar className="h-16 w-16">
                          {userAvatar ? (
                            <AvatarImage src={userAvatar} alt={userName} />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xl font-medium">
                            {userName[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5 text-white" />
                          )}
                        </button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-400">{userEmail}</p>
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1"
                        >
                          {uploadingAvatar ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Se încarcă...</>
                          ) : (
                            <><Camera className="h-3 w-3" /> Schimbă avatar</>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Nume complet</Label>
                          <Input
                            value={profileForm.name}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Email</Label>
                          <Input
                            value={profileForm.email}
                            disabled
                            className="h-10 rounded-xl border-gray-200 bg-gray-50"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"
                      >
                        {saving ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" />Salvează modificările</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
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
                        <span className="text-sm font-medium text-gray-900">{userCredits}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Rol</span>
                        <span className="text-sm text-gray-700 capitalize">{userRole}</span>
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

                <Card className="rounded-2xl border-0 shadow-sm border-red-100">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-red-600 mb-2">Zonă periculoasă</h3>
                    <p className="text-xs text-gray-500 mb-3">Aceste acțiuni sunt permanente și nu pot fi anulate.</p>
                    <Button variant="outline" size="sm" className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-9">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Șterge contul
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== BRAND TAB ===== */}
          <TabsContent value="brand" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Palette className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Identitate brand</h3>
                        <p className="text-xs text-gray-400">Aceste informații ajută AI-ul să genereze conținut potrivit brandului tău</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Nume business</Label>
                          <Input
                            value={brandForm.businessName}
                            onChange={(e) => setBrandForm(prev => ({ ...prev, businessName: e.target.value }))}
                            placeholder="Numele magazinului tău"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Website</Label>
                          <Input
                            value={brandForm.website}
                            onChange={(e) => setBrandForm(prev => ({ ...prev, website: e.target.value }))}
                            placeholder="https://magazinul-tau.ro"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Nișa / Industria</Label>
                        <Input
                          value={brandForm.niche}
                          onChange={(e) => setBrandForm(prev => ({ ...prev, niche: e.target.value }))}
                          placeholder="ex: Fashion, Electronice, Cosmetice..."
                          className="h-10 rounded-xl border-gray-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Tonul comunicării</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { value: 'professional', label: 'Profesional', desc: 'Serios, de încredere' },
                            { value: 'friendly', label: 'Prietenos', desc: 'Cald, accesibil' },
                            { value: 'luxury', label: 'Premium', desc: 'Elegant, sofisticat' },
                            { value: 'casual', label: 'Casual', desc: 'Relaxat, informal' },
                          ].map(tone => (
                            <button
                              key={tone.value}
                              onClick={() => setBrandForm(prev => ({ ...prev, tone: tone.value }))}
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                brandForm.tone === tone.value
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-100 hover:border-gray-200'
                              }`}
                            >
                              <p className="text-sm font-medium text-gray-900">{tone.label}</p>
                              <p className="text-[11px] text-gray-400">{tone.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Limba conținutului generat</Label>
                        <div className="flex gap-2">
                          {[
                            { value: 'ro', label: '🇷🇴 Română' },
                            { value: 'en', label: '🇬🇧 Engleză' },
                          ].map(lang => (
                            <button
                              key={lang.value}
                              onClick={() => setBrandForm(prev => ({ ...prev, language: lang.value }))}
                              className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                                brandForm.language === lang.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-100 text-gray-600 hover:border-gray-200'
                              }`}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveBrand}
                        disabled={savingBrand}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"
                      >
                        {savingBrand ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</>
                        ) : (
                          <><Save className="h-4 w-4 mr-2" />Salvează setări brand</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-blue-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">Despre setările brand</span>
                    </div>
                    <p className="text-xs text-purple-700 leading-relaxed">
                      Setările de brand ajută AI-ul să înțeleagă stilul și tonul afacerii tale.
                      Conținutul generat va reflecta personalitatea brandului tău, 
                      asigurând consistență pe toate produsele.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== INTEGRATIONS TAB ===== */}
          <TabsContent value="integrations" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {store ? (
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-5">
                        <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center">
                          <Store className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Magazin conectat</h3>
                          <p className="text-xs text-gray-400">WooCommerce este activ</p>
                        </div>
                        <Badge className="ml-auto bg-green-100 text-green-700 border-0 text-[10px]">Conectat</Badge>
                      </div>

                      <div className="space-y-3 mb-5">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">URL Magazin</span>
                          </div>
                          <a href={store.store_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            {store.store_url.replace(/^https?:\/\//, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">Produse sincronizate</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{store.products_count}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">Ultima sincronizare</span>
                          </div>
                          <span className="text-sm text-gray-700">
                            {store.last_sync_at
                              ? new Date(store.last_sync_at).toLocaleString('ro-RO')
                              : 'Niciodată'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSync}
                          disabled={syncing}
                          className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"
                        >
                          {syncing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sincronizare...</>
                          ) : (
                            <><RefreshCw className="h-4 w-4 mr-2" />Sincronizează</>
                          )}
                        </Button>
                        <Button
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          variant="outline"
                          className="rounded-xl h-10 px-5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {disconnecting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se deconectează...</>
                          ) : (
                            <><Unplug className="h-4 w-4 mr-2" />Deconectează</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-5">
                        <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
                          <Plug className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Conectează magazinul</h3>
                          <p className="text-xs text-gray-400">Introdu datele WooCommerce pentru a conecta</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">URL Magazin</Label>
                          <Input
                            value={storeForm.store_url}
                            onChange={(e) => setStoreForm(prev => ({ ...prev, store_url: e.target.value }))}
                            placeholder="https://magazinul-tau.ro"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Consumer Key</Label>
                          <div className="relative">
                            <Input
                              type={showKeys ? 'text' : 'password'}
                              value={storeForm.consumer_key}
                              onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_key: e.target.value }))}
                              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                              className="h-10 rounded-xl border-gray-200 pr-10"
                            />
                            <button
                              onClick={() => setShowKeys(!showKeys)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Consumer Secret</Label>
                          <Input
                            type={showKeys ? 'text' : 'password'}
                            value={storeForm.consumer_secret}
                            onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_secret: e.target.value }))}
                            placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>

                        <Button
                          onClick={handleConnect}
                          disabled={connecting}
                          className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-10"
                        >
                          {connecting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</>
                          ) : (
                            <><Plug className="h-4 w-4 mr-2" />Conectează magazinul</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Cum obțin cheile API?</span>
                    </div>
                    <div className="text-xs text-blue-700 leading-relaxed space-y-1.5">
                      <p>1. Intră în WordPress Admin</p>
                      <p>2. WooCommerce → Settings → Advanced</p>
                      <p>3. Click pe tab-ul REST API</p>
                      <p>4. Add Key → Permissions: Read/Write</p>
                      <p>5. Copiază Consumer Key și Consumer Secret</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== SECURITY TAB ===== */}
          <TabsContent value="security" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center">
                        <Lock className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Schimbă parola</h3>
                        <p className="text-xs text-gray-400">Actualizează parola contului tău</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">Parola curentă</Label>
                        <Input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="••••••••"
                          className="h-10 rounded-xl border-gray-200"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Parola nouă</Label>
                          <Input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            placeholder="Minim 6 caractere"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Confirmă parola</Label>
                          <Input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Repetă parola"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleChangePassword}
                        disabled={savingPassword}
                        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"
                      >
                        {savingPassword ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se actualizează...</>
                        ) : (
                          <><Lock className="h-4 w-4 mr-2" />Actualizează parola</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Sesiuni active</h3>
                        <p className="text-xs text-gray-400">Gestionează dispozitivele conectate</p>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Sesiunea curentă</p>
                          <p className="text-xs text-gray-400">Activ acum — browser web</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Activ</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-900">Securitate</span>
                    </div>
                    <p className="text-xs text-green-700 leading-relaxed">
                      Contul tău este protejat cu criptare end-to-end.
                      Cheile API ale magazinului sunt stocate securizat și nu sunt accesibile terților.
                      Recomandăm schimbarea periodică a parolei.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== PREFERENCES TAB ===== */}
          <TabsContent value="preferences" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-5">Notificări</h3>
                    <div className="space-y-4">
                      {[
                        {
                          key: 'emailNotifications',
                          icon: Mail,
                          title: 'Notificări email',
                          desc: 'Primește emailuri despre activitatea contului',
                        },
                        {
                          key: 'weeklyReport',
                          icon: Bell,
                          title: 'Raport săptămânal',
                          desc: 'Sumar cu performanța magazinului în fiecare luni',
                        },
                        {
                          key: 'autoOptimize',
                          icon: Sparkles,
                          title: 'Optimizare automată',
                          desc: 'Produsele noi sunt optimizate automat la sincronizare',
                        },
                      ].map(pref => (
                        <div key={pref.key} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                              <pref.icon className="h-4 w-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{pref.title}</p>
                              <p className="text-xs text-gray-400">{pref.desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setPreferences(prev => ({ ...prev, [pref.key]: !prev[pref.key as keyof typeof prev] }))}
                            className={`relative h-6 w-11 rounded-full transition-colors ${
                              preferences[pref.key as keyof typeof preferences] ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              preferences[pref.key as keyof typeof preferences] ? 'translate-x-5' : ''
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-5">Aspect</h3>
                    <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                          <Moon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Mod întunecat</p>
                          <p className="text-xs text-gray-400">Schimbă aspectul platformei</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          preferences.darkMode ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          preferences.darkMode ? 'translate-x-5' : ''
                        }`} />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5"
                >
                  {savingPreferences ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se salvează...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Salvează preferințele</>
                  )}
                </Button>
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Despre preferințe</span>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Preferințele controlează modul în care platforma interacționează cu tine.
                      Optimizarea automată va folosi credite din contul tău.
                    </p>
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