'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Search, Star, Archive, ChevronRight, Loader2, AlertTriangle, Clock, RefreshCw, X } from 'lucide-react'

const getIntentMeta = (t: (k: string, p?: Record<string, string | number>) => string): Record<string, { label: string; bg: string; text: string }> => ({
  buying_ready:  { label:t('agent.intent_buying_ready'), bg:'bg-emerald-100', text:'text-emerald-700' },
  browsing:      { label:t('agent.intent_browsing'),      bg:'bg-neutral-100', text:'text-neutral-600' },
  comparing:     { label:t('agent.intent_comparing'),         bg:'bg-blue-100',    text:'text-blue-700'    },
  info_shipping: { label:t('agent.intent_info_shipping'),         bg:'bg-violet-100',  text:'text-violet-700'  },
  escalate:      { label:t('agent.intent_escalate'),      bg:'bg-red-100',     text:'text-red-700'     },
  problem:       { label:t('agent.intent_problem'),        bg:'bg-orange-100',  text:'text-orange-700'  },
  order_tracking:{ label:t('agent.intent_order_tracking'), bg:'bg-amber-100',   text:'text-amber-700'   },
  off_topic:     { label:'Offtopic',        bg:'bg-neutral-100', text:'text-neutral-500' },
  greeting:      { label:t('agent.intent_greeting'),           bg:'bg-sky-100',     text:'text-sky-600'     },
})

type Conversation = {
  session_id: string; visitor_id: string; messages_count: number
  intents: string[]; dominant_intent: string; is_escalated: boolean
  preview: string; started_at: string; ended_at: string
  starred: boolean; messages: Array<{ role: string; content: string }>
}

function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`} onClick={onClick}>{children}</div>
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${bg} ${text}`}>{label}</span>
}

export default function InboxPage() {
  const { t } = useT()
  const INTENT_META = getIntentMeta(t)
  const [convs, setConvs]               = useState<Conversation[]>([])
  const [selected, setSelected]         = useState<Conversation | null>(null)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [intentFilter, setIntentFilter] = useState('')
  const [days, setDays]                 = useState(30)
  const [page, setPage]                 = useState(1)
  const [total, setTotal]               = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: String(days), page: String(page) })
      if (search) params.set('search', search)
      if (intentFilter) params.set('intent', intentFilter)
      const r    = await fetch(`/api/agent/inbox?${params}`)
      const data = await r.json()
      setConvs(data.conversations || [])
      setTotal(data.total || 0)
    } catch {} finally { setLoading(false) }
  }, [days, page, search, intentFilter])

  useEffect(() => { load() }, [load])

  const toggleStar = async (c: Conversation) => {
    await fetch('/api/agent/inbox', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:c.session_id, starred:!c.starred }) })
    setConvs(prev => prev.map(x => x.session_id===c.session_id ? {...x,starred:!x.starred} : x))
    if (selected?.session_id===c.session_id) setSelected(s => s ? {...s,starred:!s.starred} : s)
  }

  const archive = async (c: Conversation) => {
    await fetch('/api/agent/inbox', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:c.session_id, archived:true }) })
    setConvs(prev => prev.filter(x => x.session_id!==c.session_id))
    if (selected?.session_id===c.session_id) setSelected(null)
  }

  const fmt = (iso: string) => {
    if (!iso) return ''
    const d    = new Date(iso)
    const diff = Math.floor((Date.now()-d.getTime())/1000)
    if (diff < 3600)  return `acum ${Math.floor(diff/60)}m`
    if (diff < 86400) return `acum ${Math.floor(diff/3600)}h`
    return d.toLocaleDateString('ro-RO', { day:'numeric', month:'short' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('agent.inbox_title')}</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">{t('agent.conversations_in_days', { total: String(total), days: String(days) })}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-neutral-100">
          <RefreshCw className="h-3.5 w-3.5" />{t('agent.update_stats')}
        </button>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('agent.search_conversations')}
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 transition-colors" />
        </div>
        <select value={intentFilter} onChange={e => { setIntentFilter(e.target.value); setPage(1) }}
          className="text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 bg-white text-neutral-600">
          <option value="">{t('common.all')}</option>
          {Object.entries(INTENT_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
          className="text-[12px] border border-neutral-200 rounded-xl px-3 py-2 focus:outline-none focus:border-neutral-400 bg-white text-neutral-600">
          <option value={7}>7 zile</option>
          <option value={30}>30 zile</option>
          <option value={90}>90 zile</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-200" /></div>
          ) : convs.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-[13px] text-neutral-400">{t('agent.no_conversations')}</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {convs.map(c => {
                const meta = INTENT_META[c.dominant_intent] || INTENT_META.browsing
                return (
                  <div key={c.session_id} onClick={() => setSelected(c)}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selected?.session_id===c.session_id ? 'bg-blue-50' : 'hover:bg-neutral-50'}`}>
                    <div className="shrink-0 mt-0.5">
                      {c.is_escalated
                        ? <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /></div>
                        : <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center"><MessageCircle className="h-3.5 w-3.5 text-neutral-400" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge label={meta.label} bg={meta.bg} text={meta.text} />
                        <span className="text-[10px] text-neutral-400 shrink-0">{fmt(c.started_at)}</span>
                      </div>
                      <p className="text-[12px] text-neutral-600 truncate">{c.preview || t('agent.conversation_no_msg')}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{c.messages_count} mesaje</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button onClick={e => { e.stopPropagation(); toggleStar(c) }} className="p-1 hover:bg-neutral-100 rounded-lg transition-colors">
                        <Star className={`h-3.5 w-3.5 ${c.starred ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'}`} />
                      </button>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-200" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {total > 20 && (
            <div className="flex items-center justify-between p-3 border-t border-neutral-50">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="text-[11px] text-neutral-500 disabled:opacity-40 hover:text-neutral-700">← Anterior</button>
              <span className="text-[11px] text-neutral-400">Pagina {page}</span>
              <button onClick={() => setPage(p => p+1)} disabled={convs.length<20} className="text-[11px] text-neutral-500 disabled:opacity-40 hover:text-neutral-700">{t('common.next_label')}</button>
            </div>
          )}
        </Card>

        {/* Detaliu */}
        <Card className="p-5">
          {!selected ? (
            <div className="text-center py-16">
              <MessageCircle className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-[13px] text-neutral-400">{t('agent.no_conversations')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-neutral-700">#{selected.session_id.slice(-8)}</p>
                  <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />{new Date(selected.started_at).toLocaleString('ro-RO')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleStar(selected)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                    <Star className={`h-4 w-4 ${selected.starred ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'}`} />
                  </button>
                  <button onClick={() => archive(selected)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                    <Archive className="h-4 w-4 text-neutral-400" />
                  </button>
                  <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors lg:hidden">
                    <X className="h-4 w-4 text-neutral-400" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {[...new Set(selected.intents)].map(i => {
                  const m = INTENT_META[i]
                  return m ? <Badge key={i} label={m.label} bg={m.bg} text={m.text} /> : null
                })}
                {selected.is_escalated && <Badge label={`⚠️ ${t('agent.intent_escalate')}`} bg="bg-red-100" text="text-red-700" />}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {selected.messages.length === 0
                  ? <p className="text-[11px] text-neutral-400 text-center py-4">{t('agent.no_conversations')}</p>
                  : selected.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${m.role==='user' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))
                }
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-neutral-100">
                <div className="text-center">
                  <p className="text-[16px] font-bold text-neutral-900 tabular-nums">{selected.messages_count}</p>
                  <p className="text-[9px] text-neutral-400 uppercase tracking-wide">mesaje</p>
                </div>
                <div className="h-6 w-px bg-neutral-100" />
                <div className="text-center">
                  <p className="text-[16px] font-bold text-neutral-900 tabular-nums">{selected.intents.length}</p>
                  <p className="text-[9px] text-neutral-400 uppercase tracking-wide">intenții</p>
                </div>
                {selected.is_escalated && (
                  <>
                    <div className="h-6 w-px bg-neutral-100" />
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-[11px] font-medium text-red-600">{t('agent.escalated')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}