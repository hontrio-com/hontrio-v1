'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, ArrowLeft, Send, Loader2, Clock,
  CheckCircle, AlertCircle, ChevronRight, HelpCircle, Bug,
  Lightbulb, CreditCard, Link2, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type Ticket = {
  id: string; subject: string; message: string; status: string
  priority: string; category: string; created_at: string; updated_at: string
}
type Reply = {
  id: string; message: string; is_admin: boolean; created_at: string
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Deschis', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  in_progress: { label: 'În lucru', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'Rezolvat', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Închis', color: 'bg-gray-100 text-gray-500', icon: CheckCircle },
}

const categoryConfig: Record<string, { label: string; icon: any }> = {
  general: { label: 'General', icon: HelpCircle },
  bug: { label: 'Bug / Eroare', icon: Bug },
  feature: { label: 'Sugestie', icon: Lightbulb },
  billing: { label: 'Facturare', icon: CreditCard },
  integration: { label: 'Integrare', icon: Link2 },
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [statusFilter, setStatusFilter] = useState('all')

  // Create form
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [creating, setCreating] = useState(false)

  // Reply
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { fetchTickets() }, [])

  async function fetchTickets() {
    try {
      const res = await fetch('/api/tickets')
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch {} finally { setLoading(false) }
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, category, priority }),
      })
      if (res.ok) {
        setSubject(''); setMessage(''); setCategory('general'); setPriority('normal')
        setView('list')
        fetchTickets()
      }
    } catch {} finally { setCreating(false) }
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket)
    setView('detail')
    try {
      const res = await fetch('/api/tickets/' + ticket.id)
      const data = await res.json()
      setReplies(data.replies || [])
    } catch {}
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedTicket) return
    setSending(true)
    try {
      const res = await fetch('/api/tickets/' + selectedTicket.id + '/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      if (res.ok) {
        const data = await res.json()
        setReplies(prev => [...prev, data.reply])
        setReplyText('')
      }
    } catch {} finally { setSending(false) }
  }

  const filteredTickets = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
    </div>
  )

  // ===== CREATE VIEW =====
  if (view === 'create') return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />Înapoi la tichete
      </button>
      <h1 className="text-2xl font-bold text-gray-900">Tichet nou</h1>
      <form onSubmit={createTicket} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Subiect</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Descrie pe scurt problema..." className="rounded-xl" required maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Categorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm">
              {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Prioritate</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm">
              <option value="low">Scăzută</option>
              <option value="normal">Normală</option>
              <option value="high">Ridicată</option>
              <option value="urgent">Urgentă</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Mesaj</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Descrie detaliat problema sau întrebarea ta..." className="w-full h-40 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-300" required maxLength={5000} />
          <p className="text-xs text-gray-400 mt-1">{message.length}/5000</p>
        </div>
        <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
          {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Se trimite...</> : <><Send className="h-4 w-4 mr-2" />Trimite tichetul</>}
        </Button>
      </form>
    </div>
  )

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selectedTicket) {
    const sc = statusConfig[selectedTicket.status] || statusConfig.open
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => { setView('list'); setSelectedTicket(null) }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />Înapoi la tichete
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h1>
            <p className="text-sm text-gray-500 mt-1">{formatDate(selectedTicket.created_at)}</p>
          </div>
          <Badge className={sc.color + ' text-xs'}>{sc.label}</Badge>
        </div>

        {/* Original message */}
        <Card className="rounded-2xl border-gray-100">
          <CardContent className="p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-3">
          {replies.map(reply => (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl ${reply.is_admin ? 'bg-blue-50 border border-blue-100 ml-4' : 'bg-white border border-gray-100 mr-4'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium ${reply.is_admin ? 'text-blue-600' : 'text-gray-500'}`}>
                  {reply.is_admin ? '🛡️ Echipa Hontrio' : '👤 Tu'}
                </span>
                <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
            </motion.div>
          ))}
        </div>

        {/* Reply box */}
        {selectedTicket.status !== 'closed' && (
          <div className="flex gap-3">
            <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Scrie un răspuns..." className="rounded-xl flex-1"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} maxLength={5000} />
            <Button onClick={sendReply} disabled={sending || !replyText.trim()} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suport</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tickets.length} tichete</p>
        </div>
        <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5">
          <Plus className="h-4 w-4 mr-2" />Tichet nou
        </Button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Toate' },
          { value: 'open', label: 'Deschise' },
          { value: 'in_progress', label: 'În lucru' },
          { value: 'resolved', label: 'Rezolvate' },
          { value: 'closed', label: 'Închise' },
        ].map(opt => (
          <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {opt.label} ({opt.value === 'all' ? tickets.length : tickets.filter(t => t.status === opt.value).length})
          </button>
        ))}
      </div>

      {/* Tickets list */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Niciun tichet</p>
          <p className="text-sm text-gray-400 mt-1">Creează un tichet dacă ai nevoie de ajutor</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map(ticket => {
            const sc = statusConfig[ticket.status] || statusConfig.open
            const cc = categoryConfig[ticket.category] || categoryConfig.general
            const StatusIcon = sc.icon
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => openTicket(ticket)}
                className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${sc.color}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${sc.color}`}>{sc.label}</Badge>
                    <span className="text-[11px] text-gray-400">{cc.label}</span>
                    <span className="text-[11px] text-gray-400">{formatDate(ticket.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}