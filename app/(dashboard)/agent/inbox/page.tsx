'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Search, Filter, Star, Archive, ChevronRight, Loader2, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  buying_ready:  { label: 'Gata să cumpere', color: 'bg-green-100 text-green-700' },
  browsing:      { label: 'Navighează', color: 'bg-gray-100 text-gray-600' },
  comparing:     { label: 'Compară', color: 'bg-blue-100 text-blue-700' },
  info_shipping: { label: 'Livrare', color: 'bg-purple-100 text-purple-700' },
  escalate:      { label: 'Escaladare', color: 'bg-red-100 text-red-700' },
  problem:       { label: 'Problemă', color: 'bg-orange-100 text-orange-700' },
  order_tracking:{ label: 'Urmărire comandă', color: 'bg-yellow-100 text-yellow-700' },
  off_topic:     { label: 'Offtopic', color: 'bg-gray-100 text-gray-500' },
  greeting:      { label: 'Salut', color: 'bg-sky-100 text-sky-600' },
}

type Conversation = {
  session_id: string; visitor_id: string; messages_count: number
  intents: string[]; dominant_intent: string; is_escalated: boolean
  preview: string; started_at: string; ended_at: string
  starred: boolean; messages: Array<{ role: string; content: string }>
}

export default function InboxPage() {
  const [convs, setConvs] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [intentFilter, setIntentFilter] = useState('')
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: String(days), page: String(page) })
      if (search) params.set('search', search)
      if (intentFilter) params.set('intent', intentFilter)
      const r = await fetch(`/api/agent/inbox?${params}`)
      const data = await r.json()
      setConvs(data.conversations || [])
      setTotal(data.total || 0)
    } catch {} finally { setLoading(false) }
  }, [days, page, search, intentFilter])

  useEffect(() => { load() }, [load])

  const toggleStar = async (c: Conversation) => {
    await fetch('/api/agent/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: c.session_id, starred: !c.starred }) })
    setConvs(prev => prev.map(x => x.session_id === c.session_id ? { ...x, starred: !x.starred } : x))
    if (selected?.session_id === c.session_id) setSelected(s => s ? { ...s, starred: !s.starred } : s)
  }

  const archive = async (c: Conversation) => {
    await fetch('/api/agent/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: c.session_id, archived: true }) })
    setConvs(prev => prev.filter(x => x.session_id !== c.session_id))
    if (selected?.session_id === c.session_id) setSelected(null)
  }

  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 3600) return `acum ${Math.floor(diff / 60)}m`
    if (diff < 86400) return `acum ${Math.floor(diff / 3600)}h`
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Inbox conversații</h1><p className="text-sm text-gray-500 mt-0.5">{total} conversații în ultimele {days} zile</p></div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"><RefreshCw className="h-3.5 w-3.5" />Actualizează</button>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Caută în conversații..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={intentFilter} onChange={e => { setIntentFilter(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Toate intențiile</option>
          {Object.entries(INTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(1) }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value={7}>7 zile</option>
          <option value={30}>30 zile</option>
          <option value={90}>90 zile</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : convs.length === 0 ? (
              <div className="text-center py-16"><MessageCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" /><p className="text-sm text-gray-400">Nicio conversație găsită</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {convs.map(c => {
                  const meta = INTENT_LABELS[c.dominant_intent] || INTENT_LABELS.browsing
                  return (
                    <div key={c.session_id} onClick={() => setSelected(c)}
                      className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.session_id === c.session_id ? 'bg-blue-50' : ''}`}>
                      <div className="shrink-0 mt-0.5">
                        {c.is_escalated
                          ? <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-red-500" /></div>
                          : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><MessageCircle className="h-4 w-4 text-gray-400" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                          <span className="text-xs text-gray-400 shrink-0">{fmt(c.started_at)}</span>
                        </div>
                        <p className="text-xs text-gray-600 truncate">{c.preview || 'Conversație fără mesaje'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.messages_count} mesaje</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); toggleStar(c) }} className="p-1 hover:bg-gray-100 rounded-lg">
                          <Star className={`h-3.5 w-3.5 ${c.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        </button>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Paginare */}
            {total > 20 && (
              <div className="flex items-center justify-between p-3 border-t border-gray-50">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-gray-500 disabled:opacity-40 hover:text-gray-700">← Anterior</button>
                <span className="text-xs text-gray-400">Pagina {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={convs.length < 20} className="text-xs text-gray-500 disabled:opacity-40 hover:text-gray-700">Următor →</button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detaliu conversație */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            {!selected ? (
              <div className="text-center py-16">
                <MessageCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Selectează o conversație</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Conversație {selected.session_id.slice(-8)}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{new Date(selected.started_at).toLocaleString('ro-RO')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStar(selected)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <Star className={`h-4 w-4 ${selected.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />
                    </button>
                    <button onClick={() => archive(selected)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <Archive className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[...new Set(selected.intents)].map(i => {
                    const m = INTENT_LABELS[i]
                    return m ? <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.color}`}>{m.label}</span> : null
                  })}
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selected.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {selected.messages.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Mesajele nu sunt disponibile</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}