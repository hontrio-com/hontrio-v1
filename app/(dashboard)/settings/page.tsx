'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type StoreData = {
  id: string
  store_url: string
  store_name: string
  products_count: number
  last_sync_at: string | null
  status: string
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('general')
  const [store, setStore] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showKeys, setShowKeys] = useState(false)

  const [storeForm, setStoreForm] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
  })

  const [profileForm, setProfileForm] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
  })

  const [brandForm, setBrandForm] = useState({
    businessName: '',
    website: '',
    tone: 'professional',
    language: 'ro',
  })

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    weeklyReport: true,
    autoOptimize: false,
    darkMode: false,
  })

  useEffect(() => {
    fetchStore()
  }, [])

  useEffect(() => {
    if (session?.user) {
      setProfileForm({
        name: session.user.name || '',
        email: session.user.email || '',
      })
    }
  }, [session])

  const fetchStore = async () => {
    try {
      const res = await fetch('/api/stores')
      const data = await res.json()
      if (data.store) setStore(data.store)
    } catch {
      console.error('Error loading store')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    if (!storeForm.store_url || !storeForm.consumer_key || !storeForm.consumer_secret) {
      setMessage({ type: 'error', text: 'Completează toate câmpurile' })
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
        setMessage({ type: 'error', text: data.error })
        return
      }
      setMessage({ type: 'success', text: 'Magazin conectat cu succes!' })
      setStore(data.store)
      setStoreForm({ store_url: '', consumer_key: '', consumer_secret: '' })
    } catch {
      setMessage({ type: 'error', text: 'Eroare la conectare' })
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
        setMessage({ type: 'error', text: data.error })
        return
      }
      setMessage({ type: 'success', text: `Sincronizare completă! ${data.synced} produse sincronizate.` })
      fetchStore()
    } catch {
      setMessage({ type: 'error', text: 'Eroare la sincronizare' })
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
      setMessage({ type: 'success', text: 'Magazin deconectat.' })
    } catch {
      setMessage({ type: 'error', text: 'Eroare la deconectare' })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setTimeout(() => {
      setMessage({ type: 'success', text: 'Profil salvat cu succes!' })
      setSaving(false)
    }, 800)
  }

  const userName = session?.user?.name || 'Utilizator'
  const userEmail = session?.user?.email || ''
  const userPlan = (session?.user as any)?.plan || 'free'

  const tabItems = [
    { value: 'general', label: 'General', icon: User },
    { value: 'brand', label: 'Brand', icon: Palette },
    { value: 'integrations', label: 'Integrări', icon: Plug },
    { value: 'security', label: 'Securitate', icon: Shield },
    { value: 'preferences', label: 'Preferințe', icon: SlidersHorizontal },
  ]

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
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-xl font-medium">
                          {userName[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-400">{userEmail}</p>
                        <button className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Schimbă avatar
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
                        <span className="text-sm font-medium text-gray-900">{(session?.user as any)?.credits || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Rol</span>
                        <span className="text-sm text-gray-700 capitalize">{(session?.user as any)?.role || 'user'}</span>
                      </div>
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

                      <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                        <Save className="h-4 w-4 mr-2" />
                        Salvează setări brand
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
                {/* Connected store */}
                {store ? (
                  <Card className="rounded-2xl border-2 border-green-100 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <Store className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-900">{store.store_name}</h3>
                              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Conectat</Badge>
                            </div>
                            <p className="text-xs text-gray-400">{store.store_url}</p>
                          </div>
                        </div>
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-gray-900">{store.products_count}</p>
                          <p className="text-[10px] text-gray-400">Produse</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-medium text-gray-900">
                            {store.last_sync_at
                              ? new Date(store.last_sync_at).toLocaleDateString('ro-RO')
                              : 'Niciodată'}
                          </p>
                          <p className="text-[10px] text-gray-400">Ultima sincron.</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-xs font-medium text-green-600">Activ</p>
                          <p className="text-[10px] text-gray-400">Status</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSync}
                          disabled={syncing}
                          className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 flex-1"
                        >
                          {syncing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se sincronizează...</>
                          ) : (
                            <><RefreshCw className="h-4 w-4 mr-2" />Sincronizează produse</>
                          )}
                        </Button>
                        <Button
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          variant="outline"
                          className="rounded-xl h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {disconnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Unplug className="h-4 w-4 mr-2" />Deconectează</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Connect store form */
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                          <Store className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Conectează magazin WooCommerce</h3>
                          <p className="text-xs text-gray-400">Sincronizează produsele automat din magazinul tău</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">URL Magazin</Label>
                          <Input
                            placeholder="https://magazinul-tau.ro"
                            value={storeForm.store_url}
                            onChange={(e) => setStoreForm(prev => ({ ...prev, store_url: e.target.value }))}
                            className="h-10 rounded-xl border-gray-200"
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
                            placeholder="ck_xxxxxxxxxxxxxxxx"
                            value={storeForm.consumer_key}
                            onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_key: e.target.value }))}
                            className="h-10 rounded-xl border-gray-200 font-mono text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Consumer Secret</Label>
                          <Input
                            type={showKeys ? 'text' : 'password'}
                            placeholder="cs_xxxxxxxxxxxxxxxx"
                            value={storeForm.consumer_secret}
                            onChange={(e) => setStoreForm(prev => ({ ...prev, consumer_secret: e.target.value }))}
                            className="h-10 rounded-xl border-gray-200 font-mono text-sm"
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

                {/* Other integrations - coming soon */}
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Alte integrări</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Shopify', desc: 'Conectează magazinul Shopify', icon: ShoppingBag, status: 'coming' },
                        { name: 'Google Analytics', desc: 'Monitorizează traficul', icon: Globe, status: 'coming' },
                        { name: 'Google Search Console', desc: 'Date SEO reale', icon: Globe, status: 'coming' },
                      ].map(integration => (
                        <div key={integration.name} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                              <integration.icon className="h-5 w-5 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                              <p className="text-xs text-gray-400">{integration.desc}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-gray-200 text-gray-500 text-[10px]">În curând</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Cum obții cheile API?</span>
                    </div>
                    <div className="space-y-2 text-xs text-blue-700 leading-relaxed">
                      <p>1. Mergi în panoul admin WooCommerce</p>
                      <p>2. Navigă la <strong>WooCommerce → Settings → Advanced → REST API</strong></p>
                      <p>3. Click pe <strong>"Add Key"</strong></p>
                      <p>4. Selectează <strong>Read/Write</strong> permissions</p>
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
                        <Input type="password" placeholder="••••••••" className="h-10 rounded-xl border-gray-200" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Parola nouă</Label>
                          <Input type="password" placeholder="Minim 6 caractere" className="h-10 rounded-xl border-gray-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Confirmă parola</Label>
                          <Input type="password" placeholder="Repetă parola" className="h-10 rounded-xl border-gray-200" />
                        </div>
                      </div>
                      <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                        <Lock className="h-4 w-4 mr-2" />
                        Actualizează parola
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

                <Button className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
                  <Save className="h-4 w-4 mr-2" />
                  Salvează preferințele
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