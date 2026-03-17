'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n/context'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Power, MessageCircle, Phone, Palette, Settings2,
  Copy, Check, ChevronRight, TrendingUp,
  Zap, ArrowUpRight, Loader2, Save, AlertCircle,
  ExternalLink, Upload, Code2,
  Square, Circle, RectangleHorizontal,
  X, Send, Users, Search, BarChart2, Clock, Star,
  BookOpen, FileText, Link2, Trash2, PlusCircle, CheckCircle2, AlertTriangle, Bell,
} from 'lucide-react'

const COLORS = [
  '#2563eb','#7c3aed','#db2777','#dc2626',
  '#d97706','#16a34a','#0891b2','#374151',
  '#f97316','#8b5cf6','#06b6d4','#84cc16',
]

const getIntentLabels = (t: (k: string) => string): Record<string, string> => ({
  buying_ready: t('agent.intent_buying_ready'), browsing: t('agent.intent_browsing'), comparing: t('agent.intent_comparing'),
  compatibility: t('agent.intent_compatibility'), info_product: t('agent.intent_info_product'), info_shipping: t('agent.intent_info_shipping'),
  problem: t('agent.intent_problem'), escalate: t('agent.intent_escalate'), greeting: t('agent.intent_greeting'),
})

type Config = {
  is_active: boolean; agent_name: string; welcome_message: string
  whatsapp_number: string; whatsapp_message: string
  widget_position: string; widget_color: string; widget_size: string
  widget_bottom_offset: number; widget_button_shape: string
  widget_button_label: string; widget_avatar_url: string
  widget_intro_animation: boolean; widget_custom_css: string
  quick_replies: string[]
  notify_email: string; notify_on_escalation: boolean; notify_on_problem: boolean
}
type Stats = { total: number; last7: number; escalated: number; avgMessages: number }
type KnowledgeDoc = { id: string; name: string; type: string; status: string; chunk_count: number; size_bytes: number; error_msg: string | null; created_at: string }
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
  notify_email: '', notify_on_escalation: true, notify_on_problem: true,
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`} onClick={onClick}>{children}</div>
}
function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '', type }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; type?: 'button'|'submit'
  variant?: 'primary'|'outline'|'ghost'|'success'|'danger'; size?: 'sm'|'md'; className?: string
}) {
  const base  = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const vars  = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost:   'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger:  'bg-red-500 text-white hover:bg-red-600',
  }
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${vars[variant]} ${className}`}>{children}</button>
}
function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] font-medium text-neutral-400 uppercase tracking-wide ${className}`}>{children}</p>
}
function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}>{children}</span>
}
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full relative transition-colors ${on ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  )
}

// ─── Widget Preview ───────────────────────────────────────────────────────────

function WidgetPreview({ config, messages, onSend, loading, onToggle, isOpen }: {
  config: Config
  messages: Array<{role:string;content:string;quick_replies?:string[]}>
  onSend: (msg:string) => void; loading: boolean; onToggle: () => void; isOpen: boolean
}) {
  const { t } = useT()
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const btnSize = config.widget_size === 'small' ? 44 : config.widget_size === 'large' ? 64 : 52
  const isRect  = config.widget_button_shape === 'rectangle'
  const borderRadius = config.widget_button_shape === 'circle' ? '50%' : config.widget_button_shape === 'rounded' ? '16px' : '12px'

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = () => { if (!input.trim()) return; onSend(input.trim()); setInput('') }

  return (
    <div className="relative bg-neutral-100 rounded-xl overflow-hidden" style={{ height: 520 }}>
      <div className="absolute inset-0 p-5 opacity-20 pointer-events-none select-none">
        <div className="h-4 bg-neutral-400 rounded w-2/3 mb-3" />
        <div className="h-3 bg-neutral-300 rounded w-full mb-2" />
        <div className="h-3 bg-neutral-300 rounded w-5/6 mb-5" />
        <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-neutral-200 rounded-lg" />)}</div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ scale:0.9,opacity:0,y:12 }} animate={{ scale:1,opacity:1,y:0 }} exit={{ scale:0.9,opacity:0,y:12 }} transition={{ type:'spring',stiffness:400,damping:30 }}
            className="absolute flex flex-col rounded-xl overflow-hidden shadow-2xl bg-white"
            style={{ width:280, height:380, bottom: config.widget_bottom_offset+btnSize+10, [config.widget_position==='bottom-right'?'right':'left']:12 }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 shrink-0" style={{ background: config.widget_color }}>
              {config.widget_avatar_url
                ? <img src={config.widget_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
                : <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30"><Bot className="w-4 h-4 text-white" /></div>}
              <div>
                <p className="text-white text-xs font-semibold">{config.agent_name||'Asistent'}</p>
                <div className="flex items-center gap-1 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><p className="text-white/80 text-[10px]">Online</p></div>
              </div>
              <button onClick={onToggle} className="ml-auto w-6 h-6 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-neutral-50">
              {messages.length === 0 ? (
                <div className="text-center py-6">
                  <Bot className="w-7 h-7 text-neutral-200 mx-auto mb-2" />
                  <p className="text-[11px] text-neutral-400 mb-3">{t('agent.test_message')}</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {(config.quick_replies||[]).slice(0,3).map((qr:string) => (
                      <button key={qr} onClick={() => onSend(qr)}
                        className="text-[10px] px-2 py-1 rounded-full border font-medium hover:opacity-80 transition-all"
                        style={{ color:config.widget_color, borderColor:config.widget_color+'50', background:config.widget_color+'10' }}>{qr}</button>
                    ))}
                  </div>
                </div>
              ) : messages.map((msg,i) => (
                <div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                  <div className="max-w-[85%] space-y-1.5">
                    <div className={`px-3 py-2 rounded-xl text-[11px] leading-relaxed ${msg.role==='user'?'text-white rounded-br-sm':'bg-white text-neutral-800 shadow-sm rounded-bl-sm'}`}
                      style={msg.role==='user'?{background:config.widget_color}:{}}>
                      {msg.content}
                    </div>
                    {msg.quick_replies && msg.quick_replies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.quick_replies.map((qr:string) => (
                          <button key={qr} onClick={() => onSend(qr)}
                            className="text-[10px] px-2 py-1 rounded-full border font-medium hover:opacity-80 transition-all"
                            style={{ color:config.widget_color, borderColor:config.widget_color+'50', background:config.widget_color+'10' }}>{qr}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-xl rounded-bl-sm px-3 py-2.5 shadow-sm flex gap-1">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="p-2.5 border-t border-neutral-100 bg-white flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSend()}
                placeholder={t('agent.type_message')} className="flex-1 text-[11px] bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-300 transition-colors" />
              <button onClick={handleSend} disabled={!input.trim()||loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white hover:opacity-80 disabled:opacity-40 transition-all"
                style={{ background:config.widget_color }}><Send className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-center py-1.5 text-[9px] text-neutral-300 bg-white">Powered by <span className="text-neutral-400">Hontrio</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && config.widget_intro_animation && (
          <motion.div initial={{ opacity:0,y:8,scale:0.95 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,scale:0.9 }} transition={{ delay:0.6 }}
            className="absolute rounded-xl px-3 py-2.5 shadow-lg text-[11px] text-neutral-700 font-medium max-w-[170px] cursor-pointer hover:shadow-xl transition-shadow"
            style={{ background:'#fff', bottom:config.widget_bottom_offset+btnSize+14, [config.widget_position==='bottom-right'?'right':'left']:12, boxShadow:'0 4px 20px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06)', borderBottomRightRadius:config.widget_position==='bottom-right'?4:16, borderBottomLeftRadius:config.widget_position==='bottom-left'?4:16 }}
            onClick={onToggle}>
            👋 {(config.welcome_message||'Cu ce te pot ajuta?').slice(0,55)}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.95 }} onClick={onToggle}
        className="absolute flex items-center justify-center gap-2 text-white"
        style={{ background:config.widget_color, borderRadius, width:isRect?'auto':btnSize, height:isRect?Math.round(btnSize*0.65):btnSize, paddingLeft:isRect?14:0, paddingRight:isRect?14:0, bottom:config.widget_bottom_offset, [config.widget_position==='bottom-right'?'right':'left']:12, boxShadow:`0 4px 16px ${config.widget_color}66` }}>
        {config.widget_avatar_url && !isOpen
          ? <img src={config.widget_avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          : <MessageCircle style={{ width:config.widget_size==='small'?18:config.widget_size==='large'?26:22, height:'auto' }} />}
        {isRect && <span className="text-sm font-semibold whitespace-nowrap">{config.widget_button_label||'Ajutor?'}</span>}
      </motion.button>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const { t } = useT()
  const INTENT_LABELS = getIntentLabels(t)
  const [config, setConfig]       = useState<Config>(defaultConfig)
  const [stats, setStats]         = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([])
  const [kUploadType, setKUploadType] = useState<'file'|'url'|'text'>('file')
  const [kUrl, setKUrl]           = useState('')
  const [kText, setKText]         = useState('')
  const [kName, setKName]         = useState('')
  const [kUploading, setKUploading] = useState(false)
  const [kError, setKError]       = useState('')
  const kFileRef                  = useRef<HTMLInputElement>(null)
  const [analyticsRange, setAnalyticsRange] = useState<7|30>(30)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [storeUserId, setStoreUserId] = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [copied, setCopied]       = useState(false)
  const [activeTab, setActiveTab] = useState<'overview'|'settings'|'knowledge'|'intelligence'|'notifications'|'install'>('overview')
  const [activeSettingsTab, setActiveSettingsTab] = useState<'identity'|'appearance'|'advanced'>('identity')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef            = useRef<HTMLInputElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMessages, setPreviewMessages] = useState<Array<{role:string;content:string;quick_replies?:string[]}>>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [intelStats, setIntelStats] = useState<{total_products:number;intelligence:Record<string,number>;coverage:number;products?:any[]}|null>(null)
  const [intelGenerating, setIntelGenerating] = useState(false)
  const [intelResult, setIntelResult] = useState<{generated:number;skipped:number;failed:number;credits_used:number}|null>(null)
  const [intelError, setIntelError] = useState('')
  const [intelProducts, setIntelProducts] = useState<any[]>([])
  const [intelSelected, setIntelSelected] = useState<Set<string>>(new Set())
  const [intelExpanded, setIntelExpanded] = useState<string|null>(null)
  const [intelSearch, setIntelSearch] = useState('')
  const [intelFilter, setIntelFilter] = useState<'all'|'ready'|'none'|'failed'>('all')
  const [intelEditing, setIntelEditing] = useState<Record<string, any>>({})
  const [intelSaving, setIntelSaving] = useState(false)

  const startEditIntel = (productId: string, product: any) => {
    setIntelEditing({
      productId,
      technical_summary: product.technical_summary || '',
      sales_summary: product.sales_summary || '',
      best_for: product.best_for || '',
      top_benefits: product.top_benefits || [],
      key_specs: product.key_specs || {},
      faq_candidates: product.faq_candidates || [],
    })
  }

  const saveEditIntel = async () => {
    if (!intelEditing.productId) return
    setIntelSaving(true)
    try {
      const { productId, ...fields } = intelEditing
      const res = await fetch('/api/agent/generate-intelligence', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, fields }),
      })
      if (res.ok) {
        setIntelEditing({})
        loadIntelStats()
      }
    } catch {} finally { setIntelSaving(false) }
  }

  const loadIntelStats = async () => {
    try {
      const res = await fetch('/api/agent/generate-intelligence?details=true')
      const data = await res.json()
      if (data.total_products !== undefined) {
        setIntelStats(data)
        if (data.products) setIntelProducts(data.products)
      }
    } catch {}
  }

  const generateIntelligence = async (force: boolean = false, selectedOnly: boolean = false) => {
    setIntelGenerating(true); setIntelResult(null); setIntelError('')
    try {
      const body: Record<string, any> = { force }
      if (selectedOnly && intelSelected.size > 0) body.product_ids = Array.from(intelSelected)
      const res = await fetch('/api/agent/generate-intelligence', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setIntelError(data.error||t('common.error_generic')); return }
      setIntelResult(data); setIntelSelected(new Set()); loadIntelStats()
    } catch { setIntelError(t('agent.error_network')) } finally { setIntelGenerating(false) }
  }

  const loadKnowledge = async () => {
    try { const r = await fetch('/api/agent/knowledge'); const data = await r.json(); if (data.documents) setKnowledgeDocs(data.documents) } catch {}
  }

  const uploadKnowledge = async (file?: File) => {
    setKUploading(true); setKError('')
    try {
      const fd = new FormData()
      if (file) { fd.append('file', file); fd.append('name', kName||file.name) }
      else if (kUploadType==='url') { fd.append('url', kUrl); fd.append('name', kName||kUrl) }
      else { fd.append('text', kText); fd.append('name', kName||'Text manual') }
      const r = await fetch('/api/agent/knowledge/upload', { method:'POST', body:fd })
      const data = await r.json()
      if (!r.ok) { setKError(data.error||t('common.error_upload')); return }
      setKUrl(''); setKText(''); setKName('')
      await loadKnowledge()
    } catch { setKError(t('agent.error_upload_label')) } finally { setKUploading(false) }
  }

  const deleteKnowledge = async (id: string) => {
    if (!confirm(t('agent.confirm_delete_doc'))) return
    await fetch('/api/agent/knowledge', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setKnowledgeDocs(prev => prev.filter(d => d.id !== id))
  }

  const loadAnalytics = async (days=analyticsRange) => {
    setAnalyticsLoading(true)
    try { const r = await fetch(`/api/agent/analytics?days=${days}`); const data = await r.json(); if (data.summary) setAnalytics(data) } catch {} finally { setAnalyticsLoading(false) }
  }

  const loadData = async () => {
    try {
      const [configRes, statsRes, meRes] = await Promise.all([fetch('/api/agent/config'), fetch('/api/agent/conversations'), fetch('/api/user/me')])
      const configData = await configRes.json(); const statsData = await statsRes.json(); const meData = await meRes.json()
      if (configData.config) setConfig({ ...defaultConfig, ...configData.config })
      if (meData.user?.id) setStoreUserId(meData.user.id)
      if (statsData.stats) setStats(statsData.stats)
    } catch {} finally { setLoading(false) }
    loadAnalytics()
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try { const res = await fetch('/api/agent/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(config) }); if (res.ok) { setSaved(true); setTimeout(()=>setSaved(false),3000) } } catch {} finally { setSaving(false) }
  }

  const handleToggle = async () => {
    const newActive = !config.is_active
    setConfig(c => ({ ...c, is_active: newActive }))
    await fetch('/api/agent/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...config, is_active: newActive }) })
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try { const fd = new FormData(); fd.append('file', file); const res = await fetch('/api/user/avatar', { method:'POST', body:fd }); const data = await res.json(); if (data.url) setConfig(c => ({ ...c, widget_avatar_url: data.url })) } catch {} finally { setUploadingAvatar(false) }
  }

  const sendPreview = async (msg: string) => {
    if (!msg || previewLoading) return
    const newMessages = [...previewMessages, { role:'user', content:msg }]
    setPreviewMessages(newMessages); setPreviewLoading(true); setPreviewOpen(true)
    try {
      const res  = await fetch('/api/agent/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message:msg, history:newMessages.slice(-6).map(m=>({ role:m.role, content:m.content })), session_id:'preview-'+Date.now(), store_user_id:storeUserId }) })
      const data = await res.json()
      setPreviewMessages(prev => [...prev, { role:'assistant', content:data.message, quick_replies:data.quick_replies }])
    } catch { setPreviewMessages(prev => [...prev, { role:'assistant', content:t('agent.connection_error') }]) }
    finally { setPreviewLoading(false) }
  }

  const appBase = typeof window !== 'undefined' ? window.location.origin : 'https://app.hontrio.com'
  const snippetCode = `<!-- HONTRIO AI Agent -->\n<script>\n  window.HontrioAgent = {\n    userId: "${storeUserId}",\n    apiBase: "${appBase}",\n    color: "${config.widget_color}",\n    position: "${config.widget_position}",\n  };\n</script>\n<script src="${appBase}/agent-widget.js" async></script>`

  const copySnippet = () => { navigator.clipboard.writeText(snippetCode); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  const MAIN_TABS = [
    { id:'overview',      label:t('agent.overview_label'),  icon:TrendingUp },
    { id:'settings',      label:t('agent.config_tab'), icon:Settings2  },
    { id:'knowledge',     label:t('agent.knowledge_label'),  icon:BookOpen   },
    { id:'intelligence',  label:t('agent.intelligence_title'),icon:Zap        },
    { id:'notifications', label:t('agent.notifications_label'),  icon:Bell       },
    { id:'install',       label:t('agent.install_tab'),   icon:ExternalLink},
  ] as const

  if (loading) return (
    <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-neutral-100 rounded-xl animate-pulse" />)}</div>
  )

  // ── intent bar colors
  const INTENT_COLORS: Record<string,string> = { buying_ready:'#16a34a', browsing:'#2563eb', comparing:'#7c3aed', info_shipping:'#d97706', problem:'#ef4444', escalate:'#ef4444', greeting:'#94a3b8' }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('agent.title')}</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">{t('agent.subtitle')}</p>
        </div>
        <button onClick={handleToggle} className="flex items-center gap-2 text-[12px] font-medium">
          {config.is_active
            ? <><span className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-100"><span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse block" /></span><span className="text-emerald-600">{t('common.active_label')}</span></>
            : <><span className="h-8 w-8 flex items-center justify-center rounded-full bg-neutral-100"><span className="w-3 h-3 rounded-full bg-neutral-300 block" /></span><span className="text-neutral-400">{t('common.inactive_label')}</span></>}
        </button>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-4 flex items-center justify-between border ${config.is_active ? 'bg-emerald-50 border-emerald-100' : 'bg-neutral-50 border-neutral-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${config.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
          <span className={`text-[13px] font-medium ${config.is_active ? 'text-emerald-700' : 'text-neutral-500'}`}>
            {config.is_active ? `"${config.agent_name}" ${t('agent.active').toLowerCase()}` : t('agent.inactive')}
          </span>
        </div>
        {!config.is_active && (
          <Btn onClick={handleToggle} variant="success" size="sm">
            <Power className="h-3 w-3" />{t('agent.activate')}
          </Btn>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl overflow-x-auto scrollbar-none">
        {MAIN_TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id==='overview') loadAnalytics(); if (tab.id==='knowledge') loadKnowledge(); if (tab.id==='intelligence') loadIntelStats() }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${activeTab===tab.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <tab.icon className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Btn variant="ghost" size="sm" onClick={() => loadAnalytics()} disabled={analyticsLoading}>
              {analyticsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3 rotate-180" />}{t('agent.update_stats')}
            </Btn>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:t('agent.conversations_30d'), value:analytics?.summary.totalSessions??stats?.total??0,  icon:MessageCircle, color:'text-blue-600',   bg:'bg-blue-50',   sub:analytics?.summary.weekTrend ? `${analytics.summary.weekTrend>0?'+':''}${analytics.summary.weekTrend}% ${t('agent.vs_last_week')}` : undefined },
              { label:t('agent.unique_visitors'),  value:analytics?.summary.uniqueVisitors??0,               icon:Users,         color:'text-violet-600', bg:'bg-violet-50', sub:analytics?`${analytics.summary.returningVisitors} ${t('agent.returns_label')}`:undefined },
              { label:t('agent.messages_per_conv'),    value:analytics?.summary.avgMessages??stats?.avgMessages??0, icon:Zap,          color:'text-amber-600',  bg:'bg-amber-50',  sub:undefined },
              { label:t('agent.escalations'),        value:analytics?.summary.escalated??stats?.escalated??0,  icon:Phone,         color:'text-red-500',    bg:'bg-red-50',    sub:analytics?.summary.totalSessions ? `${Math.round((analytics.summary.escalated/analytics.summary.totalSessions)*100)}% ${t('agent.of_total')}` : undefined },
            ].map(stat => (
              <Card key={stat.label} className="p-4">
                <div className={`h-8 w-8 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-[22px] font-bold text-neutral-900 tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">{stat.label}</p>
                {stat.sub && <p className="text-[10px] text-emerald-600 font-medium mt-1">{stat.sub}</p>}
              </Card>
            ))}
          </div>

          {/* Conversații pe zile */}
          {analytics?.conversationsPerDay && analytics.conversationsPerDay.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-semibold text-neutral-900">{t('agent.conversations_per_day')}</p>
                <div className="flex gap-1">
                  {([7,30] as const).map(d => (
                    <button key={d} onClick={() => { setAnalyticsRange(d); loadAnalytics(d) }}
                      className={`h-7 px-3 rounded-lg text-[11px] font-medium transition-all ${analyticsRange===d ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                      {d} zile
                    </button>
                  ))}
                </div>
              </div>
              {analyticsLoading
                ? <div className="h-28 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>
                : (() => {
                    const data = analytics.conversationsPerDay.slice(-analyticsRange)
                    const max  = Math.max(...data.map(d => d.count), 1)
                    return (
                      <div className="flex items-end gap-1 h-28">
                        {data.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{d.count} conv.</div>
                            <div className="w-full rounded-t-sm transition-all" style={{ height:`${Math.max(4,(d.count/max)*100)}%`, background:d.count>0?'#2563eb':'#e5e7eb' }} />
                            {(analyticsRange===7||i%5===0) && <span className="text-[9px] text-neutral-400">{d.date.slice(5)}</span>}
                          </div>
                        ))}
                      </div>
                    )
                  })()
              }
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Intenții */}
            {analytics?.intentCounts && Object.keys(analytics.intentCounts).length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-blue-600" />
                  <p className="text-[13px] font-semibold text-neutral-900">{t('agent.visitor_intents')}</p>
                </div>
                <div className="space-y-2.5">
                  {(() => {
                    const entries = Object.entries(analytics.intentCounts) as [string,number][]
                    const total   = entries.reduce((s,[,v])=>s+v,0)
                    return entries.sort((a,b)=>b[1]-a[1]).slice(0,6).map(([intent,count]) => (
                      <div key={intent} className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-600 w-28 shrink-0">{INTENT_LABELS[intent]||intent}</span>
                        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width:`${Math.round((count/total)*100)}%`, background:INTENT_COLORS[intent]||'#2563eb' }} />
                        </div>
                        <span className="text-[11px] font-semibold text-neutral-700 w-6 text-right tabular-nums">{count}</span>
                      </div>
                    ))
                  })()}
                </div>
              </Card>
            )}

            {/* Heatmap ore */}
            {analytics?.hourCounts && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <p className="text-[13px] font-semibold text-neutral-900">{t('agent.peak_hours')}</p>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {analytics.hourCounts.map((count, h) => {
                    const max = Math.max(...analytics.hourCounts, 1)
                    const intensity = count/max
                    return (
                      <div key={h} className="relative group">
                        <div className="h-8 rounded transition-all" style={{ background:count>0?`rgba(37,99,235,${0.15+intensity*0.85})`:'#f3f4f6' }} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{h}:00 — {count}</div>
                        {h%6===0 && <p className="text-[9px] text-neutral-400 text-center mt-1">{h}h</p>}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics?.topProducts && analytics.topProducts.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4"><Star className="h-4 w-4 text-amber-400 fill-amber-400" /><p className="text-[13px] font-semibold text-neutral-900">{t('agent.top_products')}</p></div>
                <div className="space-y-2">
                  {analytics.topProducts.slice(0,7).map((p,i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-neutral-300 w-4 tabular-nums">{i+1}</span>
                      <span className="text-[11px] text-neutral-700 flex-1 truncate">{p.name}</span>
                      <span className="text-[11px] font-semibold text-blue-600 tabular-nums">{p.count}×</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {analytics?.topSearches && analytics.topSearches.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4"><Search className="h-4 w-4 text-violet-500" /><p className="text-[13px] font-semibold text-neutral-900">{t('agent.top_searches')}</p></div>
                <div className="space-y-2">
                  {analytics.topSearches.slice(0,7).map((s,i) => (
                    <div key={s.query} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-neutral-300 w-4 tabular-nums">{i+1}</span>
                      <span className="text-[11px] text-neutral-700 flex-1 truncate capitalize">{s.query}</span>
                      <span className="text-[11px] font-semibold text-violet-600 tabular-nums">{s.count}×</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {!analytics?.summary?.totalSessions && !stats?.total && (
            <Card className="p-10 text-center">
              <BarChart2 className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-[13px] font-medium text-neutral-500">{t('agent.no_conversations_yet')}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{t('agent.data_will_appear')}</p>
            </Card>
          )}
        </div>
      )}

      {/* ─── SETTINGS ─── */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
              {([{ id:'identity',label:t('agent.config_identity'),icon:Bot },{ id:'appearance',label:t('agent.config_appearance'),icon:Palette },{ id:'advanced',label:t('agent.config_advanced'),icon:Code2 }] as const).map(t => (
                <button key={t.id} onClick={() => setActiveSettingsTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all ${activeSettingsTab===t.id?'bg-white text-neutral-900 shadow-sm':'text-neutral-500 hover:text-neutral-700'}`}>
                  <t.icon className="h-3.5 w-3.5" />{t.label}
                </button>
              ))}
            </div>

            {activeSettingsTab === 'identity' && (
              <Card className="p-5 space-y-4">
                {/* Avatar */}
                <div>
                  <SectionLabel className="mb-2 block">Avatar agent</SectionLabel>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-neutral-100 bg-neutral-50 flex items-center justify-center shrink-0">
                      {config.widget_avatar_url ? <img src={config.widget_avatar_url} alt="" className="w-full h-full object-cover" /> : <Bot className="w-6 h-6 text-neutral-300" />}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <Btn variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="w-full justify-center">
                        {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingAvatar ? t('common.uploading') : t('common.upload_photo')}
                      </Btn>
                      {config.widget_avatar_url && <button onClick={() => setConfig(c => ({ ...c, widget_avatar_url:'' }))} className="text-[11px] text-red-400 hover:text-red-500 w-full text-center">{t('agent.delete_avatar')}</button>}
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-2">{t('agent.or_url_direct')}</p>
                  <input value={config.widget_avatar_url} onChange={e => setConfig(c => ({ ...c, widget_avatar_url:e.target.value }))} placeholder={t('agent.avatar_url_placeholder')}
                    className="mt-1.5 w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div className="h-px bg-neutral-100" />
                <div>
                  <SectionLabel className="mb-1.5 block">{t('agent.agent_name_label')}</SectionLabel>
                  <input value={config.agent_name} onChange={e => setConfig(c => ({ ...c, agent_name:e.target.value }))} placeholder={t('agent.agent_name_placeholder')}
                    className="w-full text-[13px] border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div>
                  <SectionLabel className="mb-1.5 block">{t('agent.welcome_msg_label')}</SectionLabel>
                  <textarea value={config.welcome_message} onChange={e => setConfig(c => ({ ...c, welcome_message:e.target.value }))} rows={3}
                    className="w-full text-[13px] border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors resize-none" />
                </div>
                <div>
                  <SectionLabel className="mb-2 block">{t('agent.quick_replies_label')}</SectionLabel>
                  {(config.quick_replies||[]).map((qr,i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input value={qr} onChange={e => { const u=[...(config.quick_replies||[])]; u[i]=e.target.value; setConfig(c=>({...c,quick_replies:u})) }}
                        className="flex-1 text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                      <button onClick={() => setConfig(c => ({ ...c, quick_replies:(c.quick_replies||[]).filter((_,j)=>j!==i) }))} className="p-1.5 rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(config.quick_replies||[]).length < 5 && (
                    <button onClick={() => setConfig(c => ({ ...c, quick_replies:[...(c.quick_replies||[]),''] }))} className="text-[12px] text-blue-500 hover:text-blue-600 font-medium">{t('agent.add_quick_reply')}</button>
                  )}
                </div>
                <div className="h-px bg-neutral-100" />
                <div>
                  <SectionLabel className="mb-1.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-500" />{t('agent.whatsapp_escalation')}</SectionLabel>
                  <input value={config.whatsapp_number} onChange={e => setConfig(c => ({ ...c, whatsapp_number:e.target.value }))} placeholder="40712345678"
                    className="w-full text-[13px] border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors mt-1.5" />
                </div>
              </Card>
            )}

            {activeSettingsTab === 'appearance' && (
              <Card className="p-5 space-y-5">
                {/* Culoare */}
                <div>
                  <SectionLabel className="mb-2 block">{t('agent.primary_color')}</SectionLabel>
                  <div className="flex gap-2 flex-wrap items-center">
                    {COLORS.map(color => (
                      <button key={color} onClick={() => setConfig(c => ({ ...c, widget_color:color }))}
                        className={`w-7 h-7 rounded-full transition-all ${config.widget_color===color?'ring-2 ring-offset-2 ring-neutral-400 scale-110':'hover:scale-105'}`}
                        style={{ backgroundColor:color }} />
                    ))}
                    <input type="color" value={config.widget_color} onChange={e => setConfig(c => ({ ...c, widget_color:e.target.value }))} className="w-7 h-7 rounded-full cursor-pointer border border-neutral-200" />
                    <span className="text-[10px] text-neutral-400 font-mono">{config.widget_color}</span>
                  </div>
                </div>
                {/* Formă buton */}
                <div>
                  <SectionLabel className="mb-2 block">{t('agent.button_shape')}</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id:'circle',label:t('agent.shape_circle'),icon:Circle },{ id:'rounded',label:t('agent.shape_rounded'),icon:Square },{ id:'rectangle',label:t('agent.shape_rectangle'),icon:RectangleHorizontal }].map(s => (
                      <button key={s.id} onClick={() => setConfig(c => ({ ...c, widget_button_shape:s.id }))}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-medium transition-all ${config.widget_button_shape===s.id?'border-blue-500 bg-blue-50 text-blue-600':'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
                        <s.icon className="w-4 h-4" />{s.label}
                      </button>
                    ))}
                  </div>
                  {config.widget_button_shape==='rectangle' && (
                    <input value={config.widget_button_label} onChange={e => setConfig(c => ({ ...c, widget_button_label:e.target.value }))} placeholder={t('agent.button_label_placeholder')}
                      className="mt-2 w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
                  )}
                </div>
                {/* Dimensiune */}
                <div>
                  <SectionLabel className="mb-2 block">{t('agent.widget_size')}</SectionLabel>
                  <div className="flex gap-2">
                    {[{ id:'small',label:t('agent.size_small') },{ id:'medium',label:t('agent.size_medium') },{ id:'large',label:t('agent.size_large') }].map(s => (
                      <button key={s.id} onClick={() => setConfig(c => ({ ...c, widget_size:s.id }))}
                        className={`flex-1 py-2 text-[11px] rounded-xl border font-medium transition-all ${config.widget_size===s.id?'border-blue-500 bg-blue-50 text-blue-600':'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
                {/* Poziție */}
                <div>
                  <SectionLabel className="mb-2 block">{t('agent.widget_position')}</SectionLabel>
                  <div className="flex gap-2">
                    {[{ id:'bottom-right',label:t('agent.pos_bottom_right') },{ id:'bottom-left',label:t('agent.pos_bottom_left') }].map(pos => (
                      <button key={pos.id} onClick={() => setConfig(c => ({ ...c, widget_position:pos.id }))}
                        className={`flex-1 py-2 text-[11px] rounded-xl border font-medium transition-all ${config.widget_position===pos.id?'border-blue-500 bg-blue-50 text-blue-600':'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>{pos.label}</button>
                    ))}
                  </div>
                </div>
                {/* Offset */}
                <div>
                  <SectionLabel className="mb-2 block">Distanță față de jos — <span className="text-neutral-700 font-semibold">{config.widget_bottom_offset}px</span></SectionLabel>
                  <input type="range" min={16} max={120} value={config.widget_bottom_offset} onChange={e => setConfig(c => ({ ...c, widget_bottom_offset:Number(e.target.value) }))} className="w-full accent-blue-500" />
                </div>
                {/* Animație */}
                <div className="flex items-center justify-between py-2 border-t border-neutral-100">
                  <div>
                    <p className="text-[12px] font-semibold text-neutral-700">{t('agent.intro_animation')}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{t('agent.bubble_welcome')}</p>
                  </div>
                  <Toggle on={config.widget_intro_animation} onToggle={() => setConfig(c => ({ ...c, widget_intro_animation:!c.widget_intro_animation }))} />
                </div>
              </Card>
            )}

            {activeSettingsTab === 'advanced' && (
              <Card className="p-5 space-y-4">
                <div>
                  <SectionLabel className="flex items-center gap-1.5 mb-1"><Code2 className="w-3.5 h-3.5 text-violet-500" />CSS Custom</SectionLabel>
                  <p className="text-[10px] text-neutral-400 mb-2">{t('agent.css_desc')}</p>
                  <textarea value={config.widget_custom_css} onChange={e => setConfig(c => ({ ...c, widget_custom_css:e.target.value }))}
                    placeholder={t('agent.css_placeholder')}
                    rows={12} spellCheck={false}
                    className="w-full text-[11px] font-mono border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 transition-colors resize-none bg-neutral-50" />
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-amber-800 mb-1.5">{t('agent.css_selectors')}</p>
                  <div className="space-y-0.5 text-[10px] font-mono text-amber-700">
                    {[['#_h_b',t('agent.css_selector_button')],['#_h_w',t('agent.css_selector_window')],['#_h_hd',t('agent.css_selector_header')],['._h_r.u ._h_bb',t('agent.css_selector_user_msg')],['._h_r.b ._h_bb',t('agent.css_selector_agent_msg')],['#_h_bl',t('agent.css_selector_bubble')]].map(([s,d]) => (
                      <div key={s} className="flex gap-2"><span className="shrink-0">{s}</span><span className="text-amber-500">— {d}</span></div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <Btn onClick={handleSave} disabled={saving} variant={saved?'success':'primary'} className="w-full justify-center h-10">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? t('common.saving') : saved ? t('common.saved') : t('agent.save_config_label')}
            </Btn>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-neutral-900">{t('agent.live_preview')}</p>
                <p className="text-[11px] text-neutral-400">{t('agent.changes_instant')}</p>
              </div>
              {previewMessages.length > 0 && <Btn variant="ghost" size="sm" onClick={() => { setPreviewMessages([]); setPreviewOpen(false) }}>{t('agent.reset_label')}</Btn>}
            </div>
            <WidgetPreview config={config} messages={previewMessages} onSend={sendPreview} loading={previewLoading} onToggle={() => setPreviewOpen(p=>!p)} isOpen={previewOpen} />
            <p className="text-[10px] text-neutral-400 text-center">{t('agent.preview_hint')}</p>
          </div>
        </div>
      )}

      {/* ─── INTELLIGENCE ─── */}
      {activeTab === 'intelligence' && (() => {
        const filteredProducts = intelProducts.filter(p => {
          if (intelSearch && !p.title.toLowerCase().includes(intelSearch.toLowerCase()) && !(p.category||'').toLowerCase().includes(intelSearch.toLowerCase())) return false
          if (intelFilter === 'ready' && p.intel_status !== 'ready') return false
          if (intelFilter === 'none' && p.intel_status !== 'none') return false
          if (intelFilter === 'failed' && p.intel_status !== 'failed') return false
          return true
        })
        const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => intelSelected.has(p.id))
        const toggleAll = () => {
          if (allFilteredSelected) setIntelSelected(new Set())
          else setIntelSelected(new Set(filteredProducts.map(p => p.id)))
        }
        return (
        <div className="space-y-4">
          {/* Stats */}
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"><Zap className="h-5 w-5 text-white" /></div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-neutral-900">{t('agent.intel_title')}</p>
                <p className="text-[11px] text-neutral-400">{t('agent.intel_desc')}</p>
              </div>
            </div>
            {intelStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label:t('agent.intel_total'),  val:intelStats.total_products, bg:'bg-neutral-50', text:'text-neutral-900' },
                  { label:'Cu intelligence', val:intelStats.intelligence?.ready||0, bg:'bg-emerald-50', text:'text-emerald-600' },
                  { label:t('agent.intel_processing'), val:(intelStats.intelligence?.processing||0)+(intelStats.intelligence?.pending||0), bg:'bg-amber-50', text:'text-amber-600' },
                  { label:t('agent.intel_failed'), val:intelStats.intelligence?.failed||0, bg:'bg-red-50', text:'text-red-500' },
                ].map(x => (
                  <div key={x.label} className={`${x.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-[18px] font-bold ${x.text} tabular-nums`}>{x.val}</p>
                    <SectionLabel className="mt-0.5">{x.label}</SectionLabel>
                  </div>
                ))}
              </div>
            )}
            {intelStats && intelStats.total_products > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium text-neutral-600">{t('agent.intel_coverage')}</span>
                  <span className="text-[12px] font-bold text-neutral-900 tabular-nums">{intelStats.coverage}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700" style={{ width:`${intelStats.coverage}%` }} />
                </div>
              </div>
            )}
            {intelResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-emerald-600">{intelResult.generated} generate · {intelResult.skipped} ignorate · {intelResult.failed} eșuate · {intelResult.credits_used} credite</p>
              </div>
            )}
            {intelError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[12px] text-red-600">{intelError}</p>
              </div>
            )}
          </Card>

          {/* Product Selector + Intelligence Viewer */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300" />
                <input value={intelSearch} onChange={e => setIntelSearch(e.target.value)} placeholder={t('agent.search_products_placeholder')} className="w-full pl-9 pr-3 h-9 bg-neutral-50 border border-neutral-200 rounded-xl text-[13px] outline-none focus:border-neutral-400" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([['all',t('agent.filter_all')],['ready',t('agent.filter_with_ai')],['none',t('agent.filter_without_ai')],['failed',t('agent.filter_failed')]] as const).map(([v,l]) => (
                  <button key={v} onClick={() => setIntelFilter(v)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${intelFilter===v ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>{l}</button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-neutral-100">
              <button onClick={toggleAll} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                {allFilteredSelected ? t('agent.deselect_all_intel') : `${t('agent.select_all_intel')} (${filteredProducts.length})`}
              </button>
              {intelSelected.size > 0 && (
                <>
                  <span className="text-[11px] text-neutral-300">|</span>
                  <span className="text-[11px] text-neutral-500">{intelSelected.size} selectate</span>
                  <Btn onClick={() => generateIntelligence(false, true)} disabled={intelGenerating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 px-3 text-[11px] ml-auto">
                    {intelGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {t('agent.generate_for_selected')} ({intelSelected.size})
                  </Btn>
                </>
              )}
              {intelSelected.size === 0 && (
                <div className="flex gap-2 ml-auto">
                  <Btn onClick={() => generateIntelligence(false)} disabled={intelGenerating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-8 px-3 text-[11px]">
                    {intelGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {t('agent.generate_all_intel')}
                  </Btn>
                  <Btn onClick={() => generateIntelligence(true)} disabled={intelGenerating} variant="outline" className="h-8 px-3 text-[11px]">{t('agent.intel_regenerate')}</Btn>
                </div>
              )}
            </div>

            {/* Product list */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredProducts.length === 0 && <p className="text-[12px] text-neutral-400 text-center py-8">{t('agent.intel_no_products')}</p>}
              {filteredProducts.map(p => (
                <div key={p.id} className="border border-neutral-100 rounded-xl overflow-hidden hover:border-neutral-200 transition-colors">
                  {/* Product row */}
                  <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setIntelExpanded(intelExpanded === p.id ? null : p.id)}>
                    <input type="checkbox" checked={intelSelected.has(p.id)} onChange={e => {
                      e.stopPropagation()
                      const next = new Set(intelSelected)
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                      setIntelSelected(next)
                    }} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-neutral-300 text-blue-600 shrink-0" />
                    {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-100" /> : <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-neutral-300" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-neutral-900 truncate">{p.title}</p>
                      <p className="text-[11px] text-neutral-400">{p.category || 'Fără categorie'}{p.price ? ` · ${p.price} RON` : ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      p.intel_status === 'ready' ? 'bg-emerald-50 text-emerald-600' :
                      p.intel_status === 'processing' ? 'bg-amber-50 text-amber-600' :
                      p.intel_status === 'failed' ? 'bg-red-50 text-red-500' :
                      'bg-neutral-50 text-neutral-400'
                    }`}>{p.intel_status === 'ready' ? t('agent.ai_ready') : p.intel_status === 'processing' ? t('agent.processing_dots') : p.intel_status === 'failed' ? t('agent.failed_label') : t('agent.no_ai')}</span>
                    <ChevronRight className={`h-4 w-4 text-neutral-300 transition-transform shrink-0 ${intelExpanded === p.id ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Expanded intelligence view */}
                  {intelExpanded === p.id && p.intel_status === 'ready' && (() => {
                    const isEd = intelEditing.productId === p.id
                    const ed = isEd ? intelEditing : null
                    const setField = (key: string, val: any) => setIntelEditing(prev => ({ ...prev, [key]: val }))
                    return (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 space-y-4">
                      {/* Edit / Save / Cancel buttons */}
                      <div className="flex justify-end gap-2">
                        {!isEd ? (
                          <button onClick={(e) => { e.stopPropagation(); startEditIntel(p.id, p) }} className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"><Settings2 className="h-3 w-3" />{t('agent.intel_edit')}</button>
                        ) : (
                          <>
                            <button onClick={() => setIntelEditing({})} className="text-[11px] font-medium text-neutral-400 hover:text-neutral-600">{t('agent.intel_cancel')}</button>
                            <button onClick={saveEditIntel} disabled={intelSaving} className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50">{intelSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Salvează</button>
                          </>
                        )}
                      </div>

                      {/* Technical summary */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{t('agent.intel_tech_summary')}</p>
                        {isEd ? <textarea value={ed?.technical_summary||''} onChange={e => setField('technical_summary', e.target.value)} className="w-full text-[12px] text-neutral-700 bg-white border border-neutral-200 rounded-lg p-2.5 leading-relaxed outline-none focus:border-blue-400 min-h-[60px] resize-y" />
                          : <p className="text-[12px] text-neutral-700 leading-relaxed">{p.technical_summary || 'N/A'}</p>}
                      </div>

                      {/* Sales summary */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{t('agent.intel_sales_summary')}</p>
                        {isEd ? <textarea value={ed?.sales_summary||''} onChange={e => setField('sales_summary', e.target.value)} className="w-full text-[12px] text-neutral-700 bg-white border border-neutral-200 rounded-lg p-2.5 leading-relaxed outline-none focus:border-blue-400 min-h-[60px] resize-y" />
                          : <p className="text-[12px] text-neutral-700 leading-relaxed">{p.sales_summary || 'N/A'}</p>}
                      </div>

                      {/* Best for */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{t('agent.intel_best_for')}</p>
                        {isEd ? <textarea value={ed?.best_for||''} onChange={e => setField('best_for', e.target.value)} className="w-full text-[12px] text-neutral-700 bg-white border border-neutral-200 rounded-lg p-2.5 leading-relaxed outline-none focus:border-blue-400 min-h-[40px] resize-y" />
                          : <p className="text-[12px] text-neutral-700 leading-relaxed">{p.best_for || 'N/A'}</p>}
                      </div>

                      {/* Benefits */}
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{t('agent.intel_benefits')}</p>
                        {isEd ? (
                          <div className="space-y-1.5">
                            {(ed?.top_benefits||[]).map((b: string, i: number) => (
                              <div key={i} className="flex gap-2 items-center">
                                <input value={b} onChange={e => { const arr = [...(ed?.top_benefits||[])]; arr[i] = e.target.value; setField('top_benefits', arr) }} className="flex-1 text-[11px] bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400" />
                                <button onClick={() => { const arr = [...(ed?.top_benefits||[])]; arr.splice(i,1); setField('top_benefits', arr) }} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                              </div>
                            ))}
                            <button onClick={() => setField('top_benefits', [...(ed?.top_benefits||[]), ''])} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">{t('agent.intel_add_benefit')}</button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">{(p.top_benefits||[]).map((b: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-medium">{b}</span>
                          ))}</div>
                        )}
                      </div>

                      {/* Key specs */}
                      {(isEd || (p.key_specs && Object.keys(p.key_specs).length > 0)) && (
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{t('agent.intel_specs')}</p>
                          {isEd ? (
                            <div className="space-y-1.5">
                              {Object.entries(ed?.key_specs||{}).map(([k, v]) => (
                                <div key={k} className="flex gap-2 items-center">
                                  <input value={k} onChange={e => { const specs = {...(ed?.key_specs||{})}; const val = specs[k]; delete specs[k]; specs[e.target.value] = val; setField('key_specs', specs) }} className="w-1/3 text-[11px] bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400" placeholder={t('agent.spec_placeholder')} />
                                  <input value={String(v)} onChange={e => { const specs = {...(ed?.key_specs||{})}; specs[k] = e.target.value; setField('key_specs', specs) }} className="flex-1 text-[11px] bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400" placeholder={t('agent.value_placeholder')} />
                                  <button onClick={() => { const specs = {...(ed?.key_specs||{})}; delete specs[k]; setField('key_specs', specs) }} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                                </div>
                              ))}
                              <button onClick={() => setField('key_specs', {...(ed?.key_specs||{}), '': ''})} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">{t('agent.intel_add_spec')}</button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">{Object.entries(p.key_specs||{}).map(([k, v]) => (
                              <div key={k} className="bg-white rounded-lg p-2 border border-neutral-100">
                                <p className="text-[10px] text-neutral-400">{k}</p>
                                <p className="text-[12px] font-semibold text-neutral-900">{String(v)}</p>
                              </div>
                            ))}</div>
                          )}
                        </div>
                      )}

                      {/* FAQ */}
                      {(isEd || (p.faq_candidates && p.faq_candidates.length > 0)) && (
                        <div>
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">{t('agent.intel_faq')}</p>
                          {isEd ? (
                            <div className="space-y-2">
                              {(ed?.faq_candidates||[]).map((f: any, i: number) => (
                                <div key={i} className="bg-white rounded-lg p-2.5 border border-neutral-200 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <input value={f.q||''} onChange={e => { const arr = [...(ed?.faq_candidates||[])]; arr[i] = {...arr[i], q: e.target.value}; setField('faq_candidates', arr) }} placeholder={t('agent.question_placeholder')} className="flex-1 text-[11px] font-semibold bg-transparent outline-none" />
                                    <button onClick={() => { const arr = [...(ed?.faq_candidates||[])]; arr.splice(i,1); setField('faq_candidates', arr) }} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                                  </div>
                                  <textarea value={f.a||''} onChange={e => { const arr = [...(ed?.faq_candidates||[])]; arr[i] = {...arr[i], a: e.target.value}; setField('faq_candidates', arr) }} placeholder="Răspuns" className="w-full text-[11px] text-neutral-600 bg-transparent outline-none resize-y min-h-[30px]" />
                                </div>
                              ))}
                              <button onClick={() => setField('faq_candidates', [...(ed?.faq_candidates||[]), {q:'',a:''}])} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">{t('agent.intel_add_faq')}</button>
                            </div>
                          ) : (
                            <div className="space-y-2">{(p.faq_candidates||[]).map((f: any, i: number) => (
                              <div key={i} className="bg-white rounded-lg p-3 border border-neutral-100">
                                <p className="text-[11px] font-semibold text-neutral-900 mb-1">{f.q}</p>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">{f.a}</p>
                              </div>
                            ))}</div>
                          )}
                        </div>
                      )}
                    </div>
                    )
                  })()}
                  {intelExpanded === p.id && p.intel_status !== 'ready' && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 text-center">
                      <p className="text-[12px] text-neutral-400">{p.intel_status === 'failed' ? 'Generarea a eșuat. Selectează produsul și regenerează.' : p.intel_status === 'processing' ? 'Se procesează...' : 'Intelligence-ul nu a fost generat încă. Selectează produsul și apasă Generează.'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 mt-3">{t('agent.intel_cost')}</p>
          </Card>
        </div>
        )
      })()}

      {/* ─── NOTIFICATIONS ─── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <p className="text-[13px] font-semibold text-neutral-900">{t('agent.notif_email_title')}</p>
            </div>
            <p className="text-[12px] text-neutral-500">{t('agent.notif_email_desc')}</p>
            <div>
              <SectionLabel className="mb-1.5 block">{t('agent.notif_email_label')}</SectionLabel>
              <input value={config.notify_email||''} onChange={e => setConfig(c => ({ ...c, notify_email:e.target.value }))} type="email" placeholder="tu@magazin.ro"
                className="w-full text-[13px] border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 transition-colors" />
            </div>
            <div className="space-y-2">
              {[
                { key:'notify_on_escalation', label:t('agent.notif_client_human'), desc:t('agent.notif_client_human_desc') },
                { key:'notify_on_problem',    label:t('agent.notif_order_problem'),      desc:t('agent.notif_order_problem_desc') },
              ].map(({ key, label, desc }) => (
                <div key={key} onClick={() => setConfig(c => ({ ...c, [key]:!(c as any)[key] }))}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-[12px] font-medium text-neutral-800">{label}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{desc}</p>
                  </div>
                  <Toggle on={(config as any)[key]} onToggle={() => setConfig(c => ({ ...c, [key]:!(c as any)[key] }))} />
                </div>
              ))}
            </div>
            {!config.notify_email
              ? <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl"><AlertCircle className="h-4 w-4 text-amber-500 shrink-0" /><p className="text-[11px] text-amber-700">{t('agent.notif_add_email')}</p></div>
              : <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl"><Check className="h-4 w-4 text-emerald-600 shrink-0" /><p className="text-[11px] text-emerald-700">Notificările vor fi trimise la <strong>{config.notify_email}</strong></p></div>}
            <Btn onClick={handleSave} disabled={saving} variant={saved?'success':'primary'} className="w-full justify-center h-10">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
            </Btn>
          </Card>
          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <Bell className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">{t('agent.notif_how_works')}</p>
          </div>
        </div>
      )}

      {/* ─── KNOWLEDGE ─── */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <p className="text-[13px] font-semibold text-neutral-900">{t('agent.knowledge_title')}</p>
            </div>
            <p className="text-[11px] text-neutral-500 mb-4">{t('agent.knowledge_desc')}</p>
            <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-4">
              {([['file',t('agent.knowledge_type_file')],['url',t('agent.knowledge_type_url')],['text',t('agent.knowledge_type_text')]] as const).map(([tp,label]) => (
                <button key={tp} onClick={() => setKUploadType(tp)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${kUploadType===tp?'bg-white text-neutral-900 shadow-sm':'text-neutral-500 hover:text-neutral-700'}`}>{label}</button>
              ))}
            </div>
            <div className="space-y-3">
              <input value={kName} onChange={e => setKName(e.target.value)} placeholder={t('agent.doc_name_optional')}
                className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />
              {kUploadType==='file' && (
                <div onClick={() => kFileRef.current?.click()} className="border-2 border-dashed border-neutral-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <Upload className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
                  <p className="text-[11px] text-neutral-500">{t('agent.knowledge_drop')}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">{t('agent.knowledge_formats')}</p>
                  <input ref={kFileRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) uploadKnowledge(f); e.target.value='' }} />
                </div>
              )}
              {kUploadType==='url' && <input value={kUrl} onChange={e => setKUrl(e.target.value)} placeholder="https://magazin.ro/politica-retur" className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors" />}
              {kUploadType==='text' && <textarea value={kText} onChange={e => setKText(e.target.value)} rows={5} placeholder="Ex: Livrăm în 24-48h prin Fan Courier..." className="w-full text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 transition-colors resize-none" />}
              {kError && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{kError}</p>}
              {(kUploadType==='url'||kUploadType==='text') && (
                <Btn onClick={() => uploadKnowledge()} disabled={kUploading||(!kUrl&&!kText)} className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-[12px]">
                  {kUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('agent.knowledge_processing')}</> : <><PlusCircle className="h-3.5 w-3.5" />{t('agent.knowledge_add')}</>}
                </Btn>
              )}
              {kUploading && kUploadType==='file' && <div className="flex items-center gap-2 text-[11px] text-blue-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('agent.knowledge_processing_doc')}</div>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-neutral-400" /><p className="text-[13px] font-semibold text-neutral-900">Documente ({knowledgeDocs.length})</p></div>
              <Btn variant="ghost" size="sm" onClick={loadKnowledge}>{t('agent.knowledge_refresh')}</Btn>
            </div>
            {knowledgeDocs.length === 0
              ? <div className="text-center py-8"><BookOpen className="h-10 w-10 text-neutral-200 mx-auto mb-3" /><p className="text-[12px] text-neutral-400">{t('agent.knowledge_empty')}</p></div>
              : <div className="space-y-2">
                  {knowledgeDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors group">
                      <div className="shrink-0">
                        {doc.type==='pdf' ? <FileText className="h-4 w-4 text-red-400" /> : doc.type==='url' ? <Link2 className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-neutral-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-neutral-800 truncate">{doc.name}</p>
                        <p className="text-[10px] text-neutral-400">{doc.status==='ready'?`${doc.chunk_count} segmente`:doc.status==='processing'?'Se procesează...':doc.error_msg||'Eroare'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.status==='ready' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        {doc.status==='processing' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                        {doc.status==='error' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        <button onClick={() => deleteKnowledge(doc.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg transition-all">
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>}
          </Card>
          <div className="flex gap-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <BookOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">{t('agent.knowledge_hint')} Agentul va cita informațiile relevante automat.</p>
          </div>
        </div>
      )}

      {/* ─── INSTALL ─── */}
      {activeTab === 'install' && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-neutral-900 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-2xl">🔌</div>
                <div>
                  <p className="text-white font-semibold text-[15px]">{t('agent.install_wp_title')}</p>
                  <p className="text-neutral-400 text-[12px] mt-1">{t('agent.install_wp_desc')}</p>
                </div>
              </div>
              <a href="/settings?tab=plugin" className="mt-5 w-full bg-blue-500 hover:bg-blue-400 text-white rounded-xl h-10 gap-2 font-semibold text-[13px] flex items-center justify-center transition-colors">
                <ArrowUpRight className="h-4 w-4" />Descarcă din Setări → Plugin WP
              </a>
            </div>
            <div className="p-5 space-y-3">
              {[{ step:'1',text:t('agent.install_step1_text') },{ step:'2',text:t('agent.install_step2_text') },{ step:'3',text:t('agent.install_step3_text') },{ step:'4',text:t('agent.install_step4_text') }].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">{s.step}</div>
                  <p className="text-[13px] text-neutral-700">{s.text}</p>
                </div>
              ))}
            </div>
          </Card>
          <details className="group">
            <summary className="cursor-pointer text-[12px] text-neutral-400 hover:text-neutral-600 flex items-center gap-2 select-none">
              <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />Instalare manuală (cod snippet)
            </summary>
            <Card className="overflow-hidden mt-2">
              <div className="bg-neutral-900 p-4">
                <div className="bg-black/30 rounded-xl p-3 font-mono text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap">{snippetCode}</div>
                <Btn onClick={copySnippet} variant={copied?'success':'ghost'} size="sm" className="mt-3">
                  {copied ? <><Check className="h-3 w-3" />{t('agent.copied_code')}</> : <><Copy className="h-3 w-3" />{t('agent.copy_code_btn')}</>}
                </Btn>
              </div>
            </Card>
          </details>
          {!config.whatsapp_number && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-amber-800">{t('agent.whatsapp_missing')}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">{t('agent.whatsapp_missing_desc')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}