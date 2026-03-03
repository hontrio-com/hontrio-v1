'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Power, MessageCircle, Phone, Palette, Settings2,
  Copy, Check, ChevronRight, TrendingUp,
  Zap, ArrowUpRight, Loader2, Save, AlertCircle,
  ExternalLink, ToggleLeft, ToggleRight, Upload, Code2,
  Square, Circle, RectangleHorizontal,
  X, Send, Users, Search, BarChart2, Clock, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#d97706', '#16a34a', '#0891b2', '#374151',
  '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
]

const INTENT_LABELS: Record<string, string> = {
  buying_ready: 'Gata să cumpere', browsing: 'Explorează', comparing: 'Compară',
  compatibility: 'Compatibilitate', info_product: 'Info produs', info_shipping: 'Livrare/retur',
  problem: 'Problemă', escalate: 'Escaladare', greeting: 'Salut inițial',
}

type Config = {
  is_active: boolean; agent_name: string; welcome_message: string
  whatsapp_number: string; whatsapp_message: string
  widget_position: string; widget_color: string; widget_size: string
  widget_bottom_offset: number; widget_button_shape: string
  widget_button_label: string; widget_avatar_url: string
  widget_intro_animation: boolean; widget_custom_css: string
  quick_replies: string[]
}

type Stats = { total: number; last7: number; escalated: number; avgMessages: number }

type Analytics = {
  summary: { totalSessions: number; uniqueVisitors: number; returningVisitors: number; avgMessages: number; escalated: number; weekTrend: number; thisWeek: number; lastWeek: number }
  conversationsPerDay: { date: string; count: number }[]
  intentCounts: Record<string, number>
  topProducts: { id: string; name: string; count: number }[]
  topSearches: { query: string; count: number }[]
  topCategories: { category: string; count: number }[]
  hourCounts: number[]
}

const defaultConfig: Config = {
  is_active: false, agent_name: 'Asistent',
  welcome_message: 'Bună! Sunt asistentul tău virtual. Cu ce te pot ajuta astăzi?',
  whatsapp_number: '', whatsapp_message: 'Bună ziua! Am o întrebare despre produsele voastre.',
  widget_position: 'bottom-right', widget_color: '#2563eb', widget_size: 'medium',
  widget_bottom_offset: 20, widget_button_shape: 'circle', widget_button_label: 'Ajutor?',
  widget_avatar_url: '', widget_intro_animation: true, widget_custom_css: '',
  quick_replies: ['Caut un produs', 'Am o întrebare', 'Livrare & retur'],
}

// ── LIVE WIDGET PREVIEW ───────────────────────────────────────────────────────
function WidgetPreview({ config, messages, onSend, loading, onToggle, isOpen }: {
  config: Config
  messages: Array<{role: string; content: string; quick_replies?: string[]}>
  onSend: (msg: string) => void
  loading: boolean
  onToggle: () => void
  isOpen: boolean
}) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const btnSize = config.widget_size === 'small' ? 44 : config.widget_size === 'large' ? 64 : 52
  const isRect = config.widget_button_shape === 'rectangle'
  const borderRadius = config.widget_button_shape === 'circle' ? '50%' : config.widget_button_shape === 'rounded' ? '16px' : '12px'

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = () => { if (!input.trim()) return; onSend(input.trim()); setInput('') }

  return (
    <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ height: 520 }}>
      {/* Fake background */}
      <div className="absolute inset-0 p-5 opacity-25 pointer-events-none select-none">
        <div className="h-4 bg-gray-400 rounded w-2/3 mb-3" />
        <div className="h-3 bg-gray-300 rounded w-full mb-2" />
        <div className="h-3 bg-gray-300 rounded w-5/6 mb-2" />
        <div className="h-3 bg-gray-300 rounded w-4/5 mb-5" />
        <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}</div>
      </div>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 12 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white"
            style={{ width: 280, height: 380, bottom: config.widget_bottom_offset + btnSize + 10, [config.widget_position === 'bottom-right' ? 'right' : 'left']: 12 }}
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 shrink-0" style={{ background: config.widget_color }}>
              {config.widget_avatar_url
                ? <img src={config.widget_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
                : <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30"><Bot className="w-4 h-4 text-white" /></div>
              }
              <div>
                <p className="text-white text-xs font-semibold">{config.agent_name || 'Asistent'}</p>
                <div className="flex items-center gap-1 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><p className="text-white/80 text-[10px]">Online</p></div>
              </div>
              <button onClick={onToggle} className="ml-auto w-6 h-6 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center py-6">
                  <Bot className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                  <p className="text-[11px] text-gray-400 mb-3">Trimite un mesaj ca să testezi</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {(config.quick_replies || []).slice(0,3).map((qr: string) => (
                      <button key={qr} onClick={() => onSend(qr)}
                        className="text-[10px] px-2 py-1 rounded-full border font-medium hover:opacity-80 transition-all"
                        style={{ color: config.widget_color, borderColor: config.widget_color + '50', background: config.widget_color + '10' }}>
                        {qr}
                      </button>
                    ))}
                  </div>
                </div>
              ) : messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] space-y-1.5">
                    <div className={`px-3 py-2 rounded-2xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}
                      style={msg.role === 'user' ? { background: config.widget_color } : {}}>
                      {msg.content}
                    </div>
                    {msg.quick_replies && msg.quick_replies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.quick_replies.map((qr: string) => (
                          <button key={qr} onClick={() => onSend(qr)}
                            className="text-[10px] px-2 py-1 rounded-full border font-medium hover:opacity-80 transition-all"
                            style={{ color: config.widget_color, borderColor: config.widget_color + '50', background: config.widget_color + '10' }}>
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="p-2.5 border-t border-gray-100 bg-white flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Scrie un mesaj..." className="flex-1 text-[11px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-300 transition-colors" />
              <button onClick={handleSend} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white hover:opacity-80 disabled:opacity-40 transition-all"
                style={{ background: config.widget_color }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-center py-1.5 text-[9px] text-gray-300 bg-white">Powered by <span className="text-gray-400">Hontrio</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intro bubble */}
      <AnimatePresence>
        {!isOpen && config.widget_intro_animation && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: 0.6 }}
            className="absolute rounded-2xl px-3 py-2.5 shadow-lg text-[11px] text-gray-700 font-medium max-w-[170px] cursor-pointer hover:shadow-xl transition-shadow"
            style={{
              background: '#fff', bottom: config.widget_bottom_offset + btnSize + 14,
              [config.widget_position === 'bottom-right' ? 'right' : 'left']: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06)',
              borderBottomRightRadius: config.widget_position === 'bottom-right' ? 4 : 16,
              borderBottomLeftRadius: config.widget_position === 'bottom-left' ? 4 : 16,
            }}
            onClick={onToggle}>
            👋 {(config.welcome_message || 'Cu ce te pot ajuta?').slice(0, 55)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button */}
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={onToggle}
        className="absolute flex items-center justify-center gap-2 text-white"
        style={{
          background: config.widget_color, borderRadius,
          width: isRect ? 'auto' : btnSize, height: isRect ? Math.round(btnSize * 0.65) : btnSize,
          paddingLeft: isRect ? 14 : 0, paddingRight: isRect ? 14 : 0,
          bottom: config.widget_bottom_offset, [config.widget_position === 'bottom-right' ? 'right' : 'left']: 12,
          boxShadow: `0 4px 16px ${config.widget_color}66`,
        }}>
        {config.widget_avatar_url && !isOpen
          ? <img src={config.widget_avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          : <MessageCircle style={{ width: config.widget_size === 'small' ? 18 : config.widget_size === 'large' ? 26 : 22, height: 'auto' }} />
        }
        {isRect && <span className="text-sm font-semibold whitespace-nowrap">{config.widget_button_label || 'Ajutor?'}</span>}
      </motion.button>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [config, setConfig] = useState<Config>(defaultConfig)
  const [stats, setStats] = useState<Stats | null>(null)
  const [intents, setIntents] = useState<Record<string, number>>({})
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsRange, setAnalyticsRange] = useState<7 | 30>(30)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [storeUserId, setStoreUserId] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'install'>('overview')
  const [activeSettingsTab, setActiveSettingsTab] = useState<'identity' | 'appearance' | 'advanced'>('identity')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMessages, setPreviewMessages] = useState<Array<{role: string; content: string; quick_replies?: string[]}>>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadAnalytics = async (days = analyticsRange) => {
    setAnalyticsLoading(true)
    try {
      const r = await fetch(`/api/agent/analytics?days=${days}`)
      const data = await r.json()
      if (data.summary) setAnalytics(data)
    } catch {} finally { setAnalyticsLoading(false) }
  }

  const loadData = async () => {
    try {
      const [configRes, statsRes, meRes] = await Promise.all([
        fetch('/api/agent/config'), fetch('/api/agent/conversations'), fetch('/api/user/me'),
      ])
      const configData = await configRes.json()
      const statsData = await statsRes.json()
      const meData = await meRes.json()
      if (configData.config) setConfig({ ...defaultConfig, ...configData.config })
      if (configData.store?.store_url) setStoreUrl(configData.store.store_url)
      if (meData.user?.id) setStoreUserId(meData.user.id)
      if (statsData.stats) setStats(statsData.stats)
      if (statsData.intents) setIntents(statsData.intents)
    } catch (e) { console.error(e) } finally { setLoading(false) }
    loadAnalytics()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/agent/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch {} finally { setSaving(false) }
  }

  const handleToggle = async () => {
    const newActive = !config.is_active
    setConfig(c => ({ ...c, is_active: newActive }))
    await fetch('/api/agent/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, is_active: newActive }) })
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) setConfig(c => ({ ...c, widget_avatar_url: data.url }))
    } catch {} finally { setUploadingAvatar(false) }
  }

  const sendPreview = async (msg: string) => {
    if (!msg || previewLoading) return
    const newMessages = [...previewMessages, { role: 'user', content: msg }]
    setPreviewMessages(newMessages); setPreviewLoading(true); setPreviewOpen(true)
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: newMessages.slice(-6).map(m => ({ role: m.role, content: m.content })), session_id: 'preview-' + Date.now(), store_user_id: storeUserId }),
      })
      const data = await res.json()
      setPreviewMessages(prev => [...prev, { role: 'assistant', content: data.message, quick_replies: data.quick_replies }])
    } catch { setPreviewMessages(prev => [...prev, { role: 'assistant', content: 'Eroare la conectare.' }]) }
    finally { setPreviewLoading(false) }
  }

  const snippetCode = `<!-- HONTRIO AI Agent -->\n<script>\n  window.HontrioAgent = {\n    userId: "${storeUserId}",\n    color: "${config.widget_color}",\n    position: "${config.widget_position}",\n    size: "${config.widget_size}",\n    bottomOffset: ${config.widget_bottom_offset},\n  };\n</script>\n<script src="https://hontrio.com/agent-widget.js" async></script>`

  const copySnippet = () => { navigator.clipboard.writeText(snippetCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const downloadPlugin = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/agent/download-plugin'); if (!res.ok) throw new Error()
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'hontrio-agent.zip'; a.click(); URL.revokeObjectURL(url)
    } catch { alert('Eroare la descărcare.') } finally { setDownloading(false) }
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}</div>

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">AI Agent</h1><p className="text-gray-500 text-sm mt-0.5">Asistent conversațional pentru magazinul tău</p></div>
          <button onClick={handleToggle} className="flex items-center gap-2 text-sm font-medium">
            {config.is_active ? <><ToggleRight className="h-8 w-8 text-green-500" /><span className="text-green-600">Activ</span></> : <><ToggleLeft className="h-8 w-8 text-gray-300" /><span className="text-gray-400">Inactiv</span></>}
          </button>
        </div>
      </motion.div>

      <div className={`rounded-2xl p-4 flex items-center justify-between ${config.is_active ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className={`text-sm font-medium ${config.is_active ? 'text-green-700' : 'text-gray-500'}`}>
            {config.is_active ? `"${config.agent_name}" este activ` : 'Agentul este oprit'}
          </span>
        </div>
        {!config.is_active && <Button onClick={handleToggle} size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl gap-1.5 text-xs"><Power className="h-3.5 w-3.5" />Activează</Button>}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[{ id: 'overview', label: 'Statistici', icon: TrendingUp }, { id: 'settings', label: 'Configurare', icon: Settings2 }, { id: 'install', label: 'Instalare', icon: ExternalLink }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); if (tab.id === 'overview') loadAnalytics() }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* STATISTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => loadAnalytics()} disabled={analyticsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50">
              {analyticsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5 rotate-180" />}
              Actualizează
            </button>
          </div>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Conversații (30z)', value: analytics?.summary.totalSessions ?? stats?.total ?? 0, icon: MessageCircle, color: 'blue', sub: analytics?.summary.weekTrend ? `${analytics.summary.weekTrend > 0 ? '+' : ''}${analytics.summary.weekTrend}% vs săpt. trecută` : undefined },
              { label: 'Vizitatori unici', value: analytics?.summary.uniqueVisitors ?? 0, icon: Users, color: 'violet', sub: analytics ? `${analytics.summary.returningVisitors} reveniri` : undefined },
              { label: 'Mesaje / conv.', value: analytics?.summary.avgMessages ?? stats?.avgMessages ?? 0, icon: Zap, color: 'amber', sub: undefined },
              { label: 'Escaladări', value: analytics?.summary.escalated ?? stats?.escalated ?? 0, icon: Phone, color: 'red', sub: analytics?.summary.totalSessions ? `${Math.round((( analytics.summary.escalated) / analytics.summary.totalSessions) * 100)}% din total` : undefined },
            ].map(stat => (
              <Card key={stat.label} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className={`h-8 w-8 rounded-xl bg-${stat.color}-100 flex items-center justify-center mb-2`}><stat.icon className={`h-4 w-4 text-${stat.color}-600`} /></div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                  {stat.sub && <p className="text-xs text-green-600 font-medium mt-1">{stat.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Grafic conversații pe zile */}
          {analytics?.conversationsPerDay && analytics.conversationsPerDay.length > 0 && (
            <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-900">Conversații pe zile</p>
                <div className="flex gap-1">
                  {([7, 30] as const).map(d => (
                    <button key={d} onClick={async () => {
                      setAnalyticsRange(d); loadAnalytics(d)
                    }} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${analyticsRange === d ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{d === 7 ? '7 zile' : '30 zile'}</button>
                  ))}
                </div>
              </div>
              {analyticsLoading ? <div className="h-28 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div> : (() => {
                const data = analytics.conversationsPerDay.slice(-(analyticsRange))
                const max = Math.max(...data.map(d => d.count), 1)
                return (
                  <div className="flex items-end gap-1 h-28">
                    {(data as {date:string;count:number}[]).map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{d.count} conv.</div>
                        <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: d.count > 0 ? '#2563eb' : '#e5e7eb' }} />
                        {(analyticsRange === 7 || i % 5 === 0) && <span className="text-[9px] text-gray-400 rotate-0">{d.date.slice(5)}</span>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Intenții vizitatori */}
            {analytics?.intentCounts && Object.keys(analytics.intentCounts).length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><BarChart2 className="h-4 w-4 text-blue-600" /><p className="text-sm font-semibold text-gray-900">Intențiile vizitatorilor</p></div>
                <div className="space-y-2.5">
                  {(() => {
                    const INTENT_COLORS: Record<string,string> = { buying_ready:'#16a34a', browsing:'#2563eb', comparing:'#7c3aed', info_shipping:'#d97706', problem:'#dc2626', escalate:'#dc2626', greeting:'#6b7280', order_tracking:'#0891b2' }
                    const entries = Object.entries(analytics.intentCounts) as [string, number][]
                    const total = entries.reduce((s, [,v]) => s + v, 0)
                    return entries.sort((a,b) => b[1]-a[1]).slice(0,6).map(([intent, count]) => (
                      <div key={intent} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 shrink-0">{INTENT_LABELS[intent] || intent}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.round((count/total)*100)}%`, background: INTENT_COLORS[intent] || '#2563eb' }} /></div>
                        <span className="text-xs font-semibold text-gray-700 w-8 text-right">{count}</span>
                      </div>
                    ))
                  })()}
                </div>
              </CardContent></Card>
            )}

            {/* Heatmap ore */}
            {analytics?.hourCounts && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><Clock className="h-4 w-4 text-amber-500" /><p className="text-sm font-semibold text-gray-900">Ore de vârf</p></div>
                <div className="grid grid-cols-12 gap-1">
                  {analytics.hourCounts.map((count, h) => {
                    const max = Math.max(...analytics.hourCounts, 1)
                    const intensity = count / max
                    return (
                      <div key={h} className="relative group">
                        <div className="h-8 rounded transition-all" style={{ background: count > 0 ? `rgba(37,99,235,${0.15 + intensity * 0.85})` : '#f3f4f6' }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{h}:00 — {count}</div>
                        {h % 6 === 0 && <p className="text-[9px] text-gray-400 text-center mt-1">{h}h</p>}
                      </div>
                    )
                  })}
                </div>
              </CardContent></Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top produse cerute */}
            {analytics?.topProducts && analytics.topProducts.length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><Star className="h-4 w-4 text-amber-500" /><p className="text-sm font-semibold text-gray-900">Top produse cerute</p></div>
                <div className="space-y-2">
                  {analytics.topProducts.slice(0,7).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i+1}</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-semibold text-blue-600">{p.count}×</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            )}

            {/* Top căutări */}
            {analytics?.topSearches && analytics.topSearches.length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><Search className="h-4 w-4 text-violet-500" /><p className="text-sm font-semibold text-gray-900">Top căutări</p></div>
                <div className="space-y-2">
                  {analytics.topSearches.slice(0,7).map((s, i) => (
                    <div key={s.query} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i+1}</span>
                      <span className="text-xs text-gray-700 flex-1 truncate capitalize">{s.query}</span>
                      <span className="text-xs font-semibold text-violet-600">{s.count}×</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            )}
          </div>

          {/* Empty state */}
          {!analytics?.summary?.totalSessions && !stats?.total && (
            <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-10 text-center">
              <BarChart2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Nicio conversație încă</p>
              <p className="text-xs text-gray-400 mt-1">Datele vor apărea odată ce vizitatoarele încep să interacționeze cu agentul.</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {[{ id: 'identity', label: 'Identitate', icon: Bot }, { id: 'appearance', label: 'Aspect', icon: Palette }, { id: 'advanced', label: 'Avansat', icon: Code2 }].map(t => (
                <button key={t.id} onClick={() => setActiveSettingsTab(t.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${activeSettingsTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <t.icon className="h-3.5 w-3.5" />{t.label}
                </button>
              ))}
            </div>

            {activeSettingsTab === 'identity' && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Avatar agent</label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center shrink-0">
                      {config.widget_avatar_url ? <img src={config.widget_avatar_url} alt="" className="w-full h-full object-cover" /> : <Bot className="w-6 h-6 text-gray-300" />}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all w-full justify-center">
                        {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingAvatar ? 'Se urcă...' : 'Încarcă poză'}
                      </button>
                      {config.widget_avatar_url && <button onClick={() => setConfig(c => ({ ...c, widget_avatar_url: '' }))} className="text-xs text-red-400 hover:text-red-500 w-full text-center">Șterge avatarul</button>}
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Sau URL direct:</p>
                  <input value={config.widget_avatar_url} onChange={e => setConfig(c => ({ ...c, widget_avatar_url: e.target.value }))}
                    placeholder="https://exemplu.ro/avatar.jpg"
                    className="mt-1.5 w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div className="h-px bg-gray-100" />
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Numele agentului</label>
                  <input value={config.agent_name} onChange={e => setConfig(c => ({ ...c, agent_name: e.target.value }))} placeholder="ex: Maria"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Mesaj de bun venit</label>
                  <textarea value={config.welcome_message} onChange={e => setConfig(c => ({ ...c, welcome_message: e.target.value }))} rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Răspunsuri rapide</label>
                  {(config.quick_replies || []).map((qr, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input value={qr} onChange={e => { const u = [...(config.quick_replies||[])]; u[i] = e.target.value; setConfig(c => ({ ...c, quick_replies: u })) }}
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                      <button onClick={() => setConfig(c => ({ ...c, quick_replies: (c.quick_replies||[]).filter((_,j) => j !== i) }))}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {(config.quick_replies || []).length < 5 && (
                    <button onClick={() => setConfig(c => ({ ...c, quick_replies: [...(c.quick_replies||[]), ''] }))} className="text-xs text-blue-500 hover:text-blue-600 font-medium">+ Adaugă răspuns rapid</button>
                  )}
                </div>
                <div className="h-px bg-gray-100" />
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-green-500" />WhatsApp escaladare</label>
                  <input value={config.whatsapp_number} onChange={e => setConfig(c => ({ ...c, whatsapp_number: e.target.value }))} placeholder="40712345678"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
              </CardContent></Card>
            )}

            {activeSettingsTab === 'appearance' && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Culoare principală</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {COLORS.map(color => (
                      <button key={color} onClick={() => setConfig(c => ({ ...c, widget_color: color }))}
                        className={`w-7 h-7 rounded-full transition-all ${config.widget_color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }} />
                    ))}
                    <input type="color" value={config.widget_color} onChange={e => setConfig(c => ({ ...c, widget_color: e.target.value }))}
                      className="w-7 h-7 rounded-full cursor-pointer border border-gray-200" />
                    <span className="text-xs text-gray-400 font-mono">{config.widget_color}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Formă buton</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'circle', label: 'Cerc', icon: Circle }, { id: 'rounded', label: 'Rotunjit', icon: Square }, { id: 'rectangle', label: 'Text + icon', icon: RectangleHorizontal }].map(s => (
                      <button key={s.id} onClick={() => setConfig(c => ({ ...c, widget_button_shape: s.id }))}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${config.widget_button_shape === s.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        <s.icon className="w-4 h-4" />{s.label}
                      </button>
                    ))}
                  </div>
                  {config.widget_button_shape === 'rectangle' && (
                    <input value={config.widget_button_label} onChange={e => setConfig(c => ({ ...c, widget_button_label: e.target.value }))}
                      placeholder="Text buton (ex: Ajutor?)" className="mt-2 w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Dimensiune</label>
                  <div className="flex gap-2">
                    {[{ id: 'small', label: 'Mic' }, { id: 'medium', label: 'Mediu' }, { id: 'large', label: 'Mare' }].map(s => (
                      <button key={s.id} onClick={() => setConfig(c => ({ ...c, widget_size: s.id }))}
                        className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-all ${config.widget_size === s.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Poziție</label>
                  <div className="flex gap-2">
                    {[{ id: 'bottom-right', label: 'Dreapta jos' }, { id: 'bottom-left', label: 'Stânga jos' }].map(pos => (
                      <button key={pos.id} onClick={() => setConfig(c => ({ ...c, widget_position: pos.id }))}
                        className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-all ${config.widget_position === pos.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{pos.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Distanță față de jos — <span className="font-bold text-gray-900">{config.widget_bottom_offset}px</span></label>
                  <input type="range" min="16" max="120" value={config.widget_bottom_offset} onChange={e => setConfig(c => ({ ...c, widget_bottom_offset: Number(e.target.value) }))} className="w-full accent-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Util dacă ai butoane WhatsApp sau telefon în colț</p>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div><p className="text-xs font-semibold text-gray-700">Animație de introducere</p><p className="text-xs text-gray-400 mt-0.5">Bubble cu mesajul de bun venit la load</p></div>
                  <button onClick={() => setConfig(c => ({ ...c, widget_intro_animation: !c.widget_intro_animation }))}
                    className={`w-10 h-6 rounded-full transition-colors relative ${config.widget_intro_animation ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config.widget_intro_animation ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </CardContent></Card>
            )}

            {activeSettingsTab === 'advanced' && (
              <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Code2 className="w-3.5 h-3.5 text-purple-500" />CSS Custom</label>
                  <p className="text-xs text-gray-400 mb-2">Suprascrie stilurile implicite ale widget-ului.</p>
                  <textarea value={config.widget_custom_css} onChange={e => setConfig(c => ({ ...c, widget_custom_css: e.target.value }))}
                    placeholder={`/* Exemplu */\n#_h * { font-family: 'Georgia', serif !important; }\n#_h_b { box-shadow: 0 0 20px rgba(37,99,235,.5) !important; }`}
                    rows={12} spellCheck={false}
                    className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-400 transition-colors resize-none bg-gray-50" />
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">🎨 Selectori principali</p>
                  <div className="space-y-0.5 text-xs font-mono text-amber-700">
                    {[['#_h_b', 'Butonul'], ['#_h_w', 'Fereastra chat'], ['#_h_hd', 'Header'], ['._h_r.u ._h_bb', 'Mesaje utilizator'], ['._h_r.b ._h_bb', 'Mesaje agent'], ['#_h_bl', 'Bubble intro']].map(([s, d]) => (
                      <div key={s} className="flex gap-2"><span className="shrink-0">{s}</span><span className="text-amber-500">— {d}</span></div>
                    ))}
                  </div>
                </div>
              </CardContent></Card>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-11 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvez...' : saved ? 'Salvat!' : 'Salvează configurarea'}
            </Button>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-gray-900">Preview live</p><p className="text-xs text-gray-400">Modificările se văd instant</p></div>
              {previewMessages.length > 0 && <button onClick={() => { setPreviewMessages([]); setPreviewOpen(false) }} className="text-xs text-gray-400 hover:text-gray-600">Resetează</button>}
            </div>
            <WidgetPreview config={config} messages={previewMessages} onSend={sendPreview} loading={previewLoading} onToggle={() => setPreviewOpen(p => !p)} isOpen={previewOpen} />
            <p className="text-xs text-gray-400 text-center">Apasă butonul din preview ca să deschizi chat-ul și să testezi</p>
          </div>
        </div>
      )}

      {/* INSTALL */}
      {activeTab === 'install' && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-2xl">🔌</div>
                <div><p className="text-white font-bold text-base">Plugin WordPress — instalare 1 click</p><p className="text-slate-400 text-sm mt-1">Descarcă pluginul pre-configurat și uploadează-l direct în WordPress.</p></div>
              </div>
              <Button onClick={downloadPlugin} disabled={downloading} className="mt-5 w-full bg-blue-500 hover:bg-blue-400 text-white rounded-xl h-11 gap-2 font-semibold text-sm">
                {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Se generează...</> : <><ArrowUpRight className="h-4 w-4" />Descarcă hontrio-agent.zip</>}
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {[{ step: '1', text: 'Descarcă ZIP-ul' }, { step: '2', text: 'WordPress → Plugins → Add New → Upload Plugin' }, { step: '3', text: 'Selectează ZIP și Install Now' }, { step: '4', text: 'Activate Plugin — gata!' }].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{s.step}</div>
                  <p className="text-sm text-gray-700">{s.text}</p>
                </div>
              ))}
            </div>
          </Card>
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 flex items-center gap-2 select-none">
              <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />Instalare manuală (cod snippet)
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
          {!config.whatsapp_number && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div><p className="text-sm font-semibold text-amber-800">Numărul WhatsApp lipsește</p><p className="text-xs text-amber-600 mt-0.5">Fără WhatsApp, vizitatorii nu pot fi escaladați.</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}