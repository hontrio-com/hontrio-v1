'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Power, MessageCircle, Phone, Palette, Settings2,
  Copy, Check, ChevronRight, Eye, TrendingUp, Users,
  Zap, ArrowUpRight, Loader2, Save, AlertCircle,
  ExternalLink, Smartphone, Monitor, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#374151',
]

const INTENT_LABELS: Record<string, string> = {
  buying_ready: 'Gata să cumpere',
  browsing: 'Explorează',
  comparing: 'Compară',
  compatibility: 'Compatibilitate',
  info_product: 'Info produs',
  info_shipping: 'Livrare/retur',
  problem: 'Problemă',
  escalate: 'Escaladare',
  greeting: 'Salut inițial',
}

type Config = {
  is_active: boolean
  agent_name: string
  welcome_message: string
  whatsapp_number: string
  whatsapp_message: string
  widget_position: string
  widget_color: string
  widget_size: string
  widget_bottom_offset: number
}

type Stats = {
  total: number; last7: number; escalated: number; avgMessages: number
}

const defaultConfig: Config = {
  is_active: false,
  agent_name: 'Asistent',
  welcome_message: 'Bună! Sunt asistentul tău virtual. Cu ce te pot ajuta astăzi?',
  whatsapp_number: '',
  whatsapp_message: 'Bună ziua! Am o întrebare despre produsele voastre.',
  widget_position: 'bottom-right',
  widget_color: '#2563eb',
  widget_size: 'medium',
  widget_bottom_offset: 20,
}

export default function AgentPage() {
  const [config, setConfig] = useState<Config>(defaultConfig)
  const [stats, setStats] = useState<Stats | null>(null)
  const [intents, setIntents] = useState<Record<string, number>>({})
  const [storeUserId, setStoreUserId] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'install'>('overview')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')
  const [previewMessages, setPreviewMessages] = useState<Array<{role: string; content: string; products?: any[]; quick_replies?: string[]}>>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { previewEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [previewMessages])

  const loadData = async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/agent/config'),
        fetch('/api/agent/conversations'),
      ])
      const configData = await configRes.json()
      const statsData = await statsRes.json()

      if (configData.config) setConfig({ ...defaultConfig, ...configData.config })
      if (configData.store?.id) setStoreUserId(configData.store.id)
      if (configData.store?.store_url) setStoreUrl(configData.store.store_url)

      if (statsData.stats) setStats(statsData.stats)
      if (statsData.intents) setIntents(statsData.intents)

      // Get current user ID for snippet
      const meRes = await fetch('/api/user/me')
      const meData = await meRes.json()
      if (meData.user?.id) setStoreUserId(meData.user.id)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch {} finally { setSaving(false) }
  }

  const handleToggle = async () => {
    const newActive = !config.is_active
    setConfig(c => ({ ...c, is_active: newActive }))
    await fetch('/api/agent/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, is_active: newActive }),
    })
  }

  const snippetCode = `<!-- HONTRIO AI Agent -->
<script>
  window.HontrioAgent = {
    userId: "${storeUserId}",
    color: "${config.widget_color}",
    position: "${config.widget_position}",
    size: "${config.widget_size}"
  };
</script>
<script src="https://hontrio.com/agent-widget.js" async></script>`

  const downloadPlugin = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/agent/download-plugin')
      if (!res.ok) throw new Error('Eroare')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hontrio-agent.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Eroare la descărcare. Încearcă din nou.') }
    finally { setDownloading(false) }
  }

  const copySnippet = () => {
    navigator.clipboard.writeText(snippetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendPreview = async (msg?: string) => {
    const text = msg || previewMessage.trim()
    if (!text) return
    setPreviewMessage('')
    const newMessages = [...previewMessages, { role: 'user', content: text }]
    setPreviewMessages(newMessages)
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          session_id: 'preview-' + Date.now(),
          store_user_id: storeUserId,
        }),
      })
      const data = await res.json()
      setPreviewMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        products: data.products,
        quick_replies: data.quick_replies,
      }])
    } catch {
      setPreviewMessages(prev => [...prev, { role: 'assistant', content: 'Eroare la conectare. Verifică că agentul e activ.' }])
    } finally { setPreviewLoading(false) }
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agent</h1>
            <p className="text-gray-500 text-sm mt-0.5">Asistent conversațional pentru magazinul tău</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleToggle} className="flex items-center gap-2 text-sm font-medium">
              {config.is_active ? (
                <><ToggleRight className="h-8 w-8 text-green-500" /><span className="text-green-600">Activ</span></>
              ) : (
                <><ToggleLeft className="h-8 w-8 text-gray-300" /><span className="text-gray-400">Inactiv</span></>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Status banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className={`rounded-2xl p-4 flex items-center justify-between ${config.is_active ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={`text-sm font-medium ${config.is_active ? 'text-green-700' : 'text-gray-500'}`}>
              {config.is_active ? `Agentul "${config.agent_name}" este activ și răspunde vizitatorilor` : 'Agentul este oprit — vizitatorii nu îl văd'}
            </span>
          </div>
          {!config.is_active && (
            <Button onClick={handleToggle} size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl gap-1.5 text-xs">
              <Power className="h-3.5 w-3.5" />Activează
            </Button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Statistici', icon: TrendingUp },
          { id: 'settings', label: 'Configurare', icon: Settings2 },
          { id: 'install', label: 'Instalare', icon: ExternalLink },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── STATISTICS TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Conversații (30z)', value: stats?.total || 0, icon: MessageCircle, color: 'blue' },
              { label: 'Săptămâna aceasta', value: stats?.last7 || 0, icon: TrendingUp, color: 'green' },
              { label: 'Mesaje / conv.', value: stats?.avgMessages || 0, icon: Zap, color: 'amber' },
              { label: 'Escaladări', value: stats?.escalated || 0, icon: Phone, color: 'purple' },
            ].map(stat => (
              <Card key={stat.label} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className={`h-8 w-8 rounded-xl bg-${stat.color}-100 flex items-center justify-center mb-2`}>
                    <stat.icon className={`h-4 w-4 text-${stat.color}-600`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Intent breakdown */}
          {Object.keys(intents).length > 0 && (
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-gray-900 mb-4">Intențiile vizitatorilor</p>
                <div className="space-y-3">
                  {Object.entries(intents).sort((a, b) => b[1] - a[1]).map(([intent, count]) => {
                    const total = Object.values(intents).reduce((s, v) => s + v, 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={intent} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-32 shrink-0">{INTENT_LABELS[intent] || intent}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview chat */}
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-semibold text-gray-900">Testează agentul</p>
              </div>
              {previewMessages.length > 0 && (
                <button onClick={() => setPreviewMessages([])} className="text-xs text-gray-400 hover:text-gray-600">Resetează</button>
              )}
            </div>
            <div className="h-72 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {previewMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Trimite un mesaj ca să testezi agentul</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {['Caut un produs', 'Care e programul?', 'Mă poate ajuta cineva?'].map(q => (
                      <button key={q} onClick={() => sendPreview(q)}
                        className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {previewMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] space-y-2`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {/* Product cards */}
                    {msg.products && msg.products.length > 0 && (
                      <div className="space-y-2">
                        {msg.products.map((p: any) => (
                          <div key={p.id} className="bg-white rounded-xl shadow-sm p-3 flex gap-3 border border-gray-100">
                            {p.image && <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{p.title}</p>
                              <p className="text-xs text-gray-500 truncate">{p.description}</p>
                              {p.price && <p className="text-xs font-bold text-blue-600 mt-0.5">{p.price} RON</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Quick replies */}
                    {msg.quick_replies && msg.quick_replies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.quick_replies.map((qr: string) => (
                          <button key={qr} onClick={() => sendPreview(qr)}
                            className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {previewLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={previewEndRef} />
            </div>
            <div className="p-3 border-t border-gray-100 flex gap-2 bg-white">
              <input
                value={previewMessage}
                onChange={e => setPreviewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendPreview()}
                placeholder="Scrie un mesaj de test..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <Button onClick={() => sendPreview()} disabled={!previewMessage.trim() || previewLoading} size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-4">
                Trimite
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Identity */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Bot className="h-4 w-4 text-blue-500" />Identitate agent</p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Numele agentului</label>
                <input value={config.agent_name} onChange={e => setConfig(c => ({ ...c, agent_name: e.target.value }))}
                  placeholder="ex: Asistent BundeCasa"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
                <p className="text-xs text-gray-400 mt-1">Apare în chat ca "Salut! Sunt [Nume]"</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Mesaj de bun venit</label>
                <textarea value={config.welcome_message} onChange={e => setConfig(c => ({ ...c, welcome_message: e.target.value }))}
                  rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Phone className="h-4 w-4 text-green-500" />Escaladare WhatsApp</p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Număr WhatsApp</label>
                <input value={config.whatsapp_number} onChange={e => setConfig(c => ({ ...c, whatsapp_number: e.target.value }))}
                  placeholder="40712345678 (fără + sau spații)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
                <p className="text-xs text-gray-400 mt-1">Format internațional fără +: ex: 40712345678</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Mesaj pre-completat pentru client</label>
                <textarea value={config.whatsapp_message} onChange={e => setConfig(c => ({ ...c, whatsapp_message: e.target.value }))}
                  rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Widget appearance */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Palette className="h-4 w-4 text-purple-500" />Aspect widget</p>

              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Culoare principală</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setConfig(c => ({ ...c, widget_color: color }))}
                      className={`w-8 h-8 rounded-full transition-all ${config.widget_color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                  <input type="color" value={config.widget_color} onChange={e => setConfig(c => ({ ...c, widget_color: e.target.value }))}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 p-0" title="Culoare custom" />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Poziție</label>
                <div className="flex gap-2">
                  {[{ id: 'bottom-right', label: 'Dreapta jos' }, { id: 'bottom-left', label: 'Stânga jos' }].map(pos => (
                    <button key={pos.id} onClick={() => setConfig(c => ({ ...c, widget_position: pos.id }))}
                      className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-all ${config.widget_position === pos.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offset buton - punct 5 */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Distanță față de marginea de jos (px)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="16" max="120" value={config.widget_bottom_offset || 20}
                    onChange={e => setConfig(c => ({ ...c, widget_bottom_offset: Number(e.target.value) }))}
                    className="flex-1" />
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{config.widget_bottom_offset || 20}px</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Util dacă ai butoane WhatsApp sau telefon în colț</p>
              </div>

              {/* Size */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Dimensiune buton</label>
                <div className="flex gap-2">
                  {[{ id: 'small', label: 'Mic' }, { id: 'medium', label: 'Mediu' }, { id: 'large', label: 'Mare' }].map(s => (
                    <button key={s.id} onClick={() => setConfig(c => ({ ...c, widget_size: s.id }))}
                      className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-all ${config.widget_size === s.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offset buton - punct 5 */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Distanță față de marginea de jos (px)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="16" max="120" value={config.widget_bottom_offset || 20}
                    onChange={e => setConfig(c => ({ ...c, widget_bottom_offset: Number(e.target.value) }))}
                    className="flex-1" />
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{config.widget_bottom_offset || 20}px</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Util dacă ai butoane WhatsApp sau telefon în colț</p>
              </div>

              {/* Live preview */}
              <div className="bg-gray-50 rounded-xl p-4 relative h-20 overflow-hidden">
                <p className="text-xs text-gray-400 mb-2">Preview buton:</p>
                <div className={`absolute bottom-3 ${config.widget_position === 'bottom-right' ? 'right-3' : 'left-3'}`}>
                  <button className="flex items-center justify-center rounded-full shadow-lg text-white transition-all"
                    style={{
                      backgroundColor: config.widget_color,
                      width: config.widget_size === 'small' ? 44 : config.widget_size === 'large' ? 64 : 52,
                      height: config.widget_size === 'small' ? 44 : config.widget_size === 'large' ? 64 : 52,
                    }}>
                    <MessageCircle style={{ width: config.widget_size === 'small' ? 20 : config.widget_size === 'large' ? 28 : 24, height: config.widget_size === 'small' ? 20 : config.widget_size === 'large' ? 28 : 24 }} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-11 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvez...' : saved ? 'Salvat!' : 'Salvează configurarea'}
          </Button>
        </div>
      )}

      {/* ── INSTALL TAB ── */}
      {activeTab === 'install' && (
        <div className="space-y-4">

          {/* MAIN: Download Plugin */}
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-2xl">🔌</div>
                <div className="flex-1">
                  <p className="text-white font-bold text-base">Plugin WordPress — instalare 1 click</p>
                  <p className="text-slate-400 text-sm mt-1">Descarcă pluginul pre-configurat cu datele tale și uploadează-l direct în WordPress. Nicio configurare necesară.</p>
                </div>
              </div>
              <Button onClick={downloadPlugin} disabled={downloading}
                className="mt-5 w-full bg-blue-500 hover:bg-blue-400 text-white rounded-xl h-11 gap-2 font-semibold text-sm">
                {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Se generează...</> : <><ArrowUpRight className="h-4 w-4" />Descarcă hontrio-agent.zip</>}
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cum instalezi</p>
              {[
                { step: '1', text: 'Descarcă fișierul ZIP de mai sus' },
                { step: '2', text: 'În WordPress mergi la Plugins → Add New → Upload Plugin' },
                { step: '3', text: 'Selectează fișierul ZIP descărcat și apasă Install Now' },
                { step: '4', text: 'Apasă Activate Plugin — agentul apare instant pe site!' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{s.step}</div>
                  <p className="text-sm text-gray-700">{s.text}</p>
                </div>
              ))}

              {storeUrl && (
                <div className="pt-2 border-t border-gray-100">
                  <a href={storeUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                    Verifică pe {storeUrl} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Advanced: manual snippet */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 flex items-center gap-2 select-none">
              <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
              Instalare manuală (avansat)
            </summary>
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden mt-2">
              <div className="bg-slate-900 p-4">
                <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-green-400 leading-relaxed whitespace-pre-wrap">{snippetCode}</div>
                <button onClick={copySnippet} className={`mt-3 flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {copied ? <><Check className="h-3.5 w-3.5" />Copiat!</> : <><Copy className="h-3.5 w-3.5" />Copiază codul</>}
                </button>
              </div>
            </Card>
          </details>

          {/* Warning if not configured */}
          {!config.whatsapp_number && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Numărul WhatsApp lipsește</p>
                <p className="text-xs text-amber-600 mt-0.5">Fără număr WhatsApp, vizitatorii nu pot fi escaladați când agentul nu poate răspunde. Adaugă-l în tab-ul Configurare.</p>
              </div>
            </div>
          )}

          {!config.is_active && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <Power className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Agentul nu e activ</p>
                <p className="text-xs text-blue-600 mt-0.5">Chiar dacă instalezi codul, agentul nu va răspunde până nu îl activezi.</p>
                <button onClick={handleToggle} className="text-xs font-semibold text-blue-700 underline mt-1">Activează acum</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}